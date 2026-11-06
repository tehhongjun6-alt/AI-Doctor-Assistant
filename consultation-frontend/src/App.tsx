import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import {
  AUTH_EXPIRED_EVENT,
  clearSession,
  loadSession,
  type AuthSession,
} from './auth'
import { ChatToolbar } from './chat/ChatToolbar'
import ChatPanel from './chat/ChatPanel'
import { Icon } from './components/Icon'
import { translations, type Language } from './i18n'
import LandingPage from './landing/LandingPage'
import AuthPage from './login/AuthPage'
import type { CareLevel } from './services/chatService'
import {
  deleteConversation,
  listConversations,
  type ConversationItem,
} from './services/conversationService'
import { Sidebar, type Section } from './workspace/Sidebar'
import './chat/chat.css'
import './workspace/workspace.css'

// 地图库体积较大，第一次打开 Map 时才加载
const MapPanel = lazy(() => import('./map/MapPanel'))

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

type PublicView = { name: 'landing' } | { name: 'auth'; mode: 'login' | 'register' }

function viewFromHash(): PublicView {
  if (typeof window === 'undefined') return { name: 'landing' }
  if (window.location.hash === '#login') return { name: 'auth', mode: 'login' }
  if (window.location.hash === '#signup') return { name: 'auth', mode: 'register' }
  return { name: 'landing' }
}

function setHash(hash: string) {
  try {
    if (hash) {
      window.history.pushState(null, '', hash)
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  } catch {
    /* ignore */
  }
}

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())
  const [authNotice, setAuthNotice] = useState<string>()
  const [publicView, setPublicView] = useState<PublicView>(viewFromHash)
  const [lang, setLang] = useState<Language>(loadLanguage)
  const [section, setSection] = useState<Section>('chat')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [hasOpenedMap, setHasOpenedMap] = useState(false)
  const [careLevel, setCareLevel] = useState<CareLevel>('clinic')
  const [mapFromChat, setMapFromChat] = useState<CareLevel | null>(null)

  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [limit, setLimit] = useState(3)
  const [activeConversationId, setActiveConversationId] = useState<string>()
  const [chatKey, setChatKey] = useState(0)

  const online = useOnline()
  const t = translations[lang]

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  // 浏览器前进 / 后退切换官网和登录页
  useEffect(() => {
    const onPop = () => setPublicView(viewFromHash())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const expireSession = useCallback(() => {
    clearSession()
    setSession(null)
    setAuthNotice(translations[lang].sessionExpired)
    setPublicView({ name: 'auth', mode: 'login' })
  }, [lang])

  // 后端返回 401 或令牌到期：回到登录页并提示
  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, expireSession)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expireSession)
  }, [expireSession])

  useEffect(() => {
    if (!session) return
    const remaining = session.expiresAt - Date.now()
    const timer = window.setTimeout(expireSession, Math.max(0, Math.min(remaining, 2_147_000_000)))
    return () => window.clearTimeout(timer)
  }, [session, expireSession])

  const refreshConversations = useCallback(async () => {
    try {
      const data = await listConversations()
      if (!data) return
      setConversations(data.conversations)
      if (data.limit) setLimit(data.limit)
    } catch (err) {
      console.error('Failed to load conversations', err)
    }
  }, [])

  useEffect(() => {
    if (session) {
      void refreshConversations()
    } else {
      setConversations([])
      setActiveConversationId(undefined)
    }
  }, [session, refreshConversations])

  function goToAuth(mode: 'login' | 'register') {
    setAuthNotice(undefined)
    setPublicView({ name: 'auth', mode })
    setHash(mode === 'login' ? '#login' : '#signup')
    window.scrollTo?.(0, 0)
  }

  function goToLanding() {
    setPublicView({ name: 'landing' })
    setHash('')
  }

  function handleLogout() {
    clearSession()
    setSession(null)
    setAuthNotice(undefined)
    setDrawerOpen(false)
    setSection('chat')
    setHasOpenedMap(false)
    setConversations([])
    setActiveConversationId(undefined)
    setPublicView({ name: 'landing' })
    setHash('')
  }

  function selectSection(next: Section) {
    if (next === 'map') {
      setHasOpenedMap(true)
      setMapFromChat(null)
    }
    setSection(next)
  }

  function openMapFromChat(level: CareLevel) {
    setCareLevel(level)
    setMapFromChat(level)
    setHasOpenedMap(true)
    setSection('map')
  }

  function startNewChat() {
    if (conversations.length >= limit) return
    setActiveConversationId(undefined)
    setChatKey((k) => k + 1)
    setSection('chat')
  }

  function selectConversation(id: string) {
    setActiveConversationId(id)
    setChatKey((k) => k + 1)
    setSection('chat')
  }

  async function handleDeleteConversation(id: string) {
    if (!window.confirm(t.deleteConversationConfirm)) return
    try {
      if (await deleteConversation(id)) {
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (activeConversationId === id) {
          setActiveConversationId(undefined)
          setChatKey((k) => k + 1)
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation', err)
    }
  }

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  // 未登录：品牌官网或登录页
  if (!session) {
    if (publicView.name === 'auth') {
      return (
        <AuthPage
          key={publicView.mode}
          lang={lang}
          onChangeLang={setLang}
          notice={authNotice}
          initialMode={publicView.mode}
          onBack={goToLanding}
          onAuthenticated={(next) => {
            setSession(next)
            setAuthNotice(undefined)
            setSection('chat')
            setHash('')
          }}
        />
      )
    }
    return (
      <LandingPage
        lang={lang}
        onChangeLang={setLang}
        onSignIn={() => goToAuth('login')}
        onStart={() => goToAuth('register')}
      />
    )
  }

  // 已登录：工作区（默认进入 Chat）
  return (
    <div className="ws">
      <Sidebar
        t={t}
        lang={lang}
        onChangeLang={setLang}
        active={section}
        onSelect={selectSection}
        email={session.user.email}
        onLogout={handleLogout}
        drawerOpen={drawerOpen}
        onCloseDrawer={closeDrawer}
        onAccountDeleted={handleLogout}
      />

      <main className="ws-main">
        {!online && (
          <div className="ws-offline" role="status">
            <Icon name="wifiOff" size={16} />
            {t.offlineNotice}
          </div>
        )}

        {/* 两个视图都保留在页面里，切换功能不会清空当前对话 */}
        <div className="ws-view" hidden={section !== 'chat'}>
          <ChatToolbar
            t={t}
            conversations={conversations}
            limit={limit}
            activeId={activeConversationId}
            onSelect={selectConversation}
            onDelete={(id) => void handleDeleteConversation(id)}
            onNew={startNewChat}
            onOpenMenu={() => setDrawerOpen(true)}
          />
          <ChatPanel
            key={chatKey}
            initialConversationId={activeConversationId}
            onConversationCreated={(id) => setActiveConversationId(id)}
            onConversationMissing={() => {
              setActiveConversationId(undefined)
              void refreshConversations()
            }}
            onListChanged={() => void refreshConversations()}
            onOpenMap={openMapFromChat}
            lang={lang}
          />
        </div>

        <div className="ws-view" hidden={section !== 'map'}>
          {hasOpenedMap && (
            <Suspense
              fallback={
                <div className="chat-loading" role="status" style={{ justifyContent: 'center' }}>
                  <span className="spinner" aria-hidden="true" />
                  <span>{t.loadingMap}</span>
                </div>
              }
            >
              <MapPanel
                careLevel={careLevel}
                onChangeCareLevel={(level) => {
                  setCareLevel(level)
                  setMapFromChat(null)
                }}
                fromChatLevel={mapFromChat}
                isVisible={section === 'map'}
                lang={lang}
                onOpenMenu={() => setDrawerOpen(true)}
              />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  )
}
