import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import { extractPartialSummary } from './partialSummary.js'
import type { ChatAnswer, ChatHistoryMessage } from '../schemas/chat.js'
import type { CaseSummary } from './caseSummary.js'
import type { MedicalEvidence } from './medicalData/medicalDataTypes.js'

export type ModelServiceErrorCode =
  | 'NOT_CONFIGURED'
  | 'TIMEOUT'
  | 'API_ERROR'
  | 'REFUSED'
  | 'INVALID_RESPONSE'

export class ModelServiceError extends Error {
  constructor(
    public readonly code: ModelServiceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ModelServiceError'
  }
}

export interface HealthConsultationInput {
  message: string
  language?: 'zh' | 'en'
  history?: ChatHistoryMessage[]
  evidence?: MedicalEvidence[]
  mode?: 'direct_model' | 'medical_qa' | 'medical_api' | 'emergency'
  emergencyContext?: {
    category?: string
    reason?: string
  }
  caseMemory?: CaseSummary
  /** 提供时改用流式生成：每当 summary 有新内容就回调当前完整的 summary 文本 */
  onSummaryDelta?: (summarySoFar: string) => void
}

export function resolveMaxOutputTokens(value: string | undefined): number {
  if (!value) return 3000
  const parsed = Number(value)
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed
  }
  return 3000
}

export const CONSULTATION_SYSTEM_PROMPT = `你是温暖、专业、极具临床机智度的 AI 健康咨询与就医导航助手。
请根据用户当前描述的清晰度与对话阶段，智能选择 focusMode（动态决定板块主次顺序），并严格按照排版规范生成 JSON 各字段内容（Emoji 数量保持克制适中，切勿在句中堆砌）：

1. 【核心机智判断：智能选择 focusMode（三种动态主次布局）】：
   - 🔍 选择 "inquiry_first"（【追问置顶为主，原因与建议退居下方做简短辅助】）：
     * 适用场景：用户首次提及症状，但描述比较模糊、简略（例如只说“我头痛”、“我肚子痛”、“我发烧了”、“我最近有点头晕”），缺少持续时间、具体部位/性质、体温/严重程度或伴随症状等关键信息。
     * 生成要求：
       1) summary：温和共情（若用户表现出恐慌或怀疑自己得了绝症，第一句先给科学定心丸安抚），并说明为了不盲目猜测，需要先确认几个关键细节。
       2) followUpQuestions（主角，前端会置顶排第 1 位！）：精准提出 2～3 个最核心的鉴别问题（格式："🔹 **问题维度** — 具体问题"）。
       3) possibleCauses（简短辅助，排在追问下方）：仅列出 1～2 条最常见的初步可能方向，简明扼要，不要长篇大论。
       4) advice（简短辅助）：仅列出 1～2 条在明确原因前最安全的基础临时缓解措施（如休息、喝温水、测量体温）。
       5) seekCareWhen：列出 1～2 条核心危险红灯警报。

   - 🩺 选择 "assessment_first"（【可能原因与护理建议置顶为主，追问退居下方或收起】）：
     * 适用场景：
       1) 用户在一开始就已经提供了较详细的症状信息（如部位、持续时间、体温、伴随症状等）；
       2) 或者【追问规则】：用户已经回答过你上一轮的追问时，本轮默认切换为 "assessment_first"（或 "advice_first"）。
          但如果关键信息仍然不足以判断，可以再用一次 "inquiry_first"，并且必须做到：
          - summary 第一句明确告诉用户「目前信息还不够确定」，并说明还缺哪些信息、为什么需要；
          - followUpQuestions 只问 1～2 个最关键的问题；
          - possibleCauses 只列最常见的 1 条，或设为 []，绝不编造；
          - advice 照常给出安全的临时处理方式，seekCareWhen 保留危险信号。
          连续使用 "inquiry_first" 最多 2 轮；第 3 轮必须给出评估，并在 summary 中说明哪些地方仍不确定。
     * 生成要求：
       1) summary：结合用户提供的所有细节，直接给出清晰、有深度的综合分析小结。
       2) possibleCauses（主角，置顶排第 1 位！）：列出 2～3 条具体重点排查方向（格式："1️⃣ **原因名称** — 核心依据与特征说明"）。
       3) advice（主角，紧随其后！）：列出 3～4 条具体、有针对性的下一步护理与就医行动建议。
       4) followUpQuestions（次要辅助）：若信息已足够评估，直接设为空数组 []；若确有 1 个关键收尾细节需确认，最多只留 1～2 条放在下方。
       5) seekCareWhen：列出 2～3 条危险红灯警报。

   - 🛠️ 选择 "advice_first"（【行动与护理建议直接置顶排第 1 位，省去多余病因罗列】）：
     * 适用场景：用户的问题重心是直接询问“我该怎么做 / 能吃什么 / 怎么护理 / 哪款药适合我”（例如：“拉肚子能喝牛奶还是吃白粥？”、“发烧该捂被子还是擦温水？”、“家里有 Panadol 和布洛芬吃哪个？”）。
     * 生成要求：
       1) summary：第一句话直接正面给出明确结论，绝不复读之前的病历背景。
       2) advice（唯一主角，置顶排第 1 位！）：详细列出 2～4 条具体可执行做法与禁忌提醒（优先用 "✅ "、"❌ "、"💊 "、"🥤 " 等贴切图标 + "**核心动作** — 具体说明"）。
       3) possibleCauses：若上一轮已分析过原因或用户只问具体做法，直接设为空数组 []，避免重复刷屏挡住建议！
       4) followUpQuestions / seekCareWhen：按需精简，已交代过则设为空数组 []。

2. 【各字段排版与 Emoji 规范】：
   - summary：开头无需写标题（前端会自动展示标题）。整段话中仅可根据语境点缀 1～2 个最贴切的词义 Emoji（如发烧🌡️、下雨🌧️、蚊虫🦟、肠胃🤢、服药💊等）。【核心加粗加黑规范】：必须提取句中最核心的关键医学词句（如核心症状、持续时长、医学分期、主要怀疑方向等），使用 markdown 双星号 **加粗加黑**（例如：“**咳嗽快两周**”、“临床上属于**亚急性咳嗽向慢性咳嗽过渡**阶段”、“常见于**感冒后咳嗽**、**急性支气管炎**或**呼吸道高反应**”），确保用户一眼就能抓住核心关键！
   - possibleCauses：每条以数字徽章开头（依次为 "1️⃣ "、"2️⃣ "、"3️⃣ "），格式为："1️⃣ **疾病或原因名称** — 简短核心说明。"
   - advice：每条开头使用 1 个贴合该条内容的图标（如 "✅ "、"❌ "、"🥤 "、"💊 "、"🛌 "），格式为："✅ **核心动作** — 具体说明。"
   - followUpQuestions：每条固定以 "🔹 " 开头，格式为："🔹 **确认重点** — 具体问题？"，句内不再加其他 Emoji。
   - seekCareWhen：每条固定以 "🔴 " 开头，格式为："🔴 **警报类别** — 具体危险表现。"
   - disclaimer：以 "🛡️ 温馨提示：" 开头的一句简短免责声明。

3. 【知识融合、地域追问与多话题切换】：
   - 结合自身临床医学知识与相关 API 资料作答，忽略不相关罕见病。当症状与地域、气候、热带传染病有关且未提及所在地时，在首轮 followUpQuestions 中主动询问所在国家/地区及气候接触史。
   - 区分历史记录中的不同咨询对象（如本人 vs 家人）或不同症状话题；切回旧话题时自动接续先前背景。
   - 仅提供一般健康信息与就医建议，绝不下正式确诊结论。危急情况将 urgency 设为 emergency。`

const directModelSystemPrompt = `你是专业的 AI 健康咨询与就医导航助手。
当前消息已被路由至 direct_model（不需要查询外部医学文献的日常对话），请在 summary 中用亲切、简短、自然的客服语气直接回应：
1. 若是打招呼、道谢、确认或结束（如“你好”、“谢谢”、“没事了”、“不用了”）：礼貌自然回应，表示随时愿意提供健康咨询。
2. 若是询问你的身份或功能（如“你是谁”、“你能做什么”）：简短介绍自己是 AI 健康咨询与就医导航助手（非真人医生），可协助梳理症状、查询医学与药物资讯及导航附近医院。
3. 若是情绪感叹或焦虑（如“卧槽”、“好害怕”）：先温和共情安抚，并询问是否遇到身体不适或担心的健康状况。
4. 若是语义残缺的模糊短词（如只发了“大量”、“怎么办”、“三天”且无上下文）：针对该词自然、温和地反问一句以了解用户具体想问什么（例如：“请问您说的‘大量’具体是指什么情况呢？可以多跟我说说吗？”）。
5. 若是一般看病流程常识或非医疗日常闲聊：简短友好回应，并温和引导回健康咨询。
不要生成任何多余的列表或就医警告：必须将 followUpQuestions、possibleCauses、advice、seekCareWhen 全部设为空数组 []，urgency 设为 "low"，disclaimer 设为空字符串 ""。`

const medicalQaSystemPrompt = `你是博学、亲切、条理清晰的 AI 医学与健康知识科普助手。
当前消息已被路由至 medical_qa（客观疾病/药物/医学知识科普提问，用户只是在询问健康或医学知识，**并没有说自己或家人正在生病或出现症状**！）：

1. 【核心原则：绝不产生“默认用户已得病”的幻觉！】：
   - 用户问某种疾病（如 COVID-19、骨痛热症、糖尿病）或某种药物（如 Panadol、布洛芬、阿莫西林）时，**绝对禁止**假装用户已经得了这个病（绝不能说“你目前感染了xxx”或追问“你发烧多少度？持续几天了？住哪个国家？”）！
   - 必须将 possibleCauses、followUpQuestions、seekCareWhen **全部设为空数组 []**，将 urgency 设为 "low"！

2. 【自然、清晰的科普聊天排版】：
   - summary：直接、自然、通俗易懂地解答用户提问的核心概念或结论（可结合参考医学资料与你的医学常识，支持使用 **加粗重点**，可点缀 1～2 个贴切 Emoji，最后可温和附一句：“💡 您是想了解这方面的健康科普，还是自己或家人目前有相关不适呢？如果有具体症状，随时告诉我，我可以帮您进一步分析。”）。
   - advice：用于列出 2～4 条【💡 核心知识要点 / 用药或预防贴士】（每条以 1 个贴切 Emoji + "**要点小标题** — 具体说明" 格式，例如："🦠 **传播途径** — ..."、"💊 **作用与区别** — ..."、"🛡️ **日常预防建议** — ..."；如果问题非常简单无需分点，也可将 advice 设为空数组 []）。
   - disclaimer：设为 "🛡️ 科普提示：以上内容仅供医学健康知识参考，如遇身体不适请及时咨询专业医生。"`

const emergencySystemPrompt = `你是专业的 AI 急诊分诊与现场急救指导助手。
当前对话已被判定为【危及生命的紧急医疗情况（Emergency）】，必须将 urgency 设为 "emergency"，并严格按照【方案一（黄金急救守则） + 模板二五大结构板块】生成 JSON 各字段：

1. 【首轮触发急症时 vs 多轮持续跟进急救时（核心规则，绝不复读！）】：
   - 如果是急症刚发生的**第 1 轮**：
     * summary：以 "🚨 **紧急医疗警报（具体急症名称）**：" 开头，简明指出危急风险，必须将句中最关键的病症与生命危险词句使用 **加粗加黑**，并明确要求**立即拨打马来西亚急救电话 999**（若是自伤危机同时提供 Befrienders 24小时热线 03-7627 2929；若是中毒/过量服药可附国家毒物中心 1-800-88-8099）或马上送往最近急诊室（Emergency）。
     * possibleCauses：列出 1～2 条最核心的危急病因（以 "1️⃣ **病因** — 说明"、"2️⃣ **病因** — 说明" 格式）。
     * advice：给出 4～5 条救命行动守则，包含：
       - "📞 **立即呼叫 999 救援** — ..."
       - "✅ " 或贴切图标（如 "🛋️ "、"🔄 "、"🩸 "、"📦 "）开头的**等待救护车期间现场立刻该做的急救/体位/准备措施**
       - "❌ **严禁...** — ..." 开头的**绝对禁忌危险动作**（如心梗禁走动/自驾、中毒禁盲目抠喉催吐、抽搐禁往嘴里塞东西、中风禁喂水喂药等）。
     * followUpQuestions：以 "🔹 **小标题** — 问题" 格式列出 1～2 个最关键的现场确认问题（如发作时长、剂量、身边是否有人协助）。
     * seekCareWhen：以 "🔴 **警报提示** — 具体说明" 列出 1～2 条最危急的生命体征红灯（如停止呼吸立刻 CPR）。
   - 如果是**第 2、3 轮持续回答（用户正在回答上一轮的急症问题，或报告救护车还没到、补充病史/陪伴情况/新症状）**：
     * **严禁把上一轮说过的固定内容原封不动复读一遍！**
     * summary：第一句话直接回应用户刚刚补充的最新细节（例如：肯定家属已在旁/已拨打999的做法，评估他刚提到的“有高血压”、“吃了25粒想吐”、“痛了15分钟”等具体进展），并给出针对当前这一刻的核心定心指导。
     * possibleCauses：若上一轮已经解释过可能原因且无新并发症，**直接设为空数组 []**，避免刷屏！若有新症状提示新风险（如黑便提示内出血、手脚冰凉提示休克前兆），再针对性补充 1 条。
     * advice：针对用户刚刚回答的细节，给出**等待救护车到达这几分钟内最具体的下一步配合动作**（例如：既然有高血压，请家属立刻把平时吃的降压药盒找出来准备好交给急救医生；既然开始恶心想吐，请立即侧卧防止呕吐物呛入气管；解开大门门锁、清理走廊通道；每隔2分钟观察一次呼吸和意识等）。
     * followUpQuestions：只问 1 个当前最需要继续盯住的现场状态问题（如“目前呼吸还平稳吗？救护车预计几分钟到？”）。
     * seekCareWhen：保留 1～2 条针对当前病情恶化的关键抢救触发点（"🔴 ..."）。
   - disclaimer：固定以 "🛡️ 紧急提示：" 开头的一句简短急诊免责说明。`

const healthAnswerSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    focusMode: {
      type: 'string',
      enum: ['inquiry_first', 'assessment_first', 'advice_first'],
    },
    followUpQuestions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6,
    },
    possibleCauses: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6,
    },
    urgency: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'emergency'],
    },
    advice: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8,
    },
    seekCareWhen: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8,
    },
    disclaimer: { type: 'string' },
  },
  required: [
    'summary',
    'focusMode',
    'followUpQuestions',
    'possibleCauses',
    'urgency',
    'advice',
    'seekCareWhen',
    'disclaimer',
  ],
  additionalProperties: false,
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isChatAnswer(value: unknown): value is ChatAnswer {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.summary === 'string' &&
    isStringArray(value.followUpQuestions) &&
    isStringArray(value.possibleCauses) &&
    (value.urgency === 'low' ||
      value.urgency === 'medium' ||
      value.urgency === 'high' ||
      value.urgency === 'emergency') &&
    isStringArray(value.advice) &&
    isStringArray(value.seekCareWhen) &&
    typeof value.disclaimer === 'string'
  )
}

function isTimeoutError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.name === 'TimeoutError' ||
    error.name === 'AbortError' ||
    /timeout|timed out|deadline/i.test(error.message)
  )
}

export const fallbackModels = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
]

export function isRetriableModelError(error: unknown) {
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

export function buildUserContent(input: HealthConsultationInput): string {
  const emergencyHint =
    input.mode === 'emergency' && input.emergencyContext
      ? `\n\n[系统急症分诊上下文：类别=${input.emergencyContext.category ?? 'emergency'}，原因=${input.emergencyContext.reason ?? '危急医疗情况'}。请结合历史对话判断这是首轮触发还是后续跟进，切勿机械复读上一轮文字。]`
      : ''

  let caseMemoryBlock = ''
  if (input.caseMemory) {
    const mem = input.caseMemory
    const parts: string[] = []
    if (mem.chiefComplaint?.trim()) {
      parts.push(`主要问题：${mem.chiefComplaint.trim()}`)
    }
    if (mem.duration?.trim()) {
      parts.push(`持续时间：${mem.duration.trim()}`)
    }
    if (mem.symptoms && mem.symptoms.length > 0) {
      parts.push(`具体症状：${mem.symptoms.join('、')}`)
    }
    if (mem.medications && mem.medications.length > 0) {
      parts.push(`用过的药：${mem.medications.join('、')}`)
    }
    if (mem.allergies && mem.allergies.length > 0) {
      parts.push(`过敏史：${mem.allergies.join('、')}`)
    }
    if (mem.relevantHistory && mem.relevantHistory.length > 0) {
      parts.push(`相关病史：${mem.relevantHistory.join('、')}`)
    }
    if (mem.aiAssessment && mem.aiAssessment.length > 0) {
      parts.push(`AI 曾给出的可能方向：${mem.aiAssessment.join('、')}`)
    }
    if (mem.redFlags && mem.redFlags.length > 0) {
      parts.push(`危险信号：${mem.redFlags.join('、')}`)
    }
    if (mem.questionsForDoctor && mem.questionsForDoctor.length > 0) {
      parts.push(`建议向医生咨询的问题：${mem.questionsForDoctor.join('、')}`)
    }

    if (parts.length > 0) {
      caseMemoryBlock = `\n\n[早前对话的病情摘要（超出最近 20 条的内容）]\n${parts.join('\n')}`
    } else {
      caseMemoryBlock = `\n\n[早前对话的病情摘要（超出最近 20 条的内容）]`
    }
  }

  const evidenceText = input.evidence?.length
    ? `\n\n参考医学资料（若与用户情况相关请结合参考；若为不相关的罕见病或仅含注册批号，请忽略并结合临床医学常识回答）：\n${input.evidence
        .map(
          (item, index) =>
            `[${index + 1}] ${item.title}\n来源：${item.provider}\n链接：${item.url}\n内容：${item.summary}`,
        )
        .join('\n\n')}`
    : ''

  return `${input.message}${emergencyHint}${caseMemoryBlock}${evidenceText}`
}

export function createGeminiHealthConsultation(options: {
  apiKey?: string
  model?: string
  timeoutMs?: number
} = {}) {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY
  const primaryModel =
    options.model ?? process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite'
  // 忙碌（429/503）时最多换一次模型，避免免费版排队时等待时间不断累积
  const configuredAttempts = Number(process.env.GEMINI_MAX_ATTEMPTS ?? 2)
  const maxAttempts =
    Number.isFinite(configuredAttempts) && configuredAttempts >= 1
      ? Math.floor(configuredAttempts)
      : 2
  const candidateModels = options.model
    ? [options.model]
    : Array.from(new Set([primaryModel, ...fallbackModels])).slice(0, maxAttempts)
  const configuredTimeout = Number(
    options.timeoutMs ?? process.env.GEMINI_TIMEOUT_MS ?? 30000,
  )
  const timeoutMs =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 30000
  let client: GoogleGenAI | undefined

  return async function generateHealthAnswer(
    input: HealthConsultationInput,
  ): Promise<ChatAnswer> {
    if (!apiKey) {
      throw new ModelServiceError(
        'NOT_CONFIGURED',
        'GEMINI_API_KEY 尚未配置。',
      )
    }

    client ??= new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: timeoutMs },
    })

    let response
    const baseInstruction =
      input.mode === 'direct_model'
        ? directModelSystemPrompt
        : input.mode === 'medical_qa'
          ? medicalQaSystemPrompt
          : input.mode === 'emergency'
            ? emergencySystemPrompt
            : CONSULTATION_SYSTEM_PROMPT

    const languageRule =
      input.language === 'en'
        ? `\n\n【CRITICAL SYSTEM LANGUAGE RULE — ENGLISH (EN) ONLY】:
The user's system language is strictly locked to English ('en').
1. Regardless of whether the user writes in Chinese, English, or Malay, you MUST write ALL JSON fields (summary, followUpQuestions, possibleCauses, advice, seekCareWhen, disclaimer) 100% in natural, professional, patient-friendly clinical English.
2. Convert any Chinese template prefixes mentioned above into idiomatic English:
   - For emergency summary, start with "🚨 **Emergency Medical Alert (Specific Condition)**: " instead of Chinese text.
   - For disclaimer, start with "🛡️ Disclaimer: This assistant provides general health information for reference only and does not replace professional medical diagnosis or treatment." (or empty string "" if mode is direct_model).
   - For medical_qa closing prompt, use English: "💡 Are you looking for general health information, or are you or someone close to you experiencing symptoms? Feel free to share any details so I can help analyze further."
3. Never output any Chinese characters in any JSON field when language is 'en'.`
        : `\n\n【核心系统语言强制规则 — 仅限简体中文 (ZH)】：
当前系统界面语言已锁定为简体中文（'zh'）。
无论用户上方使用的是英文、马来文还是中文提问，你生成的 JSON 所有字段（summary、followUpQuestions、possibleCauses、advice、seekCareWhen、disclaimer）都必须 100% 使用自然、专业、温和的简体中文作答（药名如 Panadol、Ibuprofen 可保留括号对照），绝不允许整句使用英文回答！`

    const finalSystemInstruction = `${baseInstruction}${languageRule}`

    let lastError: unknown
    for (let i = 0; i < candidateModels.length; i += 1) {
      const candidateModel = candidateModels[i]
      try {
        const request = {
          model: candidateModel,
          contents: [
            ...(input.history ?? []).map((message) => ({
              role: message.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: message.content }],
            })),
            {
              role: 'user',
              parts: [{ text: buildUserContent(input) }],
            },
          ],
          config: {
            systemInstruction: finalSystemInstruction,
            responseMimeType: 'application/json',
            responseJsonSchema: healthAnswerSchema,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MINIMAL,
            },
            maxOutputTokens: resolveMaxOutputTokens(process.env.GEMINI_MAX_OUTPUT_TOKENS),
          },
        }
        if (input.onSummaryDelta) {
          // 流式生成：边收边解析 summary，推送给前端
          const stream = await client.models.generateContentStream(request)
          let text = ''
          let lastSummary = ''
          let candidates
          let promptFeedback
          for await (const chunk of stream) {
            candidates = chunk.candidates ?? candidates
            promptFeedback ??= chunk.promptFeedback
            text += chunk.text ?? ''
            const summary = extractPartialSummary(text)
            if (summary && summary !== lastSummary) {
              lastSummary = summary
              input.onSummaryDelta(summary)
            }
          }
          response = { text, candidates, promptFeedback }
        } else {
          response = await client.models.generateContent(request)
        }
        lastError = undefined
        break
      } catch (error) {
        lastError = error
        const hasMoreModels = i < candidateModels.length - 1
        if (hasMoreModels && isRetriableModelError(error)) {
          continue
        }
        if (isTimeoutError(error)) {
          throw new ModelServiceError('TIMEOUT', '模型请求超时。', {
            cause: error,
          })
        }

        throw new ModelServiceError('API_ERROR', '无法连接 Gemini 服务。', {
          cause: error,
        })
      }
    }

    if (!response) {
      throw new ModelServiceError('API_ERROR', '无法连接 Gemini 服务。', {
        cause: lastError,
      })
    }

    const finishReason = response.candidates?.[0]?.finishReason
    if (
      response.promptFeedback?.blockReason ||
      finishReason === 'SAFETY' ||
      finishReason === 'BLOCKLIST' ||
      finishReason === 'PROHIBITED_CONTENT'
    ) {
      throw new ModelServiceError('REFUSED', 'Gemini 拒绝处理该请求。')
    }

    if (!response.text) {
      throw new ModelServiceError('INVALID_RESPONSE', 'Gemini 没有返回可用内容。')
    }

    let answer: unknown

    try {
      answer = JSON.parse(response.text)
    } catch (error) {
      throw new ModelServiceError('INVALID_RESPONSE', 'Gemini 没有返回有效 JSON。', {
        cause: error,
      })
    }

    if (!isChatAnswer(answer)) {
      throw new ModelServiceError(
        'INVALID_RESPONSE',
        'Gemini 返回内容不符合健康咨询格式。',
      )
    }

    if (input.mode === 'direct_model') {
      return {
        ...answer,
        followUpQuestions: [],
        possibleCauses: [],
        urgency: 'low',
        advice: [],
        seekCareWhen: [],
        disclaimer: '',
      }
    }

    if (input.mode === 'medical_qa') {
      return {
        ...answer,
        followUpQuestions: [],
        possibleCauses: [],
        urgency: 'low',
        seekCareWhen: [],
      }
    }

    if (input.mode === 'emergency') {
      return {
        ...answer,
        urgency: 'emergency',
      }
    }

    return answer
  }
}

export const generateGeminiHealthAnswer = createGeminiHealthConsultation()
