import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MedicalHttpError } from '../src/services/medicalData/http.js'
import { retrieveMedicalData } from '../src/services/medicalData/medicalDataService.js'
import {
  clearMohCpgEmbeddingCache,
  CPG_EMBEDDING_DIM,
  CPG_MATCH_COUNT,
  createMohCpgSearcher,
  type CpgChunkRow,
} from '../src/services/medicalData/providers/mohCpg.js'
import * as medlinePlusModule from '../src/services/medicalData/providers/medlinePlus.js'
import * as icd11Module from '../src/services/medicalData/providers/icd11.js'
import * as nhsModule from '../src/services/medicalData/providers/nhs.js'

vi.mock('../src/services/medicalData/providers/medlinePlus.js', () => ({
  searchMedlinePlus: vi.fn(),
}))
vi.mock('../src/services/medicalData/providers/icd11.js', () => ({
  searchIcd11: vi.fn(),
}))
vi.mock('../src/services/medicalData/providers/nhs.js', () => ({
  searchNhs: vi.fn(),
}))

describe('MOH CPG provider (Vector RAG Step 5)', () => {
  const fakeVector = Array.from({ length: CPG_EMBEDDING_DIM }, (_, i) =>
    i === 0 ? 1 : 0,
  )

  const sampleRow: CpgChunkRow = {
    id: 17,
    doc_id: 'dengue',
    title: 'MANAGEMENT OF DENGUE IN ADULTS (FOURTH EDITION)',
    edition_year: 2026,
    source_url: 'https://mymahtas2.moh.gov.my/files/CPG_Dengue_4th_Edition.pdf',
    chunk_index: 10,
    page_start: 31,
    page_end: 33,
    section: '4.2 Clinical Course of Dengue Infection',
    content:
      'Warning signs in critical phase include intense abdominal pain or tenderness, persistent vomiting (>three times per day), lethargy, restlessness, mucosal bleeding, and rising HCT with rapidly falling platelet count.',
    score: 0.03252,
  }

  beforeEach(() => {
    clearMohCpgEmbeddingCache()
    vi.clearAllMocks()
  })

  it('throws NOT_CONFIGURED when CPG_RAG_ENABLED is false or DATABASE_URL is missing, while other providers still work', async () => {
    const prevEnabled = process.env.CPG_RAG_ENABLED
    process.env.CPG_RAG_ENABLED = 'false'

    try {
      const searcherDisabled = createMohCpgSearcher({
        enabled: false,
        databaseUrl: 'postgresql://localhost:5432/test',
        apiKey: 'fake-key',
      })
      await expect(searcherDisabled('dengue warning signs')).rejects.toMatchObject({
        name: 'MedicalHttpError',
        code: 'NOT_CONFIGURED',
      })

      const searcherNoDb = createMohCpgSearcher({
        enabled: true,
        databaseUrl: '',
        apiKey: 'fake-key',
      })
      await expect(searcherNoDb('dengue warning signs')).rejects.toMatchObject({
        name: 'MedicalHttpError',
        code: 'NOT_CONFIGURED',
      })

      vi.mocked(medlinePlusModule.searchMedlinePlus).mockResolvedValue([
        {
          provider: 'medlineplus',
          title: 'Dengue - MedlinePlus',
          summary: 'Dengue fever information from MedlinePlus.',
          url: 'https://medlineplus.gov/dengue.html',
          retrievedAt: '2026-11-08T00:00:00.000Z',
        },
      ])
      vi.mocked(icd11Module.searchIcd11).mockRejectedValue(
        new MedicalHttpError('NOT_CONFIGURED', 'ICD-11 not configured'),
      )
      vi.mocked(nhsModule.searchNhs).mockRejectedValue(
        new MedicalHttpError('NOT_CONFIGURED', 'NHS not configured'),
      )

      const result = await retrieveMedicalData({
        message: '骨痛热症有什么危险信号？',
        route: {
          route: 'medical_qa',
          category: 'disease',
          reason: 'test',
          searchQuery: 'dengue warning signs',
          searchQueries: ['dengue warning signs'],
        },
      })

      expect(result.status).toBe('success')
      expect(result.evidence).toHaveLength(1)
      expect(result.evidence[0].provider).toBe('medlineplus')
      expect(result.issues.find((i) => i.provider === 'cpg')?.code).toBe(
        'NOT_CONFIGURED',
      )
    } finally {
      if (prevEnabled === undefined) {
        delete process.env.CPG_RAG_ENABLED
      } else {
        process.env.CPG_RAG_ENABLED = prevEnabled
      }
    }
  })

  it('formats evidence with provider="cpg", MOH CPG title with page range, and URL with #page=<page_start>', async () => {
    const embedQuery = vi.fn().mockResolvedValue(fakeVector)
    const queryDb = vi.fn().mockResolvedValue([sampleRow])

    const searcher = createMohCpgSearcher({
      enabled: true,
      databaseUrl: 'postgresql://localhost:5432/test',
      embedQuery,
      queryDb,
    })

    const evidence = await searcher('dengue warning signs')
    expect(evidence).toHaveLength(1)
    expect(evidence[0].provider).toBe('cpg')
    expect(evidence[0].title).toBe(
      'MOH CPG: MANAGEMENT OF DENGUE IN ADULTS (FOURTH EDITION)（p. 31-33）',
    )
    expect(evidence[0].url).toBe(
      'https://mymahtas2.moh.gov.my/files/CPG_Dengue_4th_Edition.pdf#page=31',
    )
    expect(evidence[0].summary).toContain('Warning signs in critical phase')
    expect(evidence[0].summary.length).toBeLessThanOrEqual(801)
    expect(queryDb).toHaveBeenCalledTimes(1)
    expect(queryDb.mock.calls[0][1]).toBe('dengue warning signs')
    expect(queryDb.mock.calls[0][2]).toBe(CPG_MATCH_COUNT)
  })

  it('reports an issue when database query fails, while other providers still return their results', async () => {
    const embedQuery = vi.fn().mockResolvedValue(fakeVector)
    const failingQueryDb = vi
      .fn()
      .mockRejectedValue(new Error('connection terminated unexpectedly'))

    const searcher = createMohCpgSearcher({
      enabled: true,
      databaseUrl: 'postgresql://localhost:5432/test',
      embedQuery,
      queryDb: failingQueryDb,
    })

    await expect(searcher('dengue warning signs')).rejects.toMatchObject({
      name: 'MedicalHttpError',
      code: 'API_ERROR',
    })

    // Seed the embedding cache so default searchMohCpg skips Gemini and hits the DB pool
    await createMohCpgSearcher({
      enabled: true,
      databaseUrl: 'postgresql://localhost:5432/test',
      embedQuery,
      queryDb: vi.fn().mockResolvedValue([]),
    })('dengue fever')

    const prevEnabled = process.env.CPG_RAG_ENABLED
    const prevDb = process.env.DATABASE_URL
    const prevKey = process.env.GEMINI_API_KEY
    process.env.CPG_RAG_ENABLED = 'true'
    process.env.DATABASE_URL = 'postgresql://127.0.0.1:1/nonexistent?connect_timeout=1'
    process.env.GEMINI_API_KEY = 'fake-test-key'

    try {
      vi.mocked(medlinePlusModule.searchMedlinePlus).mockResolvedValue([
        {
          provider: 'medlineplus',
          title: 'Dengue - MedlinePlus',
          summary: 'Dengue fever summary',
          url: 'https://medlineplus.gov/dengue.html',
          retrievedAt: '2026-11-08T00:00:00.000Z',
        },
      ])
      vi.mocked(icd11Module.searchIcd11).mockResolvedValue([])
      vi.mocked(nhsModule.searchNhs).mockResolvedValue([])

      const result = await retrieveMedicalData({
        message: '骨痛热症有什么症状？',
        route: {
          route: 'medical_qa',
          category: 'disease',
          reason: 'test',
          searchQuery: 'dengue fever',
          searchQueries: ['dengue fever'],
        },
      })

      expect(result.status).toBe('success')
      expect(result.evidence).toHaveLength(1)
      expect(result.evidence[0].provider).toBe('medlineplus')
      expect(result.issues.find((i) => i.provider === 'cpg')?.code).toBe(
        'API_ERROR',
      )
    } finally {
      process.env.CPG_RAG_ENABLED = prevEnabled
      process.env.DATABASE_URL = prevDb
      process.env.GEMINI_API_KEY = prevKey
    }
  })

  it('caches query embeddings in memory so the same query does not call embedding a second time', async () => {
    const embedQuery = vi.fn().mockResolvedValue(fakeVector)
    const queryDb = vi.fn().mockResolvedValue([sampleRow])

    const searcher = createMohCpgSearcher({
      enabled: true,
      databaseUrl: 'postgresql://localhost:5432/test',
      embedQuery,
      queryDb,
    })

    const first = await searcher('Dengue Warning Signs')
    const second = await searcher('  dengue warning signs  ')

    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
    expect(embedQuery).toHaveBeenCalledTimes(1)
    expect(queryDb).toHaveBeenCalledTimes(2)
  })
})
