import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { signToken } from '../src/auth/token.js'
import { searchGeoapifyHospitals } from '../src/services/geoapifyPlaces.js'

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
const auth = () =>
  `Bearer ${signToken({ id: 'u-map-test', email: 'map@example.com' }).token}`

describe('geoapifyPlaces & mapCareLevel (Step 6 / A12)', () => {
  const originalApiKey = process.env.GEOAPIFY_API_KEY

  beforeEach(() => {
    process.env.GEOAPIFY_API_KEY = 'test-geoapify-key'
  })

  afterEach(() => {
    process.env.GEOAPIFY_API_KEY = originalApiKey
    vi.unstubAllGlobals()
  })

  it('queries clinic and pharmacy categories when careLevel is clinic', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        features: [
          {
            properties: {
              place_id: 'p1',
              name: 'Community Pharmacy',
              formatted: '123 Health Road',
              lat: 3.14,
              lon: 101.69,
              categories: ['healthcare.pharmacy'],
            },
          },
          {
            properties: {
              place_id: 'p2',
              formatted: '456 Clinic Lane',
              lat: 3.15,
              lon: 101.7,
              categories: ['healthcare.clinic_or_praxis'],
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const places = await searchGeoapifyHospitals({
      latitude: 3.14,
      longitude: 101.69,
      radius: 5000,
      careLevel: 'clinic',
    })

    expect(places).toHaveLength(2)
    expect(places[0]).toMatchObject({
      id: 'p1',
      name: 'Community Pharmacy',
      type: 'pharmacy',
    })
    expect(places[1]).toMatchObject({
      id: 'p2',
      name: '诊所', // Fallback default name for clinic
      type: 'clinic',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const requestedUrl = String(fetchMock.mock.calls[0][0])
    expect(requestedUrl).toContain(
      'categories=healthcare.clinic_or_praxis%2Chealthcare.pharmacy',
    )
  })

  it('rejects invalid careLevel with 400 on /api/hospitals/nearby', async () => {
    const app = createApp()
    const response = await request(app)
      .post('/api/hospitals/nearby')
      .set('Authorization', auth())
      .send({
        latitude: 3.14,
        longitude: 101.69,
        radius: 5000,
        careLevel: 'invalid_level',
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('就医级别无效')
  })

  it('returns mapCareLevel: clinic when route is medical_api and urgency is low', async () => {
    const modelAnswer = {
      summary: '您描述了轻微咳嗽症状。',
      followUpQuestions: [],
      possibleCauses: ['感冒恢复期'],
      urgency: 'low' as const,
      advice: ['适量温水', '注意保暖'],
      seekCareWhen: ['持续加重'],
      disclaimer: '仅供参考。',
    }

    const app = createApp({
      generateHealthAnswer: vi.fn().mockResolvedValue(modelAnswer),
      routeMedicalData: vi.fn().mockResolvedValue({
        route: 'medical_api',
        category: 'symptom',
        reason: 'symptom query',
        searchQueries: ['cough'],
      }),
      retrieveMedicalData: vi.fn().mockResolvedValue({
        status: 'success',
        evidence: [],
        issues: [],
        searchQuery: 'cough',
      }),
    })

    const response = await request(app)
      .post('/api/chat')
      .set('Authorization', auth())
      .send({
        message: '最近有点轻微咳嗽。',
      })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.mapCareLevel).toBe('clinic')
    expect(response.body.data.showHospitalMap).toBe(true)
  })

  it('returns mapCareLevel: hospital when urgency is high or emergency', async () => {
    const highUrgencyAnswer = {
      summary: '您的高热持续不退并伴随剧烈头痛。',
      followUpQuestions: [],
      possibleCauses: ['脑膜炎等中枢神经系统感染需紧急排查'],
      urgency: 'high' as const,
      advice: ['请立刻前往医院急诊就诊'],
      seekCareWhen: ['立刻就诊'],
      disclaimer: '仅供参考。',
    }

    const app = createApp({
      generateHealthAnswer: vi.fn().mockResolvedValue(highUrgencyAnswer),
      routeMedicalData: vi.fn().mockResolvedValue({
        route: 'medical_api',
        category: 'symptom',
        reason: 'severe fever',
      }),
      retrieveMedicalData: vi.fn().mockResolvedValue({
        status: 'success',
        evidence: [],
        issues: [],
      }),
    })

    const response = await request(app)
      .post('/api/chat')
      .set('Authorization', auth())
      .send({
        message: '高烧40度并且头痛欲裂。',
      })

    expect(response.status).toBe(200)
    expect(response.body.data.mapCareLevel).toBe('hospital')
    expect(response.body.data.showHospitalMap).toBe(true)
  })
})
