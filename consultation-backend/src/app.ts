import cors from 'cors'
import { randomUUID } from 'node:crypto'
import express from 'express'
import {
  createAuthRouter,
  requireAuth,
  type AuthenticatedRequest,
} from './auth/authRoutes.js'
import { RequestRateLimiter } from './auth/requestRateLimiter.js'
import { LoginRateLimiter } from './auth/loginRateLimiter.js'
import { verifyPassword } from './auth/password.js'
import {
  createPgUserRepository,
  type UserRepository,
} from './auth/userRepository.js'
import { routeMedicalDataRequest } from './routing/medicalDataRouter.js'
import {
  createCaseSummarizer,
  type CaseSummary,
  type SummarizeCaseInput,
} from './services/caseSummary.js'
import {
  buildEmergencyStructuredAnswer,
  checkEmergencyRisk,
  EMERGENCY_ACTION_TEXT,
} from './safety/emergencyCheck.js'
import { validateChatRequest, type ChatHistoryMessage } from './schemas/chat.js'
import {
  createMemoryConversationRepository,
  createPgConversationRepository,
  type ConversationRepository,
  type ConversationState,
  MAX_CONVERSATIONS_PER_USER,
  MAX_MESSAGES_PER_CONVERSATION,
} from './services/conversationRepository.js'
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
import { createStageTimer } from './services/stageTimer.js'
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
type SummarizeCase = (input: SummarizeCaseInput) => Promise<CaseSummary>

interface AppDependencies {
  searchHospitals?: SearchHospitals
  generateHealthAnswer?: GenerateHealthAnswer
  retrieveMedicalData?: RetrieveMedicalData
  conversationRepository?: ConversationRepository
  userRepository?: UserRepository
  routeMedicalData?: RouteMedicalData
  chatRateLimiter?: RequestRateLimiter
  summarizeCase?: SummarizeCase
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

let dbWarned = false
function getDefaultConversationRepository(): ConversationRepository {
  if (process.env.DATABASE_URL) {
    return createPgConversationRepository(process.env.DATABASE_URL)
  }
  if (!dbWarned) {
    dbWarned = true
    console.warn(
      '[conversationRepository] DATABASE_URL not set, falling back to memory repository',
    )
  }
  return createMemoryConversationRepository()
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express()
  const searchHospitals =
    dependencies.searchHospitals ?? searchGeoapifyHospitals
  const generateHealthAnswer =
    dependencies.generateHealthAnswer ?? generateGeminiHealthAnswer
  const getMedicalData =
    dependencies.retrieveMedicalData ?? retrieveMedicalData
  const conversationRepository =
    dependencies.conversationRepository ?? getDefaultConversationRepository()
  const routeMedicalData =
    dependencies.routeMedicalData ?? routeMedicalDataRequest
  const chatRateLimiter =
    dependencies.chatRateLimiter ?? new RequestRateLimiter()
  const summarizeCase =
    dependencies.summarizeCase ?? createCaseSummarizer()
  const frontendOriginsEnv = process.env.FRONTEND_ORIGINS?.trim()

  let lastDeleteExpiredAt = 0
  const ONE_HOUR_MS = 60 * 60 * 1000
  function maybeDeleteExpired() {
    const now = Date.now()
    if (now - lastDeleteExpiredAt >= ONE_HOUR_MS) {
      lastDeleteExpiredAt = now
      conversationRepository.deleteExpired().catch((err) => {
        console.error('Failed to cleanup expired conversations:', err)
      })
    }
  }

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

  const userRepository =
    dependencies.userRepository ?? createPgUserRepository()
  const deleteRateLimiter = new LoginRateLimiter()

  app.use('/api/auth', createAuthRouter(userRepository))

  // -------------------------------------------------------------------------
  // Delete Account API (Step 7)
  // -------------------------------------------------------------------------
  app.delete(
    '/api/account',
    requireAuth,
    async (request: AuthenticatedRequest, response) => {
      const userId = request.user?.sub
      const email = request.user?.email

      if (!userId || !email) {
        response.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '登录已过期，请重新登录。' },
        })
        return
      }

      const { password } = (request.body ?? {}) as Record<string, unknown>
      if (typeof password !== 'string' || !password) {
        response.status(400).json({
          success: false,
          error: { code: 'PASSWORD_REQUIRED', message: '请输入密码。' },
        })
        return
      }

      const limitKey = `delete:${userId}`
      const retryAfter = deleteRateLimiter.retryAfterSeconds(limitKey)
      if (retryAfter > 0) {
        response.setHeader('Retry-After', String(retryAfter))
        response.status(429).json({
          success: false,
          error: {
            code: 'TOO_MANY_ATTEMPTS',
            message: '尝试太多次，请稍后再试。',
          },
        })
        return
      }

      const user = await userRepository.findByEmail(email)
      if (!user || user.id !== userId) {
        response.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: '用户不存在。' },
        })
        return
      }

      const valid = await verifyPassword(password, user.passwordHash)
      if (!valid) {
        deleteRateLimiter.recordFailure(limitKey)
        response.status(401).json({
          success: false,
          error: { code: 'WRONG_PASSWORD', message: '密码不正确。' },
        })
        return
      }

      deleteRateLimiter.reset(limitKey)
      await conversationRepository.deleteAllForUser(userId)
      await userRepository.deleteById(userId)
      response.status(204).end()
    },
  )

  // -------------------------------------------------------------------------
  // Conversation Management API (Step 4c)
  // -------------------------------------------------------------------------
  app.get(
    '/api/conversations',
    requireAuth,
    async (request: AuthenticatedRequest, response) => {
      const userId = request.user?.sub
      if (!userId) {
        response.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '登录已过期，请重新登录。' },
        })
        return
      }
      maybeDeleteExpired()
      try {
        const conversations = await conversationRepository.listByUser(userId)
        response.json({
          conversations,
          limit: MAX_CONVERSATIONS_PER_USER,
        })
      } catch (error) {
        console.error('Failed to list conversations:', error)
        response.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: '获取对话列表失败。' },
        })
      }
    },
  )

  app.get(
    '/api/conversations/:id',
    requireAuth,
    async (request: AuthenticatedRequest, response) => {
      const userId = request.user?.sub
      if (!userId) {
        response.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '登录已过期，请重新登录。' },
        })
        return
      }
      const id = String(request.params.id)
      try {
        const conversation = await conversationRepository.get(id, userId)
        if (!conversation) {
          response.status(404).json({
            success: false,
            error: {
              code: 'CONVERSATION_NOT_FOUND',
              message: '对话不存在或已过期。',
            },
          })
          return
        }
        const messages =
          (await conversationRepository.getMessages(id, userId)) ?? []
        response.json({
          conversation: {
            id: conversation.id,
            title: conversation.title,
            messageCount: conversation.messageCount,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
          },
          messages,
        })
      } catch (error) {
        console.error('Failed to get conversation:', error)
        response.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: '获取对话详情失败。' },
        })
      }
    },
  )

  app.delete(
    '/api/conversations/:id',
    requireAuth,
    async (request: AuthenticatedRequest, response) => {
      const userId = request.user?.sub
      if (!userId) {
        response.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '登录已过期，请重新登录。' },
        })
        return
      }
      const id = String(request.params.id)
      try {
        const deleted = await conversationRepository.delete(id, userId)
        if (!deleted) {
          response.status(404).json({
            success: false,
            error: {
              code: 'CONVERSATION_NOT_FOUND',
              message: '对话不存在或无权删除。',
            },
          })
          return
        }
        response.status(204).end()
      } catch (error) {
        console.error('Failed to delete conversation:', error)
        response.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: '删除对话失败。' },
        })
      }
    },
  )

  // -------------------------------------------------------------------------
  // Visit Summary API (Step 8)
  // -------------------------------------------------------------------------
  app.post(
    '/api/conversations/:id/visit-summary',
    requireAuth,
    async (request: AuthenticatedRequest, response) => {
      const userId = request.user?.sub
      if (!userId) {
        response.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '登录已过期，请重新登录。' },
        })
        return
      }

      const id = String(request.params.id)
      const conversation = await conversationRepository.get(id, userId)
      if (!conversation) {
        response.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: '对话不存在或已过期。',
          },
        })
        return
      }

      const messages = await conversationRepository.getMessages(id, userId)
      const hasUserMessage = messages?.some((m) => m.role === 'user')
      if (!hasUserMessage) {
        response.status(409).json({
          success: false,
          error: {
            code: 'NOTHING_TO_SUMMARIZE',
            message: '没有可以生成就诊摘要的内容。',
          },
        })
        return
      }

      const retryAfter = chatRateLimiter.consume(userId)
      if (retryAfter > 0) {
        response.setHeader('Retry-After', String(retryAfter))
        response.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `请求太频繁，请 ${retryAfter} 秒后再试。`,
            retryAfter,
          },
        })
        return
      }

      const language = request.body?.language === 'en' ? 'en' : 'zh'
      const inputMessages = (messages ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      try {
        const summary = await summarizeCase({
          messages: inputMessages,
          language,
          purpose: 'visit',
        })

        response.status(200).json({
          success: true,
          data: {
            summary,
            generatedAt: new Date().toISOString(),
          },
        })
      } catch (error) {
        console.error('Visit summary generation failed', error)
        response.status(502).json({
          success: false,
          error: {
            code: 'AI_MODEL_UNAVAILABLE',
            message: 'AI 服务暂时无法使用，未能生成就诊摘要。',
          },
        })
      }
    },
  )

  // -------------------------------------------------------------------------
  // Chat Handler (JSON & SSE)
  // -------------------------------------------------------------------------
  const handleChat =
    (mode: 'json' | 'stream') =>
    async (request: AuthenticatedRequest, response: express.Response) => {
      const timer = createStageTimer()
      const reply = createChatResponder(response, mode)

      const userId = request.user?.sub
      if (!userId) {
        reply.send(401, {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '登录已过期，请重新登录。',
          },
        })
        return
      }
      const currentUserId: string = userId

      const retryAfter = chatRateLimiter.consume(userId)
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
      const language = validChat.language ?? 'zh'
      let chatMessage = validChat.message

      maybeDeleteExpired()

      let conversationId: string
      let activeConversation: ConversationState | null = null
      let history: ChatHistoryMessage[] = []

      if (!validChat.conversationId) {
        if (validChat.regenerate) {
          reply.send(400, {
            success: false,
            error: {
              code: 'INVALID_CHAT_REQUEST',
              message: '重新回答必须提供 conversationId。',
            },
          })
          return
        }
        const title = validChat.message.trim().slice(0, 15) || '新医疗咨询'
        const created = await conversationRepository.createIfUnderLimit(
          userId,
          title,
        )
        if (!created) {
          reply.send(409, {
            success: false,
            error: {
              code: 'CONVERSATION_LIMIT_REACHED',
              message: '对话已满（最多 3 个），请先删除一个。',
            },
          })
          return
        }
        conversationId = created.id
        activeConversation = await conversationRepository.get(
          conversationId,
          userId,
        )
        history = []
      } else {
        activeConversation = await conversationRepository.get(
          validChat.conversationId,
          userId,
        )
        if (!activeConversation) {
          reply.send(404, {
            success: false,
            error: {
              code: 'CONVERSATION_NOT_FOUND',
              message: '对话不存在或已过期。',
            },
          })
          return
        }
        conversationId = activeConversation.id

        if (validChat.regenerate) {
          const popped = await conversationRepository.popLastTurn(
            conversationId,
            userId,
          )
          if (!popped) {
            reply.send(409, {
              success: false,
              error: {
                code: 'NOTHING_TO_REGENERATE',
                message: '没有可以重新回答的内容。',
              },
            })
            return
          }
          chatMessage = popped.userMessage
        } else if (activeConversation.messageCount >= MAX_MESSAGES_PER_CONVERSATION) {
          reply.send(409, {
            success: false,
            error: {
              code: 'CONVERSATION_FULL',
              message: '这个对话已满 100 条，请开新对话。',
            },
          })
          return
        }

        history = await conversationRepository.getContextHistory(conversationId)
      }

      timer.mark('prepare')

      const emergency = checkEmergencyRisk(chatMessage, history)
      timer.mark('emergencyCheck')

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
            message: chatMessage,
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

        timer.mark('generate')

        await conversationRepository.appendTurn({
          conversationId,
          userId: currentUserId,
          userMessage: chatMessage,
          assistantAnswer: emergencyAnswer,
          category: medicalDataRoute?.category ?? 'symptom',
          searchQueries: medicalDataRoute?.searchQueries,
          activeEmergency: { category, reason },
          isEmergency: true,
          mapCareLevel: 'hospital',
          useForContext: true,
        })

        timer.mark('save')

        const route = 'emergency'
        console.log(
          '[chat-timing]',
          JSON.stringify({ conversationId, route, ...timer.result() }),
        )

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
            mapCareLevel: 'hospital',
            showHospitalMap: true,
            timings: timer.result(),
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
          chatMessage,
          {
            history,
            activeCategory: activeConversation?.activeCategory,
            activeEmergency: activeConversation?.activeEmergency,
            topicMessages: activeConversation?.topicMessages,
            previousSearchQueries: activeConversation?.lastSearchQueries,
          },
        )
        timer.mark('route')

        if (
          medicalDataRoute.route === 'emergency' ||
          medicalDataRoute.isEmergency
        ) {
          const emergencyReason =
            medicalDataRoute.emergencyReason ??
            medicalDataRoute.reason ??
            activeConversation?.activeEmergency?.reason ??
            '识别到可能危及生命的紧急医疗情况。'
          const emergencyCategory =
            medicalDataRoute.emergencyCategory ??
            activeConversation?.activeEmergency?.category ??
            'unconsciousness'

          await respondWithEmergency(
            emergencyCategory,
            emergencyReason,
            medicalDataRoute,
          )
          return
        }

        let rawAnswer: unknown
        let sources: Array<{ title: string; url: string; provider?: string }> = []
        let medicalData: MedicalDataResult | undefined
        let fallbackTriggeredReason: string | undefined

        try {
          if (medicalDataRoute.route === 'direct_model') {
            rawAnswer = await generateHealthAnswer({
              message: chatMessage,
              language,
              history,
              mode: 'direct_model',
              onSummaryDelta: reply.delta,
            })
            timer.mark('generate')
          } else {
            medicalData = await getMedicalData({
              message: chatMessage,
              route: medicalDataRoute,
              cachedEvidence:
                activeConversation?.activeCategory === medicalDataRoute.category
                  ? activeConversation?.lastEvidence
                  : undefined,
            })
            timer.mark('retrieve')

            rawAnswer = await generateHealthAnswer({
              message: chatMessage,
              language,
              history,
              evidence: medicalData.evidence,
              mode:
                medicalDataRoute.route === 'medical_qa'
                  ? 'medical_qa'
                  : 'medical_api',
              onSummaryDelta: reply.delta,
            })
            timer.mark('generate')
            // 来源去重，供前端展示参考资料
            const seenUrls = new Set<string>()
            sources = medicalData.evidence
              .filter((item) => {
                if (!item.url || seenUrls.has(item.url)) return false
                seenUrls.add(item.url)
                return true
              })
              .slice(0, 5)
              .map((item) => ({ title: item.title, url: item.url, provider: item.provider }))
          }
        } catch (modelError) {
          if (
            modelError instanceof ModelServiceError &&
            (modelError.code === 'REFUSED' ||
              modelError.code === 'INVALID_RESPONSE')
          ) {
            fallbackTriggeredReason = modelError.message
            rawAnswer = undefined
            timer.mark('generate')
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
                reason:
                  fallbackTriggeredReason ??
                  '模型未返回合规内容，已启用安全备用回答。',
                answer: createSafeFallbackAnswer(language),
              }
        timer.mark('safety')

        const answer = safetyCheck.answer
        const isLayer3Emergency = answer.urgency === 'emergency'
        const isEmergencyLevel =
          isLayer3Emergency ||
          answer.urgency === 'emergency' ||
          answer.urgency === 'high'

        let mapCareLevel: 'hospital' | 'clinic' | null = null
        if (isEmergencyLevel) {
          mapCareLevel = 'hospital'
        } else if (
          medicalDataRoute.route === 'medical_api' &&
          (answer.urgency === 'low' || answer.urgency === 'medium')
        ) {
          mapCareLevel = 'clinic'
        }

        await conversationRepository.appendTurn({
          conversationId,
          userId: currentUserId,
          userMessage: chatMessage,
          assistantAnswer: answer,
          sources,
          category: medicalDataRoute.category,
          evidence: medicalData?.evidence,
          searchQueries: medicalDataRoute.searchQueries,
          activeEmergency: isLayer3Emergency
            ? {
                category: 'unconsciousness',
                reason: answer.summary.slice(0, 120),
              }
            : null,
          isEmergency: isLayer3Emergency,
          mapCareLevel,
          useForContext: safetyCheck.passed, // 兜底回答不进入后续上下文
        })
        timer.mark('save')

        const route = medicalDataRoute.route
        console.log(
          '[chat-timing]',
          JSON.stringify({ conversationId, route, ...timer.result() }),
        )

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
            mapCareLevel,
            showHospitalMap: mapCareLevel !== null,
            timings: timer.result(),
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
    const { latitude, longitude, radius = 5000, careLevel } =
      request.body ?? {}

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

    if (
      careLevel !== undefined &&
      careLevel !== 'hospital' &&
      careLevel !== 'clinic'
    ) {
      response
        .status(400)
        .json({ error: '就医级别无效（需为 hospital 或 clinic）。' })
      return
    }

    try {
      const hospitals = await searchHospitals({
        latitude,
        longitude,
        radius,
        ...(careLevel ? { careLevel } : {}),
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
