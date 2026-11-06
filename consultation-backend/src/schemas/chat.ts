export type ChatRole = 'user' | 'assistant'
export type ChatLanguage = 'zh' | 'en'

export interface ChatImageInput {
  id: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface ChatHistoryMessage {
  role: ChatRole
  content: string
}

export interface ChatRequest {
  conversationId?: string
  message: string
  language?: ChatLanguage
  images?: ChatImageInput[]
  history?: ChatHistoryMessage[]
  regenerate?: boolean
}

export type FocusMode = 'inquiry_first' | 'assessment_first' | 'advice_first'

export interface ChatAnswer {
  summary: string
  focusMode?: FocusMode
  followUpQuestions: string[]
  possibleCauses: string[]
  urgency: 'low' | 'medium' | 'high' | 'emergency'
  advice: string[]
  seekCareWhen: string[]
  disclaimer: string
}

export interface ChatSource {
  title: string
  url: string
  provider?: string
  publishedAt?: string
}

export interface ChatSuccessResponse {
  success: true
  data: {
    conversationId: string
    messageId: string
    answer: ChatAnswer
    sources: ChatSource[]
  }
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: string[]
  }
}

type ValidationResult =
  | { valid: true; value: ChatRequest }
  | { valid: false; errors: string[] }

const allowedImageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyText(value: unknown, maximumLength: number) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= maximumLength
  )
}

export function validateChatRequest(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return { valid: false, errors: ['请求内容必须是 JSON 对象。'] }
  }

  const errors: string[] = []

  if (!isNonEmptyText(input.message, 4000)) {
    errors.push('message 必须是 1 至 4000 个字符的文字。')
  }

  if (
    input.conversationId !== undefined &&
    !isNonEmptyText(input.conversationId, 100)
  ) {
    errors.push('conversationId 必须是 1 至 100 个字符的文字。')
  }

  if (input.regenerate !== undefined && typeof input.regenerate !== 'boolean') {
    errors.push('regenerate 必须是布尔值。')
  }

  if (input.images !== undefined) {
    if (!Array.isArray(input.images) || input.images.length > 4) {
      errors.push('images 必须是最多包含 4 张图片的数组。')
    } else {
      input.images.forEach((image, index) => {
        if (
          !isRecord(image) ||
          !isNonEmptyText(image.id, 200) ||
          typeof image.mimeType !== 'string' ||
          !allowedImageTypes.has(image.mimeType)
        ) {
          errors.push(
            `images[${index}] 必须包含有效的 id 和 jpeg、png 或 webp 类型。`,
          )
        }
      })
    }
  }

  let sanitizedHistory: ChatHistoryMessage[] | undefined
  if (input.history !== undefined) {
    if (!Array.isArray(input.history)) {
      errors.push('history 必须是消息数组。')
    } else {
      const recentHistory = input.history.slice(-20)
      sanitizedHistory = []
      recentHistory.forEach((historyMessage, index) => {
        if (
          !isRecord(historyMessage) ||
          (historyMessage.role !== 'user' &&
            historyMessage.role !== 'assistant') ||
          typeof historyMessage.content !== 'string' ||
          historyMessage.content.trim().length === 0
        ) {
          errors.push(
            `history[${index}] 必须包含有效的 role 和非空 content。`,
          )
        } else {
          sanitizedHistory?.push({
            role: historyMessage.role,
            content: historyMessage.content.trim().slice(0, 4000),
          })
        }
      })
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  const language: ChatLanguage = input.language === 'en' ? 'en' : 'zh'

  return {
    valid: true,
    value: {
      conversationId: input.conversationId as string | undefined,
      message: (input.message as string).trim(),
      language,
      images: input.images as ChatImageInput[] | undefined,
      history: sanitizedHistory,
      regenerate: input.regenerate as boolean | undefined,
    },
  }
}
