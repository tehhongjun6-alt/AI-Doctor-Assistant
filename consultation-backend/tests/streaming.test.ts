import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { signToken } from '../src/auth/token.js'
import { extractPartialSummary } from '../src/services/partialSummary.js'

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
const auth = () => `Bearer ${signToken({ id: 'u1', email: 't@example.com' }).token}`

describe('extractPartialSummary', () => {
  it('reads the summary while JSON is still incomplete', () => {
    expect(extractPartialSummary('{"summary": "喉咙')).toBe('喉咙')
    expect(extractPartialSummary(String.raw`{"summary":"a\"b\n`)).toBe('a"b\n')
    expect(extractPartialSummary(String.raw`{"summary":"x\u4f`)).toBe('x')
    expect(extractPartialSummary('{"summary":"x' + '\\')).toBe('x')
    expect(extractPartialSummary('{"summary":"done","focusMode":"')).toBe('done')
    expect(extractPartialSummary('{"foc')).toBeUndefined()
  })
})

describe('POST /api/chat/stream', () => {
  it('streams summary deltas and ends with the checked final answer', async () => {
    const answer = {
      summary: '你喉咙痛两天。',
      followUpQuestions: ['是否发烧？'],
      possibleCauses: ['上呼吸道感染'],
      urgency: 'low' as const,
      advice: ['多喝水。'],
      seekCareWhen: ['持续加重。'],
      disclaimer: '仅供参考。',
    }
    const generateHealthAnswer = vi.fn(async (input) => {
      input.onSummaryDelta?.('你喉咙')
      input.onSummaryDelta?.('你喉咙痛两天。')
      return answer
    })
    const app = createApp({
      generateHealthAnswer,
      routeMedicalData: vi.fn().mockResolvedValue({
        route: 'medical_api',
        category: 'symptom',
        reason: 'test',
        searchQueries: ['sore throat'],
      }),
      retrieveMedicalData: vi.fn().mockResolvedValue({
        status: 'success',
        evidence: [],
        issues: [],
        searchQuery: 'sore throat',
      }),
    })

    const response = await request(app)
      .post('/api/chat/stream')
      .set('Authorization', auth())
      .send({ message: '我喉咙痛两天了' })

    expect(response.headers['content-type']).toContain('text/event-stream')
    const events = response.text
      .trim()
      .split('\n\n')
      .map((block) => {
        const [eventLine, dataLine] = block.split('\n')
        return {
          event: eventLine.replace('event: ', ''),
          data: JSON.parse(dataLine.replace('data: ', '')),
        }
      })

    expect(events.map((e) => e.event)).toEqual(['delta', 'delta', 'final'])
    expect(events[1].data.summary).toBe('你喉咙痛两天。')
    expect(events[2].data.status).toBe(200)
    expect(events[2].data.body.success).toBe(true)
    expect(events[2].data.body.data.answer.summary).toBe('你喉咙痛两天。')
  })

  it('reports errors through the final event', async () => {
    const response = await request(createApp())
      .post('/api/chat/stream')
      .set('Authorization', auth())
      .send({ message: '   ' })

    expect(response.text).toContain('event: final')
    expect(response.text).toContain('INVALID_CHAT_REQUEST')
  })
})
