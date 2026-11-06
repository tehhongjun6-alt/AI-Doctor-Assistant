import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { signToken } from '../src/auth/token.js'
import { createMemoryConversationRepository } from '../src/services/conversationRepository.js'

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
const authU1 = () => `Bearer ${signToken({ id: 'u1', email: 'u1@example.com' }).token}`
const authU2 = () => `Bearer ${signToken({ id: 'u2', email: 'u2@example.com' }).token}`

describe('regenerate API (Step 6)', () => {
  const answer1 = {
    summary: '第 1 轮回答摘要。',
    followUpQuestions: [],
    possibleCauses: ['原因 1'],
    urgency: 'low' as const,
    advice: ['建议 1'],
    seekCareWhen: ['危险 1'],
    disclaimer: '免责 1',
  }

  const answer2 = {
    summary: '第 2 轮回答摘要。',
    followUpQuestions: [],
    possibleCauses: ['原因 2'],
    urgency: 'medium' as const,
    advice: ['建议 2'],
    seekCareWhen: ['危险 2'],
    disclaimer: '免责 2',
  }

  const answerRegenerated = {
    summary: '重新回答后的新摘要。',
    followUpQuestions: [],
    possibleCauses: ['新原因'],
    urgency: 'low' as const,
    advice: ['新建议'],
    seekCareWhen: ['新危险'],
    disclaimer: '免责',
  }

  const fakeRoute = vi.fn().mockResolvedValue({
    route: 'direct_model',
    category: 'symptom',
    reason: 'test',
    searchQueries: [],
  })

  it('regenerates the last turn: Gemini receives turn 2 user message, history has only turn 1, and total messages remain 4', async () => {
    const generateHealthAnswer = vi
      .fn()
      .mockResolvedValueOnce(answer1)
      .mockResolvedValueOnce(answer2)
      .mockResolvedValueOnce(answerRegenerated)

    const repo = createMemoryConversationRepository()
    const app = createApp({
      conversationRepository: repo,
      generateHealthAnswer,
      routeMedicalData: fakeRoute,
    })

    // Turn 1
    const res1 = await request(app)
      .post('/api/chat')
      .set('Authorization', authU1())
      .send({ message: '头痛两天' })
    expect(res1.status).toBe(200)
    const conversationId = res1.body.data.conversationId
    expect(conversationId).toBeDefined()

    // Turn 2
    const res2 = await request(app)
      .post('/api/chat')
      .set('Authorization', authU1())
      .send({ conversationId, message: '伴有轻微发烧 38 度' })
    expect(res2.status).toBe(200)

    // Verify 4 messages before regenerate
    const getBefore = await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', authU1())
    expect(getBefore.status).toBe(200)
    expect(getBefore.body.messages).toHaveLength(4)

    // Regenerate
    const resRegen = await request(app)
      .post('/api/chat')
      .set('Authorization', authU1())
      .send({
        conversationId,
        message: '用户端重传或占位内容（应被后端忽略）',
        regenerate: true,
      })

    expect(resRegen.status).toBe(200)
    expect(resRegen.body.success).toBe(true)
    expect(resRegen.body.data.answer.summary).toBe('重新回答后的新摘要。')

    // Check Gemini 3rd call
    expect(generateHealthAnswer).toHaveBeenCalledTimes(3)
    const thirdCallArg = generateHealthAnswer.mock.calls[2][0]
    expect(thirdCallArg.message).toBe('伴有轻微发烧 38 度')
    expect(thirdCallArg.history).toHaveLength(2)
    expect(thirdCallArg.history[0].content).toBe('头痛两天')
    expect(thirdCallArg.history[1].content).toContain('第 1 轮回答摘要')

    // Check GET /api/conversations/:id remains 4 messages total
    const getAfter = await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', authU1())
    expect(getAfter.status).toBe(200)
    expect(getAfter.body.messages).toHaveLength(4)
    expect(getAfter.body.messages[2].content).toBe('伴有轻微发烧 38 度')
    expect(getAfter.body.messages[3].content).toBe('重新回答后的新摘要。')
  })

  it('returns 409 NOTHING_TO_REGENERATE and does not call Gemini when conversation is empty', async () => {
    const generateHealthAnswer = vi.fn()
    const repo = createMemoryConversationRepository()
    const conv = await repo.createIfUnderLimit('u1', '空对话')

    const app = createApp({
      conversationRepository: repo,
      generateHealthAnswer,
      routeMedicalData: fakeRoute,
    })

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', authU1())
      .send({
        conversationId: conv!.id,
        message: '尝试重新回答',
        regenerate: true,
      })

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOTHING_TO_REGENERATE')
    expect(res.body.error.message).toBe('没有可以重新回答的内容。')
    expect(generateHealthAnswer).not.toHaveBeenCalled()
  })

  it("returns 404 CONVERSATION_NOT_FOUND when conversation belongs to another user", async () => {
    const generateHealthAnswer = vi.fn()
    const repo = createMemoryConversationRepository()
    const conv = await repo.createIfUnderLimit('u2', '他人对话')

    const app = createApp({
      conversationRepository: repo,
      generateHealthAnswer,
      routeMedicalData: fakeRoute,
    })

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', authU1()) // Authenticated as u1, trying to access u2's conv
      .send({
        conversationId: conv!.id,
        message: '重新回答',
        regenerate: true,
      })

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('CONVERSATION_NOT_FOUND')
    expect(generateHealthAnswer).not.toHaveBeenCalled()
  })

  it('returns 400 INVALID_CHAT_REQUEST when regenerate is true but conversationId is missing', async () => {
    const generateHealthAnswer = vi.fn()
    const repo = createMemoryConversationRepository()
    const app = createApp({
      conversationRepository: repo,
      generateHealthAnswer,
      routeMedicalData: fakeRoute,
    })

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', authU1())
      .send({
        message: '没有 conversationId 的重新回答',
        regenerate: true,
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('INVALID_CHAT_REQUEST')
    expect(generateHealthAnswer).not.toHaveBeenCalled()
  })
})
