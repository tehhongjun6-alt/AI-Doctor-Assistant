import { describe, expect, it } from 'vitest'
import { GUIDE_TOPICS } from './guideTopics'

const LANGS = ['zh', 'en', 'ms'] as const

const EXPECTED_IDS = [
  'dengue', 'influenza', 'covid19', 'hfmd', 'tuberculosis', 'gastroenteritis',
  'diabetes', 'hypertension', 'cholesterol', 'asthma', 'kidney', 'gout',
  'cold', 'fever', 'gastritis', 'eczema', 'mental-health',
  'stroke', 'heart-attack', 'heatstroke',
]

const byId = (id: string) => {
  const topic = GUIDE_TOPICS.find((t) => t.id === id)
  if (!topic) throw new Error(`missing topic ${id}`)
  return topic
}

describe('GUIDE_TOPICS', () => {
  it('has exactly the 20 planned topics in order, with no duplicates', () => {
    const ids = GUIDE_TOPICS.map((t) => t.id)
    expect(ids).toEqual(EXPECTED_IDS)
    expect(new Set(ids).size).toBe(20)
  })

  it('has the planned number of topics per category', () => {
    const count = (c: string) => GUIDE_TOPICS.filter((t) => t.category === c).length
    expect(count('infection')).toBe(6)
    expect(count('chronic')).toBe(6)
    expect(count('everyday')).toBe(5)
    expect(count('emergency')).toBe(3)
  })

  it.each(GUIDE_TOPICS.map((t) => [t.id, t] as const))('%s has complete content in all languages', (_id, topic) => {
    for (const lang of LANGS) {
      expect(topic.title[lang].trim()).not.toBe('')
      expect(topic.summary[lang].trim()).not.toBe('')
      expect(topic.askPrompt[lang].trim()).not.toBe('')
      expect(topic.symptoms[lang].length).toBeGreaterThanOrEqual(3)
      expect(topic.symptoms[lang].length).toBeLessThanOrEqual(5)
      expect(topic.care[lang].length).toBeGreaterThanOrEqual(3)
      expect(topic.care[lang].length).toBeLessThanOrEqual(5)
      expect(topic.seeDoctor[lang].length).toBeGreaterThanOrEqual(2)
      expect(topic.seeDoctor[lang].length).toBeLessThanOrEqual(4)
    }
    expect(topic.sources.length).toBeGreaterThanOrEqual(1)
    for (const source of topic.sources) {
      expect(source.url.startsWith('https://')).toBe(true)
    }
    expect(topic.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('emergency topics list calling 999 first in every language', () => {
    for (const topic of GUIDE_TOPICS.filter((t) => t.category === 'emergency')) {
      for (const lang of LANGS) {
        expect(topic.seeDoctor[lang][0]).toContain('999')
      }
    }
  })

  it('dengue warns to use paracetamol and avoid ibuprofen', () => {
    const dengue = byId('dengue')
    const zh = dengue.care.zh.join(' ')
    expect(zh).toContain('paracetamol')
    expect(zh).toContain('布洛芬')
    expect(dengue.care.en.join(' ')).toContain('ibuprofen')
  })

  it('mental-health lists the Befrienders hotline and 999 in every language', () => {
    const topic = byId('mental-health')
    for (const lang of LANGS) {
      const text = topic.seeDoctor[lang].join(' ')
      expect(text).toContain('03-7627 2929')
      expect(text).toContain('999')
    }
  })
})
