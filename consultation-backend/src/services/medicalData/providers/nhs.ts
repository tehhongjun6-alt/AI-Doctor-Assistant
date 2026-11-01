import { fetchMedicalResource, MedicalHttpError, stripMarkup } from '../http.js'
import type { MedicalEvidence } from '../medicalDataTypes.js'

function toNhsSlug(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export async function searchNhs(query: string): Promise<MedicalEvidence[]> {
  const endpoint =
    process.env.NHS_CONTENT_API_SEARCH_URL?.replace(/\/$/, '') ||
    'https://api.service.nhs.uk/nhs-website-content'
  const apiKey = process.env.NHS_API_KEY
  if (!endpoint || !apiKey) {
    throw new MedicalHttpError(
      'NOT_CONFIGURED',
      'NHS Content API 尚未配置 NHS_CONTENT_API_SEARCH_URL 和 NHS_API_KEY。',
    )
  }

  const slug = toNhsSlug(query)
  if (!slug) return []

  const candidatePaths = [`/conditions/${slug}/`, `/medicines/${slug}/`]
  const retrievedAt = new Date().toISOString()

  for (const path of candidatePaths) {
    try {
      const response = await fetchMedicalResource(`${endpoint}${path}`, {
        headers: { apikey: apiKey, Accept: 'application/json' },
      })
      const data = (await response.json()) as Record<string, unknown>
      const title = String(data.name ?? data.title ?? '').trim()
      const summary = stripMarkup(
        String(data.description ?? data.summary ?? ''),
      ).trim()
      const rawUrl = String(data.url ?? '').trim()
      const publicUrl = rawUrl
        ? rawUrl.replace(
            /^https?:\/\/[^/]+\/nhs-website-content/,
            'https://www.nhs.uk',
          )
        : `https://www.nhs.uk${path}`

      if (title && summary) {
        return [
          {
            provider: 'nhs' as const,
            title: `NHS：${title}`,
            summary: summary.slice(0, 1800),
            url: publicUrl,
            retrievedAt,
          },
        ]
      }
    } catch {
      // Try next candidate path
    }
  }

  return []
}
