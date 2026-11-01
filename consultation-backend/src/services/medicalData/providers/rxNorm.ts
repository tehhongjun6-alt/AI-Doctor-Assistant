import { fetchMedicalResource, MedicalHttpError } from '../http.js'
import type { MedicalEvidence } from '../medicalDataTypes.js'

export async function searchRxNorm(query: string): Promise<MedicalEvidence[]> {
  const url = new URL('https://rxnav.nlm.nih.gov/REST/rxcui.json')
  url.searchParams.set('name', query)
  url.searchParams.set('search', '2')

  const response = await fetchMedicalResource(url.toString())
  const data = (await response.json()) as {
    idGroup?: { name?: string; rxnormId?: string[] }
  }

  if (!data.idGroup) {
    throw new MedicalHttpError('INVALID_RESPONSE', 'RxNorm 返回格式无效。')
  }

  const ids = data.idGroup.rxnormId ?? []
  if (ids.length === 0) {
    return []
  }

  const normalizedName = data.idGroup.name || query
  return [
    {
      provider: 'rxnorm',
      title: `RxNorm：${normalizedName}`,
      summary: `RxNorm 找到的标准药物标识为 ${ids.slice(0, 5).join('、')}。这只用于确认药名和标准标识，不代表剂量或用药建议。`,
      url: `https://mor.nlm.nih.gov/RxNav/search?searchBy=String&searchTerm=${encodeURIComponent(normalizedName)}`,
      retrievedAt: new Date().toISOString(),
      metadata: { rxcui: ids.slice(0, 5).join(',') },
    },
  ]
}

