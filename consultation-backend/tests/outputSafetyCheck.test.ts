import { describe, expect, it } from 'vitest'
import { validateAndSanitizeAnswer } from '../src/safety/outputSafetyCheck.js'

function buildMockAnswer(overrides: Record<string, unknown> = {}) {
  return {
    summary: 'Based on your reported fever and cough, this could be an upper respiratory tract infection.',
    followUpQuestions: ['How many days has the fever lasted?'],
    possibleCauses: ['Common cold', 'Influenza'],
    urgency: 'low',
    advice: ['Drink plenty of fluids', 'Get sufficient bed rest'],
    seekCareWhen: ['Please see a doctor if symptoms persist or fever exceeds 39°C'],
    disclaimer: '',
    ...overrides,
  }
}

describe('outputSafetyCheck - English safety rules', () => {
  it('blocks unauthorized diagnosis in English', () => {
    const answer1 = buildMockAnswer({
      summary: 'I diagnose you with acute bronchitis.',
    })
    const result1 = validateAndSanitizeAnswer(answer1, 'medical_api', 'en')
    expect(result1.passed).toBe(false)
    expect(result1.reason).toBe('包含越权确诊表述')

    const answer2 = buildMockAnswer({
      possibleCauses: ['You definitely have COVID-19.'],
    })
    const result2 = validateAndSanitizeAnswer(answer2, 'medical_api', 'en')
    expect(result2.passed).toBe(false)
    expect(result2.reason).toBe('包含越权确诊表述')
  })

  it('blocks guaranteed cure claims in English', () => {
    const answer1 = buildMockAnswer({
      advice: ['Take this herbal supplement, it is guaranteed to cure your infection.'],
    })
    const result1 = validateAndSanitizeAnswer(answer1, 'medical_api', 'en')
    expect(result1.passed).toBe(false)
    expect(result1.reason).toBe('包含绝对化治愈承诺')

    const answer2 = buildMockAnswer({
      summary: 'This therapy provides a 100% cure for arthritis.',
    })
    const result2 = validateAndSanitizeAnswer(answer2, 'medical_api', 'en')
    expect(result2.passed).toBe(false)
    expect(result2.reason).toBe('包含绝对化治愈承诺')
  })

  it('blocks advice discouraging medical care in English', () => {
    const answer1 = buildMockAnswer({
      advice: ['There is no need to see a doctor, simply rest at home.'],
    })
    const result1 = validateAndSanitizeAnswer(answer1, 'medical_api', 'en')
    expect(result1.passed).toBe(false)
    expect(result1.reason).toBe('包含劝阻正常就医的不安全建议')

    const answer2 = buildMockAnswer({
      seekCareWhen: ['You don\'t need to go to the hospital even if symptoms persist.'],
    })
    const result2 = validateAndSanitizeAnswer(answer2, 'medical_api', 'en')
    expect(result2.passed).toBe(false)
    expect(result2.reason).toBe('包含劝阻正常就医的不安全建议')
  })

  it('allows safe and standard English medical guidance', () => {
    const safeAnswer = buildMockAnswer({
      summary: 'You may be experiencing mild seasonal allergies or a viral infection.',
      advice: [
        'Rest adequately and monitor your hydration.',
        'Please see a doctor if symptoms persist for more than three days.',
      ],
      seekCareWhen: [
        'Seek immediate medical care at the hospital if you experience breathing difficulty.',
      ],
    })
    const result = validateAndSanitizeAnswer(safeAnswer, 'medical_api', 'en')
    expect(result.passed).toBe(true)
    expect(result.answer.summary).toBe(safeAnswer.summary)
  })

  it('preserves existing Chinese safety checks', () => {
    const chineseUnsafe = buildMockAnswer({
      summary: '本助手正式确诊您患有急性胃炎。',
    })
    const result = validateAndSanitizeAnswer(chineseUnsafe, 'medical_api', 'zh')
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('包含越权确诊表述')
  })
})
