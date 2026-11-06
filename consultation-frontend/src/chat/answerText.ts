import type { Translation } from '../i18n'
import type { HealthAnswer } from '../services/chatService'

function clean(text: string): string {
  return text.replace(/\*\*/g, '').trim()
}

export function formatAnswerAsText(answer: HealthAnswer, t: Translation): string {
  const blocks: string[] = []

  if (answer.urgency === 'emergency') {
    blocks.push(t.emergencyCallText)
  }

  if (answer.summary) {
    blocks.push(clean(answer.summary))
  }

  if (answer.possibleCauses && answer.possibleCauses.length > 0) {
    const title =
      answer.focusMode === 'inquiry_first'
        ? t.preliminaryCauses
        : t.keyPossibleCauses
    const items = answer.possibleCauses.map((c) => clean(c)).filter(Boolean)
    if (items.length > 0) {
      blocks.push(`【${title}】\n${items.join('\n')}`)
    }
  }

  if (answer.advice && answer.advice.length > 0) {
    const title =
      answer.focusMode === 'inquiry_first'
        ? t.tempReliefAdvice
        : answer.possibleCauses.length === 0 &&
            (!answer.followUpQuestions || answer.followUpQuestions.length === 0) &&
            (!answer.seekCareWhen || answer.seekCareWhen.length === 0)
          ? t.coreHealthPoints
          : t.nextStepAdvice
    const items = answer.advice.map((a) => clean(a)).filter(Boolean)
    if (items.length > 0) {
      blocks.push(`【${title}】\n${items.join('\n')}`)
    }
  }

  if (answer.seekCareWhen && answer.seekCareWhen.length > 0) {
    const items = answer.seekCareWhen.map((s) => clean(s)).filter(Boolean)
    if (items.length > 0) {
      blocks.push(`【${t.dangerRedFlags}】\n${items.join('\n')}`)
    }
  }

  if (answer.disclaimer) {
    blocks.push(clean(answer.disclaimer))
  }

  blocks.push(t.shareFooter)

  return blocks.join('\n\n')
}
