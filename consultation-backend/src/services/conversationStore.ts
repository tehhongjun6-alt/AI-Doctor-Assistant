import type { MedicalDataCategory } from '../routing/medicalDataTypes.js'
import type { EmergencyCategory } from '../safety/emergencyCheck.js'
import type { ChatAnswer, ChatHistoryMessage } from '../schemas/chat.js'
import type { MedicalEvidence } from './medicalData/medicalDataTypes.js'

export type ActiveMedicalCategory = Exclude<
  MedicalDataCategory,
  'greeting' | 'unknown'
>

export interface ActiveEmergencyState {
  category: EmergencyCategory
  reason: string
}

export interface ConversationSession {
  conversationId: string
  history: ChatHistoryMessage[]
  activeCategory?: ActiveMedicalCategory
  activeEmergency?: ActiveEmergencyState
  topicMessages: string[]
  lastEvidence: MedicalEvidence[]
  updatedAt: number
}

const SESSION_TTL_MS = 30 * 60 * 1000
const MAX_HISTORY_MESSAGES = 20
const MAX_TOPIC_MESSAGES = 6

export function formatAnswerForHistory(answer: ChatAnswer): string {
  const parts = [answer.summary]
  if (answer.followUpQuestions.length > 0) {
    parts.push(`追问：${answer.followUpQuestions.join('；')}`)
  }
  if (answer.possibleCauses.length > 0) {
    parts.push(`可能原因：${answer.possibleCauses.join('；')}`)
  }
  if (answer.advice.length > 0) {
    parts.push(`建议：${answer.advice.join('；')}`)
  }
  return parts.join('\n')
}

export class ConversationStore {
  private readonly sessions = new Map<string, ConversationSession>()

  private cleanupExpired(now = Date.now()) {
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.updatedAt > SESSION_TTL_MS) {
        this.sessions.delete(id)
      }
    }
  }

  getSession(conversationId?: string): ConversationSession | undefined {
    this.cleanupExpired()
    if (!conversationId) return undefined
    return this.sessions.get(conversationId)
  }

  getMergedHistory(
    conversationId: string | undefined,
    clientHistory: ChatHistoryMessage[] = [],
  ): ChatHistoryMessage[] {
    const session = this.getSession(conversationId)
    if (session && session.history.length > 0) {
      return session.history.slice(-MAX_HISTORY_MESSAGES)
    }
    return clientHistory.slice(-MAX_HISTORY_MESSAGES)
  }

  saveTurn(input: {
    conversationId: string
    userMessage: string
    answer: ChatAnswer
    clientHistory?: ChatHistoryMessage[]
    category?: MedicalDataCategory
    evidence?: MedicalEvidence[]
    activeEmergency?: ActiveEmergencyState | null
  }): ConversationSession {
    this.cleanupExpired()
    const existing = this.sessions.get(input.conversationId)
    const baseHistory = existing
      ? existing.history
      : (input.clientHistory ?? [])

    const updatedHistory: ChatHistoryMessage[] = [
      ...baseHistory,
      { role: 'user' as const, content: input.userMessage },
      { role: 'assistant' as const, content: formatAnswerForHistory(input.answer) },
    ].slice(-MAX_HISTORY_MESSAGES)

    const isMedicalCategory =
      input.category !== undefined &&
      input.category !== 'greeting' &&
      input.category !== 'unknown'

    const activeCategory: ActiveMedicalCategory | undefined = isMedicalCategory
      ? (input.category as ActiveMedicalCategory)
      : existing?.activeCategory

    const topicMessages = isMedicalCategory
      ? [...(existing?.topicMessages ?? []), input.userMessage].slice(
          -MAX_TOPIC_MESSAGES,
        )
      : (existing?.topicMessages ?? [])

    const lastEvidence =
      input.evidence && input.evidence.length > 0
        ? input.evidence
        : (existing?.lastEvidence ?? [])

    const activeEmergency =
      input.activeEmergency === null
        ? undefined
        : (input.activeEmergency ?? existing?.activeEmergency)

    const session: ConversationSession = {
      conversationId: input.conversationId,
      history: updatedHistory,
      activeCategory,
      activeEmergency,
      topicMessages,
      lastEvidence,
      updatedAt: Date.now(),
    }

    this.sessions.set(input.conversationId, session)
    return session
  }
}

export const defaultConversationStore = new ConversationStore()
