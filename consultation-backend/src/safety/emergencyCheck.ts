import type { ChatAnswer, ChatHistoryMessage, ChatLanguage } from '../schemas/chat.js'

export type EmergencyCategory =
  | 'airway_emergency'
  | 'breathing'
  | 'unconsciousness'
  | 'chest_pain'
  | 'severe_bleeding'
  | 'severe_allergy'
  | 'stroke'
  | 'seizure'
  | 'self_harm'
  | 'severe_trauma'
  | 'severe_burn'
  | 'poisoning_overdose'
  | 'drowning'

export interface EmergencyCheckResult {
  isEmergency: boolean
  category?: EmergencyCategory
  reason?: string
  action?: string
}

interface EmergencyRule {
  category: EmergencyCategory
  reason: string
  patterns: RegExp[]
}

interface ContextualEmergencyRule {
  category: EmergencyCategory
  reason: string
  historyPatterns: RegExp[]
  currentPatterns: RegExp[]
}

export const EMERGENCY_ACTION_TEXT =
  '请立即拨打马来西亚紧急电话 999，并按照接线员指示处理。'

export function emergencyActionText(language: ChatLanguage = 'zh'): string {
  if (language === 'en') {
    return 'Please call Malaysia emergency services at 999 immediately and follow the operator’s instructions.'
  }
  if (language === 'ms') {
    return 'Sila hubungi talian kecemasan Malaysia 999 dengan segera dan ikuti arahan operator.'
  }
  return EMERGENCY_ACTION_TEXT
}

const emergencyAction = EMERGENCY_ACTION_TEXT

const rules: EmergencyRule[] = [
  {
    category: 'airway_emergency',
    reason: '描述了窒息、气道阻塞、停止呼吸或疑似心搏骤停。',
    patterns: [
      /噎住|卡住喉咙|窒息|气道阻塞|停止呼吸|没有呼吸|没呼吸|没有脉搏|心跳停止/,
      /choking|airway (?:is )?blocked|stopped breathing|not breathing|no pulse|cardiac arrest/i,
    ],
  },
  {
    category: 'breathing',
    reason: '描述了严重呼吸困难或无法正常呼吸。',
    patterns: [
      /无法呼吸|不能呼吸|喘不过气|呼吸(?:非常|十分|严重)困难|说不出完整句子/,
      /cannot breathe|can(?:not|'t) catch (?:my|their) breath|severe difficulty breathing|gasping for air/i,
      /tak boleh bernafas|sesak nafas teruk/i,
    ],
  },
  {
    category: 'unconsciousness',
    reason: '描述了失去意识、严重意识异常或无法唤醒。',
    patterns: [
      /失去意识|没有意识|昏迷|叫不醒|无法唤醒|神志不清|突然意识混乱|异常嗜睡|很难叫醒/,
      /unconscious|unresponsive|cannot be woken|passed out and (?:is )?not waking|sudden confusion|extremely drowsy and hard to wake/i,
      /pengsan|tak sedar diri/i,
    ],
  },
  {
    category: 'chest_pain',
    reason: '描述了严重或持续的胸部疼痛。',
    patterns: [
      /(?:剧烈|严重|持续|压榨性|撕裂样).{0,5}胸(?:口|部)?(?:痛|疼)|胸(?:口|部)?(?:剧烈|严重|持续|压榨性|撕裂样).{0,5}(?:痛|疼)/,
      /胸(?:口|部)?(?:闷|压迫感|紧缩感|不舒服).{0,12}(?:气短|呼吸困难|冷汗|恶心|手臂|下巴|背部)|(?:手臂|下巴|背部).{0,12}(?:痛|疼).{0,12}胸(?:口|部)?(?:闷|痛|疼|不舒服)/,
      /severe chest pain|crushing chest pain|persistent chest pain/i,
      /chest (?:pressure|tightness|discomfort).{0,30}(?:shortness of breath|cold sweat|nausea|arm|jaw|back)/i,
      /sakit dada/i,
    ],
  },
  {
    category: 'severe_bleeding',
    reason: '描述了大量出血或无法止血。',
    patterns: [
      /大量出血|无法止血|出血不止|血.{0,6}(?:止不住|一直流|不停流)/,
      /severe bleeding|uncontrolled bleeding|bleeding (?:will not|won't) stop|major blood loss/i,
      /darah tak berhenti/i,
    ],
  },
  {
    category: 'severe_allergy',
    reason: '描述了可能影响呼吸的严重过敏反应。',
    patterns: [
      /(?:喉咙|舌头|嘴唇).{0,6}(?:突然)?肿.{0,8}(?:呼吸困难|喘不过气|吞咽困难)/,
      /(?:严重过敏|过敏反应).{0,8}(?:呼吸困难|喉咙肿|舌头肿)/,
      /(?:throat|tongue|lips?).{0,12}(?:swelling|swollen).{0,20}(?:difficulty breathing|cannot breathe|difficulty swallowing)/i,
    ],
  },
  {
    category: 'stroke',
    reason: '描述了可能的中风警示信号。',
    patterns: [
      /突然.{0,8}(?:脸歪|嘴歪|一侧无力|半边无力|说话含糊|无法说话)/,
      /突然.{0,8}(?:单侧麻木|一边麻木|看不清|视力异常|失去平衡|站不稳|剧烈头痛)/,
      /(?:脸歪|嘴歪|一侧无力|半边无力).{0,8}(?:说话含糊|无法说话)/,
      /sudden.{0,20}(?:face droop|one-sided (?:weakness|numbness)|slurred speech|unable to speak|vision (?:loss|change)|loss of balance|severe headache)/i,
      /mulut senget|cakap pelat tiba-tiba/i,
    ],
  },
  {
    category: 'seizure',
    reason: '描述了持续抽搐或癫痫发作后没有恢复意识。',
    patterns: [
      /抽搐.{0,8}(?:超过五分钟|超过5分钟|一直不停|没有停止)|癫痫.{0,8}(?:一直发作|没有停止|失去意识)|第一次.{0,6}(?:抽搐|癫痫发作)/,
      /(?:first|first-ever).{0,12}seizure|seizure.{0,20}(?:over five minutes|over 5 minutes|will not stop|not regaining consciousness)/i,
      /\bsawan\b/i,
    ],
  },
  {
    category: 'self_harm',
    reason: '表达了立即自杀或伤害自己的意图。',
    patterns: [
      /(?:现在|马上|立即)?.{0,4}(?:想|要|准备)(?:自杀|结束生命|伤害自己)/,
      /(?:going to|plan to|about to|want to).{0,12}(?:kill myself|end my life|hurt myself)/i,
      /bunuh diri|nak mati/i,
    ],
  },
  {
    category: 'severe_trauma',
    reason: '描述了可能危及生命的严重事故或创伤。',
    patterns: [
      /严重车祸|重大交通事故|高处坠落|从.{0,6}(?:高处|楼上)摔下|穿透伤|贯穿伤|枪伤|严重头部受伤|严重脊椎受伤|骨头露出/,
      /serious (?:car|road traffic) accident|major trauma|fall from (?:a )?height|penetrating injury|gunshot wound|serious (?:head|spinal) injury|bone (?:is )?exposed/i,
    ],
  },
  {
    category: 'severe_burn',
    reason: '描述了严重烧伤、化学烧伤、电击或吸入浓烟。',
    patterns: [
      /大面积烧伤|严重烧伤|脸部烧伤|面部烧伤|呼吸道烧伤|化学烧伤|酸(?:液)?烧伤|触电|电击伤|吸入浓烟|烟雾吸入/,
      /severe burn|large burn|face burn|airway burn|chemical burn|electric shock|electrical burn|smoke inhalation/i,
    ],
  },
  {
    category: 'poisoning_overdose',
    reason: '描述了可能的中毒、危险物质暴露或药物过量。',
    patterns: [
      /误食(?:毒物|化学品|清洁剂|农药)|吞下(?:毒物|化学品|清洁剂|农药)|服药过量|药物过量|煤气中毒|一氧化碳中毒|吸入有毒气体/,
      /swallowed (?:poison|a chemical|cleaning product|pesticide)|medication overdose|drug overdose|took too many pills|carbon monoxide poisoning|inhaled toxic (?:gas|fumes)/i,
      /telan banyak ubat|minum racun/i,
    ],
  },
  {
    category: 'drowning',
    reason: '描述了正在溺水，或溺水后出现意识或呼吸异常。',
    patterns: [
      /正在溺水|溺水后.{0,12}(?:没有呼吸|昏迷|失去意识|呼吸困难)|从水里救起.{0,12}(?:没有呼吸|昏迷|失去意识|呼吸困难)/,
      /drowning now|after (?:drowning|submersion).{0,30}(?:not breathing|unconscious|difficulty breathing)|pulled from (?:the )?water.{0,30}(?:not breathing|unconscious|difficulty breathing)/i,
    ],
  },
]

const contextualRules: ContextualEmergencyRule[] = [
  {
    category: 'breathing',
    reason: '最近的对话提到呼吸问题，而当前消息表示情况正在恶化。',
    historyPatterns: [/呼吸困难|喘不过气|气喘|无法呼吸/, /difficulty breathing|cannot breathe|shortness of breath/i],
    currentPatterns: [/越来越严重|加重|恶化|现在无法|现在不能|还是无法|仍然无法/, /getting worse|worsening|still cannot|now cannot/i],
  },
  {
    category: 'chest_pain',
    reason: '最近的对话提到胸部不适，而当前消息表示情况持续或正在恶化。',
    historyPatterns: [/胸(?:口|部)?(?:痛|疼|闷|不舒服)/, /chest (?:pain|pressure|discomfort|tightness)/i],
    currentPatterns: [/越来越严重|加重|恶化|更痛|持续|没有缓解|压榨|撕裂/, /getting worse|worsening|more painful|persistent|not improving|crushing|tearing/i],
  },
  {
    category: 'severe_bleeding',
    reason: '最近的对话提到出血，而当前消息表示仍未止血或正在恶化。',
    historyPatterns: [/流血|出血|伤口/, /bleeding|blood loss|wound/i],
    currentPatterns: [/止不住|没有停止|还在流|越来越多|加重|恶化/, /will not stop|won't stop|still bleeding|more blood|getting worse/i],
  },
  {
    category: 'severe_allergy',
    reason: '最近的对话提到严重过敏迹象，而当前消息表示情况正在恶化。',
    historyPatterns: [/过敏|喉咙肿|舌头肿|嘴唇肿/, /allerg|swollen (?:throat|tongue|lips?)/i],
    currentPatterns: [/呼吸困难|喘不过气|吞咽困难|越来越严重|加重|恶化/, /difficulty breathing|cannot breathe|difficulty swallowing|getting worse|worsening/i],
  },
  {
    category: 'stroke',
    reason: '最近的对话提到可能的中风迹象，而当前消息表示症状持续或恶化。',
    historyPatterns: [/脸歪|嘴歪|一侧无力|半边无力|说话含糊|无法说话/, /face droop|one-sided weakness|slurred speech|unable to speak/i],
    currentPatterns: [/还在|没有恢复|越来越严重|加重|恶化/, /still|not recovered|getting worse|worsening/i],
  },
  {
    category: 'seizure',
    reason: '最近的对话提到抽搐或癫痫，而当前消息表示发作仍在继续。',
    historyPatterns: [/抽搐|癫痫/, /seizure|convulsion/i],
    currentPatterns: [/还在|没有停止|一直不停|没有恢复意识|叫不醒/, /still|will not stop|not regaining consciousness|cannot be woken/i],
  },
  {
    category: 'severe_bleeding',
    reason: '发烧或疑似骨痛热症（登革热）期间出现呕血、黑便、出血不止或剧烈腹痛等重症警示信号。',
    historyPatterns: [/发烧|高烧|骨痛热症|登革热|蚊症/, /fever|dengue/i],
    currentPatterns: [
      /呕血|吐血|黑便|柏油便|便血|流血不止|出血不止|剧烈腹痛|肚子剧痛|频繁呕吐|叫不醒|极度嗜睡/,
      /vomiting blood|black stool|bleeding.{0,12}stop|severe abdominal pain|severe stomach pain/i,
    ],
  },
  {
    category: 'unconsciousness',
    reason: '发烧或头痛伴随颈部僵硬、喷射性呕吐或意识异常，需高度警惕急性中枢神经系统感染（如脑膜炎）。',
    historyPatterns: [/发烧|高烧|头痛|头疼/, /fever|headache/i],
    currentPatterns: [
      /脖子(?:僵硬|很硬|硬邦邦|低不下)|颈部僵硬|喷射(?:性|状)?呕吐|神志不清|意识模糊/,
      /stiff neck|neck stiffness|projectile vomiting|confusion/i,
    ],
  },
  {
    category: 'severe_bleeding',
    reason: '孕期出现阴道出血、剧烈腹痛或严重视觉/血压异常，属于产科急症信号。',
    historyPatterns: [/怀孕|孕妇|孕期|怀孕.{0,6}周|妊娠/, /pregnant|pregnancy/i],
    currentPatterns: [
      /流血|出血|见红.{0,6}痛|剧烈腹痛|肚子剧痛|突然眼花|看不清|剧烈头痛|抽搐/,
      /bleeding|severe abdominal pain|severe headache|blurred vision|seizure/i,
    ],
  },
]

function isNegatedOrNonAcute(text: string, matchIndex: number) {
  const lookbackStart = Math.max(0, matchIndex - 40)
  const prefix = text.slice(lookbackStart, matchIndex)
  const lastClause = prefix.split(/[。！？；!?;]/).pop() ?? prefix

  const suffix = text.slice(matchIndex, Math.min(text.length, matchIndex + 60))
  const currentSentence = `${lastClause}${suffix.split(/[。！？；!?;]/)[0] ?? suffix}`

  if (
    /(?:没有|并无|未出现|没出现|否认|不是|并没|不会|毫无|without|den(?:y|ies|ied)|no sign of|not having|no |don't have|doesn't have)/i.test(
      lastClause,
    )
  ) {
    return true
  }

  if (
    /(?:如果|万一|假如|要是|假设|请问.{0,8}会|什么是|有什么症状|去年|前年|几年前|以前|上个月|刚刚提到的|刚才说的|你说的)/i.test(
      currentSentence,
    )
  ) {
    return true
  }

  const isEducationalQuestion =
    /(?:是什么(?:原因|病|意思|症状|情况)|有什么(?:症状|表现|后果|危害|原因|区别)|为什么(?:会|不能|要)|怎么(?:引起|导致的|正确止血|预防|判断|区分)|如何(?:止血|预防|判断|急救)|能不能(?:喂水|吃)|通常是什么)/i.test(
      currentSentence,
    )
  const hasAcuteFirstPerson =
    /(?:我(?:现在|突然|刚刚|正在|自己|老婆|老公|孩子|妈|爸)|救命|帮帮我|一直在流)/i.test(
      currentSentence,
    )

  if (isEducationalQuestion && !hasAcuteFirstPerson) {
    return true
  }

  return false
}

function hasNonNegatedMatch(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => {
    const match = pattern.exec(text)
    return Boolean(match && !isNegatedOrNonAcute(text, match.index))
  })
}

function checkDirectEmergency(
  normalizedMessage: string,
): EmergencyCheckResult | undefined {
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(normalizedMessage)

      if (match && !isNegatedOrNonAcute(normalizedMessage, match.index)) {
        return {
          isEmergency: true,
          category: rule.category,
          reason: rule.reason,
          action: emergencyAction,
        }
      }
    }
  }

  return undefined
}

export function checkEmergencyRisk(
  message: string,
  history: ChatHistoryMessage[] = [],
): EmergencyCheckResult {
  const normalizedMessage = message.trim()
  const directEmergency = checkDirectEmergency(normalizedMessage)

  if (directEmergency) {
    return directEmergency
  }

  const recentUserContext = history
    .filter((historyMessage) => historyMessage.role === 'user')
    .slice(-3)
    .map((historyMessage) => historyMessage.content.trim())
    .join(' ')

  if (recentUserContext) {
    for (const rule of contextualRules) {
      const hasRelevantHistory = hasNonNegatedMatch(
        recentUserContext,
        rule.historyPatterns,
      )
      const hasCurrentEscalation = hasNonNegatedMatch(
        normalizedMessage,
        rule.currentPatterns,
      )

      if (hasRelevantHistory && hasCurrentEscalation) {
        return {
          isEmergency: true,
          category: rule.category,
          reason: rule.reason,
          action: emergencyAction,
        }
      }
    }
  }

  return { isEmergency: false }
}

const EMERGENCY_DISCLAIMER =
  '本助手仅提供紧急医疗分诊与现场初步急救指引，不能替代急诊医生的抢救与诊疗。遇危及生命情况请立即拨打马来西亚急救电话 999。'

const EMERGENCY_DISCLAIMER_EN =
  '🛡️ Emergency Notice: This assistant provides emergency triage and first-aid guidance only and cannot replace emergency medical care. In life-threatening situations, call 999 immediately.'

const EMERGENCY_DISCLAIMER_MS =
  '🛡️ Penafian Kecemasan: Pembantu ini hanya menyediakan triage kecemasan dan panduan pertolongan cemas awal, serta tidak boleh menggantikan rawatan perubatan kecemasan profesional. Jika dalam situasi yang mengancam nyawa, sila hubungi 999 dengan segera.'

export function buildEmergencyStructuredAnswer(
  category: EmergencyCategory | undefined,
  reason?: string,
  language: ChatLanguage = 'zh',
): ChatAnswer {
  if (language === 'en') {
    return {
      summary:
        '🚨 **Emergency Medical Alert (Life-Threatening Condition Detected)**: Your description indicates a critical medical emergency. Please do not wait for online consultation — **call 999 immediately or go to the nearest hospital Emergency Department right away!**',
      possibleCauses: [
        '1️⃣ **Acute Critical Medical Emergency** — Symptoms suggest a potentially life-threatening condition requiring immediate hospital intervention.',
      ],
      advice: [
        '📞 **Call 999 Immediately** — Dial Malaysia emergency services (**999**) right now or have someone take you to the nearest Emergency Department.',
        '🛋️ **Rest & Stay Calm** — Stop all physical activity, unlock your front door for paramedics, and stay in a safe resting position.',
        '❌ **Do Not Drive Yourself** — Never attempt to drive yourself to the hospital during a medical emergency.',
      ],
      followUpQuestions: [
        '🔹 **On-Site Assistance** — Is there a family member or bystander with you right now who can assist and call 999?',
      ],
      seekCareWhen: [
        '🔴 **Immediate Action Required**: Call **999** now or tap the button below to locate the nearest hospital Emergency Department!',
        '🔴 **If Unconscious or Not Breathing**: Begin CPR immediately under the guidance of the 999 dispatcher.',
      ],
      urgency: 'emergency',
      disclaimer: EMERGENCY_DISCLAIMER_EN,
    }
  }

  if (language === 'ms') {
    return {
      summary:
        '🚨 **Amaran Kecemasan Perubatan (Keadaan Mengancam Nyawa Dikesan)**: Penerangan anda menunjukkan kecemasan perubatan yang kritikal. Tolong jangan tunggu perundingan dalam talian — **sila hubungi 999 dengan segera atau pergi ke Jabatan Kecemasan hospital terdekat sekarang!**',
      possibleCauses: [
        '1️⃣ **Kecemasan Perubatan Kritikal Akut** — Gejala menunjukkan keadaan yang berpotensi mengancam nyawa dan memerlukan rawatan hospital dengan segera.',
      ],
      advice: [
        '📞 **Hubungi 999 Dengan Segera** — Hubungi talian kecemasan Malaysia (**999**) sekarang atau minta bantuan seseorang untuk membawa anda ke Jabatan Kecemasan terdekat.',
        '🛋️ **Bertenang & Berehat** — Hentikan semua aktiviti fizikal, buka kunci pintu untuk memudahkan paramedik masuk, dan kekal dalam posisi rehat yang selamat.',
        '❌ **Jangan Memandu Sendiri** — Jangan sesekali cuba memandu sendiri ke hospital semasa kecemasan perubatan.',
      ],
      followUpQuestions: [
        '🔹 **Bantuan Di Lokasi** — Adakah terdapat ahli keluarga atau orang berdekatan bersama anda sekarang yang boleh membantu menghubungi 999?',
      ],
      seekCareWhen: [
        '🔴 **Tindakan Segera Diperlukan**: Sila hubungi **999** sekarang atau tekan butang di bawah untuk mencari Jabatan Kecemasan hospital terdekat!',
        '🔴 **Jika Tidak Sedarkan Diri atau Tidak Bernafas**: Mulakan CPR dengan segera di bawah bimbingan operator talian 999.',
      ],
      urgency: 'emergency',
      disclaimer: EMERGENCY_DISCLAIMER_MS,
    }
  }

  const cleanReason = (reason ?? '识别到可能危及生命的紧急医疗情况。').replace(/。$/, '')

  switch (category) {
    case 'chest_pain':
      return {
        summary: `🚨 **紧急医疗警报（高度疑似急性心脏事件）**：${cleanReason}。这属于危及生命的最高级别急症信号，请勿继续等待线上问诊，**请立即拨打 999 急救电话或由身边亲友马上送往最近医院急诊室（Emergency）！**`,
        possibleCauses: [
          '1️⃣ **急性冠脉综合征 / 急性心肌梗死** — 心脏冠状动脉突发严重阻塞导致心肌急性缺血，常表现为压榨性胸痛并向左肩背/下巴放射、冒冷汗与气促。',
          '2️⃣ **不稳定性心绞痛或其他急性胸痛危象** — 如主动脉夹层或急性肺栓塞，随时可能危及生命。',
        ],
        advice: [
          '📞 **立即呼叫 999 救援** — 马上拨打马来西亚紧急电话 **999**，告知接线员“疑似急性心梗剧烈胸痛”，若独自在家请先解开房门门锁方便急救人员进入。',
          '🛋️ **立即原地静卧或半坐卧休息** — 马上停止一切活动，保持最省力的半卧姿势，解开紧身衣领或腰带以减少心脏耗氧量。',
          '💊 **按医嘱含服急救药** — 若平时备有医生开具的**硝酸甘油**且无低血压，可按医嘱舌下含服。',
          '❌ **严禁自行走动、上下楼或自己开车去医院** — 任何体力活动都会加剧心肌坏死风险，独自驾车极易在途中昏厥。',
          '❌ **切勿盲目吃普通止痛药拖延时间** — 普通止痛药（如 Panadol）对心肌梗死无效，切勿在家硬撑观察。',
        ],
        followUpQuestions: [
          '🔹 **发作时长与既往病史** — 剧烈胸痛已经持续几分钟了？平时是否有高血压、糖尿病、高血脂或冠心病史？',
          '🔹 **现场陪同情况** — 你现在身边有家人、同事或邻居可以立刻协助拨打 999 并陪护吗？',
        ],
        seekCareWhen: [
          '🔴 **当前已处于最高危急状态**：请**立即（现在）**拨打 **999** 或点击下方按钮查看并前往最近医院急诊科！',
          '🔴 **若患者出现意识丧失、叫不醒或呼吸停止**：身边人员请在 999 接线员指导下立即进行心肺复苏（CPR）。',
        ],
        urgency: 'emergency',
        disclaimer: EMERGENCY_DISCLAIMER,
      }

    case 'poisoning_overdose':
      return {
        summary: `🚨 **紧急医疗警报（急性药物过量 / 中毒风险）**：${cleanReason}。过量药物或毒物随时可能引发**急性重度肝肾功能衰竭、呼吸抑制或致命性中毒**（即使前几小时没有剧烈疼痛也极其危险），必须争分夺秒前往急诊洗胃或使用特效解毒剂！`,
        possibleCauses: [
          '1️⃣ **急性药物过量中毒** — 远超安全上限的药物剂量（如大量扑热息痛/Panadol、安眠药或处方药）会迅速造成急性中毒与器官损伤。',
          '2️⃣ **化学物质或有毒气体暴露** — 毒物经消化道或呼吸道吸收后会导致全身多器官急性损害。',
        ],
        advice: [
          '📞 **立即拨打 999 或马上前往最近急诊室** — 请立即让身边亲友送往最近医院急诊科（Emergency），或立刻拨打 **999** 呼叫救护车。',
          '📦 **务必带上药盒/剩余药片或容器** — 把吃剩的**药盒、药板或化学品瓶子**一起带给急诊医生，准确告知吞服的具体时间和大概数量。',
          '🌬️ **若为吸入有毒气体/煤气** — 立即开窗通风并迅速转移到室外空气新鲜处。',
          '❌ **千万不要自行盲目抠喉催吐** — 不当催吐极易导致呕吐物误吸入肺引起窒息，或造成食道二次灼伤，请交由急诊医生专业处理。',
          '❌ **严禁抱有“现在还不痛就先睡一觉”的侥幸心理** — 许多药物（如 Panadol）过量在前 12~24 小时症状隐匿，但肝脏损伤已在发生，越早用上解毒药（如 NAC）越能保命！',
        ],
        followUpQuestions: [
          '🔹 **吞服时间与具体剂量** — 请问大概是几分钟/几小时前服下的？具体是什么药名、一共吃了多少粒？',
          '🔹 **当前身体反应** — 目前有没有出现恶心呕吐、头晕嗜睡、腹痛或呼吸变慢的情况？',
        ],
        seekCareWhen: [
          '🔴 **当前已处于最高危急状态**：请**一分钟都不要耽误**，立即前往最近医院急诊科或拨打 **999**！',
          '🔴 **若出现昏迷、抽搐或呼吸微弱**：请将患者头偏向一侧防止呕吐物窒息，并立即配合 999 急救人员抢救。',
        ],
        urgency: 'emergency',
        disclaimer: EMERGENCY_DISCLAIMER,
      }

    case 'stroke':
      return {
        summary: `🚨 **紧急医疗警报（高度疑似急性脑卒中 / 中风）**：${cleanReason}。脑中风抢救讲究“黄金时间窗（发病后 3~4.5 小时内溶栓）”，每延误一分钟都会导致大量脑细胞不可逆受损，**请立即拨打 999 送往有急诊卒中能力的医院！**`,
        possibleCauses: [
          '1️⃣ **急性缺血性脑卒中（脑梗死）** — 脑部血管突发堵塞导致半身无力、言语含糊、口角歪斜或视力平衡障碍。',
          '2️⃣ **急性出血性脑卒中（脑出血）** — 脑血管破裂出血，常伴随突发剧烈头痛、呕吐与偏瘫。',
        ],
        advice: [
          '📞 **立即拨打 999 呼叫救护车** — 马上拨打 **999**，明确告知“疑似急性中风”，切勿自行驾车前往以免途中病情加重。',
          '⏱️ **准确记下症状开始的具体时间** — 急诊医生决定能否进行溶栓抢救，最关键的依据就是“最后一次看起来正常的时间”。',
          '🛌 **保持平卧、头肩略微垫高并偏向一侧** — 解开领口扣子，若有呕吐物或口水请及时清理防止误吸。',
          '❌ **严禁给患者喂水、喂食或喂任何药物（包括降压药/阿司匹林）** — 中风患者极易吞咽麻痹导致呛咳窒息，且在未做脑部 CT 区分脑出血/脑梗前乱吃药会加重病情！',
          '❌ **切勿随意摇晃患者或让患者强行站立行走** — 避免跌倒二次受伤或加重脑出血。',
        ],
        followUpQuestions: [
          '🔹 **准确发病时间** — 脸歪、手脚无力或说话含糊是从几点几分突然开始的？',
          '🔹 **意识与吞咽情况** — 患者目前意识清醒吗？之前是否有高血压、房颤或糖尿病史？',
        ],
        seekCareWhen: [
          '🔴 **当前已处于最高危急状态**：请立即拨打 **999** 急救电话，争分夺秒进入医院急诊卒中绿色通道！',
          '🔴 **若患者出现昏迷、剧烈呕吐或呼吸异常**：请确保患者侧卧保持气道通畅，等待救护车到达。',
        ],
        urgency: 'emergency',
        disclaimer: EMERGENCY_DISCLAIMER,
      }

    case 'breathing':
    case 'airway_emergency':
    case 'severe_allergy':
      return {
        summary: `🚨 **紧急医疗警报（严重呼吸困难 / 气道危象）**：${cleanReason}。急性缺氧与气道受阻会在短时间内危及生命，**请立即拨打 999 急救电话或马上前往最近医院急诊室！**`,
        possibleCauses: [
          '1️⃣ **急性气道阻塞 / 严重过敏性休克（喉头水肿）** — 异物卡喉或严重过敏导致气道迅速狭窄闭塞。',
          '2️⃣ **急性重症哮喘发作 / 急性心衰或肺部急症** — 支气管剧烈痉挛或肺部急性换气障碍导致重度缺氧。',
        ],
        advice: [
          '📞 **立即拨打 999 急救电话** — 马上呼叫救护车，说明“严重呼吸困难/喘不过气”。',
          '🪑 **保持前倾坐位或半坐位** — 解开衣领、领带和腰带，让患者双手撑在膝盖或桌面上身体微向前倾，有助呼吸肌发力（切勿强行平躺）。',
          '💨 **立即使用随身急救药** — 若有哮喘急救吸入剂（如 Ventolin/Salbutamol）或严重过敏肾上腺素笔（EpiPen），请立即按医嘱使用。',
          '👐 **若为异物卡喉窒息（说不出话、双手掐脖）** — 身边人员请立即实施**海姆立克急救法（腹部冲击法）**！',
          '❌ **严禁给呼吸极度困难者喂水或喂食** — 极易引发呛咳并彻底堵死气道。',
        ],
        followUpQuestions: [
          '🔹 **诱发原因** — 呼吸困难前是否有吃东西噎住、接触过敏原（海鲜/药物/昆虫叮咬）或哮喘病史？',
          '🔹 **嘴唇与意识状态** — 患者目前嘴唇或指甲有没有发紫？能否说出完整的句子？',
        ],
        seekCareWhen: [
          '🔴 **当前已处于最高危急状态**：请立即拨打 **999** 或点击下方查看最近医院急诊！',
          '🔴 **若患者出现口唇发紫、意识模糊或呼吸停止**：请立即在 999 接线员指导下开展海姆立克急救或心肺复苏（CPR）。',
        ],
        urgency: 'emergency',
        disclaimer: EMERGENCY_DISCLAIMER,
      }

    case 'seizure':
    case 'unconsciousness':
      return {
        summary: `🚨 **紧急医疗警报（急性意识丧失 / 抽搐惊厥发作）**：${cleanReason}。昏迷不醒或持续抽搐属于危急神经系统急症，当前最核心的是**保护气道防止窒息**并**立即拨打 999 送医抢救！**`,
        possibleCauses: [
          '1️⃣ **癫痫持续状态 / 高热惊厥** — 大脑神经元异常放电导致全身抽搐、翻白眼及意识丧失。',
          '2️⃣ **急性脑血管意外 / 严重低血糖 / 休克或心脏骤停** — 导致脑部供血供氧急剧中断而昏迷不醒。',
        ],
        advice: [
          '📞 **立即拨打 999 急救电话** — 马上呼叫救护车，并看一眼手机**记录抽搐或昏迷开始的时间**。',
          '🔄 **立即让患者侧卧（复苏体位）** — 将患者身体和头部转向一侧，让口水、分泌物或呕吐物自然流出，防止堵住气管窒息。',
          '🧣 **清理周围危险物品并解开衣领** — 移开周围桌椅或尖锐硬物，在头下垫软毛巾或衣物保护头部。',
          '❌ **严禁往患者嘴里塞任何东西（毛巾、筷子、手指）** — 抽搐时塞东西不仅防不了咬舌，反而极易顶住舌后坠或折断堵死气道导致窒息！',
          '❌ **严禁强行按压抖动的四肢或喂水喂药** — 强行按压会导致骨折脱臼，未清醒前喂水极易呛入肺部。',
        ],
        followUpQuestions: [
          '🔹 **发作持续时间与呼吸** — 抽搐或昏迷已经持续几分钟了？患者目前胸口还有正常起伏呼吸吗？',
          '🔹 **伴随情况** — 发作前是否有高烧、头部撞击、糖尿病（用胰岛素）或既往癫痫病史？',
        ],
        seekCareWhen: [
          '🔴 **当前已处于最高危急状态**：请立即拨打 **999** 急救电话或送往最近急诊室！',
          '🔴 **若患者停止呼吸或没有脉搏**：请立即让患者平躺在硬地上，在 999 接线员指导下开始胸外按压（CPR）。',
        ],
        urgency: 'emergency',
        disclaimer: EMERGENCY_DISCLAIMER,
      }

    case 'self_harm':
      return {
        summary: `🚨 **紧急安全与生命关怀警报**：我们非常重视并关心你此刻的生命安全！你现在的痛苦不必独自承受，**请立即停下手上可能伤害自己的动作，马上联系身边亲友或拨打 999 / Befrienders 24小时关怀热线（03-7627 2929）寻求帮助！**`,
        possibleCauses: [
          '1️⃣ **急性情绪危机与重度心理压力** — 当痛苦超出负荷时容易产生冲动念头，及时的专业干预与陪伴能帮你安全度过危机。',
        ],
        advice: [
          '📞 **立即拨打紧急求助热线** — 马来西亚紧急救援电话：**999**；Befrienders 24小时免费倾听热线：**03-7627 2929**；Talian Kasih 关怀热线：**15999**。',
          '🤝 **马上走到有人的地方** — 立即离开独处空间，给最信任的家人、伴侣或朋友打个电话，让他们陪在你身边。',
          '🛡️ **若已经服药或造成身体伤口** — 请立刻告诉身边的人或直接拨打 **999** 前往医院急诊室处理伤口/解毒。',
          '❌ **请千万不要独自留在危险物品（药物、利器、高处）旁边** — 先把危险物品放到看不见的地方，给自己一点缓冲时间。',
        ],
        followUpQuestions: [
          '🔹 **当前身体安全确认** — 请问你现在是否已经服用了药物或造成了身体受伤？身边有人可以马上过来陪你吗？',
        ],
        seekCareWhen: [
          '🔴 **如果你已经吞服药物或身体正在流血**：请立即拨打 **999** 或前往最近医院急诊室！',
          '🔴 **如果你感到无法控制伤害自己的冲动**：请现在就拨打 **999** 或 **03-7627 2929**，有人愿意倾听并帮助你。',
        ],
        urgency: 'emergency',
        disclaimer: EMERGENCY_DISCLAIMER,
      }

    default:
      return {
        summary: `🚨 **紧急医疗警报（重度外伤 / 大出血 / 危急情况）**：${cleanReason}。该情况随时可能危及生命，**请立即拨打马来西亚紧急电话 999，或马上前往最近医院急诊科（Emergency）抢救！**`,
        possibleCauses: [
          '1️⃣ **急性失血性休克或重度创伤风险** — 大量出血、严重车祸坠落、大面积烧伤或溺水会导致生命体征迅速恶化。',
          '2️⃣ **重要脏器或气道急性损伤** — 需急诊创伤团队立即介入稳定生命体征。',
        ],
        advice: [
          '📞 **立即拨打 999 急救电话** — 马上呼叫救护车，清晰告知当前准确位置与受伤人数。',
          '🩸 **若为大量出血：立即直接加压止血** — 用干净纱布、毛巾或衣物**直接用力按压出血伤口**，若纱布浸透不要揭开，直接在上面叠加新布继续按压。',
          '🚿 **若为烧烫伤/化学灼伤** — 立即脱离热源，用流动的冷自来水持续冲洗伤处 15~20 分钟（严禁涂抹牙膏、酱油或直接冰敷）。',
          '❌ **若为车祸/高处坠落怀疑脊椎或头部受伤：严禁随意搬动患者** — 随意抱起或扭动极易造成脊髓横断导致永久瘫痪（除非现场有起火爆炸等危险）。',
          '❌ **严禁拔出刺入身体的异物** — 若有刀片、玻璃或钢筋刺入体内，拔出会引发致命大出血，应固定异物等急诊医生手术取出。',
        ],
        followUpQuestions: [
          '🔹 **意识与呼吸确认** — 伤者目前意识清醒吗？呼吸是否正常、出血有没有减缓？',
          '🔹 **现场救援情况** — 是否已经拨打 999？现场有没有其他人可以一起帮忙协助？',
        ],
        seekCareWhen: [
          '🔴 **当前已处于最高危急状态**：请**立即（现在）**拨打 **999** 或点击下方查看最近医院急诊！',
          '🔴 **若伤者出现面色苍白、手脚冰凉、意识模糊或停止呼吸**：请在 999 接线员指导下立即进行急救复苏。',
        ],
        urgency: 'emergency',
        disclaimer: EMERGENCY_DISCLAIMER,
      }
  }
}
