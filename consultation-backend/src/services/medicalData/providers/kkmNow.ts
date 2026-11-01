import { parse } from 'csv-parse/sync'
import { fetchMedicalResource, MedicalHttpError } from '../http.js'
import type { MedicalEvidence } from '../medicalDataTypes.js'

interface PharmaceuticalProduct {
  reg_no?: string
  product?: string
  status?: string
  holder?: string
  manufacturer?: string
  active_ingredient?: string
  generic_name?: string
  date_end?: string
}

const DATA_URL =
  'https://storage.data.gov.my/healthcare/pharmaceutical_products.csv'
const CACHE_MS = 24 * 60 * 60 * 1000
let cachedProducts: PharmaceuticalProduct[] | undefined
let cacheExpiresAt = 0

async function loadProducts() {
  if (cachedProducts && Date.now() < cacheExpiresAt) {
    return cachedProducts
  }

  const response = await fetchMedicalResource(DATA_URL)
  const csv = await response.text()
  const products = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as PharmaceuticalProduct[]

  if (!Array.isArray(products)) {
    throw new MedicalHttpError('INVALID_RESPONSE', 'KKMNOW 返回格式无效。')
  }

  cachedProducts = products
  cacheExpiresAt = Date.now() + CACHE_MS
  return products
}

export async function searchKkmNow(query: string): Promise<MedicalEvidence[]> {
  const terms = query
    .toLocaleLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)

  if (terms.length === 0) {
    return []
  }

  const products = await loadProducts()
  const buildHaystack = (product: PharmaceuticalProduct) =>
    [
      product.reg_no,
      product.product,
      product.active_ingredient,
      product.generic_name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()

  let matches = products
    .filter((product) => {
      const haystack = buildHaystack(product)
      return terms.every((term) => haystack.includes(term))
    })
    .slice(0, 5)

  if (matches.length === 0 && terms.length > 1) {
    matches = products
      .filter((product) => {
        const haystack = buildHaystack(product)
        return terms.some((term) => term.length >= 4 && haystack.includes(term))
      })
      .slice(0, 5)
  }
  const retrievedAt = new Date().toISOString()

  return matches.map((product) => ({
    provider: 'kkmnow',
    title: product.product || product.generic_name || '马来西亚注册药品',
    summary: [
      product.reg_no ? `注册编号：${product.reg_no}` : '',
      product.status ? `状态：${product.status}` : '',
      product.active_ingredient
        ? `活性成分：${product.active_ingredient}`
        : '',
      product.holder ? `持有人：${product.holder}` : '',
      product.manufacturer ? `制造商：${product.manufacturer}` : '',
    ]
      .filter(Boolean)
      .join('；'),
    url: 'https://data.gov.my/data-catalogue/pharmaceutical_products',
    retrievedAt,
    metadata: {
      registrationNumber: product.reg_no ?? '',
      registrationStatus: product.status ?? '',
      registrationEndDate: product.date_end ?? '',
    },
  }))
}

