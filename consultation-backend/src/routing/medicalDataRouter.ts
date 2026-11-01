import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import type { EmergencyCategory } from '../safety/emergencyCheck.js'
import type { ChatHistoryMessage } from '../schemas/chat.js'
import type {
  MedicalDataCategory,
  MedicalDataRouteResult,
} from './medicalDataTypes.js'

type ActiveMedicalCategory = Exclude<
  MedicalDataCategory,
  'greeting' | 'unknown'
>

export interface MedicalDataRouteContext {
  history?: ChatHistoryMessage[]
  activeCategory?: ActiveMedicalCategory
  activeEmergency?: { category: EmergencyCategory; reason: string }
  topicMessages?: string[]
}

const fallbackModels = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
]

const routerSchema = {
  type: 'object',
  properties: {
    route: {
      type: 'string',
      enum: ['emergency', 'direct_model', 'medical_qa', 'medical_api'],
    },
    category: {
      type: 'string',
      enum: [
        'greeting',
        'symptom',
        'medication',
        'disease',
        'injury',
        'test_result',
        'treatment',
        'general_health',
        'unknown',
      ],
    },
    reason: { type: 'string' },
    englishQueries: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
    emergencyCategory: {
      type: 'string',
      enum: [
        'none',
        'airway_emergency',
        'breathing',
        'unconsciousness',
        'chest_pain',
        'severe_bleeding',
        'severe_allergy',
        'stroke',
        'seizure',
        'self_harm',
        'severe_trauma',
        'severe_burn',
        'poisoning_overdose',
        'drowning',
      ],
    },
    emergencyReason: { type: 'string' },
  },
  required: [
    'route',
    'category',
    'reason',
    'englishQueries',
    'emergencyCategory',
    'emergencyReason',
  ],
  additionalProperties: false,
} as const

const routerSystemPrompt = `你是 AI 医疗问诊客服的智能分流与急症识别器（Medical Data & Emergency Router）。
请结合对话历史（History）与用户当前消息（Current Message），判断该消息应该进入 "emergency"、"direct_model" 还是 "medical_api"：

0. 选择 "emergency"（危及生命的紧急医疗情况，需立即拨打 999 急救）：
   - 当用户（或用户正在求助的身边人员）**正在发生**危及生命的急症时，哪怕使用的是日常口语表达，也必须立即判定为 "emergency"！
   - 典型情况包括但不限于：
     * 过量服药或中毒（如口语表达："刚刚一口气吞了一整盒/二十几粒 Panadol/安眠药"、"喝了清洁剂/农药"、"煤气中毒头晕"）-> emergencyCategory: "poisoning_overdose"
     * 急性脑卒中/中风征兆（如："突然半边身子/左手没力气"、"讲话大舌头/口齿不清"、"半边脸不会动/嘴角歪斜"）-> emergencyCategory: "stroke"
     * 急性心梗/严重胸痛（如："胸口像大石头压着喘不上气，左肩/后背也痛、冒冷汗"）-> emergencyCategory: "chest_pain"
     * 严重呼吸困难或窒息（如："喘不上来气快晕过去了"、"喉咙肿得咽不下口水喘不过气"、"小孩吃东西卡住脸发紫"）-> emergencyCategory: "breathing" 或 "airway_emergency" 或 "severe_allergy"
     * 昏迷、叫不醒或抽搐发作（如："小孩高烧突然翻白眼浑身一抽一抽的"、"晕倒在地上怎么叫都没反应"、或未满3个月婴儿发烧≥38℃）-> emergencyCategory: "seizure" 或 "unconsciousness"
     * 大出血、严重创伤/烧伤、自杀或自残意图（如："割腕了血一直流止不住"、"不想活了准备跳楼/吃药"）-> emergencyCategory: "severe_bleeding" / "self_harm" / "severe_trauma"
     * 【跨轮高危组合急症】：结合历史对话，若出现：① 发烧/骨痛热症（登革热）伴呕血、黑便、出血不止、剧烈腹痛或极度嗜睡（重症登革休克）；② 发烧头痛伴脖子僵硬/喷射性呕吐（急性脑膜炎）；③ 孕妇伴阴道出血、剧烈腹痛或突发眼花抽搐（产科急症），均必须判定为 "emergency"！
   - 【急症会话持续跟进（Active Emergency Context）】：如果上下文中提示当前正处于 Active Emergency（上一轮刚触发急症），且用户本轮消息是在补充回答该急症的细节（如回答"痛了15分钟了，我有高血压，老婆在旁边已经打了999"、"半小时前吃的，现在想吐"、"救护车还没到我该怎么办"），请**继续保持选择 "emergency"**（沿用相同的 emergencyCategory），以便系统在等待救护车期间提供针对性的动态持续急救指导！只有当用户明确表示"刚才只是随便问问/开玩笑的/不是我自己"或完全切换到另一个非危急日常话题时，才退出 "emergency"。
   - 【防误报注意】：如果用户只是单纯科普提问（如"中风有什么症状？"、"吃多两颗 Panadol 会中毒吗？"）、假设句（"如果出现喘不过气怎么办"）、过去式（"去年出过车祸"）或者明确否认症状（如"我没有发烧、胸痛或喘不过气"），**绝不要**选 "emergency"，而应选 "medical_api"。
   - 当选择 "emergency" 时，请在 emergencyReason 中用一句简明中文说明识别到的危急情况（如："描述了疑似急性药物过量（一次吞服大量止痛药），存在严重急性中毒与肝损伤风险。"），englishQueries 设为空数组 []。
   - 当不是急症时，emergencyCategory 设为 "none"，emergencyReason 设为空字符串 ""。

1. 选择 "direct_model"（无需查询外部医学数据库，直接由对话模型自然回应）：
   - 礼貌寒暄、打招呼、道谢、确认或结束对话（如："你好"、"hi"、"谢谢"、"好的"、"没事"、"不用了"、"拜拜"）
   - 询问助手身份、功能或使用方式（如："你是谁"、"你能帮我做什么"、"你是真人吗"）
   - 纯情绪感叹、吐槽或就医焦虑（如："卧槽"、"天哪"、"好害怕看医生"、"哈哈哈"）
   - 语义残缺、没头没尾的碎片词，且历史上下文中也没有正在讨论的具体症状/疾病/药物
   - 一般就诊流程或与具体医学文献无关的日常闲聊
   * 当选择 "direct_model" 时，englishQueries 必须设为空数组 []。

2. 选择 "medical_qa"（客观医学/疾病/药物知识科普提问，需查询外部医学库，但以自然科普方式作答，不把用户当成已患病患者审问）：
   - 用户**没有说自己或家人正在出现身体不适/症状**，而是在客观询问某种疾病、病毒、药物、疫苗、检查指标或日常健康常识！
   - 典型例子：
     * 问疾病/病毒科普："什么是 COVID-19？"、"骨痛热症是怎么传染的？有什么症状？"、"糖尿病是怎么引起的？"
     * 问药物科普/对比："Panadol 是什么药？有什么副作用？"、"布洛芬和扑热息痛有什么区别？"、"阿莫西林能治感冒吗？"
     * 问日常预防/养生："高血压平时不能吃什么？"、"怎样预防流感？"
   - *【重要区分】*：只要用户是在“问客观知识/百科提问”而不是“说自己身体哪里不舒服”，就必须选 "medical_qa"！只有当用户明确表示自己或身边人出现了症状/生病了（如"我发烧了"、"我得了COVID喉咙很痛"），才选 "medical_api"。
   - *【同样需要拆分英文词条（englishQueries）】*：当选择 "medical_qa" 时，同样必须在 englishQueries 数组中提取 1 到 4 个独立的英文医学名词（如 ["covid-19"]、["paracetamol", "ibuprofen"]），以便后端去权威医学数据库检索科普依据。

3. 选择 "medical_api"（患者症状问诊与病情排查，需查询外部权威医学数据库，并进入结构化问诊流程）：
   - 用户明确描述**自己或亲友正在经历具体的身体症状、不适、伤情**（如："我发烧 38.5 度，头痛两天了"、"我好像得了 COVID，全身酸痛怎么办"、"我妈膝盖肿痛"）
   - 或者在多轮症状问诊中，用户正在补充回答上一轮关于症状/体温/持续天数/居住地的追问
   * 【多词条独立拆分（englishQueries）】：请在 englishQueries 数组中提取 1 到 4 个独立的英文医学名词/短词组（每个元素只代表 1 个独立医学概念，1~2 个英文单词）。
     - 多个症状/多种药物必须拆成数组的独立元素！例如："发烧、胃痛、拉肚子" -> ["fever", "stomach pain", "diarrhea"]；"家里有 Panadol 和 Ibuprofen，登革热吃哪种" -> ["paracetamol", "ibuprofen", "dengue"]。
   * 【多话题切换与回溯】：注意识别用户当前消息正在询问的具体对象和话题。`

function isRetriableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }
  const status = (error as { status?: number }).status
  return (
    status === 429 ||
    status === 503 ||
    /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|quota/i.test(error.message)
  )
}

export function createMedicalDataRouter(options: {
  apiKey?: string
  model?: string
  timeoutMs?: number
} = {}) {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY
  const primaryModel =
    options.model ?? process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite'
  const candidateModels = options.model
    ? [options.model]
    : Array.from(new Set([primaryModel, ...fallbackModels]))
  const configuredTimeout = Number(
    options.timeoutMs ?? process.env.GEMINI_TIMEOUT_MS ?? 30000,
  )
  const timeoutMs =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 30000
  let client: GoogleGenAI | undefined

  return async function routeMedicalDataRequest(
    message: string,
    context: MedicalDataRouteContext = {},
  ): Promise<MedicalDataRouteResult> {
    const normalizedMessage = message.trim()

    if (!apiKey) {
      return {
        route: 'direct_model',
        category: 'unknown',
        reason: '未配置模型密钥，默认进入 direct_model。',
      }
    }

    client ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: timeoutMs } })

    const recentHistoryText = (context.history ?? [])
      .slice(-6)
      .map((item) => `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.content}`)
      .join('\n')

    const topicHint = context.activeCategory
      ? `Active consultation category: ${context.activeCategory}\nPrevious topic messages: ${(context.topicMessages ?? []).join(' | ')}\n`
      : ''

    const emergencyHint = context.activeEmergency
      ? `Active emergency in session: category=${context.activeEmergency.category}, reason=${context.activeEmergency.reason}\n`
      : ''

    const promptContent = `${emergencyHint}${topicHint}${recentHistoryText ? `Recent history:\n${recentHistoryText}\n\n` : ''}Current Message: ${normalizedMessage}`

    for (let i = 0; i < candidateModels.length; i += 1) {
      const candidateModel = candidateModels[i]
      try {
        const response = await client.models.generateContent({
          model: candidateModel,
          contents: promptContent,
          config: {
            systemInstruction: routerSystemPrompt,
            responseMimeType: 'application/json',
            responseJsonSchema: routerSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            maxOutputTokens: 240,
          },
        })

        if (!response.text) {
          continue
        }

        const parsed = JSON.parse(response.text) as {
          route?: 'emergency' | 'direct_model' | 'medical_qa' | 'medical_api'
          category?: MedicalDataCategory
          reason?: string
          englishQueries?: string[]
          emergencyCategory?: EmergencyCategory | 'none'
          emergencyReason?: string
        }

        if (parsed.route === 'emergency') {
          const validCategory =
            parsed.emergencyCategory && parsed.emergencyCategory !== 'none'
              ? parsed.emergencyCategory
              : 'unconsciousness'
          const emergencyReason =
            parsed.emergencyReason?.trim() ||
            parsed.reason?.trim() ||
            'AI 识别到您的症状描述可能属于危及生命的紧急医疗情况。'

          return {
            route: 'emergency',
            category: parsed.category ?? 'symptom',
            reason: emergencyReason,
            isEmergency: true,
            emergencyCategory: validCategory,
            emergencyReason,
          }
        }

        if (parsed.route === 'medical_api' || parsed.route === 'medical_qa') {
          const validQueries = (parsed.englishQueries ?? [])
            .map((q) => q.trim())
            .filter((q) => q.length >= 2)
            .slice(0, 4)
          const searchQueries =
            validQueries.length > 0 ? validQueries : [normalizedMessage]
          return {
            route: parsed.route,
            category: parsed.category ?? context.activeCategory ?? 'general_health',
            reason:
              parsed.reason ??
              (parsed.route === 'medical_qa'
                ? '模型判断为客观医学知识科普提问。'
                : '模型判断为症状问诊，需要查询医学资料。'),
            searchQuery: searchQueries.join(', '),
            searchQueries,
          }
        }

        return {
          route: 'direct_model',
          category: parsed.category ?? 'greeting',
          reason: parsed.reason ?? '模型判断无需查询外部医学资料，直接由模型回复。',
        }
      } catch (error) {
        const hasMoreModels = i < candidateModels.length - 1
        if (hasMoreModels && isRetriableError(error)) {
          continue
        }
        break
      }
    }

    return {
      route: 'direct_model',
      category: 'unknown',
      reason: '路由回退至 direct_model 直接由模型回复。',
    }
  }
}

export const routeMedicalDataRequest = createMedicalDataRouter()
