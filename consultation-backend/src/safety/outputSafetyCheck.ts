import type { ChatAnswer } from '../schemas/chat.js'

export interface OutputSafetyCheckResult {
  passed: boolean
  reason?: string
  answer: ChatAnswer
}

const DEFAULT_DISCLAIMER =
  '本助手仅提供一般健康信息参考，不能替代专业医生的面诊、诊断或治疗。如有身体不适，请及时就医。'

const DEFAULT_DISCLAIMER_EN =
  '🛡️ Disclaimer: This assistant provides general health information for reference only and does not replace professional medical diagnosis or treatment. Please consult a doctor if you feel unwell.'

const MEDICAL_QA_DISCLAIMER_EN =
  '🛡️ Health Info Note: The above content is for general health education only. Please consult a healthcare professional if you experience any symptoms.'

const UNSAFE_MEDICAL_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /(?:我|本助手)(?:现在)?(?:为您|给你|替你)?(?:正式)?确诊(?:您|你)(?:患有|得了|是)/,
    reason: '包含越权确诊表述',
  },
  {
    pattern: /(?:保证|100%|绝对)(?:能|可以)?(?:根治|包治|药到病除|彻底治好)/,
    reason: '包含绝对化治愈承诺',
  },
  {
    pattern: /(?:不需要|不用|切勿|千万不要)去医院(?:看病|就医|检查)/,
    reason: '包含劝阻正常就医的不安全建议',
  },
  {
    pattern:
      /\b(?:i(?:\s+hereby|\s+officially)?\s+diagnose\s+you\s+with|you\s+(?:definitely|certainly)\s+have)\b/i,
    reason: '包含越权确诊表述',
  },
  {
    pattern:
      /\b(?:guaranteed?\s+to\s+cure|100%\s*(?:cure|curable)|guarantee\s+a\s+cure)\b/i,
    reason: '包含绝对化治愈承诺',
  },
  {
    pattern:
      /\b(?:no\s+need\s+to\s+(?:see|visit|consult)\s+a\s+doctor|you\s+don't\s+need\s+to\s+(?:go\s+to\s+the\s+hospital|see\s+a\s+doctor)|(?:do\s+not|never)\s+(?:go\s+to\s+the\s+hospital|see\s+a\s+doctor))\b/i,
    reason: '包含劝阻正常就医的不安全建议',
  },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function createSafeFallbackAnswer(
  language: 'zh' | 'en' = 'zh',
): ChatAnswer {
  if (language === 'en') {
    return {
      summary:
        'Sorry, I could not generate a complete health assessment for that request right now. Please try rephrasing or describing your symptoms, duration, or medication name in more detail.',
      followUpQuestions: [
        '🔹 **Main Symptoms & Duration** — What are your main symptoms and how long have they lasted?',
        '🔹 **Associated Symptoms** — Do you have fever, pain, or other accompanying symptoms?',
      ],
      possibleCauses: [],
      urgency: 'medium',
      advice: [
        '✅ **Avoid Self-Medicating Blindly** — Do not adjust prescription dosages based on uncertain information.',
        '🏥 **Consult a Doctor** — If symptoms persist or worsen, please visit a nearby clinic or hospital for evaluation.',
      ],
      seekCareWhen: [
        '🔴 **Emergency Warning** — If you experience difficulty breathing, severe chest pain, confusion, uncontrolled bleeding, or rapid worsening, call emergency services (e.g., 999 in Malaysia) or go to the nearest Emergency Department immediately.',
      ],
      disclaimer: DEFAULT_DISCLAIMER_EN,
    }
  }

  return {
    summary:
      '抱歉，我刚才未能顺利生成针对该问题的完整健康建议。您可以换一种方式，具体描述您的症状、持续时间或正在咨询的药物名称。',
    followUpQuestions: [
      '请问您目前最明显的不适症状是什么？已经持续了多久？',
      '是否有发烧、疼痛或其他伴随症状？',
    ],
    possibleCauses: [],
    urgency: 'medium',
    advice: [
      '请勿仅凭不确定的信息自行诊断或随意更改用药剂量。',
      '如果症状持续未缓解，建议前往附近诊所或医院由专业医生评估。',
    ],
    seekCareWhen: [
      '如果出现呼吸困难、剧烈胸痛、意识模糊、大量出血或症状快速恶化，请立即拨打当地急救电话（如马来西亚 999）或前往最近急诊。',
    ],
    disclaimer: DEFAULT_DISCLAIMER,
  }
}

export function validateAndSanitizeAnswer(
  rawAnswer: unknown,
  mode: 'direct_model' | 'medical_qa' | 'medical_api' | 'emergency' | 'clarification',
  language: 'zh' | 'en' = 'zh',
): OutputSafetyCheckResult {
  if (!isRecord(rawAnswer)) {
    return {
      passed: false,
      reason: '模型返回结果不是有效对象。',
      answer: createSafeFallbackAnswer(language),
    }
  }

  const summary =
    typeof rawAnswer.summary === 'string' ? rawAnswer.summary.trim() : ''
  const followUpQuestions = isStringArray(rawAnswer.followUpQuestions)
    ? rawAnswer.followUpQuestions.map((s) => s.trim()).filter(Boolean)
    : undefined
  const possibleCauses = isStringArray(rawAnswer.possibleCauses)
    ? rawAnswer.possibleCauses.map((s) => s.trim()).filter(Boolean)
    : undefined
  const advice = isStringArray(rawAnswer.advice)
    ? rawAnswer.advice.map((s) => s.trim()).filter(Boolean)
    : undefined
  const seekCareWhen = isStringArray(rawAnswer.seekCareWhen)
    ? rawAnswer.seekCareWhen.map((s) => s.trim()).filter(Boolean)
    : undefined
  const urgency = rawAnswer.urgency
  const focusMode =
    rawAnswer.focusMode === 'inquiry_first' ||
    rawAnswer.focusMode === 'assessment_first' ||
    rawAnswer.focusMode === 'advice_first'
      ? rawAnswer.focusMode
      : 'assessment_first'
  const disclaimer =
    typeof rawAnswer.disclaimer === 'string' ? rawAnswer.disclaimer.trim() : ''

  const validUrgency =
    urgency === 'low' ||
    urgency === 'medium' ||
    urgency === 'high' ||
    urgency === 'emergency'

  if (
    !summary ||
    !followUpQuestions ||
    !possibleCauses ||
    !advice ||
    !seekCareWhen ||
    !validUrgency
  ) {
    return {
      passed: false,
      reason: '模型返回结果缺少必要字段或字段格式不正确。',
      answer: createSafeFallbackAnswer(language),
    }
  }

  const combinedText = [
    summary,
    ...followUpQuestions,
    ...possibleCauses,
    ...advice,
    ...seekCareWhen,
  ].join('\n')

  for (const rule of UNSAFE_MEDICAL_PATTERNS) {
    if (rule.pattern.test(combinedText)) {
      return {
        passed: false,
        reason: rule.reason,
        answer: createSafeFallbackAnswer(language),
      }
    }
  }

  if (mode === 'direct_model') {
    return {
      passed: true,
      answer: {
        summary,
        followUpQuestions: [],
        possibleCauses: [],
        urgency: 'low',
        advice: [],
        seekCareWhen: [],
        disclaimer: '',
      },
    }
  }

  if (mode === 'medical_qa') {
    const defaultQaDisclaimer =
      language === 'en'
        ? MEDICAL_QA_DISCLAIMER_EN
        : '🛡️ 科普提示：以上内容仅供医学健康知识参考，如遇身体不适请及时咨询专业医生。'
    return {
      passed: true,
      answer: {
        summary,
        followUpQuestions: [],
        possibleCauses: [],
        urgency: 'low',
        advice: advice.slice(0, 6),
        seekCareWhen: [],
        disclaimer: disclaimer || defaultQaDisclaimer,
      },
    }
  }

  return {
    passed: true,
    answer: {
      summary,
      focusMode,
      followUpQuestions: followUpQuestions.slice(0, 6),
      possibleCauses: possibleCauses.slice(0, 6),
      urgency,
      advice: advice.slice(0, 8),
      seekCareWhen: seekCareWhen.slice(0, 8),
      disclaimer:
        disclaimer ||
        (language === 'en' ? DEFAULT_DISCLAIMER_EN : DEFAULT_DISCLAIMER),
    },
  }
}
