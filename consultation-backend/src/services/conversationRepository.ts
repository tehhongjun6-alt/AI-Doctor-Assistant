import { randomUUID } from 'node:crypto'
import pg from 'pg'
import type { MedicalDataCategory } from '../routing/medicalDataTypes.js'
import type { EmergencyCategory } from '../safety/emergencyCheck.js'
import type { ChatAnswer, ChatHistoryMessage } from '../schemas/chat.js'
import type { MedicalEvidence } from './medicalData/medicalDataTypes.js'

export const MAX_CONVERSATIONS_PER_USER = 3
export const MAX_MESSAGES_PER_CONVERSATION = 100
export const CONVERSATION_TTL_DAYS = 30
export const CONTEXT_HISTORY_LIMIT = 20
const MAX_TOPIC_MESSAGES = 6

export type ActiveMedicalCategory = Exclude<
  MedicalDataCategory,
  'greeting' | 'unknown'
>

export interface ActiveEmergencyState {
  category: EmergencyCategory
  reason: string
}

export interface ConversationSummary {
  id: string
  title: string
  messageCount: number
  createdAt: Date
  updatedAt: Date
}

export interface ConversationStateFields {
  activeCategory?: ActiveMedicalCategory
  activeEmergency?: ActiveEmergencyState
  topicMessages: string[]
  lastEvidence: MedicalEvidence[]
  lastSearchQueries: string[]
}

export interface ConversationState extends ConversationStateFields {
  id: string
  userId: string
  title: string
  messageCount: number
  createdAt: Date
  updatedAt: Date
}

export interface ConversationMessageRecord {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  answer?: ChatAnswer | null
  sources?: Array<{ title: string; url: string; provider?: string }> | null
  isEmergency: boolean
  mapCareLevel?: 'hospital' | 'clinic' | null
  useForContext: boolean
  createdAt: Date
}

export interface StateTransitionInput {
  userMessage: string
  category?: MedicalDataCategory
  evidence?: MedicalEvidence[]
  searchQueries?: string[]
  activeEmergency?: ActiveEmergencyState | null
}

export interface AppendTurnInput extends StateTransitionInput {
  conversationId: string
  userId: string
  assistantAnswer: ChatAnswer
  assistantContent?: string
  sources?: Array<{ title: string; url: string; provider?: string }> | null
  isEmergency?: boolean
  mapCareLevel?: 'hospital' | 'clinic' | null
  useForContext?: boolean
}

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

export function nextConversationState(
  existing: Partial<ConversationStateFields> | undefined,
  turn: StateTransitionInput,
): ConversationStateFields {
  const isMedicalCategory =
    turn.category !== undefined &&
    turn.category !== 'greeting' &&
    turn.category !== 'unknown'

  const activeCategory: ActiveMedicalCategory | undefined = isMedicalCategory
    ? (turn.category as ActiveMedicalCategory)
    : existing?.activeCategory

  const topicMessages = isMedicalCategory
    ? [...(existing?.topicMessages ?? []), turn.userMessage].slice(
        -MAX_TOPIC_MESSAGES,
      )
    : (existing?.topicMessages ?? [])

  const lastEvidence =
    turn.evidence && turn.evidence.length > 0
      ? turn.evidence
      : (existing?.lastEvidence ?? [])

  const lastSearchQueries =
    turn.searchQueries && turn.searchQueries.length > 0
      ? turn.searchQueries
      : (existing?.lastSearchQueries ?? [])

  const activeEmergency =
    turn.activeEmergency === null
      ? undefined
      : (turn.activeEmergency ?? existing?.activeEmergency)

  return {
    activeCategory,
    activeEmergency,
    topicMessages,
    lastEvidence,
    lastSearchQueries,
  }
}

export interface ConversationRepository {
  listByUser(userId: string): Promise<ConversationSummary[]>
  get(id: string, userId: string): Promise<ConversationState | null>
  createIfUnderLimit(
    userId: string,
    title: string,
  ): Promise<ConversationSummary | null>
  getContextHistory(
    id: string,
    limit?: number,
  ): Promise<ChatHistoryMessage[]>
  getMessages(
    id: string,
    userId: string,
  ): Promise<ConversationMessageRecord[] | null>
  appendTurn(
    input: AppendTurnInput,
  ): Promise<{
    userMessageId: string
    assistantMessageId: string
    state: ConversationState
  } | null>
  delete(id: string, userId: string): Promise<boolean>
  deleteExpired(): Promise<number>
}

// ============================================================================
// 1. In-Memory Implementation (For Testing and Local Dev without DB)
// ============================================================================

export function createMemoryConversationRepository(options: {
  now?: () => Date
} = {}): ConversationRepository {
  const getNow = options.now ?? (() => new Date())
  const conversations = new Map<string, ConversationState>()
  const messages = new Map<string, ConversationMessageRecord[]>()

  function isExpired(conv: ConversationState): boolean {
    const ttlMs = CONVERSATION_TTL_DAYS * 24 * 60 * 60 * 1000
    return getNow().getTime() - conv.updatedAt.getTime() > ttlMs
  }

  return {
    async listByUser(userId: string): Promise<ConversationSummary[]> {
      const result: ConversationSummary[] = []
      for (const conv of conversations.values()) {
        if (conv.userId === userId && !isExpired(conv)) {
          result.push({
            id: conv.id,
            title: conv.title,
            messageCount: conv.messageCount,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
          })
        }
      }
      return result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    },

    async get(id: string, userId: string): Promise<ConversationState | null> {
      const conv = conversations.get(id)
      if (!conv || conv.userId !== userId || isExpired(conv)) {
        return null
      }
      return { ...conv }
    },

    async createIfUnderLimit(
      userId: string,
      title: string,
    ): Promise<ConversationSummary | null> {
      let activeCount = 0
      for (const conv of conversations.values()) {
        if (conv.userId === userId && !isExpired(conv)) {
          activeCount += 1
        }
      }
      if (activeCount >= MAX_CONVERSATIONS_PER_USER) {
        return null
      }

      const id = randomUUID()
      const now = getNow()
      const conv: ConversationState = {
        id,
        userId,
        title,
        messageCount: 0,
        topicMessages: [],
        lastEvidence: [],
        lastSearchQueries: [],
        createdAt: now,
        updatedAt: now,
      }
      conversations.set(id, conv)
      messages.set(id, [])
      return {
        id: conv.id,
        title: conv.title,
        messageCount: conv.messageCount,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      }
    },

    async getContextHistory(
      id: string,
      limit = CONTEXT_HISTORY_LIMIT,
    ): Promise<ChatHistoryMessage[]> {
      const convMessages = messages.get(id) ?? []
      return convMessages
        .filter((m) => m.useForContext)
        .slice(-limit)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))
    },

    async getMessages(
      id: string,
      userId: string,
    ): Promise<ConversationMessageRecord[] | null> {
      const conv = conversations.get(id)
      if (!conv || conv.userId !== userId || isExpired(conv)) {
        return null
      }
      return (messages.get(id) ?? []).map((m) => ({ ...m }))
    },

    async appendTurn(
      input: AppendTurnInput,
    ): Promise<{
      userMessageId: string
      assistantMessageId: string
      state: ConversationState
    } | null> {
      const conv = conversations.get(input.conversationId)
      if (!conv || conv.userId !== input.userId || isExpired(conv)) {
        return null
      }

      const now = getNow()
      const userMessageId = randomUUID()
      const assistantMessageId = randomUUID()

      const userMsg: ConversationMessageRecord = {
        id: userMessageId,
        conversationId: conv.id,
        role: 'user',
        content: input.userMessage,
        useForContext: true,
        isEmergency: false,
        createdAt: now,
      }

      const assistantContent =
        input.assistantContent ?? formatAnswerForHistory(input.assistantAnswer)

      const assistantMsg: ConversationMessageRecord = {
        id: assistantMessageId,
        conversationId: conv.id,
        role: 'assistant',
        content: assistantContent,
        answer: input.assistantAnswer,
        sources: input.sources ?? null,
        isEmergency: Boolean(input.isEmergency),
        mapCareLevel: input.mapCareLevel ?? null,
        useForContext: input.useForContext !== false,
        createdAt: new Date(now.getTime() + 1),
      }

      const nextState = nextConversationState(conv, input)
      conv.activeCategory = nextState.activeCategory
      conv.activeEmergency = nextState.activeEmergency
      conv.topicMessages = nextState.topicMessages
      conv.lastEvidence = nextState.lastEvidence
      conv.lastSearchQueries = nextState.lastSearchQueries
      conv.messageCount += 2
      conv.updatedAt = assistantMsg.createdAt

      const list = messages.get(conv.id) ?? []
      list.push(userMsg, assistantMsg)
      messages.set(conv.id, list)

      return {
        userMessageId,
        assistantMessageId,
        state: { ...conv },
      }
    },

    async delete(id: string, userId: string): Promise<boolean> {
      const conv = conversations.get(id)
      if (!conv || conv.userId !== userId) {
        return false
      }
      conversations.delete(id)
      messages.delete(id)
      return true
    },

    async deleteExpired(): Promise<number> {
      let count = 0
      for (const [id, conv] of conversations.entries()) {
        if (isExpired(conv)) {
          conversations.delete(id)
          messages.delete(id)
          count += 1
        }
      }
      return count
    },
  }
}

// ============================================================================
// 2. PostgreSQL Implementation (Supabase Database Production)
// ============================================================================

interface ConversationRow {
  id: string
  user_id: string
  title: string
  active_category: string | null
  active_emergency: ActiveEmergencyState | null
  topic_messages: string[] | null
  last_evidence: MedicalEvidence[] | null
  last_search_queries: string[] | null
  message_count: number
  created_at: Date
  updated_at: Date
}

interface MessageRow {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  answer: ChatAnswer | null
  sources: Array<{ title: string; url: string; provider?: string }> | null
  is_emergency: boolean
  map_care_level: 'hospital' | 'clinic' | null
  use_for_context: boolean
  created_at: Date
}

export function createPgConversationRepository(
  connectionString = process.env.DATABASE_URL,
): ConversationRepository {
  let pool: pg.Pool | undefined

  function getPool(): pg.Pool {
    if (!connectionString) {
      throw new Error('DATABASE_URL 尚未配置。')
    }
    pool ??= new pg.Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
    })
    return pool
  }

  function rowToState(row: ConversationRow): ConversationState {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      activeCategory: (row.active_category as ActiveMedicalCategory) || undefined,
      activeEmergency: row.active_emergency || undefined,
      topicMessages: row.topic_messages || [],
      lastEvidence: row.last_evidence || [],
      lastSearchQueries: row.last_search_queries || [],
      messageCount: row.message_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }

  return {
    async listByUser(userId: string): Promise<ConversationSummary[]> {
      const result = await getPool().query<ConversationRow>(
        `select id, title, message_count, created_at, updated_at
         from public.conversations
         where user_id = $1::uuid
           and updated_at >= now() - interval '30 days'
         order by updated_at desc`,
        [userId],
      )
      return result.rows.map((r) => ({
        id: r.id,
        title: r.title,
        messageCount: r.message_count,
        createdAt: new Date(r.created_at),
        updatedAt: new Date(r.updated_at),
      }))
    },

    async get(id: string, userId: string): Promise<ConversationState | null> {
      const result = await getPool().query<ConversationRow>(
        `select id, user_id, title, active_category, active_emergency,
                topic_messages, last_evidence, last_search_queries,
                message_count, created_at, updated_at
         from public.conversations
         where id = $1::uuid
           and user_id = $2::uuid
           and updated_at >= now() - interval '30 days'`,
        [id, userId],
      )
      const row = result.rows[0]
      return row ? rowToState(row) : null
    },

    async createIfUnderLimit(
      userId: string,
      title: string,
    ): Promise<ConversationSummary | null> {
      const result = await getPool().query<ConversationRow>(
        `insert into public.conversations (user_id, title)
         select $1::uuid, $2
         where (
           select count(*)
           from public.conversations
           where user_id = $1::uuid
             and updated_at >= now() - interval '30 days'
         ) < $3
         returning id, title, message_count, created_at, updated_at`,
        [userId, title, MAX_CONVERSATIONS_PER_USER],
      )
      const row = result.rows[0]
      if (!row) return null
      return {
        id: row.id,
        title: row.title,
        messageCount: row.message_count,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }
    },

    async getContextHistory(
      id: string,
      limit = CONTEXT_HISTORY_LIMIT,
    ): Promise<ChatHistoryMessage[]> {
      const result = await getPool().query<Pick<MessageRow, 'role' | 'content'>>(
        `select role, content
         from (
           select role, content, created_at
           from public.conversation_messages
           where conversation_id = $1::uuid
             and use_for_context = true
           order by created_at desc
           limit $2
         ) sub
         order by created_at asc`,
        [id, limit],
      )
      return result.rows.map((r) => ({
        role: r.role,
        content: r.content,
      }))
    },

    async getMessages(
      id: string,
      userId: string,
    ): Promise<ConversationMessageRecord[] | null> {
      const client = await getPool().connect()
      try {
        const convCheck = await client.query<{ id: string }>(
          `select id from public.conversations
           where id = $1::uuid and user_id = $2::uuid
             and updated_at >= now() - interval '30 days'`,
          [id, userId],
        )
        if (convCheck.rows.length === 0) return null

        const msgResult = await client.query<MessageRow>(
          `select id, conversation_id, role, content, answer, sources,
                  is_emergency, map_care_level, use_for_context, created_at
           from public.conversation_messages
           where conversation_id = $1::uuid
           order by created_at asc`,
          [id],
        )
        return msgResult.rows.map((r) => ({
          id: r.id,
          conversationId: r.conversation_id,
          role: r.role,
          content: r.content,
          answer: r.answer,
          sources: r.sources,
          isEmergency: r.is_emergency,
          mapCareLevel: r.map_care_level,
          useForContext: r.use_for_context,
          createdAt: new Date(r.created_at),
        }))
      } finally {
        client.release()
      }
    },

    async appendTurn(
      input: AppendTurnInput,
    ): Promise<{
      userMessageId: string
      assistantMessageId: string
      state: ConversationState
    } | null> {
      const client = await getPool().connect()
      try {
        await client.query('BEGIN')

        const convResult = await client.query<ConversationRow>(
          `select * from public.conversations
           where id = $1::uuid and user_id = $2::uuid
             and updated_at >= now() - interval '30 days'
           for update`,
          [input.conversationId, input.userId],
        )
        const row = convResult.rows[0]
        if (!row) {
          await client.query('ROLLBACK')
          return null
        }

        const existingState = rowToState(row)
        const nextState = nextConversationState(existingState, input)

        const userMsgRes = await client.query<{ id: string }>(
          `insert into public.conversation_messages
           (conversation_id, role, content, use_for_context)
           values ($1::uuid, 'user', $2, true)
           returning id`,
          [input.conversationId, input.userMessage],
        )

        const assistantContent =
          input.assistantContent ?? formatAnswerForHistory(input.assistantAnswer)

        const asstMsgRes = await client.query<{ id: string }>(
          `insert into public.conversation_messages
           (conversation_id, role, content, answer, sources, is_emergency, map_care_level, use_for_context)
           values ($1::uuid, 'assistant', $2, $3::jsonb, $4::jsonb, $5, $6, $7)
           returning id`,
          [
            input.conversationId,
            assistantContent,
            JSON.stringify(input.assistantAnswer),
            input.sources ? JSON.stringify(input.sources) : null,
            Boolean(input.isEmergency),
            input.mapCareLevel ?? null,
            input.useForContext !== false,
          ],
        )

        const updateRes = await client.query<ConversationRow>(
          `update public.conversations
           set active_category = $1,
               active_emergency = $2::jsonb,
               topic_messages = $3::jsonb,
               last_evidence = $4::jsonb,
               last_search_queries = $5::jsonb,
               message_count = message_count + 2,
               updated_at = now()
           where id = $6::uuid
           returning *`,
          [
            nextState.activeCategory ?? null,
            nextState.activeEmergency ? JSON.stringify(nextState.activeEmergency) : null,
            JSON.stringify(nextState.topicMessages),
            JSON.stringify(nextState.lastEvidence),
            JSON.stringify(nextState.lastSearchQueries),
            input.conversationId,
          ],
        )

        await client.query('COMMIT')

        return {
          userMessageId: userMsgRes.rows[0].id,
          assistantMessageId: asstMsgRes.rows[0].id,
          state: rowToState(updateRes.rows[0]),
        }
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    },

    async delete(id: string, userId: string): Promise<boolean> {
      const result = await getPool().query(
        `delete from public.conversations
         where id = $1::uuid and user_id = $2::uuid`,
        [id, userId],
      )
      return (result.rowCount ?? 0) > 0
    },

    async deleteExpired(): Promise<number> {
      const result = await getPool().query(
        `delete from public.conversations
         where updated_at < now() - interval '30 days'`,
      )
      return result.rowCount ?? 0
    },
  }
}
