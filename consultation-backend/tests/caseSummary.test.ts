import { describe, expect, it } from 'vitest'
import { isCaseSummary, type CaseSummary } from '../src/services/caseSummary.js'

describe('isCaseSummary validation (Step 8)', () => {
  const completeCaseSummary: CaseSummary = {
    chiefComplaint: '咳嗽发热两天',
    symptoms: ['干咳', '体温 38.5 度', '轻微咽痛'],
    duration: '2天',
    medications: ['对乙酰氨基酚片 500mg 一次'],
    allergies: ['青霉素过敏'],
    relevantHistory: ['无哮喘病史'],
    aiAssessment: ['可能为急性上呼吸道感染（普通感冒或流感早期），非正式诊断'],
    redFlags: ['若出现呼吸困难、持续高热超过3天需立即就医'],
    questionsForDoctor: ['是否需要进行流感抗原筛查？', '目前的退烧药用法是否合适？'],
  }

  it('returns true for a complete and correctly typed CaseSummary object', () => {
    expect(isCaseSummary(completeCaseSummary)).toBe(true)
  })

  it('returns true when optional-like array fields are empty lists and strings are empty', () => {
    const minimalSummary: CaseSummary = {
      chiefComplaint: '头痛',
      symptoms: ['头痛'],
      duration: '',
      medications: [],
      allergies: [],
      relevantHistory: [],
      aiAssessment: ['偏头痛可能，非诊断'],
      redFlags: [],
      questionsForDoctor: [],
    }
    expect(isCaseSummary(minimalSummary)).toBe(true)
  })

  it('returns false when any required field is missing', () => {
    const missingChiefComplaint = { ...completeCaseSummary }
    // @ts-expect-error test invalid object
    delete missingChiefComplaint.chiefComplaint
    expect(isCaseSummary(missingChiefComplaint)).toBe(false)

    const missingQuestions = { ...completeCaseSummary }
    // @ts-expect-error test invalid object
    delete missingQuestions.questionsForDoctor
    expect(isCaseSummary(missingQuestions)).toBe(false)

    const missingSymptoms = { ...completeCaseSummary }
    // @ts-expect-error test invalid object
    delete missingSymptoms.symptoms
    expect(isCaseSummary(missingSymptoms)).toBe(false)
  })

  it('returns false when fields have incorrect types', () => {
    // chiefComplaint is number instead of string
    expect(
      isCaseSummary({
        ...completeCaseSummary,
        chiefComplaint: 12345,
      }),
    ).toBe(false)

    // symptoms is a string instead of string[]
    expect(
      isCaseSummary({
        ...completeCaseSummary,
        symptoms: '发烧, 咳嗽',
      }),
    ).toBe(false)

    // medications contains a number inside array
    expect(
      isCaseSummary({
        ...completeCaseSummary,
        medications: ['Panadol', 500],
      }),
    ).toBe(false)

    // duration is null
    expect(
      isCaseSummary({
        ...completeCaseSummary,
        duration: null,
      }),
    ).toBe(false)
  })

  it('returns false for primitives, null, undefined, or array', () => {
    expect(isCaseSummary(null)).toBe(false)
    expect(isCaseSummary(undefined)).toBe(false)
    expect(isCaseSummary('string')).toBe(false)
    expect(isCaseSummary(123)).toBe(false)
    expect(isCaseSummary([])).toBe(false)
  })
})
