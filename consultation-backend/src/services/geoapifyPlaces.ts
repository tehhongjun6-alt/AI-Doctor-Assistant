export type CareLevel = 'hospital' | 'clinic'
export type PlaceType = 'hospital' | 'clinic' | 'pharmacy'

export interface NearbySearchInput {
  latitude: number
  longitude: number
  radius: number
  careLevel?: CareLevel
}

export interface Hospital {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  phone: string | null
  mapUri: string | null
  type?: PlaceType
}

interface GeoapifyFeature {
  properties?: {
    place_id?: string
    name?: string
    formatted?: string
    lat?: number
    lon?: number
    categories?: string[]
    contact?: {
      phone?: string
    }
  }
}

interface GeoapifyPlacesResponse {
  features?: GeoapifyFeature[]
}

export class MapServiceError extends Error {
  constructor(
    public readonly code: 'NOT_CONFIGURED' | 'REQUEST_FAILED',
    message: string,
  ) {
    super(message)
  }
}

function resolvePlaceType(categories: string[] = []): PlaceType {
  if (categories.includes('healthcare.hospital')) return 'hospital'
  if (categories.includes('healthcare.pharmacy')) return 'pharmacy'
  return 'clinic'
}

function defaultPlaceName(type: PlaceType): string {
  switch (type) {
    case 'hospital':
      return '医院'
    case 'pharmacy':
      return '药房'
    case 'clinic':
      return '诊所'
  }
}

export async function searchGeoapifyHospitals(
  input: NearbySearchInput,
): Promise<Hospital[]> {
  const apiKey = process.env.GEOAPIFY_API_KEY

  if (!apiKey) {
    throw new MapServiceError('NOT_CONFIGURED', 'GEOAPIFY_API_KEY is missing')
  }

  const careLevel = input.careLevel ?? 'hospital'
  const categories =
    careLevel === 'clinic'
      ? 'healthcare.clinic_or_praxis,healthcare.pharmacy'
      : 'healthcare.hospital'

  const parameters = new URLSearchParams({
    categories,
    filter: `circle:${input.longitude},${input.latitude},${input.radius}`,
    bias: `proximity:${input.longitude},${input.latitude}`,
    limit: '10',
    lang: 'zh',
    apiKey,
  })
  const response = await fetch(
    `https://api.geoapify.com/v2/places?${parameters.toString()}`,
  )

  if (!response.ok) {
    throw new MapServiceError(
      'REQUEST_FAILED',
      `Geoapify Places returned ${response.status}`,
    )
  }

  const data = (await response.json()) as GeoapifyPlacesResponse

  return (data.features ?? []).flatMap((feature) => {
    const properties = feature.properties
    const latitude = properties?.lat
    const longitude = properties?.lon

    if (
      !properties?.place_id ||
      typeof latitude !== 'number' ||
      typeof longitude !== 'number'
    ) {
      return []
    }

    const type = resolvePlaceType(properties.categories)
    const name = properties.name?.trim() || defaultPlaceName(type)

    return [
      {
        id: properties.place_id,
        name,
        address: properties.formatted ?? '暂无地址',
        latitude,
        longitude,
        phone: properties.contact?.phone ?? null,
        mapUri: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`,
        type,
      },
    ]
  })
}
