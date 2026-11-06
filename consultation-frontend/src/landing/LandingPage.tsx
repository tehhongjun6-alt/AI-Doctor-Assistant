import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { LangToggle } from '../components/LangToggle'
import { Logo } from '../components/Logo'
import type { Language } from '../i18n'
import { landingCopy } from './landingCopy'
import './landing.css'

type Copy = (typeof landingCopy)[Language]

interface LandingPageProps {
  lang: Language
  onChangeLang: (lang: Language) => void
  onSignIn: () => void
  onStart: () => void
}

/* ---------------- 地图示意（演示用 SVG，不是可交互地图） ---------------- */

const DEMO_PINS: { x: number; y: number }[] = [
  { x: 180, y: 150 },
  { x: 330, y: 92 },
  { x: 270, y: 250 },
]

function DemoStreets() {
  return (
    <g aria-hidden="true">
      <rect width="480" height="340" fill="#f3eff1" />
      <path d="M300 -10 C 320 80, 380 140, 490 170 L 490 230 C 370 200, 300 150, 270 -10 Z" fill="#dfeef0" />
      <rect x="40" y="200" width="110" height="80" rx="18" fill="#e4efe3" />
      <rect x="360" y="250" width="90" height="60" rx="16" fill="#e4efe3" />
      <g stroke="#ffffff" strokeLinecap="round" fill="none">
        <path d="M-10 120 C 120 110, 240 130, 490 100" strokeWidth="16" />
        <path d="M120 -10 C 140 120, 150 220, 130 350" strokeWidth="12" />
        <path d="M-10 300 C 160 270, 300 300, 490 280" strokeWidth="10" />
        <path d="M230 -10 L 260 350" strokeWidth="8" />
        <path d="M-10 40 L 490 60" strokeWidth="6" />
        <path d="M380 -10 C 360 120, 400 220, 380 350" strokeWidth="6" />
        <path d="M20 190 L 470 205" strokeWidth="5" />
      </g>
    </g>
  )
}

function MapDemo({ copy, selected, onSelect, compact = false }: {
  copy: Copy
  selected: number
  onSelect: (i: number) => void
  compact?: boolean
}) {
  return (
    <svg
      className="demo-map-svg"
      viewBox="0 0 480 340"
      preserveAspectRatio="xMidYMid slice"
      role={compact ? undefined : 'group'}
      aria-label={compact ? undefined : copy.mapNote}
      aria-hidden={compact ? true : undefined}
    >
      <DemoStreets />
      <g transform="translate(200 205)">
        <circle r="18" fill="rgb(37 99 235 / 0.14)" />
        <circle r="7" fill="#2563eb" stroke="#fff" strokeWidth="3" />
      </g>
      {DEMO_PINS.map((pin, i) => {
        const isSel = i === selected
        return (
          <g
            key={i}
            className={`demo-pin ${isSel ? 'is-selected' : ''}`}
            transform={`translate(${pin.x} ${pin.y})`}
            onClick={() => onSelect(i)}
          >
            <g className="demo-pin-body">
              <path
                d="M0 0 C -14 -16, -16 -22, -16 -30 A 16 16 0 1 1 16 -30 C 16 -22, 14 -16, 0 0 Z"
                fill={i === 2 ? 'var(--place-pharmacy)' : 'var(--rose-600)'}
                stroke="#fff"
                strokeWidth="2.5"
              />
              <text x="0" y="-25" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
                {i + 1}
              </text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}

/* ---------------- 产品界面预览（首屏） ---------------- */

function ProductPreview({ copy }: { copy: Copy }) {
  return (
    <div className="pp-frame" aria-label={copy.previewLabel} role="img">
      <div className="pp-rail" aria-hidden="true">
        <span className="pp-rail-item is-active"><Icon name="chat" size={18} /></span>
        <span className="pp-rail-item"><Icon name="map" size={18} /></span>
      </div>
      <div className="pp-chat" aria-hidden="true">
        <div className="pp-bubble-user">{copy.demoUser1}</div>
        <div className="pp-ai">
          <div className="pp-ai-label"><span className="pp-ai-dot" />Medora AI</div>
          <span className="chip chip-medium"><Icon name="alert" size={14} />{copy.demoAiLevel}</span>
          <p>{copy.demoAiSummary}</p>
          <div className="pp-ai-section">
            <strong>{copy.demoAiDo}</strong>
            <ul>{copy.demoAiDoItems.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <span className="pp-cta"><Icon name="pin" size={16} />{copy.demoAiCta}</span>
        </div>
        <div className="pp-composer"><span /><span className="pp-send"><Icon name="arrowUp" size={16} /></span></div>
      </div>
      <div className="pp-map" aria-hidden="true">
        <MapDemo copy={copy} selected={0} onSelect={() => {}} compact />
        <div className="pp-map-card">
          <strong>{copy.clinics[0].name}</strong>
          <span>{copy.clinics[0].address}</span>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Chat 演示（随步骤展开） ---------------- */

function ChatDemo({ copy, step }: { copy: Copy; step: number }) {
  const show = (min: number) => (step >= min ? 'true' : 'false')
  return (
    <div className="cd-frame">
      <div className="cd-head">
        <span className="cd-ai-dot" aria-hidden="true" />
        <span>Medora AI</span>
        <span className="cd-badge">AI</span>
      </div>
      <div className="cd-body">
        <div className="cd-msg cd-user" data-visible={show(0)}>{copy.demoUser1}</div>
        <div className="cd-msg cd-ai" data-visible={show(1)}>{copy.demoAi1}</div>
        <div className="cd-msg cd-user" data-visible={show(1)}>{copy.demoUser2}</div>
        <div className="cd-msg cd-ai cd-answer" data-visible={show(2)}>
          <span className="chip chip-medium"><Icon name="alert" size={14} />{copy.demoAiLevel}</span>
          <p>{copy.demoAiSummary}</p>
          <div className="cd-section">
            <strong><Icon name="care" size={16} />{copy.demoAiDo}</strong>
            <ul>{copy.demoAiDoItems.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div className="cd-section">
            <strong><Icon name="alert" size={16} />{copy.demoAiWatch}</strong>
            <ul>{copy.demoAiWatchItems.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <span className="cd-cta" id="lp-ribbon-start"><Icon name="pin" size={16} />{copy.demoAiCta}</span>
        </div>
      </div>
    </div>
  )
}

/* ---------------- 页面 ---------------- */

export default function LandingPage({ lang, onChangeLang, onSignIn, onStart }: LandingPageProps) {
  const copy = landingCopy[lang]
  const rootRef = useRef<HTMLDivElement>(null)
  const heroStageRef = useRef<HTMLDivElement>(null)
  const ribbonRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [step, setStep] = useState(0)
  const [selectedClinic, setSelectedClinic] = useState(0)

  // 内容随滚动分层进入（只用 opacity / transform；减少动态效果时直接显示）
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const items = root.querySelectorAll<HTMLElement>('[data-reveal]')
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.setAttribute('data-revealed', 'true'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', 'true')
            io.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // Chat 演示：当前阅读到哪一步
  useEffect(() => {
    const root = rootRef.current
    if (!root || !('IntersectionObserver' in window)) {
      setStep(2)
      return
    }
    const steps = root.querySelectorAll<HTMLElement>('[data-step]')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStep(Number(entry.target.getAttribute('data-step')))
          }
        })
      },
      { rootMargin: '-40% 0px -45% 0px' },
    )
    steps.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // 首屏产品图轻微放大、导航栏分隔线、Chat→Map 丝带：同一个滚动监听，rAF 节流
  useEffect(() => {
    let frame = 0
    function update() {
      frame = 0
      setScrolled(window.scrollY > 8)
      const vh = window.innerHeight
      const stage = heroStageRef.current
      if (stage) {
        const rect = stage.getBoundingClientRect()
        const p = Math.min(1, Math.max(0, (vh - rect.top) / (vh * 0.9)))
        stage.style.setProperty('--p', p.toFixed(3))
      }
      const ribbon = ribbonRef.current
      if (ribbon) {
        const rect = ribbon.getBoundingClientRect()
        const p = Math.min(1, Math.max(0, (vh * 0.85 - rect.top) / (rect.height + vh * 0.35)))
        ribbon.style.setProperty('--draw', p.toFixed(3))
      }
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="landing" ref={rootRef}>
      <a className="skip-link" href="#lp-main">
        {lang === 'zh' ? '跳到主要内容' : 'Skip to content'}
      </a>
      <header className={`lp-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <a href="#top" className="lp-nav-logo">
            <Logo height={26} />
          </a>
          <nav className="lp-nav-links" aria-label={lang === 'zh' ? '产品' : 'Product'}>
            <a href="#chat">{copy.navChat}</a>
            <a href="#map">{copy.navMap}</a>
          </nav>
          <div className="lp-nav-actions">
            <LangToggle lang={lang} onChange={onChangeLang} className="lp-lang" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={onSignIn}>
              {copy.signIn}
            </button>
            <button type="button" className="btn btn-primary btn-sm lp-nav-start" onClick={onStart}>
              {copy.start}
            </button>
          </div>
        </div>
      </header>

      <main id="lp-main">
        <section className="lp-hero" id="top">
          <div className="lp-hero-copy">
            <h1 className="lp-hero-title">
              <span className="lp-line" data-reveal>{copy.heroTitleA}</span>
              <span className="lp-line lp-line-2" data-reveal>{copy.heroTitleB}</span>
            </h1>
            <p className="lp-hero-body" data-reveal>{copy.heroBody}</p>
            <div className="lp-hero-ctas" data-reveal>
              <button type="button" className="btn btn-primary lp-btn-lg" onClick={onStart}>
                {copy.heroPrimary}
                <Icon name="arrowRight" size={18} />
              </button>
              <a className="btn btn-secondary lp-btn-lg" href="#chat">
                {copy.heroSecondary}
              </a>
            </div>
          </div>
          <div className="lp-hero-stage" ref={heroStageRef}>
            <ProductPreview copy={copy} />
            <p className="lp-caption">{copy.previewLabel}</p>
          </div>
        </section>

        <section className="lp-chat" id="chat" aria-labelledby="lp-chat-title">
          <div className="lp-section-head" data-reveal>
            <h2 id="lp-chat-title">{copy.chatTitle}</h2>
            <p>{copy.chatBody}</p>
          </div>
          <div className="lp-chat-grid">
            <ol className="lp-steps">
              {copy.steps.map((s, i) => (
                <li
                  key={s.title}
                  data-step={i}
                  className={`lp-step ${step === i ? 'is-active' : ''} ${step > i ? 'is-done' : ''}`}
                >
                  <span className="lp-step-index" aria-hidden="true">{i + 1}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="lp-chat-stage">
              <div className="lp-chat-sticky">
                <ChatDemo copy={copy} step={step} />
                <p className="lp-caption">{copy.demoNote}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="lp-ribbon" ref={ribbonRef} aria-hidden="true">
          <svg viewBox="0 0 1200 220" preserveAspectRatio="none">
            <path className="lp-ribbon-under" d="M760 0 C 760 120, 420 80, 420 220" pathLength={1} />
            <path className="lp-ribbon-over" d="M760 0 C 760 120, 420 80, 420 220" pathLength={1} />
          </svg>
        </div>

        <section className="lp-map" id="map" aria-labelledby="lp-map-title">
          <div className="lp-map-inner">
          <div className="lp-section-head" data-reveal>
            <h2 id="lp-map-title">{copy.mapTitle}</h2>
            <p>{copy.mapBody}</p>
          </div>
          <div className="lp-map-demo" data-reveal>
            <ul className="lp-map-list">
              {copy.clinics.map((c, i) => (
                <li key={c.name}>
                  <button
                    type="button"
                    className={`lp-clinic ${selectedClinic === i ? 'is-selected' : ''}`}
                    aria-pressed={selectedClinic === i}
                    onClick={() => setSelectedClinic(i)}
                    onMouseEnter={() => setSelectedClinic(i)}
                    onFocus={() => setSelectedClinic(i)}
                  >
                    <span className="lp-clinic-index">{i + 1}</span>
                    <span className="lp-clinic-text">
                      <strong>{c.name}</strong>
                      <span>{c.address}</span>
                      <span className="lp-clinic-meta">
                        <Icon name="pin" size={14} />{c.distance}
                        <Icon name="phone" size={14} />{c.phone}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="lp-map-canvas">
              <MapDemo copy={copy} selected={selectedClinic} onSelect={setSelectedClinic} />
              <div className="lp-map-popover" key={selectedClinic}>
                <strong>{copy.clinics[selectedClinic].name}</strong>
                <span>{copy.clinics[selectedClinic].address}</span>
                <div className="lp-map-popover-actions">
                  <span><Icon name="phone" size={14} />{copy.call}</span>
                  <span><Icon name="navigate" size={14} />{copy.navigate}</span>
                </div>
              </div>
            </div>
          </div>
          <p className="lp-caption lp-map-note">{copy.mapNote}</p>
          </div>
        </section>

        <section className="lp-closing" aria-labelledby="lp-closing-title">
          <div className="lp-closing-inner" data-reveal>
            <h2 id="lp-closing-title">{copy.closingTitle}</h2>
            <button type="button" className="btn lp-btn-lg lp-closing-cta" onClick={onStart}>
              {copy.closingCta}
              <Icon name="arrowRight" size={18} />
            </button>
            <ul className="lp-boundaries">
              {copy.boundaries.map((b) => (
                <li key={b.text}>
                  <Icon name={b.icon as IconName} size={18} />
                  <span>{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <Logo height={20} />
        <span>{copy.footer}</span>
        <LangToggle lang={lang} onChange={onChangeLang} />
      </footer>
    </div>
  )
}
