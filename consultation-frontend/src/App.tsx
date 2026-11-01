import { useState } from 'react'
import './App.css'
import ChatPanel from './ChatPanel'
import MapPanel from './MapPanel'
import { translations, type Language } from './i18n'

type ActiveSection = 'chat' | 'map'

function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('chat')
  const [lang, setLang] = useState<Language>('zh')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const t = translations[lang]

  function handleSelectSection(section: ActiveSection) {
    setActiveSection(section)
    setIsMobileMenuOpen(false)
  }

  return (
    <div className="app-viewport">
      <div className="app-container">
        {/* 左侧边栏卡片（桌面端显示，手机端隐藏） */}
        <aside className="sidebar-card">
          <div className="sidebar-top-section">
            {/* 1. 顶部 Logo & 标题 */}
            <header className="sidebar-brand-header">
              <div className="brand-icon-box" aria-hidden="true">
                <span className="cross-icon">+</span>
              </div>
              <div className="brand-text-wrap">
                <div className="brand-title-row">
                  <span className="brand-title">{t.brandTitle}</span>
                  <span className="beta-badge">Beta</span>
                </div>
                <p className="brand-subtitle">{t.brandSubtitle}</p>
              </div>
            </header>

            {/* 2. 中间 3D 机器人医生立绘与客服状态 */}
            <section className="doctor-hero-card">
              <div className="doctor-hero-visual-wrapper">
                <div className="doctor-halo-bg" aria-hidden="true"></div>
                <div
                  className="doctor-hero-sprite"
                  aria-label="3D AI Doctor Robot"
                ></div>
              </div>

              <div className="doctor-profile-info">
                <div className="doctor-name-row">
                  <span className="doctor-main-title">{t.doctorMainTitle}</span>
                  <div className="status-pill">
                    <span className="status-dot"></span>
                    <span className="status-text">{t.onlineStatus}</span>
                  </div>
                </div>
                <p className="doctor-desc">{t.doctorDesc}</p>
              </div>
            </section>
          </div>

          {/* 3. 底部两个功能卡片：1. 聊天 2. 查看附近的医院 */}
          <nav className="feature-nav-list" aria-label={t.mobileMenuTitle}>
            {/* 卡片 1: 聊天咨询 */}
            <button
              type="button"
              className={`feature-nav-card ${activeSection === 'chat' ? 'active' : ''}`}
              onClick={() => handleSelectSection('chat')}
            >
              <div className="nav-card-icon icon-bubble" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="22"
                  height="22"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <div className="nav-card-texts">
                <span className="nav-card-title">{t.navChatTitle}</span>
                <span className="nav-card-desc">{t.navChatDesc}</span>
              </div>
            </button>

            {/* 卡片 2: 查看附近的医院 */}
            <button
              type="button"
              className={`feature-nav-card ${activeSection === 'map' ? 'active' : ''}`}
              onClick={() => handleSelectSection('map')}
            >
              <div className="nav-card-icon icon-hospital" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="22"
                  height="22"
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
              </div>
              <div className="nav-card-texts">
                <span className="nav-card-title">{t.navMapTitle}</span>
                <span className="nav-card-desc">{t.navMapDesc}</span>
              </div>
            </button>
          </nav>
        </aside>

        {/* 右侧主工作区卡片：手机端默认第一页即全屏展示此区域 */}
        <main className="main-chat-card">
          <div
            className="panel-content-wrap"
            style={{ display: activeSection === 'chat' ? 'flex' : 'none' }}
          >
            <ChatPanel
              onOpenMap={() => handleSelectSection('map')}
              lang={lang}
              onChangeLang={setLang}
              onOpenMobileMenu={() =>
                setIsMobileMenuOpen((prev) => !prev)
              }
              isMobileMenuOpen={isMobileMenuOpen}
            />
          </div>
          <div
            className="panel-content-wrap"
            style={{ display: activeSection === 'map' ? 'flex' : 'none' }}
          >
            <MapPanel
              isVisible={activeSection === 'map'}
              onBackToChat={() => handleSelectSection('chat')}
              lang={lang}
              onChangeLang={setLang}
              onOpenMobileMenu={() =>
                setIsMobileMenuOpen((prev) => !prev)
              }
              isMobileMenuOpen={isMobileMenuOpen}
            />
          </div>
        </main>

        {/* 手机端：点击右上角 + 号后，从下往上滑动弹出的功能切换抽屉 */}
        <div
          className={`mobile-sheet-backdrop ${isMobileMenuOpen ? 'visible' : ''}`}
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden={!isMobileMenuOpen}
        >
          <section
            className={`mobile-bottom-sheet ${isMobileMenuOpen ? 'open' : ''}`}
            onClick={(e) => e.stopPropagation()}
            aria-label={t.mobileMenuTitle}
          >
            <div className="sheet-drag-handle" aria-hidden="true"></div>
            <header className="sheet-header">
              <div className="sheet-brand-row">
                <div className="brand-icon-box sheet-brand-icon" aria-hidden="true">
                  <span className="cross-icon">+</span>
                </div>
                <div>
                  <span className="sheet-title">{t.mobileMenuTitle}</span>
                  <p className="sheet-subtitle">{t.brandSubtitle}</p>
                </div>
              </div>
              <button
                type="button"
                className="sheet-close-btn"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label={t.closeMenu}
              >
                ✕
              </button>
            </header>

            <div className="sheet-nav-options">
              <button
                type="button"
                className={`feature-nav-card ${activeSection === 'chat' ? 'active' : ''}`}
                onClick={() => handleSelectSection('chat')}
              >
                <div className="nav-card-icon icon-bubble" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="22"
                    height="22"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <div className="nav-card-texts">
                  <span className="nav-card-title">{t.navChatTitle}</span>
                  <span className="nav-card-desc">{t.navChatDesc}</span>
                </div>
              </button>

              <button
                type="button"
                className={`feature-nav-card ${activeSection === 'map' ? 'active' : ''}`}
                onClick={() => handleSelectSection('map')}
              >
                <div className="nav-card-icon icon-hospital" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="22"
                    height="22"
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
                </div>
                <div className="nav-card-texts">
                  <span className="nav-card-title">{t.navMapTitle}</span>
                  <span className="nav-card-desc">{t.navMapDesc}</span>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default App
