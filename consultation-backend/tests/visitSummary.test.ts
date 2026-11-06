import request from 'supertest'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { signToken } from '../src/auth/token.js'
import { createMemoryConversationRepository } from '../src/services/conversationRepository.js'
import type { CaseSummary } from '../src/services/caseSummary.js'

describe('visit summary API (Step 8)', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
  })

  const authU1 = () =>
    `Bearer ${signToken({ id: 'u1', email: 'u1@example.com' }).token}`
  const authU2 = () =>
    `Bearer ${signToken({ id: 'u2', email: 'u2@example.com' }).token}`

  const mockSummary: CaseSummary = {
    chiefComplaint: '咽痛发热2天',
    symptoms: ['咽痛', '发热 38 度'],
    duration: '2天',
    medications: ['Panadol'],
    allergies: [],
    relevantHistory: [],
    aiAssessment: ['上呼吸道感染可能，非诊断'],
    redFlags: ['呼吸困难需急诊'],
    questionsForDoctor: ['是否需要验血？'],
  }

  it("generates visit summary for user's own conversation with 200", async () => {
    const summarizeCase = vi.fn().mockResolvedValue(mockSummary)
    const repo = createMemoryConversationRepository()
    const app = createApp({
      conversationRepository: repo,
      summarizeCase,
    })

    const conv = await repo.createIfUnderLimit('u1', '咽痛咨询')
    await repo.appendTurn({
      conversationId: conv!.id,
      userId: 'u1',
      userMessage: '我咽痛发烧两天了，吃了 Panadol',
      assistantAnswer: {
        summary: '可能为感冒',
        followUpQuestions: [],
        possibleCauses: [],
        advice: [],
        urgency: 'low',
        seekCareWhen: [],
        disclaimer: '免责声明',
      },
    })

    const res = await request(app)
      .post(`/api/conversations/${conv!.id}/visit-summary`)
      .set('Authorization', authU1())
      .send({ language: 'zh' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.summary).toEqual(mockSummary)
    expect(res.body.data.generatedAt).toBeDefined()

    expect(summarizeCase).toHaveBeenCalledTimes(1)
    expect(summarizeCase).toHaveBeenCalledWith({
      messages: [
        { role: 'user', content: '我咽痛发烧两天了，吃了 Panadol' },
        expect.objectContaining({ role: 'assistant' }),
      ],
      language: 'zh',
      purpose: 'visit',
    })
  })

  it("returns 404 CONVERSATION_NOT_FOUND when requesting another user's conversation", async () => {
    const summarizeCase = vi.fn().mockResolvedValue(mockSummary)
    const repo = createMemoryConversationRepository()
    const app = createApp({
      conversationRepository: repo,
      summarizeCase,
    })

    const conv = await repo.createIfUnderLimit('u2', '他人咽痛')
    await repo.appendTurn({
      conversationId: conv!.id,
      userId: 'u2',
      userMessage: '秘密病情',
      assistantAnswer: {
        summary: '建议',
        followUpQuestions: [],
        possibleCauses: [],
        advice: [],
        urgency: 'low',
        seekCareWhen: [],
        disclaimer: '免责',
      },
    })

    const res = await request(app)
      .post(`/api/conversations/${conv!.id}/visit-summary`)
      .set('Authorization', authU1()) // Authenticated as u1, trying to access u2's conv
      .send({ language: 'zh' })

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('CONVERSATION_NOT_FOUND')
    expect(summarizeCase).not.toHaveBeenCalled()
  })

  it('returns 409 NOTHING_TO_SUMMARIZE when conversation has no user messages, and summarizer is NOT called', async () => {
    const summarizeCase = vi.fn().mockResolvedValue(mockSummary)
    const repo = createMemoryConversationRepository()
    const app = createApp({
      conversationRepository: repo,
      summarizeCase,
    })

    const conv = await repo.createIfUnderLimit('u1', '空对话')

    const res = await request(app)
      .post(`/api/conversations/${conv!.id}/visit-summary`)
      .set('Authorization', authU1())
      .send({ language: 'zh' })

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOTHING_TO_SUMMARIZE')
    expect(summarizeCase).not.toHaveBeenCalled()
  })

  it('returns 502 AI_MODEL_UNAVAILABLE when summarizer throws an error', async () => {
    const summarizeCase = vi.fn().mockRejectedValue(new Error('Model quota exceeded'))
    const repo = createMemoryConversationRepository()
    const app = createApp({
      conversationRepository: repo,
      summarizeCase,
    })

    const conv = await repo.createIfUnderLimit('u1', '咽痛')
    await repo.appendTurn({
      conversationId: conv!.id,
      userId: 'u1',
      userMessage: '咽痛',
      assistantAnswer: {
        summary: '分析',
        followUpQuestions: [],
        possibleCauses: [],
        advice: [],
        urgency: 'low',
        seekCareWhen: [],
        disclaimer: '免责',
      },
    })

    const res = await request(app)
      .post(`/api/conversations/${conv!.id}/visit-summary`)
      .set('Authorization', authU1())
      .send({ language: 'zh' })

    expect(res.status).toBe(502)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('AI_MODEL_UNAVAILABLE')
  })
})
