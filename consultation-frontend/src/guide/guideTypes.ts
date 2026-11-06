import type { Language } from '../i18n'

export type GuideCategory = 'infection' | 'chronic' | 'everyday' | 'emergency'
export type Localized<T> = Record<Language, T> // zh、en、ms 三种语言都必须有

export interface GuideSource {
  name: string
  url: string
}

export interface GuideTopic {
  id: string
  category: GuideCategory
  title: Localized<string> // 病名
  summary: Localized<string> // 这是什么：中文 60 字以内
  symptoms: Localized<string[]> // 常见症状：3～5 条
  care: Localized<string[]> // 怎么处理和预防：3～5 条
  seeDoctor: Localized<string[]> // 什么时候要立刻看医生：2～4 条
  askPrompt: Localized<string> // 「问 Medora」时填进输入框的问题
  sources: GuideSource[] // 至少 1 个
  reviewedAt: string // 最后审核日期，格式 'YYYY-MM-DD'
}
