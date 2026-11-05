import type {
  MedicalDataCategory,
  MedicalDataRouteResult,
} from './medicalDataTypes.js'

/**
 * 规则兜底分流：当 Gemini 路由未配置、超时或全部模型失败时使用。
 * 目标是“宁可多查资料，也不要把症状问诊当成闲聊”——
 * 之前的兜底一律返回 direct_model，会导致症状咨询被清空成一句寒暄。
 */

const GREETING_PATTERN =
  /^(你好|您好|嗨|哈喽|hi|hello|hey|谢谢|多谢|感谢|thanks?|thank you|好的|好|ok|okay|嗯|拜拜|再见|bye|没事了?|不用了?|你是谁|你能做什么|你是真人吗|who are you)[\s!！。.,，~?？]*$/i

// 第一人称 / 亲友 + 正在发生的不适
const PERSONAL_PATTERN =
  /(我|我的|本人|孩子|小孩|宝宝|儿子|女儿|老公|老婆|妈|爸|家人|朋友|\bi\b|\bmy\b|\bi'm\b|\bim\b|\bme\b|\bmy (son|daughter|child|wife|husband|mom|dad)\b)/i

const SYMPTOM_TERMS: Array<[RegExp, string]> = [
  [/发烧|发热|高烧|低烧|fever/i, 'fever'],
  [/头痛|头疼|偏头痛|headache|migraine/i, 'headache'],
  [/喉咙痛|嗓子痛|咽痛|喉咙疼|sore throat/i, 'sore throat'],
  [/咳嗽|咳痰|cough/i, 'cough'],
  [/流鼻涕|鼻塞|runny nose|stuffy nose|congestion/i, 'nasal congestion'],
  [/肚子痛|胃痛|腹痛|胃疼|肚子疼|stomach ?ache|abdominal pain/i, 'abdominal pain'],
  [/拉肚子|腹泻|diarrh?oea|diarrhea/i, 'diarrhea'],
  [/便秘|constipation/i, 'constipation'],
  [/呕吐|想吐|恶心|vomit|nausea/i, 'nausea'],
  [/头晕|眩晕|dizz/i, 'dizziness'],
  [/皮疹|起疹|红疹|湿疹|痒|rash|itch|eczema/i, 'rash'],
  [/背痛|腰痛|腰疼|back pain/i, 'back pain'],
  [/关节痛|膝盖痛|膝盖疼|关节肿|joint pain|knee pain/i, 'joint pain'],
  [/失眠|睡不着|insomnia/i, 'insomnia'],
  [/疲劳|乏力|没力气|累|fatigue|tired/i, 'fatigue'],
  [/胸闷|心慌|心悸|palpitation/i, 'palpitations'],
  [/牙痛|牙疼|toothache/i, 'toothache'],
  [/耳朵痛|耳痛|ear ?ache/i, 'ear pain'],
  [/眼睛痛|眼睛红|红眼|eye pain|red eye/i, 'eye pain'],
  [/尿频|尿痛|小便痛|urinary|painful urination/i, 'urinary symptoms'],
  [/过敏|allerg/i, 'allergy'],
  [/扭伤|拉伤|sprain|strain/i, 'sprain'],
  [/烫伤|烧伤|burn/i, 'burn'],
  [/划伤|割伤|伤口|cut|wound/i, 'wound'],
]

const DISEASE_TERMS: Array<[RegExp, string]> = [
  [/骨痛热症|登革热|dengue/i, 'dengue'],
  [/新冠|covid/i, 'covid-19'],
  [/流感|influenza|\bflu\b/i, 'influenza'],
  [/感冒|common cold/i, 'common cold'],
  [/糖尿病|diabetes/i, 'diabetes'],
  [/高血压|hypertension|high blood pressure/i, 'hypertension'],
  [/哮喘|asthma/i, 'asthma'],
  [/胃炎|gastritis/i, 'gastritis'],
  [/痛风|gout/i, 'gout'],
]

const MEDICATION_TERMS: Array<[RegExp, string]> = [
  [/panadol|扑热息痛|对乙酰氨基酚|paracetamol|acetaminophen/i, 'paracetamol'],
  [/布洛芬|ibuprofen|nurofen/i, 'ibuprofen'],
  [/阿莫西林|amoxicillin/i, 'amoxicillin'],
  [/阿司匹林|aspirin/i, 'aspirin'],
  [/抗生素|antibiotic/i, 'antibiotics'],
  [/抗组胺|氯雷他定|loratadine|cetirizine|antihistamine/i, 'antihistamine'],
  [/二甲双胍|metformin/i, 'metformin'],
  [/奥美拉唑|omeprazole/i, 'omeprazole'],
]

const KNOWLEDGE_PATTERN =
  /(什么是|是什么|怎么传染|如何预防|怎样预防|有什么症状|有什么副作用|副作用|区别|能不能吃|可以吃|怎么治|会不会|吗[?？]?$|what is|what are|how (do|does|to)|side effects?|difference between|can i take|is it safe)/i

const PRESENT_DISCOMFORT_PATTERN =
  /(痛|疼|不舒服|难受|发作|肿|出血|一直|好几天|两天|三天|几天|天了|小时|hurts?|pain|sick|feel|since|for \d+ ?(days?|hours?))/i

// 可能涉及急症/高风险的描述：规则不做最终判断，必须交给模型细看
const RISK_PATTERN =
  /(吞|一整盒|一整瓶|过量|很多颗|几十颗|中毒|喝了.*(清洁剂|农药|漂白)|喘不|呼吸困难|胸口|胸痛|晕倒|昏迷|叫不醒|抽搐|翻白眼|大量出血|止不住|呕血|吐血|黑便|自杀|自残|不想活|轻生|半边|口齿不清|嘴角歪|脖子僵|喷射|怀孕|孕妇|阴道出血|婴儿|新生儿|overdose|poison|can't breathe|chest pain|faint|seizure|suicid|bleeding|pregnan|infant)/i

export type RouteConfidence = 'high' | 'low'

export interface HeuristicRouteResult extends MedicalDataRouteResult {
  /** high：规则足够确定，可直接采用；low：建议交给模型判断 */
  confidence: RouteConfidence
}

function collectTerms(text: string, table: Array<[RegExp, string]>) {
  return table.filter(([pattern]) => pattern.test(text)).map(([, term]) => term)
}

export function heuristicRoute(
  message: string,
  context: { activeCategory?: MedicalDataCategory } = {},
): HeuristicRouteResult {
  const text = message.trim()

  if (!text || GREETING_PATTERN.test(text)) {
    return {
      route: 'direct_model',
      category: 'greeting',
      reason: '规则判断：寒暄或助手相关问题。',
      confidence: 'high',
    }
  }

  const isRisky = RISK_PATTERN.test(text)

  const symptoms = collectTerms(text, SYMPTOM_TERMS)
  const diseases = collectTerms(text, DISEASE_TERMS)
  const medications = collectTerms(text, MEDICATION_TERMS)
  const queries = Array.from(new Set([...symptoms, ...diseases, ...medications])).slice(0, 4)

  const isPersonal = PERSONAL_PATTERN.test(text)
  const isKnowledgeQuestion = KNOWLEDGE_PATTERN.test(text)
  const describesDiscomfort = PRESENT_DISCOMFORT_PATTERN.test(text)

  if (queries.length === 0) {
    // 没识别出医学词条：如果正处于问诊话题中，视为对追问的补充回答
    if (context.activeCategory && context.activeCategory !== 'greeting' && context.activeCategory !== 'unknown') {
      return {
        route: 'medical_api',
        category: context.activeCategory,
        reason: '规则兜底：延续当前问诊话题。',
        searchQuery: text,
        searchQueries: [text],
        confidence: 'low',
      }
    }
    return {
      route: 'direct_model',
      category: 'unknown',
      reason: '规则兜底：未识别到医学相关内容。',
      confidence: 'low',
    }
  }

  const category: MedicalDataCategory =
    symptoms.length > 0
      ? 'symptom'
      : medications.length > 0
        ? 'medication'
        : 'disease'

  const isSymptomConsult =
    symptoms.length > 0 && (isPersonal || describesDiscomfort || !isKnowledgeQuestion)

  // 只有“明确的症状描述”或“明确的知识提问”才算高把握；含糊或高风险交给模型
  const isClearSymptom =
    symptoms.length > 0 && (isPersonal || describesDiscomfort) && !isKnowledgeQuestion
  const isClearQuestion = isKnowledgeQuestion && !isPersonal && !describesDiscomfort
  const confidence: RouteConfidence =
    !isRisky && (isClearSymptom || isClearQuestion) ? 'high' : 'low'

  return {
    confidence,
    route: isSymptomConsult ? 'medical_api' : 'medical_qa',
    category,
    reason: isSymptomConsult
      ? '规则判断：识别为症状问诊。'
      : '规则判断：识别为医学知识提问。',
    searchQuery: queries.join(', '),
    searchQueries: queries,
  }
}
