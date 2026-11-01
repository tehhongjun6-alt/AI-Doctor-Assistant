import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'

describe('map API', () => {
  it('reports that the backend is running', async () => {
    const response = await request(createApp()).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })

  it('returns nearby hospitals from the map service', async () => {
    const searchHospitals = vi.fn().mockResolvedValue([
      {
        id: 'hospital-1',
        name: 'Kuala Lumpur Hospital',
        address: 'Jalan Pahang, Kuala Lumpur',
        latitude: 3.1736,
        longitude: 101.7006,
        phone: '03-2615 5555',
        mapUri: 'https://www.openstreetmap.org/',
      },
    ])

    const response = await request(createApp({ searchHospitals }))
      .post('/api/hospitals/nearby')
      .send({ latitude: 3.139, longitude: 101.6869, radius: 5000 })

    expect(response.status).toBe(200)
    expect(response.body.hospitals).toHaveLength(1)
    expect(searchHospitals).toHaveBeenCalledWith({
      latitude: 3.139,
      longitude: 101.6869,
      radius: 5000,
    })
  })

  it('rejects invalid coordinates', async () => {
    const response = await request(createApp())
      .post('/api/hospitals/nearby')
      .send({ latitude: 100, longitude: 101.6869 })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('位置资料无效。')
  })
})

describe('chat API contract', () => {
  const modelAnswer = {
    summary: '用户描述喉咙痛两天。',
    followUpQuestions: ['是否发烧？'],
    possibleCauses: ['上呼吸道感染等多种可能'],
    urgency: 'low' as const,
    advice: ['休息并补充水分。'],
    seekCareWhen: ['症状明显加重或持续不改善。'],
    disclaimer: '这不是正式医疗诊断。',
  }

  it('rejects an empty chat message with the unified error format', async () => {
    const response = await request(createApp()).post('/api/chat').send({
      message: '   ',
    })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_CHAT_REQUEST',
      },
    })
  })

  it('returns the structured answer from the model service', async () => {
    const generateHealthAnswer = vi.fn().mockResolvedValue(modelAnswer)
    const response = await request(createApp({ generateHealthAnswer }))
      .post('/api/chat')
      .send({
        conversationId: 'conversation-1',
        message: '我的喉咙痛了两天。',
        images: [{ id: 'image-1', mimeType: 'image/jpeg' }],
        history: [{ role: 'assistant', content: '请描述你的症状。' }],
      })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      success: true,
      data: {
        conversationId: 'conversation-1',
        answer: modelAnswer,
        sources: [],
      },
    })
    expect(generateHealthAnswer).toHaveBeenCalledWith({
      message: '我的喉咙痛了两天。',
      history: [{ role: 'assistant', content: '请描述你的症状。' }],
    })
  })

  it('stops the normal chat flow when an emergency signal is detected', async () => {
    const response = await request(createApp()).post('/api/chat').send({
      message: '我的伤口大量出血，而且一直止不住。',
    })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      success: true,
      data: {
        type: 'emergency',
        emergency: {
          isEmergency: true,
          category: 'severe_bleeding',
        },
        showHospitalMap: true,
      },
    })
  })

  it('does not classify a small finger cut as an emergency', async () => {
    const generateHealthAnswer = vi.fn().mockResolvedValue(modelAnswer)
    const response = await request(createApp({ generateHealthAnswer }))
      .post('/api/chat')
      .send({
        message: '我切菜时轻微划破了手指，现在已经止血。',
      })

    expect(response.status).toBe(200)
    expect(generateHealthAnswer).toHaveBeenCalledOnce()
  })
})
