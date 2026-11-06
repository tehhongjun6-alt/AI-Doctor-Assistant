// 就诊摘要服务：向后端请求结构化摘要（不写进数据库，随需生成）
import { authFetch } from '../auth'
import type { Language } from '../i18n'

export interface CaseSummary {
  chiefComplaint: string // 主要问题
  symptoms: string[] // 症状
  duration: string // 持续多久
  medications: string[] // 用过的药
  allergies: string[] // 过敏
  relevantHistory: string[] // 相关病史
  aiAssessment: string[] // AI 曾给出的可能方向
  redFlags: string[] // 需要注意的危险信号
  questionsForDoctor: string[] // 可以问医生的问题
}

export interface VisitSummaryResponse {
  ok: boolean
  summary?: CaseSummary
  generatedAt?: string
  error?: {
    code?: string
    message?: string
  }
}

export async function requestVisitSummary(
  conversationId: string,
  language: Language
): Promise<VisitSummaryResponse> {
  try {
    const res = await authFetch(`/api/conversations/${conversationId}/visit-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ language }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok || !data?.success) {
      return {
        ok: false,
        error: {
          code: data?.error?.code ?? `HTTP_${res.status}`,
          message: data?.error?.message ?? '生成就诊摘要失败',
        },
      }
    }

    return {
      ok: true,
      summary: data.data?.summary,
      generatedAt: data.data?.generatedAt,
    }
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : '网络连接失败',
      },
    }
  }
}
