import cors from 'cors'
import { randomUUID } from 'node:crypto'
import express from 'express'
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

interface AppDependencies {
  searchHospitals?: SearchHospitals
  generateHealthAnswer?: GenerateHealthAnswer
  retrieveMedicalData?: RetrieveMedicalData
  conversationStore?: ConversationStore
}

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
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

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' })
  })

  app.post('/api/chat', async (request, response) => {
    const validation = validateChatRequest(request.body)

    if (!validation.valid) {
      response.status(400).json({
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
    const conversationId = validChat.conversationId ?? randomUUID()
    const language = validChat.language ?? 'zh'
    const session = conversationStore.getSession(conversationId)
    const history = conversationStore.getMergedHistory(
      conversationId,
      validChat.history,
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
        userMessage: validChat.message,
        answer: emergencyAnswer,
        clientHistory: validChat.history,
        category: medicalDataRoute?.category ?? 'symptom',
        activeEmergency: { category, reason },
      })

      response.json({
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
      const medicalDataRoute = await routeMedicalDataRequest(
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
          })
          sources = medicalData.evidence.map((item) => ({
            title: item.title,
            url: item.url,
          }))
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

      response.json({
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
          medicalData,
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

        response.status(modelError.status).json({
          success: false,
          error: {
            code: modelError.code,
            message: modelError.message,
          },
        })
        return
      }

      console.error('Health consultation failed', error)
      response.status(502).json({
        success: false,
        error: {
          code: 'AI_MODEL_UNAVAILABLE',
          message: 'AI 服务暂时无法使用。',
        },
      })
    }
  })

  app.post('/api/hospitals/nearby', async (request, response) => {
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
