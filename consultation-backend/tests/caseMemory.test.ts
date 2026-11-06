import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { RequestRateLimiter } from '../src/auth/requestRateLimiter.js'
import { signToken } from '../src/auth/token.js'
import type { CaseSummary } from '../src/services/caseSummary.js'
import { createMemoryConversationRepository } from '../src/services/conversationRepository.js'
import { buildUserContent } from '../src/services/geminiHealthConsultation.js'

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
const authHeader = (id: string, email = `${id}@example.com`) =>
  `Bearer ${signToken({ id, email }).token}`

const fakeAnswer = {
  summary: '常规咨询回答小结。',
  followUpQuestions: [],
  possibleCauses: ['原因 A'],
  urgency: 'low' as const,
  advice: ['建议 A'],
  seekCareWhen: ['危险信号 A'],
  disclaimer: '免责声明。',
}

const fakeSummary: CaseSummary = {
  chiefComplaint: '头痛发烧三天',
  duration: '3 天',
  symptoms: ['体温 38.5 度', '搏动性跳痛'],
  medications: ['布洛芬缓释胶囊'],
  allergies: ['青霉素过敏'],
  relevantHistory: ['有偏头痛病史'],
  aiAssessment: ['初步考虑偏头痛或上呼吸道感染'],
  redFlags: ['剧烈喷射性呕吐'],
  questionsForDoctor: ['是否需要进行头部 CT 检查？'],
}

describe('caseMemory (Step 9)', () => {
  describe('buildUserContent pure function', () => {
    it('includes case memory block when caseMemory is provided', () => {
      const userContent = buildUserContent({
        message: '医生，我今天还是有点不舒服。',
        caseMemory: fakeSummary,
      })

      expect(userContent).toContain(
        '[早前对话的病情摘要（超出最近 20 条的内容）]',
      )
      expect(userContent).toContain('主要问题：头痛发烧三天')
      expect(userContent).toContain('持续时间：3 天')
      expect(userContent).toContain('具体症状：体温 38.5 度、搏动性跳痛')
      expect(userContent).toContain('用过的药：布洛芬缓释胶囊')
      expect(userContent).toContain('过敏史：青霉素过敏')
      expect(userContent).toContain('相关病史：有偏头痛病史')
      expect(userContent).toContain('AI 曾给出的可能方向：初步考虑偏头痛或上呼吸道感染')
      expect(userContent).toContain('危险信号：剧烈喷射性呕吐')
      expect(userContent).toContain('建议向医生咨询的问题：是否需要进行头部 CT 检查？')
      expect(userContent).toContain('医生，我今天还是有点不舒服。')
    })

    it('does not include case memory block when caseMemory is omitted', () => {
      const userContent = buildUserContent({
        message: '医生，我今天还是有点不舒服。',
      })

      expect(userContent).not.toContain(
        '[早前对话的病情摘要（超出最近 20 条的内容）]',
      )
      expect(userContent).toBe('医生，我今天还是有点不舒服。')
    })
  })

  describe('case memory automatic background summarization in app', () => {
    const mockRoute = vi.fn().mockResolvedValue({
      route: 'medical_api',
      category: 'symptom',
      reason: 'test',
      searchQueries: ['headache'],
    })

    const mockMedicalData = vi.fn().mockResolvedValue({
      status: 'success',
      evidence: [],
      issues: [],
      searchQuery: 'headache',
    })

    it('does not trigger summarizer under 20 messages; triggers on 11th turn (22 messages); provides caseMemory on next turn', async () => {
      const memoryRepo = createMemoryConversationRepository()
      const generateHealthAnswer = vi.fn().mockResolvedValue(fakeAnswer)
      const summarizeCase = vi.fn().mockResolvedValue(fakeSummary)

      const app = createApp({
        conversationRepository: memoryRepo,
        generateHealthAnswer,
        summarizeCase,
        routeMedicalData: mockRoute,
        retrieveMedicalData: mockMedicalData,
        chatRateLimiter: new RequestRateLimiter(100),
      })

      const token = authHeader('user-memory-1')

      // 第 1 轮提问，创建对话
      const firstRes = await request(app)
        .post('/api/chat')
        .set('Authorization', token)
        .send({ message: '第 1 轮提问' })
      expect(firstRes.status).toBe(200)
      const conversationId = firstRes.body.data.conversationId
      expect(conversationId).toBeDefined()

      // 进行第 2 到第 10 轮对话（共 10 轮 = 20 条消息）
      for (let turn = 2; turn <= 10; turn++) {
        const res = await request(app)
          .post('/api/chat')
          .set('Authorization', token)
          .send({ conversationId, message: `第 ${turn} 轮提问` })
        expect(res.status).toBe(200)
      }

      // 等待后台异步任务执行完成
      await new Promise((r) => setTimeout(r, 80))

      // 对话未超过 20 条，summarizer 绝不应被调用
      expect(summarizeCase).not.toHaveBeenCalled()

      // 聊到第 11 轮（达到 22 条消息）
      const turn11Res = await request(app)
        .post('/api/chat')
        .set('Authorization', token)
        .send({ conversationId, message: '第 11 轮提问' })
      expect(turn11Res.status).toBe(200)

      // 等待后台异步任务执行
      await new Promise((r) => setTimeout(r, 80))

      // summarizer 被调用 1 次，收到的是最早的 2 条消息
      expect(summarizeCase).toHaveBeenCalledTimes(1)
      const summarizerCall = summarizeCase.mock.calls[0][0]
      expect(summarizerCall.purpose).toBe('memory')
      expect(summarizerCall.language).toBe('en')
      expect(summarizerCall.messages).toHaveLength(2)
      expect(summarizerCall.messages[0]).toEqual({
        role: 'user',
        content: '第 1 轮提问',
      })
      expect(summarizerCall.messages[1].role).toBe('assistant')

      // 第 12 轮：下一轮调用 Gemini 时，输入带有 caseMemory
      const turn12Res = await request(app)
        .post('/api/chat')
        .set('Authorization', token)
        .send({ conversationId, message: '第 12 轮提问' })
      expect(turn12Res.status).toBe(200)

      const lastGeminiCall =
        generateHealthAnswer.mock.calls[generateHealthAnswer.mock.calls.length - 1][0]
      expect(lastGeminiCall.caseMemory).toEqual(fakeSummary)

      // summarizer 不会在第 12 轮再次调用（每 10 条最多 1 次）
      await new Promise((r) => setTimeout(r, 80))
      expect(summarizeCase).toHaveBeenCalledTimes(1)
    })

    it('returns 200 chat response even if summarizer fails in background', async () => {
      const memoryRepo = createMemoryConversationRepository()
      const generateHealthAnswer = vi.fn().mockResolvedValue(fakeAnswer)
      const failingSummarizer = vi
        .fn()
        .mockRejectedValue(new Error('AI model unavailable'))

      const app = createApp({
        conversationRepository: memoryRepo,
        generateHealthAnswer,
        summarizeCase: failingSummarizer,
        routeMedicalData: mockRoute,
        retrieveMedicalData: mockMedicalData,
        chatRateLimiter: new RequestRateLimiter(100),
      })

      const token = authHeader('user-memory-err')

      // 预先向对话添加 20 条消息
      const initRes = await request(app)
        .post('/api/chat')
        .set('Authorization', token)
        .send({ message: '初始消息' })
      const conversationId = initRes.body.data.conversationId

      for (let turn = 2; turn <= 10; turn++) {
        await request(app)
          .post('/api/chat')
          .set('Authorization', token)
          .send({ conversationId, message: `消息 ${turn}` })
      }

      // 第 11 轮（触发失败的 summarizer）
      const res = await request(app)
        .post('/api/chat')
        .set('Authorization', token)
        .send({ conversationId, message: '第 11 轮提问' })

      // 聊天回应仍然是 200
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      // 等待异步任务捕获错误
      await new Promise((r) => setTimeout(r, 80))
      expect(failingSummarizer).toHaveBeenCalledTimes(1)
    })
  })
})
