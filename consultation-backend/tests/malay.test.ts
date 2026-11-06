import { describe, expect, it } from 'vitest'
import { validateChatRequest } from '../src/schemas/chat.js'
import {
  buildEmergencyStructuredAnswer,
  emergencyActionText,
  EMERGENCY_ACTION_TEXT,
} from '../src/safety/emergencyCheck.js'
import {
  createSafeFallbackAnswer,
  validateAndSanitizeAnswer,
} from '../src/safety/outputSafetyCheck.js'

describe('Malay Language Support (Step 11a)', () => {
  describe('validateChatRequest', () => {
    it('accepts ms as language', () => {
      const result = validateChatRequest({ message: 'x', language: 'ms' })
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.value.language).toBe('ms')
      }
    })

    it('defaults unknown language to zh', () => {
      const result = validateChatRequest({ message: 'x', language: 'fr' as any })
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.value.language).toBe('zh')
      }
    })
  })

  describe('emergencyActionText', () => {
    it('returns Malay emergency action text containing 999 and no Chinese characters', () => {
      const text = emergencyActionText('ms')
      expect(text).toContain('999')
      expect(text).not.toMatch(/[\u4e00-\u9fff]/)
      expect(text).toBe(
        'Sila hubungi talian kecemasan Malaysia 999 dengan segera dan ikuti arahan operator.',
      )
    })

    it('returns English emergency action text', () => {
      const text = emergencyActionText('en')
      expect(text).toContain('999')
      expect(text).not.toMatch(/[\u4e00-\u9fff]/)
    })

    it('returns Chinese emergency action text by default and matches legacy constant', () => {
      expect(emergencyActionText('zh')).toBe(EMERGENCY_ACTION_TEXT)
      expect(EMERGENCY_ACTION_TEXT).toContain('999')
    })
  })

  describe('buildEmergencyStructuredAnswer for Malay', () => {
    it('returns structured answer containing 999 and no Chinese characters', () => {
      const answer = buildEmergencyStructuredAnswer(undefined, undefined, 'ms')
      expect(answer.summary).toContain('999')
      expect(answer.summary).not.toMatch(/[\u4e00-\u9fff]/)
      expect(answer.advice.join(' ')).not.toMatch(/[\u4e00-\u9fff]/)
      expect(answer.seekCareWhen.join(' ')).not.toMatch(/[\u4e00-\u9fff]/)
      expect(answer.followUpQuestions.join(' ')).not.toMatch(/[\u4e00-\u9fff]/)
      expect(answer.possibleCauses.join(' ')).not.toMatch(/[\u4e00-\u9fff]/)
      expect(answer.disclaimer).not.toMatch(/[\u4e00-\u9fff]/)
      expect(answer.urgency).toBe('emergency')
    })
  })

  describe('createSafeFallbackAnswer for Malay', () => {
    it('returns safe fallback answer without Chinese characters', () => {
      const fallback = createSafeFallbackAnswer('ms')
      expect(fallback.summary).not.toMatch(/[\u4e00-\u9fff]/)
      expect(fallback.advice.join(' ')).not.toMatch(/[\u4e00-\u9fff]/)
      expect(fallback.seekCareWhen.join(' ')).not.toMatch(/[\u4e00-\u9fff]/)
      expect(fallback.followUpQuestions.join(' ')).not.toMatch(/[\u4e00-\u9fff]/)
      expect(fallback.disclaimer).not.toMatch(/[\u4e00-\u9fff]/)
      expect(fallback.disclaimer).toContain('🛡️ Penafian:')
    })

    it('uses Malay fallback in validateAndSanitizeAnswer when validation fails', () => {
      const result = validateAndSanitizeAnswer(null, 'medical_qa', 'ms')
      expect(result.passed).toBe(false)
      expect(result.answer.summary).not.toMatch(/[\u4e00-\u9fff]/)
      expect(result.answer.disclaimer).toContain('🛡️ Penafian:')
    })

    it('uses Malay default disclaimer for medical_qa when answer disclaimer is empty', () => {
      const result = validateAndSanitizeAnswer(
        {
          summary: 'Maklumat kesihatan umum berkenaan sakit kepala.',
          followUpQuestions: [],
          possibleCauses: [],
          urgency: 'low',
          advice: ['Minum air secukupnya.'],
          seekCareWhen: [],
          disclaimer: '',
        },
        'medical_qa',
        'ms',
      )
      expect(result.passed).toBe(true)
      expect(result.answer.disclaimer).toContain('🛡️ Nota Info Kesihatan:')
      expect(result.answer.disclaimer).not.toMatch(/[\u4e00-\u9fff]/)
    })
  })
})
