import { XMLParser } from 'fast-xml-parser'
import { fetchMedicalResource, MedicalHttpError, stripMarkup } from '../http.js'
import type { MedicalEvidence } from '../medicalDataTypes.js'

interface XmlContent {
  '@_name'?: string
  [key: string]: unknown
}

interface XmlDocument {
  '@_url'?: string
  content?: XmlContent | XmlContent[]
}

function asArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value]
}

function extractText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(extractText).join(' ')
  }
  if (typeof value !== 'object' || value === null) {
    return ''
  }
  return Object.entries(value)
    .filter(([key]) => !key.startsWith('@_'))
    .map(([, child]) => extractText(child))
    .join(' ')
}

async function queryMedlinePlusOnce(term: string): Promise<MedicalEvidence[]> {
  const url = new URL('https://wsearch.nlm.nih.gov/ws/query')
  url.searchParams.set('db', 'healthTopics')
  url.searchParams.set('term', term)
  url.searchParams.set('retmax', '3')
  url.searchParams.set('rettype', 'brief')
  url.searchParams.set('tool', process.env.MEDLINEPLUS_TOOL ?? 'consultation-assistant')
  if (process.env.MEDLINEPLUS_EMAIL) {
    url.searchParams.set('email', process.env.MEDLINEPLUS_EMAIL)
  }

  const response = await fetchMedicalResource(url.toString())
  const xml = await response.text()
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml) as {
    nlmSearchResult?: { list?: { document?: XmlDocument | XmlDocument[] } }
  }

  if (!parsed.nlmSearchResult) {
    throw new MedicalHttpError(
      'INVALID_RESPONSE',
      'MedlinePlus 返回格式无效。',
    )
  }

  const retrievedAt = new Date().toISOString()
  return asArray(parsed.nlmSearchResult.list?.document).flatMap((document) => {
    const fields = new Map(
      asArray(document.content).map((content) => [
        content['@_name'] ?? '',
        extractText(content),
      ]),
    )
    const title = stripMarkup(fields.get('title') ?? '')
    const summary = stripMarkup(
      fields.get('FullSummary') ?? fields.get('snippet') ?? '',
    )
    const sourceUrl = document['@_url']

    if (!title || !summary || !sourceUrl) {
      return []
    }

    return [
      {
        provider: 'medlineplus' as const,
        title,
        summary: summary.slice(0, 1800),
        url: sourceUrl,
        retrievedAt,
        metadata: {
          organization: stripMarkup(fields.get('organizationName') ?? ''),
        },
      },
    ]
  })
}

const stopWords = new Set(['and', 'or', 'with', 'in', 'of', 'for', 'the', 'pain', 'acute', 'chronic'])

export async function searchMedlinePlus(
  query: string,
): Promise<MedicalEvidence[]> {
  const primaryResults = await queryMedlinePlusOnce(query)
  if (primaryResults.length > 0) {
    return primaryResults
  }

  const words = query
    .split(/[\s,;|/]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 3 && !stopWords.has(w))

  if (words.length > 1) {
    return queryMedlinePlusOnce(words[0])
  }

  return []
}

