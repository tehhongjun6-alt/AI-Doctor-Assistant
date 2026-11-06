import { describe, expect, it } from 'vitest'
import {
  createMemoryConversationRepository,
  formatAnswerForHistory,
  nextConversationState,
  MAX_CONVERSATIONS_PER_USER,
  CONTEXT_HISTORY_LIMIT,
  CONVERSATION_TTL_DAYS,
} from '../src/services/conversationRepository.js'
import type { ChatAnswer } from '../schemas/chat.js'

const sampleAnswer: ChatAnswer = {
  summary: '您的症状可能需要关注',
  followUpQuestions: ['持续多久了？'],
  possibleCauses: ['感冒', '流感'],
  advice: ['多喝水', '注意休息'],
}

describe('conversationRepository - Memory Implementation & State Transitions (Step 4b)', () => {
  it('enforces limit of 3 conversations per user and allows creation after deletion', async () => {
    const repo = createMemoryConversationRepository()
    const userId = 'user-limit-test'

    const c1 = await repo.createIfUnderLimit(userId, '对话 1')
    const c2 = await repo.createIfUnderLimit(userId, '对话 2')
    const c3 = await repo.createIfUnderLimit(userId, '对话 3')

    expect(c1).not.toBeNull()
    expect(c2).not.toBeNull()
    expect(c3).not.toBeNull()

    // 4th conversation creation should be rejected
    const c4 = await repo.createIfUnderLimit(userId, '对话 4')
    expect(c4).toBeNull()

    const listBefore = await repo.listByUser(userId)
    expect(listBefore).toHaveLength(MAX_CONVERSATIONS_PER_USER)

    // Deleting one conversation frees up a slot
    const deleted = await repo.delete(c2!.id, userId)
    expect(deleted).toBe(true)

    const c4Retry = await repo.createIfUnderLimit(userId, '对话 4 重试')
    expect(c4Retry).not.toBeNull()
    expect(c4Retry?.title).toBe('对话 4 重试')

    const listAfter = await repo.listByUser(userId)
    expect(listAfter).toHaveLength(3)
  })

  it('getContextHistory only returns latest 20 items and skips use_for_context = false messages', async () => {
    const repo = createMemoryConversationRepository()
    const userId = 'user-history-test'
    const conv = await repo.createIfUnderLimit(userId, '历史记录测试')
    expect(conv).not.toBeNull()

    // Append 15 turns (30 messages total)
    // Turn 10 assistant message marked with useForContext = false
    for (let i = 1; i <= 15; i++) {
      await repo.appendTurn({
        conversationId: conv!.id,
        userId,
        userMessage: `用户问题 ${i}`,
        assistantAnswer: {
          summary: `回答总结 ${i}`,
          followUpQuestions: [],
          possibleCauses: [],
          advice: [],
        },
        useForContext: i !== 10, // turn 10 assistant won't be used for context
      })
    }

    const history = await repo.getContextHistory(conv!.id)
    // Should be capped at CONTEXT_HISTORY_LIMIT (20)
    expect(history.length).toBeLessThanOrEqual(CONTEXT_HISTORY_LIMIT)
    expect(history).toHaveLength(20)

    // Verify turn 10 assistant answer is not in context
    const hasTurn10Assistant = history.some(
      (m) => m.role === 'assistant' && m.content.includes('回答总结 10'),
    )
    expect(hasTurn10Assistant).toBe(false)

    // The most recent assistant answer (turn 15) should be present
    const hasTurn15Assistant = history.some(
      (m) => m.role === 'assistant' && m.content.includes('回答总结 15'),
    )
    expect(hasTurn15Assistant).toBe(true)
  })

  it('filters expired conversations (>30 days) from listByUser/get, and deletes them via deleteExpired', async () => {
    let now = new Date('2026-01-01T00:00:00.000Z')
    const repo = createMemoryConversationRepository({ now: () => now })
    const userId = 'user-ttl-test'

    const conv = await repo.createIfUnderLimit(userId, '有效期对话')
    expect(conv).not.toBeNull()

    // Immediately visible
    const initialList = await repo.listByUser(userId)
    expect(initialList).toHaveLength(1)
    const initialGet = await repo.get(conv!.id, userId)
    expect(initialGet).not.toBeNull()

    // Advance time by 31 days (beyond CONVERSATION_TTL_DAYS = 30)
    now = new Date(
      now.getTime() + (CONVERSATION_TTL_DAYS + 1) * 24 * 60 * 60 * 1000,
    )

    // Now expired: hidden from list and get
    const expiredList = await repo.listByUser(userId)
    expect(expiredList).toHaveLength(0)

    const expiredGet = await repo.get(conv!.id, userId)
    expect(expiredGet).toBeNull()

    const expiredMessages = await repo.getMessages(conv!.id, userId)
    expect(expiredMessages).toBeNull()

    // Purge expired records
    const purgedCount = await repo.deleteExpired()
    expect(purgedCount).toBe(1)

    // Purging again deletes nothing
    const purgedAgain = await repo.deleteExpired()
    expect(purgedAgain).toBe(0)
  })

  it('isolates conversations across different users', async () => {
    const repo = createMemoryConversationRepository()
    const userA = 'user-alice-uuid'
    const userB = 'user-bob-uuid'

    const convA = await repo.createIfUnderLimit(userA, 'Alice 的对话')
    expect(convA).not.toBeNull()

    // User B attempts to access Alice's conversation
    const getResult = await repo.get(convA!.id, userB)
    expect(getResult).toBeNull()

    const getMessagesResult = await repo.getMessages(convA!.id, userB)
    expect(getMessagesResult).toBeNull()

    const deleteResult = await repo.delete(convA!.id, userB)
    expect(deleteResult).toBe(false)

    // Append turn by User B to Alice's conversation should also fail
    const appendResult = await repo.appendTurn({
      conversationId: convA!.id,
      userId: userB,
      userMessage: 'Bob trying to append',
      assistantAnswer: sampleAnswer,
    })
    expect(appendResult).toBeNull()

    // Alice still has full access to her conversation
    const aliceGet = await repo.get(convA!.id, userA)
    expect(aliceGet).not.toBeNull()
    expect(aliceGet?.title).toBe('Alice 的对话')
  })

  it('tracks conversation state correctly across turns in nextConversationState', () => {
    // Turn 1: medical question with evidence and search queries
    const turn1Input = {
      userMessage: '我胸口有点闷痛',
      category: 'cardiology' as const,
      evidence: [{ title: 'Heart Guide', url: 'https://example.com' }],
      searchQueries: ['胸痛 原因'],
      activeEmergency: {
        category: 'chest_pain' as const,
        reason: '用户描述胸痛',
      },
    }

    const nextState1 = nextConversationState(undefined, turn1Input)

    expect(nextState1.activeCategory).toBe('cardiology')
    expect(nextState1.activeEmergency).toEqual({
      category: 'chest_pain',
      reason: '用户描述胸痛',
    })
    expect(nextState1.topicMessages).toEqual(['我胸口有点闷痛'])
    expect(nextState1.lastEvidence).toEqual([
      { title: 'Heart Guide', url: 'https://example.com' },
    ])
    expect(nextState1.lastSearchQueries).toEqual(['胸痛 原因'])

    // Turn 2: non-medical greeting turn, should keep activeCategory & searchQueries
    const turn2Input = {
      userMessage: '你好啊',
      category: 'greeting' as const,
    }

    const nextState2 = nextConversationState(nextState1, turn2Input)

    expect(nextState2.activeCategory).toBe('cardiology')
    expect(nextState2.activeEmergency).toEqual({
      category: 'chest_pain',
      reason: '用户描述胸痛',
    })
    expect(nextState2.topicMessages).toEqual(['我胸口有点闷痛'])
    expect(nextState2.lastEvidence).toEqual([
      { title: 'Heart Guide', url: 'https://example.com' },
    ])
    expect(nextState2.lastSearchQueries).toEqual(['胸痛 原因'])

    // Turn 3: emergency cleared (null)
    const nextState3 = nextConversationState(nextState2, {
      userMessage: '现在不痛了，医生说是胃酸反流',
      category: 'gastroenterology' as const,
      activeEmergency: null,
    })
    expect(nextState3.activeCategory).toBe('gastroenterology')
    expect(nextState3.activeEmergency).toBeUndefined()
  })

  it('formats answers for history consistently', () => {
    const formatted = formatAnswerForHistory(sampleAnswer)
    expect(formatted).toContain('您的症状可能需要关注')
    expect(formatted).toContain('追问：持续多久了？')
    expect(formatted).toContain('可能原因：感冒；流感')
    expect(formatted).toContain('建议：多喝水；注意休息')
  })

  describe('popLastTurn (Step 6)', () => {
    it('pops the last turn, updates message count, and returns the popped user message', async () => {
      const repo = createMemoryConversationRepository()
      const userId = 'user-pop-test'
      const conv = await repo.createIfUnderLimit(userId, '测试重新回答')
      expect(conv).not.toBeNull()

      await repo.appendTurn({
        conversationId: conv!.id,
        userId,
        userMessage: '第 1 轮问题：头痛',
        assistantAnswer: {
          summary: '第 1 轮回答',
          followUpQuestions: [],
          possibleCauses: [],
          advice: [],
          urgency: 'low',
          seekCareWhen: [],
          disclaimer: '免责声明',
        },
      })

      await repo.appendTurn({
        conversationId: conv!.id,
        userId,
        userMessage: '第 2 轮问题：发烧 38.5 度',
        assistantAnswer: {
          summary: '第 2 轮回答',
          followUpQuestions: [],
          possibleCauses: [],
          advice: [],
          urgency: 'medium',
          seekCareWhen: [],
          disclaimer: '免责声明',
        },
      })

      const beforePopMessages = await repo.getMessages(conv!.id, userId)
      expect(beforePopMessages).toHaveLength(4)

      const popResult = await repo.popLastTurn(conv!.id, userId)
      expect(popResult).toEqual({ userMessage: '第 2 轮问题：发烧 38.5 度' })

      const afterState = await repo.get(conv!.id, userId)
      expect(afterState?.messageCount).toBe(2)

      const afterPopMessages = await repo.getMessages(conv!.id, userId)
      expect(afterPopMessages).toHaveLength(2)
      expect(afterPopMessages?.map((m) => m.content)).toEqual([
        '第 1 轮问题：头痛',
        expect.stringContaining('第 1 轮回答'),
      ])

      const history = await repo.getContextHistory(conv!.id)
      expect(history).toHaveLength(2)
      expect(history[0].content).toBe('第 1 轮问题：头痛')
    })

    it('returns null when conversation is empty', async () => {
      const repo = createMemoryConversationRepository()
      const userId = 'user-empty-test'
      const conv = await repo.createIfUnderLimit(userId, '空对话')
      expect(conv).not.toBeNull()

      const popResult = await repo.popLastTurn(conv!.id, userId)
      expect(popResult).toBeNull()
    })

    it('returns null when conversation belongs to another user', async () => {
      const repo = createMemoryConversationRepository()
      const userId = 'user-owner'
      const conv = await repo.createIfUnderLimit(userId, '他人对话')
      expect(conv).not.toBeNull()

      await repo.appendTurn({
        conversationId: conv!.id,
        userId,
        userMessage: '私密问题',
        assistantAnswer: {
          summary: '私密回答',
          followUpQuestions: [],
          possibleCauses: [],
          advice: [],
          urgency: 'low',
          seekCareWhen: [],
          disclaimer: '免责声明',
        },
      })

      const popResult = await repo.popLastTurn(conv!.id, 'attacker-user')
      expect(popResult).toBeNull()

      // The turn was not deleted
      const messages = await repo.getMessages(conv!.id, userId)
      expect(messages).toHaveLength(2)
    })
  })
})
