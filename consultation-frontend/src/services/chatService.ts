// 问诊对话服务：只负责和后端 /api/chat、/api/chat/stream 通信，不含界面逻辑
import { authFetch } from '../auth'
import type { Language } from '../i18n'

export type Urgency = 'low' | 'medium' | 'high' | 'emergency'
export type FocusMode = 'inquiry_first' | 'assessment_first' | 'advice_first'
export type CareLevel = 'hospital' | 'clinic'

export interface HealthAnswer {
  summary: string
  focusMode?: FocusMode
  followUpQuestions: string[]
  possibleCauses: string[]
  urgency: Urgency
  advice: string[]
  seekCareWhen: string[]
  disclaimer: string
}

export interface Source {
  title: string
  url: string
  provider?: string
}

export interface ChatApiResponse {
  success: boolean
  data?: {
    type?: 'emergency'
    conversationId?: string
    answer?: HealthAnswer
    sources?: Source[]
    mapCareLevel?: CareLevel | null
    emergency?: {
      reason?: string
      action?: string
    }
  }
  error?: {
    code?: string
    message?: string
  }
}

export interface ChatRequest {
  conversationId?: string
  message: string
  language: Language
  regenerate?: boolean
}

async function readChatStream(
  response: Response,
  onSummary: (summary: string) => void,
): Promise<{ ok: boolean; result: ChatApiResponse }> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('stream unavailable')
  const decoder = new TextDecoder()
  let buffer = ''
  let final: { status: number; body: ChatApiResponse } | undefined

  for (;;) {
    const { done, value } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: true })
    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf('\n\n')
      const event = block.match(/^event: (.+)$/m)?.[1]
      const data = block.match(/^data: (.+)$/m)?.[1]
      if (!event || !data) continue
      const parsed = JSON.parse(data)
      if (event === 'delta' && typeof parsed.summary === 'string') {
        onSummary(parsed.summary)
      } else if (event === 'final') {
        final = parsed
      }
    }
    if (done) break
  }

  if (!final) throw new TypeError('stream ended early')
  return { ok: final.status < 400, result: final.body }
}

/** 优先使用流式接口；后端尚未支持时自动回退到普通接口。signal 用于“停止生成”。 */
export async function requestChat(
  payload: ChatRequest,
  onSummary: (summary: string) => void,
  signal?: AbortSignal,
): Promise<{ ok: boolean; result: ChatApiResponse }> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  }
  const streamResponse = await authFetch('/api/chat/stream', init)
  const contentType = streamResponse.headers?.get('Content-Type') ?? ''

  if (streamResponse.ok && contentType.includes('text/event-stream')) {
    return readChatStream(streamResponse, onSummary)
  }

  const response =
    streamResponse.status === 404
      ? await authFetch('/api/chat', init)
      : streamResponse
  const result = (await response
    .json()
    .catch(() => ({ success: false }))) as ChatApiResponse
  return { ok: response.ok, result }
}

export function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  )
}
