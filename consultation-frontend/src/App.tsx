import { lazy, Suspense, useEffect, useState } from 'react'
import './App.css'
import AuthPage from './AuthPage'
import ChatPanel from './ChatPanel'
import ConversationList, { type ConversationItem } from './ConversationList'
import {
  AUTH_EXPIRED_EVENT,
  authFetch,
  clearSession,
  loadSession,
  type AuthSession,
} from './auth'
import { translations, type Language } from './i18n'

type ActiveSection = 'chat' | 'map'
type Translation = (typeof translations)[Language]

// 地图库体积较大（约 1MB），首次打开“附近医院”时才加载
const MapPanel = lazy(() => import('./MapPanel'))

const LANG_KEY = 'ai_doc_lang'

function loadLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch {
    /* ignore */
  }
  return 'zh'
}

function FeatureNavCards({
  t,
  activeSection,
  onSelect,
}: {
  t: Translation
  activeSection: ActiveSection
  onSelect: (section: ActiveSection) => void
}) {
  return (
    <>
      <button
        type="button"
        className={`feature-nav-card ${activeSection === 'chat' ? 'active' : ''}`}
        aria-current={activeSection === 'chat' ? 'page' : undefined}
        onClick={() => onSelect('chat')}
      >
        <div className="nav-card-icon icon-bubble" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
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
        aria-current={activeSection === 'map' ? 'page' : undefined}
        onClick={() => onSelect('map')}
      >
        <div className="nav-card-icon icon-hospital" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="nav-card-texts">
          <span className="nav-card-title">{t.navMapTitle}</span>
          <span className="nav-card-desc">{t.navMapDesc}</span>
        </div>
      </button>
    </>
  )
}

function App() {
  const [session, setSession] = useState<AuthSession | null>(() =>
    loadSession(),
  )
  const [authNotice, setAuthNotice] = useState<string>()
  const [activeSection, setActiveSection] = useState<ActiveSection>('chat')
  const [lang, setLang] = useState<Language>(loadLanguage)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hasOpenedMap, setHasOpenedMap] = useState(false)

  // 多对话状态（第 5 步）
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [conversationsLimit, setConversationsLimit] = useState(3)
  const [activeConversationId, setActiveConversationId] = useState<
    string | undefined
  >(undefined)

  const t = translations[lang]

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  // 后端返回 401 或令牌到期时，自动退回登录页
  useEffect(() => {
    function handleExpired() {
      setSession(null)
      setAuthNotice(t.sessionExpired)
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired)
  }, [t.sessionExpired])

  useEffect(() => {
    if (!session) return
    const remaining = session.expiresAt - Date.now()
    const timer = window.setTimeout(() => {
      clearSession()
      setSession(null)
      setAuthNotice(t.sessionExpired)
    }, Math.max(0, Math.min(remaining, 2_147_000_000)))
    return () => window.clearTimeout(timer)
  }, [session, t.sessionExpired])

  // 加载当前用户的多对话列表
  async function loadConversations() {
    if (!session) return
    try {
      const res = await authFetch('/api/conversations')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.conversations)) {
        setConversations(data.conversations)
        if (typeof data.limit === 'number') {
          setConversationsLimit(data.limit)
        }
      }
    } catch (err) {
      console.error('Failed to load conversations', err)
    }
  }

  useEffect(() => {
    if (session) {
      void loadConversations()
    } else {
      setConversations([])
      setActiveConversationId(undefined)
    }
  }, [session])

  function handleLogout() {
    clearSession()
    setSession(null)
    setAuthNotice(undefined)
    setIsMobileMenuOpen(false)
    setActiveSection('chat')
    setHasOpenedMap(false)
    setConversations([])
    setActiveConversationId(undefined)
  }

  function handleSelectSection(section: ActiveSection) {
    if (section === 'map') setHasOpenedMap(true)
    setActiveSection(section)
    setIsMobileMenuOpen(false)
  }

  function handleSelectConversation(id?: string) {
    setActiveConversationId(id)
    setActiveSection('chat')
  }

  function handleNewConversation() {
    if (conversations.length >= conversationsLimit) return
    setActiveConversationId(undefined)
    setActiveSection('chat')
  }

  async function handleDeleteConversation(id: string) {
    if (!window.confirm(t.deleteConversationConfirm)) return
    try {
      const res = await authFetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      })
      if (res.ok || res.status === 204 || res.status === 404) {
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (activeConversationId === id) {
          setActiveConversationId(undefined)
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation', err)
    }
  }

  function handleConversationChanged() {
    void loadConversations()
  }

  // 1. 未登录（首次进入或令牌过期）：显示登录 / 注册页面
  if (!session) {
    return (
      <AuthPage
        lang={lang}
        onChangeLang={setLang}
        notice={authNotice}
        onAuthenticated={(next) => {
          setSession(next)
          setAuthNotice(undefined)
        }}
      />
    )
  }

  const accountBar = (
    <div className="account-bar">
      <span className="account-email" title={session.user.email}>
        {session.user.email}
      </span>
      <button type="button" className="logout-btn" onClick={handleLogout}>
        {t.logout}
      </button>
    </div>
  )

  // 2. 已登录：展示完整系统
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

          {/* 2.5 历史对话列表（桌面端） */}
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            limit={conversationsLimit}
            onSelect={handleSelectConversation}
            onDelete={handleDeleteConversation}
            onNew={handleNewConversation}
            t={t}
          />

          {/* 3. 底部两个功能卡片：1. 聊天 2. 查看附近的医院 */}
          <nav className="feature-nav-list" aria-label={t.mobileMenuTitle}>
            <FeatureNavCards
              t={t}
              activeSection={activeSection}
              onSelect={handleSelectSection}
            />
          </nav>
          {accountBar}
        </aside>

        {/* 右侧主工作区卡片：手机端默认第一页即全屏展示此区域 */}
        <main className="main-chat-card">
          <div
            className="panel-content-wrap"
            style={{ display: activeSection === 'chat' ? 'flex' : 'none' }}
          >
            <ChatPanel
              key={activeConversationId ?? 'new'}
              conversationId={activeConversationId}
              onConversationChanged={handleConversationChanged}
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
            {hasOpenedMap && (
              <Suspense
                fallback={
                  <div className="map-lazy-loading" role="status">
                    <div className="loading-spinner" aria-hidden="true" />
                    <span>{t.loadingMap}</span>
                  </div>
                }
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
              </Suspense>
            )}
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

            {/* 手机端对话列表 */}
            <ConversationList
              conversations={conversations}
              activeId={activeConversationId}
              limit={conversationsLimit}
              onSelect={(id) => {
                handleSelectConversation(id)
                setIsMobileMenuOpen(false)
              }}
              onDelete={handleDeleteConversation}
              onNew={() => {
                handleNewConversation()
                setIsMobileMenuOpen(false)
              }}
              t={t}
            />

            <div className="sheet-nav-options">
              <FeatureNavCards
                t={t}
                activeSection={activeSection}
                onSelect={handleSelectSection}
              />
            </div>
            {accountBar}
          </section>
        </div>
      </div>
    </div>
  )
}

export default App
