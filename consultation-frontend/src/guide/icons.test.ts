import { describe, expect, it } from 'vitest'

const TOPIC_IDS = [
  'dengue', 'influenza', 'covid19', 'hfmd', 'tuberculosis', 'gastroenteritis',
  'diabetes', 'hypertension', 'cholesterol', 'asthma', 'kidney', 'gout',
  'cold', 'fever', 'gastritis', 'eczema', 'mental-health',
  'stroke', 'heart-attack', 'heatstroke',
]

const icons = import.meta.glob('./icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('guide icons', () => {
  it('has exactly one SVG per topic id', () => {
    const names = Object.keys(icons).map((p) => p.replace('./icons/', '').replace('.svg', ''))
    expect(names).toHaveLength(20)
    expect([...names].sort()).toEqual([...TOPIC_IDS].sort())
  })

  it('every file is an SVG', () => {
    for (const content of Object.values(icons)) {
      expect(content.trimStart().startsWith('<svg')).toBe(true)
    }
  })
})
