import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { signToken } from '../src/auth/token.js'
import { createMemoryConversationRepository } from '../src/services/conversationRepository.js'

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
const authHeader = (id: string, email = `${id}@example.com`) =>
  `Bearer ${signToken({ id, email }).token}`

const modelAnswer = {
  summary: '医生建议休息并观察。',
  followUpQuestions: ['持续多久了？'],
  possibleCauses: ['劳累', '感冒'],
  urgency: 'low' as const,
  advice: ['多喝温水', '充分休息'],
  seekCareWhen: ['出现剧烈疼痛时就医'],
  disclaimer: '仅供参考。',
}

const mockSymptomRoute = vi.fn().mockResolvedValue({
  route: 'medical_api',
  category: 'symptom',
  reason: 'test',
  searchQueries: ['sore throat'],
})

const mockNoEvidence = vi.fn().mockResolvedValue({
  status: 'success',
  evidence: [],
  issues: [],
  searchQuery: 'sore throat',
})

describe('Multi-conversation API endpoints & session migration (Step 4c)', () => {
  it('creates a new conversation when sending without conversationId, visible in GET /api/conversations with first 15 chars title', async () => {
    const memoryRepo = createMemoryConversationRepository()
    const generateHealthAnswer = vi.fn().mockResolvedValue(modelAnswer)
    const app = createApp({
      conversationRepository: memoryRepo,
      generateHealthAnswer,
      routeMedicalData: mockSymptomRoute,
      retrieveMedicalData: mockNoEvidence,
    })
    const userToken = authHeader('user-alpha')
    const longMessage = '我最近几天一直觉得头晕乏力想吐，想问问可能是什么原因'

    const postRes = await request(app)
      .post('/api/chat')
      .set('Authorization', userToken)
      .send({ message: longMessage })

    expect(postRes.status).toBe(200)
    expect(postRes.body.success).toBe(true)
    const conversationId = postRes.body.data.conversationId
    expect(typeof conversationId).toBe('string')
    expect(conversationId).toBeTruthy()

    // Query list
    const listRes = await request(app)
      .get('/api/conversations')
      .set('Authorization', userToken)

    expect(listRes.status).toBe(200)
    expect(listRes.body.limit).toBe(3)
    expect(listRes.body.conversations).toHaveLength(1)
    expect(listRes.body.conversations[0]).toMatchObject({
      id: conversationId,
      title: longMessage.slice(0, 15),
      messageCount: 2,
    })

    // Query detail
    const detailRes = await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', userToken)

    expect(detailRes.status).toBe(200)
    expect(detailRes.body.conversation).toMatchObject({
      id: conversationId,
      title: longMessage.slice(0, 15),
      messageCount: 2,
    })
    expect(detailRes.body.messages).toHaveLength(2)
    expect(detailRes.body.messages[0].role).toBe('user')
    expect(detailRes.body.messages[0].content).toBe(longMessage)
    expect(detailRes.body.messages[1].role).toBe('assistant')
    expect(detailRes.body.messages[1].answer).toBeDefined()
  })

  it('rejects the 4th conversation with 409 CONVERSATION_LIMIT_REACHED without calling Gemini', async () => {
    const memoryRepo = createMemoryConversationRepository()
    const generateHealthAnswer = vi.fn().mockResolvedValue(modelAnswer)
    const app = createApp({
      conversationRepository: memoryRepo,
      generateHealthAnswer,
      routeMedicalData: mockSymptomRoute,
      retrieveMedicalData: mockNoEvidence,
    })
    const userToken = authHeader('user-limit-check')

    // Create 3 valid conversations
    for (let i = 1; i <= 3; i++) {
      const res = await request(app)
        .post('/api/chat')
        .set('Authorization', userToken)
        .send({ message: `这是第 ${i} 个对话` })
      expect(res.status).toBe(200)
    }

    expect(generateHealthAnswer).toHaveBeenCalledTimes(3)

    // Attempt 4th conversation
    const fourthRes = await request(app)
      .post('/api/chat')
      .set('Authorization', userToken)
      .send({ message: '尝试建立第 4 个对话' })

    expect(fourthRes.status).toBe(409)
    expect(fourthRes.body).toMatchObject({
      success: false,
      error: {
        code: 'CONVERSATION_LIMIT_REACHED',
        message: '对话已满（最多 3 个），请先删除一个。',
      },
    })

    // Gemini was NOT called for the 4th request
    expect(generateHealthAnswer).toHaveBeenCalledTimes(3)
  })

  it('rejects message when conversation reaches 100 messages with 409 CONVERSATION_FULL without calling Gemini', async () => {
    const memoryRepo = createMemoryConversationRepository()
    const generateHealthAnswer = vi.fn().mockResolvedValue(modelAnswer)
    const app = createApp({
      conversationRepository: memoryRepo,
      generateHealthAnswer,
      routeMedicalData: mockSymptomRoute,
      retrieveMedicalData: mockNoEvidence,
    })
    const userId = 'user-capacity-check'
    const userToken = authHeader(userId)

    const conv = await memoryRepo.createIfUnderLimit(userId, '满载对话测试')
    expect(conv).not.toBeNull()

    // Pre-fill conversation with 50 turns (100 messages)
    for (let i = 1; i <= 50; i++) {
      await memoryRepo.appendTurn({
        conversationId: conv!.id,
        userId,
        userMessage: `用户问题 ${i}`,
        assistantAnswer: modelAnswer,
      })
    }

    const convState = await memoryRepo.get(conv!.id, userId)
    expect(convState?.messageCount).toBe(100)

    // Send 101st message via API
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', userToken)
      .send({ conversationId: conv!.id, message: '第 101 条消息尝试' })

    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'CONVERSATION_FULL',
        message: '这个对话已满 100 条，请开新对话。',
      },
    })

    // Gemini was NOT called
    expect(generateHealthAnswer).not.toHaveBeenCalled()
  })

  it('passes server history to Gemini in follow-up turns', async () => {
    const memoryRepo = createMemoryConversationRepository()
    const generateHealthAnswer = vi.fn().mockResolvedValue(modelAnswer)
    const app = createApp({
      conversationRepository: memoryRepo,
      generateHealthAnswer,
      routeMedicalData: mockSymptomRoute,
      retrieveMedicalData: mockNoEvidence,
    })
    const userToken = authHeader('user-turn2')

    // Turn 1
    const res1 = await request(app)
      .post('/api/chat')
      .set('Authorization', userToken)
      .send({ message: '我喉咙痛两天了' })

    expect(res1.status).toBe(200)
    const conversationId = res1.body.data.conversationId

    // Turn 2
    const res2 = await request(app)
      .post('/api/chat')
      .set('Authorization', userToken)
      .send({ conversationId, message: '今天开始轻微发烧了' })

    expect(res2.status).toBe(200)

    // Gemini second call history should contain turn 1 user + assistant
    const secondCallArg = generateHealthAnswer.mock.calls[1][0]
    expect(secondCallArg.message).toBe('今天开始轻微发烧了')
    expect(secondCallArg.history).toHaveLength(2)
    expect(secondCallArg.history[0]).toEqual({
      role: 'user',
      content: '我喉咙痛两天了',
    })
    expect(secondCallArg.history[1].role).toBe('assistant')
    expect(secondCallArg.history[1].content).toContain(modelAnswer.summary)
  })

  it("returns 404 when reading, continuing, or deleting another user's conversation", async () => {
    const memoryRepo = createMemoryConversationRepository()
    const generateHealthAnswer = vi.fn().mockResolvedValue(modelAnswer)
    const app = createApp({
      conversationRepository: memoryRepo,
      generateHealthAnswer,
      routeMedicalData: mockSymptomRoute,
      retrieveMedicalData: mockNoEvidence,
    })
    const ownerToken = authHeader('owner-uuid')
    const intruderToken = authHeader('intruder-uuid')

    // Owner creates conversation
    const createRes = await request(app)
      .post('/api/chat')
      .set('Authorization', ownerToken)
      .send({ message: '私密健康咨询' })
    expect(createRes.status).toBe(200)
    const convId = createRes.body.data.conversationId

    // Intruder attempts to read conversation
    const getRes = await request(app)
      .get(`/api/conversations/${convId}`)
      .set('Authorization', intruderToken)
    expect(getRes.status).toBe(404)
    expect(getRes.body.error.code).toBe('CONVERSATION_NOT_FOUND')

    // Intruder attempts to continue conversation
    const continueRes = await request(app)
      .post('/api/chat')
      .set('Authorization', intruderToken)
      .send({ conversationId: convId, message: '入侵者提问' })
    expect(continueRes.status).toBe(404)
    expect(continueRes.body.error.code).toBe('CONVERSATION_NOT_FOUND')
    // Gemini was only called once (for owner)
    expect(generateHealthAnswer).toHaveBeenCalledTimes(1)

    // Intruder attempts to delete conversation
    const deleteRes = await request(app)
      .delete(`/api/conversations/${convId}`)
      .set('Authorization', intruderToken)
    expect(deleteRes.status).toBe(404)
    expect(deleteRes.body.error.code).toBe('CONVERSATION_NOT_FOUND')

    // Owner can still read it
    const ownerGetRes = await request(app)
      .get(`/api/conversations/${convId}`)
      .set('Authorization', ownerToken)
    expect(ownerGetRes.status).toBe(200)
  })

  it('returns 204 on delete, and subsequent GET returns 404', async () => {
    const memoryRepo = createMemoryConversationRepository()
    const generateHealthAnswer = vi.fn().mockResolvedValue(modelAnswer)
    const app = createApp({
      conversationRepository: memoryRepo,
      generateHealthAnswer,
      routeMedicalData: mockSymptomRoute,
      retrieveMedicalData: mockNoEvidence,
    })
    const userToken = authHeader('user-delete-test')

    const createRes = await request(app)
      .post('/api/chat')
      .set('Authorization', userToken)
      .send({ message: '需要删除的对话' })
    const convId = createRes.body.data.conversationId

    // Delete
    const deleteRes = await request(app)
      .delete(`/api/conversations/${convId}`)
      .set('Authorization', userToken)
    expect(deleteRes.status).toBe(204)

    // Subsequent GET should 404
    const getRes = await request(app)
      .get(`/api/conversations/${convId}`)
      .set('Authorization', userToken)
    expect(getRes.status).toBe(404)
    expect(getRes.body.error.code).toBe('CONVERSATION_NOT_FOUND')
  })
})
