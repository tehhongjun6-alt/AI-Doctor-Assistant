import { describe, expect, it } from 'vitest'
import { formatAnswerAsText } from './answerText'
import { translations } from '../i18n'
import type { HealthAnswer } from '../services/chatService'

describe('formatAnswerAsText (Step 4)', () => {
  const t = translations.zh

  it('formats normal answer: removes double asterisks, includes summary, advice items, and shareFooter', () => {
    const answer: HealthAnswer = {
      summary: '常见于 **感冒后咳嗽**',
      possibleCauses: ['1️⃣ **普通感冒** — 上呼吸道病毒感染'],
      advice: ['✅ **多喝温水** — 保持咽喉湿润', '🛌 **注意休息** — 避免熬夜'],
      seekCareWhen: ['🔴 **持续高烧** — 超过 3 天不退'],
      urgency: 'low',
      disclaimer: '本内容仅为健康咨询参考，不构成医疗诊断。',
      followUpQuestions: [],
    }

    const text = formatAnswerAsText(answer, t)

    expect(text).not.toContain('**')
    expect(text).toContain('常见于 感冒后咳嗽')
    expect(text).toContain('多喝温水 — 保持咽喉湿润')
    expect(text).toContain('注意休息 — 避免熬夜')
    expect(text).toContain(t.shareFooter)
  })

  it('includes 999 on the first line when urgency is emergency', () => {
    const answer: HealthAnswer = {
      summary: '患者突发剧烈胸痛并呼吸困难。',
      possibleCauses: [],
      advice: ['保持平卧，保持空气流通。'],
      seekCareWhen: [],
      urgency: 'emergency',
      disclaimer: '本回答仅供参考。',
      followUpQuestions: [],
    }

    const text = formatAnswerAsText(answer, t)
    const firstLine = text.split('\n')[0]

    expect(firstLine).toContain('999')
    expect(firstLine).toBe(t.emergencyCallText)
  })
})
