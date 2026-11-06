import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { signToken } from '../src/auth/token.js'

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
const auth = () => `Bearer ${signToken({ id: 'u1', email: 't@example.com' }).token}`

describe('timing API (Step 2)', () => {
  const modelAnswer = {
    summary: '用户描述轻微咳嗽。',
    followUpQuestions: [],
    possibleCauses: ['普通感冒'],
    urgency: 'low' as const,
    advice: ['多喝温水。'],
    seekCareWhen: ['持续发烧超过 3 天。'],
    disclaimer: '这不是正式医疗诊断。',
  }

  const fakeRoute = vi.fn().mockResolvedValue({
    route: 'medical_api',
    category: 'symptom',
    reason: 'test',
    searchQueries: ['cough'],
  })

  const fakeEvidence = vi.fn().mockResolvedValue({
    status: 'success',
    evidence: [
      {
        provider: 'medlineplus',
        title: 'Cough',
        summary: 'A cough is a reflex.',
        url: 'https://medlineplus.gov/cough.html',
        retrievedAt: '2026-11-06',
      },
    ],
    issues: [],
    searchQuery: 'cough',
  })

  it('includes route, generate, and total in data.timings with values >= 0', async () => {
    const generateHealthAnswer = vi.fn().mockResolvedValue(modelAnswer)
    const app = createApp({
      generateHealthAnswer,
      routeMedicalData: fakeRoute,
      retrieveMedicalData: fakeEvidence,
    })

    const response = await request(app)
      .post('/api/chat')
      .set('Authorization', auth())
      .send({ message: '我有点咳嗽' })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data).toBeDefined()
    expect(response.body.data.timings).toBeDefined()

    const timings = response.body.data.timings
    expect(typeof timings.route).toBe('number')
    expect(timings.route).toBeGreaterThanOrEqual(0)

    expect(typeof timings.generate).toBe('number')
    expect(timings.generate).toBeGreaterThanOrEqual(0)

    expect(typeof timings.total).toBe('number')
    expect(timings.total).toBeGreaterThanOrEqual(0)
  })

  it('includes timings in emergency response', async () => {
    const generateHealthAnswer = vi.fn().mockResolvedValue({
      ...modelAnswer,
      urgency: 'emergency',
    })
    const app = createApp({
      generateHealthAnswer,
    })

    const response = await request(app)
      .post('/api/chat')
      .set('Authorization', auth())
      .send({ message: '我胸痛呼吸困难' })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.timings).toBeDefined()
    expect(typeof response.body.data.timings.generate).toBe('number')
    expect(typeof response.body.data.timings.total).toBe('number')
  })
})
