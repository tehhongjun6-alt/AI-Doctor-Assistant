import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { translations, type Language } from './i18n'

maplibregl.setWorkerUrl(
  'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl-worker.mjs',
)

interface Hospital {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  phone: string | null
  mapUri: string | null
}

interface MapPanelProps {
  onBackToChat?: () => void
  isVisible?: boolean
  lang: Language
  onChangeLang: (lang: Language) => void
  onOpenMobileMenu: () => void
  isMobileMenuOpen?: boolean
}

type MapStatus = 'loading' | 'ready' | 'error'

function getCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is unavailable'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    })
  })
}

function getErrorMessage(error: unknown, lang: Language) {
  const t = translations[lang]
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 1
  ) {
    return t.errorPermission
  }

  if (error instanceof Error && error.message.startsWith('API:')) {
    return error.message.slice(4)
  }

  return t.errorMapDefault
}

export default function MapPanel({
  onBackToChat,
  isVisible,
  lang,
  onChangeLang,
  onOpenMobileMenu,
  isMobileMenuOpen,
}: MapPanelProps) {
  const t = translations[lang]
  const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
  const mapElement = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<maplibregl.Map | null>(null)
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const [status, setStatus] = useState<MapStatus>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // 当面板从隐藏变为可见时，触发地图重绘自适应尺寸
  useEffect(() => {
    if (isVisible && mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.resize()
      }, 60)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  async function loadHospitals(map: maplibregl.Map, center: [number, number]) {
    const response = await fetch(`${apiBaseUrl}/api/hospitals/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: center[1],
        longitude: center[0],
        radius: 5000,
      }),
    })
    const data = (await response.json()) as {
      hospitals?: Hospital[]
      error?: string
    }

    if (!response.ok) {
      throw new Error(`API:${data.error ?? t.errorMapDefault}`)
    }

    const nearbyHospitals = data.hospitals ?? []
    setHospitals(nearbyHospitals)

    // 清除既有标记
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current.clear()

    // 重新添加医院红色标记
    nearbyHospitals.forEach((hospital) => {
      const marker = new maplibregl.Marker({ color: '#dc2626' })
        .setLngLat([hospital.longitude, hospital.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 12 }).setHTML(
            `<div style="font-weight:700;font-size:13px;color:#1e293b;">${hospital.name}</div><div style="font-size:11px;color:#64748b;margin-top:2px;">${hospital.address}</div>`,
          ),
        )
        .addTo(map)
      markersRef.current.set(hospital.id, marker)
    })
  }

  useEffect(() => {
    if (!apiKey) {
      return
    }

    let cancelled = false

    async function initializeMap() {
      try {
        const position = await getCurrentPosition()
        if (cancelled || !mapElement.current) return

        const center: [number, number] = [
          position.coords.longitude,
          position.coords.latitude,
        ]

        const map = new maplibregl.Map({
          container: mapElement.current,
          style: `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${encodeURIComponent(apiKey)}`,
          center,
          zoom: 13.5,
        })
        mapInstanceRef.current = map

        map.addControl(new maplibregl.NavigationControl(), 'top-right')

        // 用户当前位置标记
        const userMarker = new maplibregl.Marker({ color: '#2563eb' })
          .setLngLat(center)
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setText(t.yourLocation),
          )
          .addTo(map)
        userMarkerRef.current = userMarker

        await loadHospitals(map, center)

        if (!cancelled) {
          setStatus('ready')
        }
      } catch (error) {
        if (cancelled) return
        setErrorMessage(getErrorMessage(error, lang))
        setStatus('error')
      }
    }

    void initializeMap()

    return () => {
      cancelled = true
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
      userMarkerRef.current = null
      markersRef.current.clear()
    }
  }, [apiBaseUrl, apiKey])

  // 手动点击刷新按钮时才触发重新定位和拉取
  async function handleManualRefresh() {
    if (!mapInstanceRef.current || isRefreshing) return
    setIsRefreshing(true)
    try {
      const position = await getCurrentPosition()
      const center: [number, number] = [
        position.coords.longitude,
        position.coords.latitude,
      ]

      mapInstanceRef.current.flyTo({ center, zoom: 13.5 })

      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat(center)
      }

      await loadHospitals(mapInstanceRef.current, center)
      setStatus('ready')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, lang))
    } finally {
      setIsRefreshing(false)
    }
  }

  function handleHospitalClick(hospital: Hospital) {
    setSelectedHospitalId(hospital.id)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: [hospital.longitude, hospital.latitude],
        zoom: 15,
        essential: true,
      })
      const marker = markersRef.current.get(hospital.id)
      if (marker && !marker.getPopup().isOpen()) {
        marker.togglePopup()
      }
    }
  }

  if (!apiKey) {
    return (
      <section className="modern-map-panel map-state" aria-label="Map not configured">
        <div className="map-empty-box">
          <h2>{t.mapNotConfiguredTitle}</h2>
          <p>{t.mapNotConfiguredDesc}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="modern-map-panel" aria-label={t.mapMainTitle}>
      {/* 现代统一顶栏 */}
      <header className="map-view-header">
        <div className="map-header-left">
          {onBackToChat && (
            <button
              type="button"
              className="back-btn-pill"
              onClick={onBackToChat}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                width="16"
                height="16"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                />
              </svg>
              <span>{t.backToChat}</span>
            </button>
          )}
          <div className="map-header-title-wrap">
            <h1 className="map-main-title">{t.mapMainTitle}</h1>
            <span className="map-status-chip">
              <span className="chip-dot"></span>
              {t.mapStatusChip}
            </span>
          </div>
        </div>
        <div className="map-header-right">
          <div className="map-header-badge">
            {t.foundHospitalsPrefix}
            <strong>{hospitals.length}</strong>
            {t.foundHospitalsSuffix}
          </div>
          <button
            type="button"
            className="map-refresh-btn"
            onClick={() => void handleManualRefresh()}
            disabled={isRefreshing || status === 'loading'}
            title={t.refreshTitle}
          >
            <svg
              className={isRefreshing ? 'spin-icon' : ''}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              width="14"
              height="14"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            <span>{isRefreshing ? t.refreshing : t.refresh}</span>
          </button>

          <div
            className="lang-switch-pill"
            role="group"
            aria-label="Language switch"
          >
            <button
              type="button"
              className={`lang-btn ${lang === 'zh' ? 'active' : ''}`}
              onClick={() => onChangeLang('zh')}
            >
              中文
            </button>
            <button
              type="button"
              className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => onChangeLang('en')}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            className={`mobile-plus-btn ${isMobileMenuOpen ? 'open' : ''}`}
            onClick={onOpenMobileMenu}
            aria-label={t.mobileMenuTitle}
            title={t.mobileMenuTitle}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              width="20"
              height="20"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* 左右分栏（桌面） / 上下分栏（手机）：地图 + 医院卡片流 */}
      <div className="map-body-grid">
        <div className="map-viewport-frame">
          <div
            ref={mapElement}
            className="map-gl-canvas"
            aria-label={t.mapMainTitle}
          />
          {status === 'loading' && (
            <div className="map-status-overlay" role="status">
              <div className="loading-spinner"></div>
              <span>{t.loadingMap}</span>
            </div>
          )}
          {status === 'error' && (
            <div className="map-status-overlay error-state" role="alert">
              <span>⚠️ {errorMessage}</span>
            </div>
          )}
        </div>

        <aside className="hospital-card-stream" aria-label={t.recommendListTitle}>
          <div className="stream-header-bar">
            <span>{t.recommendListTitle}</span>
            <span className="stream-count-tag">
              {hospitals.length}
              {t.countSuffix}
            </span>
          </div>

          <div className="stream-scroll-list">
            {status === 'ready' && hospitals.length === 0 && (
              <div className="no-hospital-card">
                <p>{t.noHospitalFound}</p>
              </div>
            )}

            {hospitals.map((hospital, index) => {
              const isSelected = hospital.id === selectedHospitalId

              return (
                <article
                  className={`hospital-card-item ${isSelected ? 'selected' : ''}`}
                  key={hospital.id}
                  onClick={() => handleHospitalClick(hospital)}
                >
                  <div className="hospital-card-top">
                    <span className="hospital-index-badge">{index + 1}</span>
                    <h2 className="hospital-item-name" title={hospital.name}>
                      {hospital.name}
                    </h2>
                  </div>

                  <p className="hospital-item-address">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="13"
                      height="13"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>{hospital.address}</span>
                  </p>

                  <div className="hospital-action-bar">
                    {hospital.phone ? (
                      <a
                        href={`tel:${hospital.phone}`}
                        className="action-pill phone-pill"
                        onClick={(e) => e.stopPropagation()}
                        title={t.callTitle}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          width="13"
                          height="13"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        <span>{hospital.phone}</span>
                      </a>
                    ) : (
                      <span className="action-pill no-phone-pill">
                        {t.noPhone}
                      </span>
                    )}

                    {hospital.mapUri && (
                      <a
                        href={hospital.mapUri}
                        target="_blank"
                        rel="noreferrer"
                        className="action-pill nav-pill"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>{t.navigateBtn}</span>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          width="12"
                          height="12"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
                          />
                        </svg>
                      </a>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </aside>
      </div>
    </section>
  )
}
