import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Icon, type IconName } from '../components/Icon'
import { translations, type Language } from '../i18n'
import type { CareLevel } from '../services/chatService'
import {
  DEFAULT_CENTER,
  distanceMeters,
  fetchNearbyPlaces,
  geoapifyKey,
  geocodeAddress,
  getCurrentPosition,
  type LngLat,
  type LocateFailure,
  type Place,
  type PlaceType,
} from '../services/placesService'
import { directionsUrl, wazeUrl } from './links'
import './map.css'

maplibregl.setWorkerUrl('https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl-worker.mjs')

interface MapPanelProps {
  careLevel: CareLevel
  onChangeCareLevel: (level: CareLevel) => void
  isVisible: boolean
  lang: Language
  onOpenMenu: () => void
  /** 从对话里点“查看附近诊所 / 医院”进来时，对话建议的机构类型 */
  fromChatLevel?: CareLevel | null
}

type MapStatus = 'loading' | 'ready' | 'error'
type Origin = { center: LngLat; kind: 'gps' | 'search'; label?: string }
type PanelState =
  | { kind: 'intro' }
  | { kind: 'locating' }
  | { kind: 'searching' }
  | { kind: 'locate_failed'; reason: LocateFailure }
  | { kind: 'search_not_found' }
  | { kind: 'loading_places' }
  | { kind: 'places_error' }
  | { kind: 'results' }

const TYPE_ICON: Record<PlaceType, IconName> = {
  clinic: 'clinic',
  hospital: 'hospital',
  pharmacy: 'pharmacy',
}

export default function MapPanel({ careLevel, onChangeCareLevel, isVisible, lang, onOpenMenu, fromChatLevel }: MapPanelProps) {
  const t = translations[lang]
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLButtonElement }>>(new Map())
  const originMarkerRef = useRef<maplibregl.Marker | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const requestSeq = useRef(0)

  const [mapStatus, setMapStatus] = useState<MapStatus>('loading')
  const [mapAttempt, setMapAttempt] = useState(0)
  const [panel, setPanel] = useState<PanelState>({ kind: 'intro' })
  const [origin, setOrigin] = useState<Origin>()
  const [places, setPlaces] = useState<Place[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const [query, setQuery] = useState('')
  const [sheetCollapsed, setSheetCollapsed] = useState(false)

  const typeLabel = (type?: PlaceType) =>
    type === 'pharmacy' ? t.typePharmacy : type === 'hospital' ? t.typeHospital : t.typeClinic

  /* ---------- 初始化地图（不请求定位） ---------- */
  useEffect(() => {
    if (!geoapifyKey || !mapEl.current) return
    setMapStatus('loading')
    let loaded = false
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: `https://maps.geoapify.com/v1/styles/osm-carto/style.json?apiKey=${encodeURIComponent(geoapifyKey)}`,
      center: DEFAULT_CENTER,
      zoom: 12,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      loaded = true
      setMapStatus('ready')
    })
    map.on('error', () => {
      if (!loaded) setMapStatus('error')
    })
    const markers = markersRef.current
    return () => {
      markers.forEach(({ marker }) => marker.remove())
      markers.clear()
      originMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [mapAttempt])

  // 从 Chat 切回来时，地图容器尺寸可能变化
  useEffect(() => {
    if (!isVisible) return
    const timer = window.setTimeout(() => mapRef.current?.resize(), 60)
    return () => window.clearTimeout(timer)
  }, [isVisible, sheetCollapsed])

  /* ---------- 选中某家机构：高亮标记、飞过去、列表滚到可见 ---------- */
  const select = useCallback((id: string, fly = true) => {
    setSelectedId(id)
    setSheetCollapsed(false)
    const entry = markersRef.current.get(id)
    if (entry && fly && mapRef.current) {
      mapRef.current.easeTo({ center: entry.marker.getLngLat(), zoom: Math.max(mapRef.current.getZoom(), 14.5), duration: 450 })
    }
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-place-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    })
  }, [])

  useEffect(() => {
    markersRef.current.forEach(({ el }, id) => {
      const on = id === selectedId
      el.classList.toggle('is-selected', on)
      el.setAttribute('aria-pressed', String(on))
      el.style.zIndex = on ? '2' : '1'
    })
  }, [selectedId, places])

  /* ---------- 在地图上画出标记 ---------- */
  function drawMarkers(list: Place[], center: LngLat, kind: Origin['kind']) {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach(({ marker }) => marker.remove())
    markersRef.current.clear()

    originMarkerRef.current?.remove()
    const originEl = document.createElement('div')
    originEl.className = `map-origin ${kind === 'gps' ? 'is-gps' : 'is-search'}`
    originEl.setAttribute('role', 'img')
    originEl.setAttribute('aria-label', kind === 'gps' ? t.yourLocation : t.searchLocation)
    originMarkerRef.current = new maplibregl.Marker({ element: originEl }).setLngLat(center).addTo(map)

    list.forEach((place, index) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `map-marker type-${place.type ?? 'clinic'}`
      const num = document.createElement('span')
      num.textContent = String(index + 1)
      el.append(num)
      el.setAttribute('aria-label', `${index + 1}. ${place.name}`)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        select(place.id, false)
      })
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map)
      markersRef.current.set(place.id, { marker, el })
    })

    if (list.length > 0) {
      const bounds = new maplibregl.LngLatBounds(center, center)
      list.forEach((p) => bounds.extend([p.longitude, p.latitude]))
      map.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 600 })
    } else {
      map.easeTo({ center, zoom: 13.5, duration: 600 })
    }
  }

  /* ---------- 查询附近机构 ---------- */
  async function loadPlaces(next: Origin, level: CareLevel = careLevel) {
    const seq = ++requestSeq.current
    setOrigin(next)
    setSelectedId(undefined)
    setPanel({ kind: 'loading_places' })
    try {
      const list = await fetchNearbyPlaces(next.center, level)
      if (seq !== requestSeq.current) return
      const sorted = [...list].sort(
        (a, b) =>
          distanceMeters(next.center, [a.longitude, a.latitude]) -
          distanceMeters(next.center, [b.longitude, b.latitude]),
      )
      setPlaces(sorted)
      setPanel({ kind: 'results' })
      drawMarkers(sorted, next.center, next.kind)
    } catch {
      if (seq !== requestSeq.current) return
      setPlaces([])
      setPanel({ kind: 'places_error' })
    }
  }

  async function handleLocate() {
    setPanel({ kind: 'locating' })
    try {
      const center = await getCurrentPosition()
      await loadPlaces({ center, kind: 'gps' })
    } catch (reason) {
      setPanel({ kind: 'locate_failed', reason: (reason as LocateFailure) ?? 'unavailable' })
    }
  }

  async function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await searchText(query.trim())
  }

  async function searchText(text: string) {
    if (!text) return
    setPanel({ kind: 'searching' })
    try {
      const result = await geocodeAddress(text)
      if (!result) {
        setPanel({ kind: 'search_not_found' })
        return
      }
      await loadPlaces({ center: result.center, kind: 'search', label: result.label })
    } catch {
      setPanel({ kind: 'places_error' })
    }
  }

  // 用户以前已经允许过定位：直接显示附近机构，不会弹出询问；没允许过就等用户点击
  useEffect(() => {
    let cancelled = false
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        if (!cancelled && status.state === 'granted') void handleLocate()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // 只在第一次打开地图时检查一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 从 Chat 带着新的机构类型过来，或在页面上切换类型：已有位置就直接重新查询
  const lastLevel = useRef(careLevel)
  useEffect(() => {
    if (lastLevel.current === careLevel) return
    lastLevel.current = careLevel
    if (origin) void loadPlaces(origin, careLevel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careLevel])

  const selected = places.find((p) => p.id === selectedId)
  const busy = panel.kind === 'locating' || panel.kind === 'searching' || panel.kind === 'loading_places'
  const title = careLevel === 'clinic' ? t.mapTitleClinics : t.mapTitleHospitals

  function distanceText(p: Place) {
    if (!origin) return t.noData
    const m = distanceMeters(origin.center, [p.longitude, p.latitude])
    return origin.kind === 'gps' ? t.distanceFromYou(m) : t.distanceFromSearch(m)
  }

  function renderPanelState() {
    switch (panel.kind) {
      case 'intro':
        return (
          <div className="map-state">
            <span className="map-state-icon"><Icon name="pin" size={22} /></span>
            <h2>{t.mapIntroTitle}</h2>
            <p>{t.mapIntroBody}</p>
          </div>
        )
      case 'locating':
      case 'searching':
      case 'loading_places':
        return (
          <div className="map-state" role="status">
            <span className="spinner" aria-hidden="true" />
            <p>{panel.kind === 'locating' ? t.locating : panel.kind === 'searching' ? t.searching : t.loadingPlaces}</p>
          </div>
        )
      case 'locate_failed':
        return (
          <div className="map-state is-warning" role="alert">
            <span className="map-state-icon"><Icon name="alert" size={22} /></span>
            <h2>{panel.reason === 'denied' ? t.errPermissionTitle : t.errPositionTitle}</h2>
            <p>
              {panel.reason === 'denied'
                ? t.errPermissionBody
                : panel.reason === 'unsupported'
                  ? t.errUnsupported
                  : t.errPositionBody}
            </p>
          </div>
        )
      case 'search_not_found':
        return (
          <div className="map-state is-warning" role="alert">
            <span className="map-state-icon"><Icon name="search" size={22} /></span>
            <p>{t.searchNoResult}</p>
          </div>
        )
      case 'places_error':
        return (
          <div className="map-state is-warning" role="alert">
            <span className="map-state-icon"><Icon name="wifiOff" size={22} /></span>
            <h2>{t.errPlacesTitle}</h2>
            <p>{t.errPlaces}</p>
            {origin && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadPlaces(origin)}>
                <Icon name="refresh" size={15} />
                {t.retryBtn}
              </button>
            )}
          </div>
        )
      case 'results':
        if (places.length === 0) {
          return (
            <div className="map-state">
              <span className="map-state-icon"><Icon name="search" size={22} /></span>
              <h2>{t.noResultsTitle}</h2>
              <p>{t.noResultsBody}</p>
            </div>
          )
        }
        return null
    }
  }

  if (!geoapifyKey) {
    return (
      <section className="map-view">
        <div className="map-state is-warning">
          <h2>{t.mapNotConfiguredTitle}</h2>
          <p>{t.mapNotConfiguredDesc}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="map-view" aria-label={title}>
      <header className="map-toolbar">
        <button type="button" className="icon-btn ws-menu-btn" onClick={onOpenMenu} aria-label={t.openMenu}>
          <Icon name="menu" size={22} />
        </button>
        <h1 className="map-title">{title}</h1>
        <div className="segmented" role="group" aria-label={t.careToggleLabel}>
          <button type="button" aria-pressed={careLevel === 'clinic'} onClick={() => onChangeCareLevel('clinic')}>
            {t.careClinic}
          </button>
          <button type="button" aria-pressed={careLevel === 'hospital'} onClick={() => onChangeCareLevel('hospital')}>
            {t.careHospital}
          </button>
        </div>
      </header>

      <div className={`map-layout ${sheetCollapsed ? 'is-sheet-collapsed' : ''}`}>
        <aside className="map-panel" aria-label={title}>
          <button
            type="button"
            className="map-sheet-handle"
            onClick={() => setSheetCollapsed((v) => !v)}
            aria-expanded={!sheetCollapsed}
            aria-label={sheetCollapsed ? t.showResults : t.hideResults}
          >
            <span aria-hidden="true" />
          </button>

          {fromChatLevel && (
            <p className="map-from-chat" role="status">
              <Icon name="chat" size={16} />
              <span>{fromChatLevel === 'clinic' ? t.fromChatClinic : t.fromChatHospital}</span>
            </p>
          )}

          <div className="map-controls">
            <form className="map-search" onSubmit={handleSearch} role="search">
              <Icon name="search" size={18} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchAria}
                enterKeyHint="search"
              />
              <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !query.trim()}>
                {t.searchBtn}
              </button>
            </form>
            <button type="button" className="btn btn-primary map-locate" onClick={() => void handleLocate()} disabled={busy}>
              <Icon name="locate" size={18} />
              {panel.kind === 'locating' ? t.locating : t.locateBtn}
            </button>
          </div>

          {!(panel.kind === 'results' && places.length > 0) && (
            <div className="map-areas" role="group" aria-label={t.quickAreasTitle}>
              <span className="map-areas-title">{t.quickAreasTitle}</span>
              <div className="map-areas-list">
                {t.quickAreas.map((area) => (
                  <button
                    key={area.label}
                    type="button"
                    className="map-area"
                    disabled={busy}
                    onClick={() => {
                      setQuery(area.label)
                      void searchText(area.query)
                    }}
                  >
                    {area.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {panel.kind === 'results' && places.length > 0 && (
            <div className="map-summary">
              <span>{t.resultsCount(places.length)}</span>
              <span>{t.radiusNote}</span>
            </div>
          )}

          <div className="map-panel-body">
            {renderPanelState()}
            {panel.kind === 'results' && places.length > 0 && (
              <ul className="place-list" ref={listRef}>
                {places.map((p, i) => {
                  const isSel = p.id === selectedId
                  return (
                    <li key={p.id} data-place-id={p.id}>
                      <article className={`place-card ${isSel ? 'is-selected' : ''}`}>
                        <button
                          type="button"
                          className="place-card-main"
                          aria-pressed={isSel}
                          onClick={() => select(p.id)}
                        >
                          <span className={`place-index type-${p.type ?? 'clinic'}`}>{i + 1}</span>
                          <span className="place-text">
                            <span className="place-name">{p.name}</span>
                            <span className="place-meta">
                              <span className="place-type">
                                <Icon name={TYPE_ICON[p.type ?? 'clinic']} size={14} />
                                {typeLabel(p.type)}
                              </span>
                              <span>{distanceText(p)}</span>
                            </span>
                            <span className="place-address">{p.address || t.noData}</span>
                          </span>
                        </button>
                        <div className="place-actions">
                          {p.phone ? (
                            <a className="place-action" href={`tel:${p.phone}`}>
                              <Icon name="phone" size={15} />
                              {t.callBtn}
                            </a>
                          ) : (
                            <span className="place-action is-muted">
                              <Icon name="phone" size={15} />
                              {t.noData}
                            </span>
                          )}
                          <a className="place-action" href={directionsUrl(p)} target="_blank" rel="noopener noreferrer">
                            <Icon name="navigate" size={15} />
                            {t.navigateBtn}
                          </a>
                          <a className="place-action" href={wazeUrl(p)} target="_blank" rel="noopener noreferrer">
                            <Icon name="navigate" size={15} />
                            {t.navigateWaze}
                          </a>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        <div className="map-canvas">
          <div ref={mapEl} className="map-gl" />
          {mapStatus === 'loading' && (
            <div className="map-overlay" role="status">
              <span className="spinner" aria-hidden="true" />
              <span>{t.loadingMap}</span>
            </div>
          )}
          {mapStatus === 'ready' && !origin && (
            <div className="map-hint" aria-hidden="true">
              <Icon name="pin" size={20} />
              <span>{t.mapHint}</span>
            </div>
          )}
          {mapStatus === 'error' && (
            <div className="map-overlay is-error" role="alert">
              <Icon name="wifiOff" size={24} />
              <strong>{t.errMapTitle}</strong>
              <span>{t.errMapBody}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMapAttempt((n) => n + 1)}>
                <Icon name="refresh" size={15} />
                {t.retryMap}
              </button>
            </div>
          )}

          {selected && (
            <div className="place-detail" role="dialog" aria-label={selected.name}>
              <div className="place-detail-head">
                <span className={`place-detail-type type-${selected.type ?? 'clinic'}`}>
                  <Icon name={TYPE_ICON[selected.type ?? 'clinic']} size={16} />
                  {typeLabel(selected.type)}
                </span>
                <button type="button" className="icon-btn" onClick={() => setSelectedId(undefined)} aria-label={t.closeDetail}>
                  <Icon name="close" size={18} />
                </button>
              </div>
              <h2>{selected.name}</h2>
              <dl>
                <div><dt><Icon name="pin" size={15} /><span className="sr-only">{t.addressLabel}</span></dt><dd>{selected.address || t.noData}</dd></div>
                <div><dt><Icon name="navigate" size={15} /><span className="sr-only">{lang === 'zh' ? '距离' : 'Distance'}</span></dt><dd>{distanceText(selected)}</dd></div>
                <div><dt><Icon name="phone" size={15} /><span className="sr-only">{t.phoneLabel}</span></dt><dd>{selected.phone ?? t.noData}</dd></div>
                <div><dt><Icon name="clock" size={15} /><span className="sr-only">{t.hoursLabel}</span></dt><dd>{t.hoursLabel}{lang === 'zh' ? '：' : ': '}{t.noData}</dd></div>
              </dl>
              <div className="place-detail-actions">
                {selected.phone && (
                  <a className="btn btn-primary btn-sm" href={`tel:${selected.phone}`}>
                    <Icon name="phone" size={15} />
                    {t.callBtn}
                  </a>
                )}
                <a className="btn btn-secondary btn-sm" href={directionsUrl(selected)} target="_blank" rel="noopener noreferrer">
                  <Icon name="navigate" size={15} />
                  {t.navigateBtn}
                </a>
                <a className="btn btn-secondary btn-sm" href={wazeUrl(selected)} target="_blank" rel="noopener noreferrer">
                  <Icon name="navigate" size={15} />
                  {t.navigateWaze}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
