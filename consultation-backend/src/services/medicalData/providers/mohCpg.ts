import { GoogleGenAI } from '@google/genai'
import type pg from 'pg'
import { getSharedPgPool } from '../../conversationRepository.js'
import { getMedicalApiTimeout, MedicalHttpError } from '../http.js'
import type { MedicalEvidence } from '../medicalDataTypes.js'

export const CPG_EMBEDDING_MODEL = 'gemini-embedding-001'
export const CPG_EMBEDDING_DIM = 768
export const CPG_MATCH_COUNT = 3
const MAX_SUMMARY_CHARS = 800
const MAX_CACHE_ENTRIES = 200

export interface CpgChunkRow {
  id: number
  doc_id: string
  title: string
  edition_year: number
  source_url: string
  chunk_index: number
  page_start: number
  page_end: number
  section: string
  content: string
  score: number
}

export type EmbedQueryFn = (query: string) => Promise<number[]>
export type QueryDbFn = (
  vectorLiteral: string,
  queryText: string,
  matchCount: number,
) => Promise<CpgChunkRow[]>

export interface MohCpgSearchOptions {
  enabled?: boolean
  databaseUrl?: string
  apiKey?: string
  matchCount?: number
  embedQuery?: EmbedQueryFn
  queryDb?: QueryDbFn
  pool?: Pick<pg.Pool, 'query'>
}

const queryEmbeddingCache = new Map<string, number[]>()

export function clearMohCpgEmbeddingCache() {
  queryEmbeddingCache.clear()
}

export function normalizeL2(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((acc, v) => acc + v * v, 0))
  if (norm <= 0) {
    return values.map((v) => Number(v))
  }
  return values.map((v) => Number(v) / norm)
}

export function formatPgVector(values: number[]): string {
  return `[${values.map((v) => Number(v).toFixed(8)).join(',')}]`
}

function isCpgEnabled(explicit?: boolean): boolean {
  if (typeof explicit === 'boolean') {
    return explicit
  }
  return process.env.CPG_RAG_ENABLED?.trim().toLowerCase() === 'true'
}

function formatPageRange(pageStart: number, pageEnd: number): string {
  return pageStart === pageEnd ? `${pageStart}` : `${pageStart}-${pageEnd}`
}

function truncateSummary(content: string, maxChars = MAX_SUMMARY_CHARS): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxChars) {
    return normalized
  }
  return `${normalized.slice(0, maxChars).trimEnd()}…`
}

let defaultGenAiClient: GoogleGenAI | undefined
let defaultGenAiKey: string | undefined

async function defaultEmbedQuery(
  query: string,
  apiKey: string,
): Promise<number[]> {
  if (!defaultGenAiClient || defaultGenAiKey !== apiKey) {
    defaultGenAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: getMedicalApiTimeout() },
    })
    defaultGenAiKey = apiKey
  }

  const response = await defaultGenAiClient.models.embedContent({
    model: CPG_EMBEDDING_MODEL,
    contents: query,
    config: {
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: CPG_EMBEDDING_DIM,
    },
  })

  const values = response.embeddings?.[0]?.values
  if (!values || values.length !== CPG_EMBEDDING_DIM) {
    throw new MedicalHttpError(
      'INVALID_RESPONSE',
      'MOH CPG 查询向量维度异常。',
    )
  }

  return normalizeL2(Array.from(values))
}

export function createMohCpgSearcher(options: MohCpgSearchOptions = {}) {
  return async function searchMohCpgWithOptions(
    query: string,
  ): Promise<MedicalEvidence[]> {
    const enabled = isCpgEnabled(options.enabled)
    const databaseUrl = (options.databaseUrl ?? process.env.DATABASE_URL ?? '').trim()
    const apiKey = (options.apiKey ?? process.env.GEMINI_API_KEY ?? '').trim()

    if (!enabled || !databaseUrl || (!options.embedQuery && !apiKey)) {
      throw new MedicalHttpError(
        'NOT_CONFIGURED',
        'MOH CPG 向量检索尚未启用或尚未配置 CPG_RAG_ENABLED、DATABASE_URL、GEMINI_API_KEY。',
      )
    }

    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      return []
    }

    const cacheKey = trimmedQuery.toLowerCase()
    let vector = queryEmbeddingCache.get(cacheKey)

    try {
      if (!vector) {
        const embedFn: EmbedQueryFn =
          options.embedQuery ?? ((q) => defaultEmbedQuery(q, apiKey))
        vector = await embedFn(trimmedQuery)
        if (queryEmbeddingCache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = queryEmbeddingCache.keys().next().value
          if (oldestKey !== undefined) {
            queryEmbeddingCache.delete(oldestKey)
          }
        }
        queryEmbeddingCache.set(cacheKey, vector)
      }

      const vectorLiteral = formatPgVector(vector)
      const matchCount = options.matchCount ?? CPG_MATCH_COUNT

      const rows: CpgChunkRow[] = options.queryDb
        ? await options.queryDb(vectorLiteral, trimmedQuery, matchCount)
        : (
            await (options.pool ?? getSharedPgPool(databaseUrl)).query<CpgChunkRow>(
              `select
                 id,
                 doc_id,
                 title,
                 edition_year,
                 source_url,
                 chunk_index,
                 page_start,
                 page_end,
                 section,
                 content,
                 score
               from public.match_cpg_chunks($1::vector(768), $2, $3)`,
              [vectorLiteral, trimmedQuery, matchCount],
            )
          ).rows

      const retrievedAt = new Date().toISOString()
      return rows.map((row) => {
        const pageLabel = formatPageRange(
          Number(row.page_start),
          Number(row.page_end),
        )
        const sectionPrefix = row.section ? `[${row.section}] ` : ''
        return {
          provider: 'cpg' as const,
          title: `MOH CPG: ${row.title}（p. ${pageLabel}）`,
          summary: truncateSummary(`${sectionPrefix}${row.content}`),
          url: `${row.source_url}#page=${row.page_start}`,
          retrievedAt,
          metadata: {
            docId: String(row.doc_id),
            editionYear: String(row.edition_year),
            pageStart: String(row.page_start),
            pageEnd: String(row.page_end),
            section: String(row.section ?? ''),
            score: Number(row.score).toFixed(6),
          },
        }
      })
    } catch (error) {
      if (error instanceof MedicalHttpError) {
        throw error
      }
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new MedicalHttpError('TIMEOUT', 'MOH CPG 向量检索请求超时。', {
          cause: error,
        })
      }
      throw new MedicalHttpError('API_ERROR', 'MOH CPG 向量数据库检索失败。', {
        cause: error,
      })
    }
  }
}

const defaultMohCpgSearcher = createMohCpgSearcher()

export async function searchMohCpg(query: string): Promise<MedicalEvidence[]> {
  return defaultMohCpgSearcher(query)
}
