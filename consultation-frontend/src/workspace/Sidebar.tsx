import { useEffect, useRef, useState, type FocusEvent } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { LangToggle } from '../components/LangToggle'
import { Logo } from '../components/Logo'
import type { Language, Translation } from '../i18n'
import { DeleteAccountDialog } from './DeleteAccountDialog'

export type Section = 'chat' | 'map'

interface SidebarProps {
  t: Translation
  lang: Language
  onChangeLang: (lang: Language) => void
  active: Section
  onSelect: (section: Section) => void
  email: string
  onLogout: () => void
  drawerOpen: boolean
  onCloseDrawer: () => void
  onAccountDeleted?: () => void
}

const CLOSE_DELAY = 220

/**
 * 桌面：默认只显示图标的窄栏；鼠标进入或键盘聚焦时向右展开（覆盖内容，不挤压），
 * 离开后延迟收起，避免边缘抖动。手机：作为抽屉，由菜单按钮控制。
 */
export function Sidebar({
  t,
  lang,
  onChangeLang,
  active,
  onSelect,
  email,
  onLogout,
  drawerOpen,
  onCloseDrawer,
  onAccountDeleted,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)
  const asideRef = useRef<HTMLElement>(null)

  const items: { id: Section; icon: IconName; label: string }[] = [
    { id: 'chat', icon: 'chat', label: t.navChat },
    { id: 'map', icon: 'map', label: t.navMap },
  ]

  function canHover() {
    return window.matchMedia?.('(hover: hover) and (min-width: 768px)').matches ?? false
  }

  function open() {
    window.clearTimeout(closeTimer.current)
    setExpanded(true)
  }

  function scheduleClose() {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setExpanded(false), CLOSE_DELAY)
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  // 抽屉打开时：焦点移入、Esc 关闭
  useEffect(() => {
    if (!drawerOpen) return
    const first = asideRef.current?.querySelector<HTMLElement>('button, a')
    first?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseDrawer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen, onCloseDrawer])

  function handleBlur(e: FocusEvent<HTMLElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      scheduleClose()
    }
  }

  const isOpen = expanded || drawerOpen

  return (
    <>
      <div
        className={`ws-backdrop ${drawerOpen ? 'is-visible' : ''}`}
        onClick={onCloseDrawer}
        aria-hidden="true"
      />
      <aside
        ref={asideRef}
        className={`ws-rail ${isOpen ? 'is-expanded' : ''} ${drawerOpen ? 'is-drawer-open' : ''}`}
        onMouseEnter={() => canHover() && open()}
        onMouseLeave={() => canHover() && scheduleClose()}
        onFocus={open}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !drawerOpen) {
            setExpanded(false)
            ;(document.activeElement as HTMLElement | null)?.blur()
          }
        }}
      >
        <div className="ws-rail-top">
          <span className="ws-rail-logo">
            <Logo height={17} />
          </span>
          <button
            type="button"
            className="icon-btn ws-drawer-close"
            onClick={onCloseDrawer}
            aria-label={t.closeMenu}
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="ws-rail-nav" aria-label={t.navLabel}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ws-rail-item ${active === item.id ? 'is-active' : ''}`}
              aria-current={active === item.id ? 'page' : undefined}
              onClick={() => {
                onSelect(item.id)
                onCloseDrawer()
                if (canHover()) scheduleClose()
              }}
            >
              <span className="ws-rail-icon">
                <Icon name={item.icon} size={22} />
              </span>
              <span className="ws-rail-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="ws-rail-bottom">
          <div className="ws-rail-lang">
            <LangToggle lang={lang} onChange={onChangeLang} />
          </div>
          <div className="ws-rail-account" title={email}>
            <span className="ws-avatar" aria-hidden="true">
              {email.slice(0, 1).toUpperCase()}
            </span>
            <span className="ws-rail-label ws-account-email">
              <span className="sr-only">{t.accountLabel}: </span>
              {email}
            </span>
          </div>
          <button type="button" className="ws-rail-item ws-logout" onClick={onLogout}>
            <span className="ws-rail-icon">
              <Icon name="logout" size={20} />
            </span>
            <span className="ws-rail-label">{t.logout}</span>
          </button>
          <button
            type="button"
            className="ws-rail-item ws-delete-account"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <span className="ws-rail-icon">
              <Icon name="trash" size={20} />
            </span>
            <span className="ws-rail-label">{t.deleteAccount}</span>
          </button>
        </div>
      </aside>

      <DeleteAccountDialog
        t={t}
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onSuccess={() => {
          setIsDeleteDialogOpen(false)
          if (onAccountDeleted) {
            onAccountDeleted()
          } else {
            onLogout()
          }
        }}
      />
    </>
  )
}
