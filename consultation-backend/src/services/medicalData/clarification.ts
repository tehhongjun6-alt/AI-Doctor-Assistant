import type { ChatAnswer } from '../../schemas/chat.js'

const disclaimer =
  '这是一般健康资讯，不是诊断，也不能代替医生面诊；如症状严重或快速恶化，请及时就医。'

export function createClarificationAnswer(): ChatAnswer {
  return {
    summary: '目前的信息不足，我还不能可靠地判断应该查询哪一类医学资料。',
    followUpQuestions: [
      '你最主要想询问的是症状、疾病、药物、伤口，还是检查报告？',
      '问题从什么时候开始，现在有多严重？',
      '可以提供年龄、相关病史以及正在使用的药物吗？',
    ],
    possibleCauses: [],
    urgency: 'low',
    advice: ['请补充上述资料，我再按对应的可靠来源查询。'],
    seekCareWhen: [
      '如果出现呼吸困难、胸痛、意识异常、大量出血或症状快速恶化，请立即联系马来西亚 999。',
    ],
    disclaimer,
  }
}

export function createInsufficientEvidenceAnswer(
  reason: 'insufficient_evidence' | 'not_configured' | 'unavailable',
): ChatAnswer {
  const summaries = {
    insufficient_evidence:
      '我没有从已连接的可靠医学资料中找到足够相关的内容，因此不能确认答案。',
    not_configured: '所需的医学资料服务尚未配置，因此目前不能可靠回答。',
    unavailable: '医学资料服务目前无法使用，因此我不能在缺少证据时给出肯定答案。',
  } as const

  return {
    summary: summaries[reason],
    followUpQuestions: [
      '可以提供更准确的症状、药名、检查名称或医生给出的术语吗？',
      '问题持续多久，严重程度和变化情况怎样？',
    ],
    possibleCauses: [],
    urgency: 'low',
    advice: ['补充资料后可以重新查询；不要仅凭不确定的信息自行诊断或改变用药。'],
    seekCareWhen: [
      '如果出现呼吸困难、胸痛、意识异常、大量出血或症状快速恶化，请立即联系马来西亚 999。',
    ],
    disclaimer,
  }
}

