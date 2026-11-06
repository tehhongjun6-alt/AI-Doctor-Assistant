import { describe, expect, it } from 'vitest'
import {
  CONSULTATION_SYSTEM_PROMPT,
  resolveMaxOutputTokens,
} from '../src/services/geminiHealthConsultation.js'

describe('geminiPrompt & resolveMaxOutputTokens (Step 1)', () => {
  it('resolves max output tokens with fallback to 3000', () => {
    expect(resolveMaxOutputTokens(undefined)).toBe(3000)
    expect(resolveMaxOutputTokens('4000')).toBe(4000)
    expect(resolveMaxOutputTokens('abc')).toBe(3000)
    expect(resolveMaxOutputTokens('0')).toBe(3000)
  })

  it('verifies CONSULTATION_SYSTEM_PROMPT includes updated follow-up rules and excludes old iron rule', () => {
    expect(CONSULTATION_SYSTEM_PROMPT).toContain('目前信息还不够确定')
    expect(CONSULTATION_SYSTEM_PROMPT).toContain('最多 2 轮')
    expect(CONSULTATION_SYSTEM_PROMPT).not.toContain('绝不允许连续两轮')
  })
})
