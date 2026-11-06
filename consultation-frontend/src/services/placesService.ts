// 附近机构服务：机构数据来自后端 /api/hospitals/nearby；
// 地址转坐标使用 Geoapify 公开前端 Key（与地图底图同一个 Key，不是服务端密钥）
import { authFetch } from '../auth'
import type { CareLevel } from './chatService'

export type PlaceType = 'hospital' | 'clinic' | 'pharmacy'

export interface Place {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  phone: string | null
  mapUri: string | null
  type?: PlaceType
}

export type LngLat = [number, number]

export const DEFAULT_CENTER: LngLat = [101.6869, 3.139] // 吉隆坡市中心，仅用于初始地图视野
export const SEARCH_RADIUS_METERS = 5000

// 沿用原代码的后备 Key（浏览器端公开 Key），避免线上未配置环境变量时地图失效
export const geoapifyKey: string =
  import.meta.env.VITE_GEOAPIFY_API_KEY || 'f5e42a9173fd49248e434af33e178bca'

export class PlacesError extends Error {}

export async function fetchNearbyPlaces(center: LngLat, careLevel: CareLevel): Promise<Place[]> {
  const response = await authFetch('/api/hospitals/nearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: center[1],
      longitude: center[0],
      radius: SEARCH_RADIUS_METERS,
      careLevel,
    }),
  })
  const data = (await response.json().catch(() => ({}))) as {
    hospitals?: Place[]
    error?: string
  }
  if (!response.ok) throw new PlacesError(data.error ?? '')
  return data.hospitals ?? []
}

export interface GeocodeResult {
  center: LngLat
  label: string
}

/** 把用户输入的地区或地址转成坐标，优先马来西亚境内 */
export async function geocodeAddress(text: string): Promise<GeocodeResult | null> {
  if (!geoapifyKey) throw new PlacesError('missing key')
  const url = new URL('https://api.geoapify.com/v1/geocode/search')
  url.searchParams.set('text', text)
  url.searchParams.set('filter', 'countrycode:my')
  url.searchParams.set('limit', '1')
  url.searchParams.set('format', 'json')
  url.searchParams.set('apiKey', geoapifyKey)
  const res = await fetch(url)
  if (!res.ok) throw new PlacesError('geocode failed')
  const data = (await res.json()) as {
    results?: { lon: number; lat: number; formatted?: string }[]
  }
  const first = data.results?.[0]
  if (!first) return null
  return { center: [first.lon, first.lat], label: first.formatted ?? text }
}

export type LocateFailure = 'denied' | 'unavailable' | 'unsupported'

export function getCurrentPosition(): Promise<LngLat> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject('unsupported' satisfies LocateFailure)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      (err) => reject((err.code === 1 ? 'denied' : 'unavailable') satisfies LocateFailure),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  })
}

/** 两点间直线距离（米），由坐标实际计算，不是估算值 */
export function distanceMeters(a: LngLat, b: LngLat) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
