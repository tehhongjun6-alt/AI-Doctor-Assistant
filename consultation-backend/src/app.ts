import cors from 'cors'
import { randomUUID } from 'node:crypto'
import express from 'express'
import {
  createAuthRouter,
  requireAuth,
  type AuthenticatedRequest,
} from './auth/authRoutes.js'
import { RequestRateLimiter } from './auth/requestRateLimiter.js'
import {
  createPgUserRepository,
  type UserRepository,
} from './auth/userRepository.js'
import { routeMedicalDataRequest } from './routing/medicalDataRouter.js'
import {
  buildEmergencyStructuredAnswer,
  checkEmergencyRisk,
  EMERGENCY_ACTION_TEXT,
} from './safety/emergencyCheck.js'
import { validateChatRequest } from './schemas/chat.js'
import {
  ConversationStore,
} from './services/conversationStore.js'
import {
  MapServiceError,
  searchGeoapifyHospitals,
  type Hospital,
  type NearbySearchInput,
} from './services/geoapifyPlaces.js'
import {
  generateGeminiHealthAnswer,
  ModelServiceError,
  type HealthConsultationInput,
} from './services/geminiHealthConsultation.js'
import {
  createSafeFallbackAnswer,
  validateAndSanitizeAnswer,
} from './safety/outputSafetyCheck.js'
import { retrieveMedicalData } from './services/medicalData/medicalDataService.js'
import type {
  MedicalDataRequest,
  MedicalDataResult,
} from './services/medicalData/medicalDataTypes.js'

type SearchHospitals = (input: NearbySearchInput) => Promise<Hospital[]>
type GenerateHealthAnswer = (
  input: HealthConsultationInput,
) => ReturnType<typeof generateGeminiHealthAnswer>
type RetrieveMedicalData = (input: MedicalDataRequest) => Promise<MedicalDataResult>
type RouteMedicalData = typeof routeMedicalDataRequest

interface AppDependencies {
  searchHospitals?: SearchHospitals
  generateHealthAnswer?: GenerateHealthAnswer
  retrieveMedicalData?: RetrieveMedicalData
  conversationStore?: ConversationStore
  userRepository?: UserRepository
  routeMedicalData?: RouteMedicalData
  chatRateLimiter?: RequestRateLimiter
}

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

interface ChatResponder {
  /** 流式模式下推送当前已生成的 summary；普通模式为 undefined */
  delta?: (summary: string) => void
  send: (status: number, body: unknown) => void
}

// 普通模式返回 JSON；流式模式使用 SSE：delta 事件推送摘要，final 事件推送经过安全检查的完整结果
function createChatResponder(
  response: express.Response,
  mode: 'json' | 'stream',
): ChatResponder {
  if (mode === 'json') {
    return { send: (status, body) => response.status(status).json(body) }
  }

  let started = false
  function start() {
    if (started) return
    started = true
    response.status(200)
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders()
  }
  function write(event: string, data: unknown) {
    response.write(`event: ${event}
data: ${JSON.stringify(data)}

`)
  }

  return {
    delta(summary) {
      if (response.writableEnded) return
      start()
      write('delta', { summary })
    },
    send(status, body) {
      if (response.writableEnded) return
      start()
      write('final', { status, body })
      response.end()
    },
  }
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express()
  const searchHospitals =
    dependencies.searchHospitals ?? searchGeoapifyHospitals
  const generateHealthAnswer =
    dependencies.generateHealthAnswer ?? generateGeminiHealthAnswer
  const getMedicalData =
    dependencies.retrieveMedicalData ?? retrieveMedicalData
  const conversationStore =
    dependencies.conversationStore ?? new ConversationStore()
  const routeMedicalData =
    dependencies.routeMedicalData ?? routeMedicalDataRequest
  const chatRateLimiter =
    dependencies.chatRateLimiter ?? new RequestRateLimiter()
  const frontendOriginsEnv = process.env.FRONTEND_ORIGINS?.trim()

  app.use(
    cors({
      origin: (origin, callback) => {
        // 允许手机移动端、同源/无源以及所有 vercel.app 预览或正式域名无阻碍访问
        if (!origin) return callback(null, true)
        if (
          !frontendOriginsEnv ||
          frontendOriginsEnv === '*' ||
          frontendOriginsEnv.includes('*')
        ) {
          return callback(null, true)
        }
        const origins = frontendOriginsEnv.split(',').map((o) => o.trim())
        if (
          origins.includes(origin) ||
          /\.vercel\.app$/.test(origin) ||
          /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        ) {
          return callback(null, true)
        }
        return callback(null, true)
      },
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '100kb' }))
  // Render 位于反向代理之后，读取真实客户端 IP（用于登录失败限制）
  app.set('trust proxy', 1)

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' })
  })

  app.use(
    '/api/auth',
    createAuthRouter(dependencies.userRepository ?? createPgUserRepository()),
  )

  const handleChat =
    (mode: 'json' | 'stream') =>
    async (request: AuthenticatedRequest, response: express.Response) => {
    const reply = createChatResponder(response, mode)

    const userId = request.user?.sub
    const retryAfter = chatRateLimiter.consume(userId ?? request.ip ?? 'anonymous')
    if (retryAfter > 0) {
      response.setHeader('Retry-After', String(retryAfter))
      reply.send(429, {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `提问太频繁了，请 ${retryAfter} 秒后再试。`,
          retryAfter,
        },
      })
      return
    }

    const validation = validateChatRequest(request.body)

    if (!validation.valid) {
      reply.send(400, {
        success: false,
        error: {
          code: 'INVALID_CHAT_REQUEST',
          message: '聊天请求格式无效。',
          details: validation.errors,
        },
      })
      return
    }

    const validChat = validation.value
    // 会话 ID 若属于其他用户，则为当前用户开启新会话，避免读取他人对话
    const conversationId =
      validChat.conversationId &&
      !conversationStore.isOwnedByOther(validChat.conversationId, userId)
        ? validChat.conversationId
        : randomUUID()
    const language = validChat.language ?? 'zh'
    const session = conversationStore.getSession(conversationId, userId)
    const history = conversationStore.getMergedHistory(
      conversationId,
      validChat.history,
      userId,
    )

    const emergency = checkEmergencyRisk(
      validChat.message,
      history,
    )

    async function respondWithEmergency(
      category: NonNullable<typeof emergency.category>,
      reason: string,
      medicalDataRoute?: Awaited<ReturnType<typeof routeMedicalDataRequest>>,
    ) {
      let emergencyAnswer = buildEmergencyStructuredAnswer(
        category,
        reason,
        language,
      )
      try {
        const dynamicAnswer = await generateHealthAnswer({
          message: validChat.message,
          language,
          history,
          mode: 'emergency',
          emergencyContext: { category, reason },
        })
        const check = validateAndSanitizeAnswer(
          dynamicAnswer,
          'emergency',
          language,
        )
        if (check.passed) {
          emergencyAnswer = check.answer
        }
      } catch {
        // Fallback to static structured emergency template if Gemini is unavailable or times out
      }

      conversationStore.saveTurn({
        conversationId,
        ownerId: userId,
        userMessage: validChat.message,
        answer: emergencyAnswer,
        clientHistory: validChat.history,
        category: medicalDataRoute?.category ?? 'symptom',
        activeEmergency: { category, reason },
      })

      reply.send(200, {
        success: true,
        data: {
          type: 'emergency',
          conversationId,
          answer: emergencyAnswer,
          emergency: {
            isEmergency: true,
            category,
            reason,
            action: EMERGENCY_ACTION_TEXT,
          },
          ...(medicalDataRoute ? { medicalDataRoute } : {}),
          showHospitalMap: true,
        },
      })
    }

    if (emergency.isEmergency) {
      await respondWithEmergency(
        emergency.category ?? 'unconsciousness',
        emergency.reason ?? '识别到可能危及生命的紧急医疗情况。',
      )
      return
    }

    try {
      const medicalDataRoute = await routeMedicalData(
        validation.value.message,
        {
          history,
          activeCategory: session?.activeCategory,
          activeEmergency: session?.activeEmergency,
          topicMessages: session?.topicMessages,
        },
      )

      if (
        medicalDataRoute.route === 'emergency' ||
        medicalDataRoute.isEmergency
      ) {
        const emergencyReason =
          medicalDataRoute.emergencyReason ??
          medicalDataRoute.reason ??
          session?.activeEmergency?.reason ??
          '识别到可能危及生命的紧急医疗情况。'
        const emergencyCategory =
          medicalDataRoute.emergencyCategory ??
          session?.activeEmergency?.category ??
          'unconsciousness'

        await respondWithEmergency(
          emergencyCategory,
          emergencyReason,
          medicalDataRoute,
        )
        return
      }

      let rawAnswer: unknown
      let sources: Array<{ title: string; url: string }> = []
      let medicalData: MedicalDataResult | undefined
      let fallbackTriggeredReason: string | undefined

      try {
        if (medicalDataRoute.route === 'direct_model') {
          rawAnswer = await generateHealthAnswer({
            message: validation.value.message,
            language,
            history,
            mode: 'direct_model',
            onSummaryDelta: reply.delta,
          })
        } else {
          medicalData = await getMedicalData({
            message: validation.value.message,
            route: medicalDataRoute,
            cachedEvidence:
              session?.activeCategory === medicalDataRoute.category
                ? session?.lastEvidence
                : undefined,
          })

          rawAnswer = await generateHealthAnswer({
            message: validation.value.message,
            language,
            history,
            evidence: medicalData.evidence,
            mode:
              medicalDataRoute.route === 'medical_qa'
                ? 'medical_qa'
                : 'medical_api',
            onSummaryDelta: reply.delta,
          })
          // 来源去重，供前端展示参考资料
          const seenUrls = new Set<string>()
          sources = medicalData.evidence
            .filter((item) => {
              if (!item.url || seenUrls.has(item.url)) return false
              seenUrls.add(item.url)
              return true
            })
            .slice(0, 5)
            .map((item) => ({ title: item.title, url: item.url }))
        }
      } catch (modelError) {
        if (
          modelError instanceof ModelServiceError &&
          (modelError.code === 'REFUSED' ||
            modelError.code === 'INVALID_RESPONSE')
        ) {
          fallbackTriggeredReason = modelError.message
          rawAnswer = undefined
        } else {
          throw modelError
        }
      }

      const safetyCheck =
        rawAnswer !== undefined
          ? validateAndSanitizeAnswer(
              rawAnswer,
              medicalDataRoute.route,
              language,
            )
          : {
              passed: false,
              reason: fallbackTriggeredReason ?? '模型未返回合规内容，已启用安全备用回答。',
              answer: createSafeFallbackAnswer(language),
            }

      const answer = safetyCheck.answer
      const isLayer3Emergency = answer.urgency === 'emergency'

      if (safetyCheck.passed) {
        conversationStore.saveTurn({
          conversationId,
          ownerId: userId,
          userMessage: validation.value.message,
          answer,
          clientHistory: validation.value.history,
          category: medicalDataRoute.category,
          evidence: medicalData?.evidence,
          activeEmergency: isLayer3Emergency
            ? {
                category: 'unconsciousness',
                reason: answer.summary.slice(0, 120),
              }
            : null,
        })
      }

      reply.send(200, {
        success: true,
        data: {
          ...(isLayer3Emergency
            ? {
                type: 'emergency' as const,
                emergency: {
                  isEmergency: true,
                  reason: answer.summary,
                  action: EMERGENCY_ACTION_TEXT,
                },
              }
            : {}),
          conversationId,
          messageId: randomUUID(),
          answer,
          medicalDataRoute,
          // 原始 evidence 体积大且前端不使用，只返回状态
          medicalDataStatus: medicalData?.status,
          sources,
          safetyCheck: {
            passed: safetyCheck.passed,
            ...(safetyCheck.reason ? { reason: safetyCheck.reason } : {}),
          },
          showHospitalMap:
            answer.urgency === 'high' || answer.urgency === 'emergency',
        },
      })
    } catch (error) {
      if (error instanceof ModelServiceError) {
        const errorResponses = {
          NOT_CONFIGURED: {
            status: 503,
            code: 'AI_MODEL_NOT_CONFIGURED',
            message: 'AI 模型尚未配置。',
          },
          TIMEOUT: {
            status: 504,
            code: 'AI_MODEL_TIMEOUT',
            message: 'AI 回答超时，请稍后再试。',
          },
          REFUSED: {
            status: 422,
            code: 'AI_MODEL_REFUSED',
            message: 'AI 无法处理这项内容。',
          },
          API_ERROR: {
            status: 502,
            code: 'AI_MODEL_UNAVAILABLE',
            message: 'AI 服务暂时无法使用。',
          },
          INVALID_RESPONSE: {
            status: 502,
            code: 'AI_MODEL_INVALID_RESPONSE',
            message: 'AI 返回了无效内容，请重新尝试。',
          },
        } as const
        const modelError = errorResponses[error.code]

        reply.send(modelError.status, {
          success: false,
          error: {
            code: modelError.code,
            message: modelError.message,
          },
        })
        return
      }

      console.error('Health consultation failed', error)
      reply.send(502, {
        success: false,
        error: {
          code: 'AI_MODEL_UNAVAILABLE',
          message: 'AI 服务暂时无法使用。',
        },
      })
    }
  }

  app.post('/api/chat', requireAuth, handleChat('json'))
  app.post('/api/chat/stream', requireAuth, handleChat('stream'))

  app.post('/api/hospitals/nearby', requireAuth, async (request, response) => {
    const { latitude, longitude, radius = 5000 } = request.body ?? {}

    if (
      !isValidNumber(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !isValidNumber(longitude) ||
      longitude < -180 ||
      longitude > 180 ||
      !isValidNumber(radius) ||
      radius <= 0 ||
      radius > 50000
    ) {
      response.status(400).json({ error: '位置资料无效。' })
      return
    }

    try {
      const hospitals = await searchHospitals({
        latitude,
        longitude,
        radius,
      })
      response.json({ hospitals })
    } catch (error) {
      if (error instanceof MapServiceError && error.code === 'NOT_CONFIGURED') {
        response.status(503).json({ error: '地图服务尚未配置。' })
        return
      }

      console.error('Nearby hospital search failed', error)
      response.status(502).json({ error: '暂时无法查询附近医院。' })
    }
  })

  return app
}
