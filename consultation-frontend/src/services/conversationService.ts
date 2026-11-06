// 多对话服务：对话保存在后端（Supabase），前端不把健康对话写进浏览器存储
import { authFetch } from '../auth'
import type { CareLevel, HealthAnswer, Source } from './chatService'

export interface ConversationItem {
  id: string
  title: string
  messageCount: number
  createdAt?: string
  updatedAt: string
}

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  answer?: HealthAnswer | null
  isEmergency?: boolean
  sources?: Source[] | null
  mapCareLevel?: CareLevel | null
  createdAt?: string
}

export async function listConversations(): Promise<{
  conversations: ConversationItem[]
  limit?: number
} | null> {
  const res = await authFetch('/api/conversations')
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data.conversations)) return null
  return {
    conversations: data.conversations,
    limit: typeof data.limit === 'number' ? data.limit : undefined,
  }
}

export type ConversationDetail =
  | { status: 'ok'; messages: StoredMessage[] }
  | { status: 'not_found' }
  | { status: 'error' }

export async function getConversation(id: string): Promise<ConversationDetail> {
  const res = await authFetch(`/api/conversations/${id}`)
  if (res.status === 404) return { status: 'not_found' }
  if (!res.ok) return { status: 'error' }
  const data = await res.json()
  return {
    status: 'ok',
    messages: Array.isArray(data.messages) ? data.messages : [],
  }
}

/** 删除成功（含已不存在）返回 true */
export async function deleteConversation(id: string): Promise<boolean> {
  const res = await authFetch(`/api/conversations/${id}`, { method: 'DELETE' })
  return res.ok || res.status === 204 || res.status === 404
}
