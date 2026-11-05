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
})
