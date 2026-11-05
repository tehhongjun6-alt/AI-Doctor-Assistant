import { describe, expect, it } from 'vitest'
import { heuristicRoute } from '../src/routing/heuristicRouter.js'

describe('heuristic fallback router', () => {
  it('keeps greetings on the direct model route', () => {
    expect(heuristicRoute('你好').route).toBe('direct_model')
    expect(heuristicRoute('thanks!').route).toBe('direct_model')
  })

  it('routes personal symptom descriptions to the consultation flow', () => {
    const result = heuristicRoute('我的喉咙痛了两天，还有点发烧')
    expect(result.route).toBe('medical_api')
    expect(result.category).toBe('symptom')
    expect(result.searchQueries).toEqual(
      expect.arrayContaining(['sore throat', 'fever']),
    )
  })

  it('routes knowledge questions to medical QA', () => {
    const result = heuristicRoute('Panadol 和布洛芬有什么区别？')
    expect(result.route).toBe('medical_qa')
    expect(result.searchQueries).toEqual(['paracetamol', 'ibuprofen'])
  })

  it('treats follow-up answers as part of the active consultation', () => {
    const result = heuristicRoute('38.5 度左右', { activeCategory: 'symptom' })
    expect(result.route).toBe('medical_api')
  })

  it('reuses previous English search queries during follow-up without new medical terms', () => {
    const result = heuristicRoute('三天了，38 度', {
      activeCategory: 'symptom',
      previousSearchQueries: ['fever'],
    })
    expect(result.route).toBe('medical_api')
    expect(result.category).toBe('symptom')
    expect(result.searchQueries).toEqual(['fever'])
    expect(result.searchQuery).toBe('fever')
    expect(result.searchQueries).not.toContain('三天了，38 度')
  })

  it('infers previous English search queries from topic messages if previousSearchQueries is omitted', () => {
    const result = heuristicRoute('三天了，38 度', {
      activeCategory: 'symptom',
      topicMessages: ['我发烧头痛两天了'],
    })
    expect(result.route).toBe('medical_api')
    expect(result.category).toBe('symptom')
    expect(result.searchQueries).toEqual(expect.arrayContaining(['fever', 'headache']))
    expect(result.searchQueries).not.toContain('三天了，38 度')
  })
})

describe('rule-first confidence', () => {
  it('is confident about clear greetings, symptoms and knowledge questions', () => {
    expect(heuristicRoute('谢谢').confidence).toBe('high')
    expect(heuristicRoute('我喉咙痛两天了').confidence).toBe('high')
    expect(heuristicRoute('布洛芬有什么副作用？').confidence).toBe('high')
  })

  it('defers risky or vague messages to the model', () => {
    expect(heuristicRoute('我刚吞了一整盒 panadol，现在想吐').confidence).toBe('low')
    expect(heuristicRoute('胸口很痛喘不过气').confidence).toBe('low')
    expect(heuristicRoute('最近怪怪的').confidence).toBe('low')
  })
})

describe('router fast path', () => {
  it('skips the model for confident rule results', async () => {
    const { createMedicalDataRouter } = await import('../src/routing/medicalDataRouter.js')
    // 无效密钥：若真的调用模型会失败并回退，这里验证高把握时直接返回规则结果
    const route = createMedicalDataRouter({ apiKey: 'fake-key', timeoutMs: 1 })
    const result = await route('我喉咙痛两天了')
    expect(result.route).toBe('medical_api')
    expect(result.reason).toContain('规则判断')
    expect(result).not.toHaveProperty('confidence')
  })

  it('falls back to previous English queries in createMedicalDataRouter when no new terms are present', async () => {
    const { createMedicalDataRouter } = await import('../src/routing/medicalDataRouter.js')
    const route = createMedicalDataRouter({ apiKey: 'fake-key', timeoutMs: 1 })
    const result = await route('三天了，38 度', {
      activeCategory: 'symptom',
      previousSearchQueries: ['fever'],
    })
    expect(result.route).toBe('medical_api')
    expect(result.searchQueries).toEqual(['fever'])
    expect(result.searchQueries).not.toContain('三天了，38 度')
  })
})
