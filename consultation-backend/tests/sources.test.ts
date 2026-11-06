import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { signToken } from '../src/auth/token.js'

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
const auth = () => `Bearer ${signToken({ id: 'u1', email: 't@example.com' }).token}`

describe('sources provider API (Step 5)', () => {
  const modelAnswer = {
    summary: '用户描述咳嗽两天。',
    followUpQuestions: [],
    possibleCauses: ['普通感冒'],
    urgency: 'low' as const,
    advice: ['多喝温水。'],
    seekCareWhen: ['持续高烧。'],
    disclaimer: '这不是正式医疗诊断。',
  }

  const fakeRoute = vi.fn().mockResolvedValue({
    route: 'medical_api',
    category: 'symptom',
    reason: 'test',
    searchQueries: ['cough'],
  })

  const fakeEvidenceWithNhs = vi.fn().mockResolvedValue({
    status: 'success',
    evidence: [
      {
        provider: 'nhs',
        title: 'Cough - NHS',
        summary: 'NHS guidelines for cough',
        url: 'https://www.nhs.uk/conditions/cough/',
        retrievedAt: '2026-11-06',
      },
    ],
    issues: [],
    searchQuery: 'cough',
  })

  it("returns data.sources[0].provider === 'nhs' when evidence provider is nhs", async () => {
    const generateHealthAnswer = vi.fn().mockResolvedValue(modelAnswer)
    const app = createApp({
      generateHealthAnswer,
      routeMedicalData: fakeRoute,
      retrieveMedicalData: fakeEvidenceWithNhs,
    })

    const response = await request(app)
      .post('/api/chat')
      .set('Authorization', auth())
      .send({ message: '我有点咳嗽' })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.sources).toHaveLength(1)
    expect(response.body.data.sources[0].provider).toBe('nhs')
    expect(response.body.data.sources[0].title).toBe('Cough - NHS')
  })
})
