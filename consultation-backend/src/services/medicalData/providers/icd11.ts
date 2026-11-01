import { fetchMedicalResource, MedicalHttpError, stripMarkup } from '../http.js'
import type { MedicalEvidence } from '../medicalDataTypes.js'

let cachedToken: { value: string; expiresAt: number } | undefined

async function getAccessToken(clientId: string, clientSecret: string) {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'icdapi_access',
  })
  const response = await fetchMedicalResource(
    'https://icdaccessmanagement.who.int/connect/token',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  )
  const token = (await response.json()) as {
    access_token?: string
    expires_in?: number
  }
  if (!token.access_token) {
    throw new MedicalHttpError('INVALID_RESPONSE', 'WHO ICD-11 未返回访问令牌。')
  }
  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + Math.max(60, (token.expires_in ?? 3600) - 60) * 1000,
  }
  return token.access_token
}

export async function searchIcd11(query: string): Promise<MedicalEvidence[]> {
  const clientId = process.env.WHO_ICD_CLIENT_ID
  const clientSecret = process.env.WHO_ICD_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new MedicalHttpError(
      'NOT_CONFIGURED',
      'WHO ICD-11 尚未配置客户端凭据。',
    )
  }

  const release = process.env.WHO_ICD_RELEASE ?? '2026-01'
  const token = await getAccessToken(clientId, clientSecret)
  const url = new URL(
    `https://id.who.int/icd/release/11/${encodeURIComponent(release)}/mms/search`,
  )
  url.searchParams.set('q', query)
  url.searchParams.set('useFlexisearch', 'true')
  url.searchParams.set('flatResults', 'true')
  const response = await fetchMedicalResource(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Accept-Language': 'en',
      'API-Version': 'v2',
    },
  })
  const data = (await response.json()) as {
    destinationEntities?: Array<{
      id?: string
      title?: string
      theCode?: string
      score?: number
    }>
  }
  if (!Array.isArray(data.destinationEntities)) {
    throw new MedicalHttpError('INVALID_RESPONSE', 'WHO ICD-11 返回格式无效。')
  }

  return data.destinationEntities.slice(0, 5).flatMap((item) => {
    const title = stripMarkup(item.title ?? '')
    if (!title || !item.id) return []
    return [
      {
        provider: 'icd11' as const,
        title: item.theCode ? `${item.theCode} — ${title}` : title,
        summary: `WHO ICD-11 搜索匹配：${title}${item.theCode ? `；编码：${item.theCode}` : ''}。编码匹配不等于临床诊断。`,
        url: item.id.replace(/^http:/, 'https:'),
        retrievedAt: new Date().toISOString(),
        metadata: {
          code: item.theCode ?? '',
          score: item.score === undefined ? '' : String(item.score),
        },
      },
    ]
  })
}

