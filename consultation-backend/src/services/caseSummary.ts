import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import {
  fallbackModels,
  isRetriableModelError,
  ModelServiceError,
} from './geminiHealthConsultation.js'

export interface CaseSummary {
  chiefComplaint: string // 主要问题
  symptoms: string[] // 症状
  duration: string // 持续多久
  medications: string[] // 用过的药
  allergies: string[] // 过敏
  relevantHistory: string[] // 相关病史
  aiAssessment: string[] // AI 曾给出的可能方向
  redFlags: string[] // 需要注意的危险信号
  questionsForDoctor: string[] // 可以问医生的问题
}

export function isCaseSummary(value: unknown): value is CaseSummary {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const v = value as Record<string, unknown>

  function isStringArray(arr: unknown): arr is string[] {
    return Array.isArray(arr) && arr.every((item) => typeof item === 'string')
  }

  return (
    typeof v.chiefComplaint === 'string' &&
    isStringArray(v.symptoms) &&
    typeof v.duration === 'string' &&
    isStringArray(v.medications) &&
    isStringArray(v.allergies) &&
    isStringArray(v.relevantHistory) &&
    isStringArray(v.aiAssessment) &&
    isStringArray(v.redFlags) &&
    isStringArray(v.questionsForDoctor)
  )
}

export interface SummarizeCaseInput {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  language: 'zh' | 'en'
  purpose: 'visit' | 'memory'
}

export const caseSummaryJsonSchema = {
  type: 'object',
  properties: {
    chiefComplaint: { type: 'string', description: '主要就诊问题/主诉' },
    symptoms: {
      type: 'array',
      items: { type: 'string' },
      description: '具体症状清单',
    },
    duration: { type: 'string', description: '症状持续时间' },
    medications: {
      type: 'array',
      items: { type: 'string' },
      description: '使用过的药物',
    },
    allergies: {
      type: 'array',
      items: { type: 'string' },
      description: '药物或食物过敏史',
    },
    relevantHistory: {
      type: 'array',
      items: { type: 'string' },
      description: '相关既往病史',
    },
    aiAssessment: {
      type: 'array',
      items: { type: 'string' },
      description: 'AI在对话中曾提及的初步可能方向（注明非确诊）',
    },
    redFlags: {
      type: 'array',
      items: { type: 'string' },
      description: '需要警惕的危险信号',
    },
    questionsForDoctor: {
      type: 'array',
      items: { type: 'string' },
      description: '建议就诊时向医生咨询的问题',
    },
  },
  required: [
    'chiefComplaint',
    'symptoms',
    'duration',
    'medications',
    'allergies',
    'relevantHistory',
    'aiAssessment',
    'redFlags',
    'questionsForDoctor',
  ],
}

export function createCaseSummarizer(
  options: { apiKey?: string; model?: string } = {},
) {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY
  const primaryModel =
    options.model ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  const candidateModels = [
    primaryModel,
    ...fallbackModels.filter((m) => m !== primaryModel),
  ]

  let client: GoogleGenAI | undefined
  if (apiKey) {
    client = new GoogleGenAI({ apiKey })
  }

  return async function summarizeCase(
    input: SummarizeCaseInput,
  ): Promise<CaseSummary> {
    if (!client) {
      throw new ModelServiceError('NOT_CONFIGURED', 'GEMINI_API_KEY 尚未配置。')
    }

    const isEnglish = input.language === 'en'
    const systemPrompt = isEnglish
      ? `You are a clinical case summary assistant for Medora AI health consultation.
Your task is to summarize the user-AI consultation dialog into a structured JSON medical case summary.

【STRICT CLINICAL FACTUALITY RULES】:
1. ONLY summarize information EXPLICITLY stated by the user!
   - For any fields not explicitly mentioned by the user (e.g. medications, allergies, relevant history, duration), you MUST provide an empty string "" or an empty list [].
   - Absolutely DO NOT speculate, assume, infer, or hallucinate any unmentioned facts.
2. aiAssessment rule:
   - ONLY summarize the potential directions or preliminary considerations that the AI assistant mentioned in the conversation.
   - Do NOT invent new assessments.
3. Language rule:
   - Output ALL fields 100% in clear, professional English.
4. Purpose (${input.purpose}):
   - ${input.purpose === 'visit' ? 'Concise and professional for doctor consultation reference.' : 'Structured factual record for conversation memory.'}`
      : `你是 Medora AI 健康咨询的临床病历摘要助手。
你的任务是将用户与 AI 的问诊对话整理成结构化的 JSON 医疗病历摘要。

【严格临床事实性规则（不得推测）】：
1. 绝对只能整理【用户明确说过的内容】！
   - 用户在对话中未明确提及的项目（例如用过的药、过敏史、既往病史、持续时间等），必须保持空字符串 "" 或空数组 []。
   - 绝对不得自行推测、推断、假定或编造任何用户未说明的内容！
2. aiAssessment 规则：
   - 只能概括 AI 助手在对话中曾经提及过的初步可能方向。
   - 不得编造 AI 未说过的分析。
3. 语言规则：
   - 必须 100% 使用专业、精炼的简体中文输出所有字段内容。
4. 用途（${input.purpose}）：
   - ${input.purpose === 'visit' ? '用于患者就诊时向医生清晰简明地陈述病情，语言需简练、专业、有条理，去除无关闲聊。' : '用于长期对话的病情记忆沉淀。'}`

    const dialogText = input.messages
      .map((m) => `${m.role === 'user' ? '用户' : 'AI助手'}: ${m.content}`)
      .join('\n\n')

    let lastError: unknown
    for (let i = 0; i < candidateModels.length; i += 1) {
      const model = candidateModels[i]
      try {
        const response = await client.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `以下是问诊对话记录：\n\n${dialogText}\n\n请严格按要求提取结构化就诊摘要。`,
                },
              ],
            },
          ],
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseJsonSchema: caseSummaryJsonSchema,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MINIMAL,
            },
            maxOutputTokens: 2000,
          },
        })

        const text = response.text?.trim()
        if (!text) {
          throw new ModelServiceError('INVALID_RESPONSE', '模型未返回有效文本。')
        }

        let parsed: unknown
        try {
          parsed = JSON.parse(text)
        } catch {
          throw new ModelServiceError(
            'INVALID_RESPONSE',
            '模型返回的不是有效的 JSON。',
          )
        }

        if (!isCaseSummary(parsed)) {
          throw new ModelServiceError(
            'INVALID_RESPONSE',
            '模型返回的 JSON 结构不符合 CaseSummary 规范。',
          )
        }

        return parsed
      } catch (err) {
        lastError = err
        const hasMore = i < candidateModels.length - 1
        if (hasMore && isRetriableModelError(err)) {
          continue
        }
        break
      }
    }

    if (lastError instanceof ModelServiceError) {
      throw lastError
    }
    throw new ModelServiceError(
      'API_ERROR',
      lastError instanceof Error
        ? lastError.message
        : '调用 Gemini 生成摘要失败。',
    )
  }
}
