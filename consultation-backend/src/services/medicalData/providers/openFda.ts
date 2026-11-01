import { fetchMedicalResource, stripMarkup } from '../http.js'
import type { MedicalEvidence } from '../medicalDataTypes.js'

interface OpenFdaLabelResult {
  openfda?: {
    brand_name?: string[]
    generic_name?: string[]
    substance_name?: string[]
    manufacturer_name?: string[]
  }
  purpose?: string[]
  indications_and_usage?: string[]
  warnings?: string[]
  boxed_warning?: string[]
  warnings_and_cautions?: string[]
  do_not_use?: string[]
  contraindications?: string[]
  drug_interactions?: string[]
  adverse_reactions?: string[]
  stop_use?: string[]
}

const DRUG_SYNONYMS: Record<string, string> = {
  paracetamol: 'acetaminophen',
  panadol: 'acetaminophen',
  uphamol: 'acetaminophen',
  salbutamol: 'albuterol',
  ventolin: 'albuterol',
  adrenaline: 'epinephrine',
  frusemide: 'furosemide',
  lignocaine: 'lidocaine',
}

function normalizeDrugTerm(raw: string): string {
  const cleaned = raw.trim().toLowerCase()
  for (const [alias, fdaTerm] of Object.entries(DRUG_SYNONYMS)) {
    if (cleaned === alias || cleaned.includes(alias)) {
      return fdaTerm
    }
  }
  return cleaned
}

function pickFirstSnippet(fields: (string[] | undefined)[], maxLen = 360): string {
  for (const field of fields) {
    if (Array.isArray(field) && field.length > 0 && typeof field[0] === 'string') {
      const text = stripMarkup(field[0]).trim()
      if (text.length > 0) {
        return text.slice(0, maxLen)
      }
    }
  }
  return ''
}

async function fetchOpenFdaLabels(searchParam: string): Promise<OpenFdaLabelResult[]> {
  const url = `https://api.fda.gov/drug/label.json?search=${searchParam}&limit=2`
  try {
    const response = await fetchMedicalResource(url)
    const data = (await response.json()) as { results?: OpenFdaLabelResult[] }
    return Array.isArray(data.results) ? data.results : []
  } catch {
    // OpenFDA returns HTTP 404 when no matching drug label is found
    return []
  }
}

export async function searchOpenFda(query: string): Promise<MedicalEvidence[]> {
  const term = normalizeDrugTerm(query)
  if (!term || term.length < 2) {
    return []
  }

  const encodedTerm = encodeURIComponent(`"${term}"`)
  let results = await fetchOpenFdaLabels(
    `openfda.generic_name:${encodedTerm}+openfda.substance_name:${encodedTerm}+openfda.brand_name:${encodedTerm}`,
  )

  if (results.length === 0) {
    results = await fetchOpenFdaLabels(encodeURIComponent(term))
  }

  if (results.length === 0) {
    return []
  }

  const retrievedAt = new Date().toISOString()

  return results.slice(0, 2).flatMap((item) => {
    const genericName = item.openfda?.generic_name?.[0] ?? item.openfda?.substance_name?.[0] ?? ''
    const brandName = item.openfda?.brand_name?.[0] ?? ''
    const displayTitle =
      genericName && brandName && genericName.toLowerCase() !== brandName.toLowerCase()
        ? `FDA 药品说明书：${genericName} (${brandName})`
        : `FDA 药品说明书：${genericName || brandName || query}`

    const indications = pickFirstSnippet([item.indications_and_usage, item.purpose], 350)
    const contraindications = pickFirstSnippet([item.contraindications, item.do_not_use], 350)
    const warnings = pickFirstSnippet(
      [item.boxed_warning, item.warnings, item.warnings_and_cautions, item.stop_use],
      400,
    )
    const interactions = pickFirstSnippet([item.drug_interactions], 320)
    const adverse = pickFirstSnippet([item.adverse_reactions], 320)

    const sections = [
      indications ? `【适应症与用途】${indications}` : '',
      contraindications ? `【禁忌症/禁用情况】${contraindications}` : '',
      warnings ? `【重要警告与注意事项】${warnings}` : '',
      interactions ? `【药物相互作用】${interactions}` : '',
      adverse ? `【常见不良反应】${adverse}` : '',
    ].filter(Boolean)

    if (sections.length === 0) {
      return []
    }

    return [
      {
        provider: 'openfda' as const,
        title: displayTitle,
        summary: sections.join(' ； ').slice(0, 1800),
        url: `https://labels.fda.gov/`,
        retrievedAt,
      },
    ]
  })
}
