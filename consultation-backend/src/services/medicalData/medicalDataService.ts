import type { MedicalDataCategory } from '../../routing/medicalDataTypes.js'
import { MedicalHttpError } from './http.js'
import type {
  MedicalDataProvider,
  MedicalDataRequest,
  MedicalDataResult,
  MedicalEvidence,
  MedicalProviderIssue,
} from './medicalDataTypes.js'
import { searchIcd11 } from './providers/icd11.js'
import { searchKkmNow } from './providers/kkmNow.js'
import { searchMedlinePlus } from './providers/medlinePlus.js'
import { searchMohCpg } from './providers/mohCpg.js'
import { searchNhs } from './providers/nhs.js'
import { searchOpenFda } from './providers/openFda.js'
import { searchRxNorm } from './providers/rxNorm.js'

type ProviderSearch = (query: string) => Promise<MedicalEvidence[]>

const providerSearches: Record<MedicalDataProvider, ProviderSearch> = {
  cpg: searchMohCpg,
  medlineplus: searchMedlinePlus,
  openfda: searchOpenFda,
  rxnorm: searchRxNorm,
  kkmnow: searchKkmNow,
  nhs: searchNhs,
  icd11: searchIcd11,
}

function providersFor(category: MedicalDataCategory, message: string) {
  if ((category as string) === 'icd' || /icd|编码|code/i.test(message)) {
    return ['cpg', 'icd11', 'medlineplus'] satisfies MedicalDataProvider[]
  }
  if (category === 'medication') {
    return ['cpg', 'openfda', 'medlineplus', 'rxnorm', 'kkmnow'] satisfies MedicalDataProvider[]
  }
  return ['cpg', 'medlineplus', 'icd11', 'nhs'] satisfies MedicalDataProvider[]
}

function toIssue(
  provider: MedicalDataProvider,
  error: unknown,
): MedicalProviderIssue {
  if (error instanceof MedicalHttpError) {
    return { provider, code: error.code, message: error.message }
  }
  return {
    provider,
    code: 'API_ERROR',
    message: '医学资料服务发生未知错误。',
  }
}

const MAX_PER_PROVIDER = 4

function mergeEvidence(
  fresh: MedicalEvidence[],
  cached: MedicalEvidence[] = [],
): MedicalEvidence[] {
  const seenKeys = new Set<string>()
  const providerCounts = new Map<MedicalDataProvider, number>()
  const merged: MedicalEvidence[] = []
  for (const item of [...fresh, ...cached]) {
    const key = `${item.provider}:${item.title}:${item.url}`
    const currentCount = providerCounts.get(item.provider) ?? 0
    if (!seenKeys.has(key) && currentCount < MAX_PER_PROVIDER) {
      seenKeys.add(key)
      providerCounts.set(item.provider, currentCount + 1)
      merged.push(item)
    }
  }
  return merged.slice(0, 10)
}

export async function retrieveMedicalData(
  input: MedicalDataRequest,
): Promise<MedicalDataResult> {
  const cachedEvidence = input.cachedEvidence ?? []
  const rawQueries =
    input.route.searchQueries && input.route.searchQueries.length > 0
      ? input.route.searchQueries
      : input.route.searchQuery
        ? [input.route.searchQuery]
        : [input.message]

  const searchQueries = Array.from(
    new Set(rawQueries.map((q) => q.trim()).filter((q) => q.length > 0)),
  ).slice(0, 4)

  const searchQueryDisplay = searchQueries.join(', ')

  const providers = providersFor(
    input.route.category,
    `${input.message} ${searchQueryDisplay}`,
  )

  const tasks = providers.flatMap((provider) =>
    searchQueries.map((query) => ({
      provider,
      query,
      promise: providerSearches[provider](query),
    })),
  )

  const settled = await Promise.allSettled(tasks.map((t) => t.promise))
  const evidence: MedicalEvidence[] = []
  const issueMap = new Map<MedicalDataProvider, MedicalProviderIssue>()
  const providerSuccess = new Set<MedicalDataProvider>()

  settled.forEach((result, index) => {
    const { provider } = tasks[index]
    if (result.status === 'fulfilled') {
      providerSuccess.add(provider)
      evidence.push(...result.value)
    } else if (!issueMap.has(provider)) {
      issueMap.set(provider, toIssue(provider, result.reason))
    }
  })

  const issues = Array.from(issueMap.values()).filter(
    (issue) => !providerSuccess.has(issue.provider),
  )

  const combinedEvidence =
    evidence.length > 0
      ? mergeEvidence(evidence, [])
      : mergeEvidence([], cachedEvidence)
  if (combinedEvidence.length > 0) {
    return {
      status: 'success',
      evidence: combinedEvidence,
      issues,
      searchQuery: searchQueryDisplay,
      searchQueries,
    }
  }

  const everyProviderUnconfigured =
    issues.length === providers.length &&
    issues.every((issue) => issue.code === 'NOT_CONFIGURED')
  const everyProviderFailed = issues.length === providers.length

  return {
    status: everyProviderUnconfigured
      ? 'not_configured'
      : everyProviderFailed
        ? 'unavailable'
        : 'insufficient_evidence',
    evidence: [],
    issues,
    searchQuery: searchQueryDisplay,
    searchQueries,
  }
}

