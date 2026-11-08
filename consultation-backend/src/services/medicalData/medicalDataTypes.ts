import type { MedicalDataRouteResult } from '../../routing/medicalDataTypes.js'

export type MedicalDataProvider =
  | 'cpg'
  | 'medlineplus'
  | 'openfda'
  | 'rxnorm'
  | 'kkmnow'
  | 'nhs'
  | 'icd11'

export interface MedicalEvidence {
  provider: MedicalDataProvider
  title: string
  summary: string
  url: string
  retrievedAt: string
  metadata?: Record<string, string>
}

export type MedicalDataStatus =
  | 'success'
  | 'insufficient_evidence'
  | 'not_configured'
  | 'unavailable'

export interface MedicalProviderIssue {
  provider: MedicalDataProvider
  code: 'NOT_CONFIGURED' | 'TIMEOUT' | 'API_ERROR' | 'INVALID_RESPONSE'
  message: string
}

export interface MedicalDataResult {
  status: MedicalDataStatus
  evidence: MedicalEvidence[]
  issues: MedicalProviderIssue[]
  searchQuery: string
  searchQueries?: string[]
}

export interface MedicalDataRequest {
  message: string
  route: MedicalDataRouteResult
  cachedEvidence?: MedicalEvidence[]
}

