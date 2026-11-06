import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Logo } from '../components/Logo'
import type { Translation } from '../i18n'
import type { ConversationItem } from '../services/conversationService'

interface ChatToolbarProps {
  t: Translation
  conversations: ConversationItem[]
  limit: number
  activeId?: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onOpenMenu: () => void
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  return sameDay ? `${hh}:${mm}` : `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
}

/** Chat 顶部工具区：历史对话（最多 3 个）+ 新对话 */
export function ChatToolbar({
  t,
  conversations,
  limit,
  activeId,
  onSelect,
  onDelete,
  onNew,
  onOpenMenu,
}: ChatToolbarProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const isFull = conversations.length >= limit
  const activeTitle = conversations.find((c) => c.id === activeId)?.title

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <header className="chat-toolbar">
      <button type="button" className="icon-btn ws-menu-btn" onClick={onOpenMenu} aria-label={t.openMenu}>
        <Icon name="menu" size={22} />
      </button>
      <span className="chat-toolbar-logo">
        <Logo height={20} />
      </span>

      <div className="conv-menu" ref={wrapRef}>
        <button
          type="button"
          className="conv-trigger"
          aria-expanded={open}
          aria-controls="conv-popover"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="history" size={18} />
          <span className="conv-trigger-label">{activeTitle ?? t.historyBtn}</span>
          <span className="conv-count">
            {conversations.length}/{limit}
          </span>
          <Icon name="chevronDown" size={16} className="conv-chevron" />
        </button>

        <section
          id="conv-popover"
          className={`conv-popover ${open ? 'is-open' : ''}`}
          aria-label={t.conversationListTitle}
          inert={!open}
        >
          <div className="conv-popover-head">
            <span>{t.conversationListTitle}</span>
          </div>
          {conversations.length === 0 ? (
            <p className="conv-empty">{t.emptyConversations}</p>
          ) : (
            <ul className="conv-list" role="list">
              {conversations.map((conv) => {
                const isSelected = conv.id === activeId
                return (
                  <li
                    key={conv.id}
                    className={`conv-item ${isSelected ? 'is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => {
                      onSelect(conv.id)
                      setOpen(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(conv.id)
                        setOpen(false)
                      }
                    }}
                  >
                    <span className="conv-item-text">
                      <span className="conv-item-title" title={conv.title}>
                        {conv.title}
                      </span>
                      <span className="conv-item-time">{formatTime(conv.updatedAt)}</span>
                    </span>
                    <button
                      type="button"
                      className="icon-btn conv-delete"
                      title={t.deleteConversationTitle}
                      aria-label={`${t.deleteConversationTitle}: ${conv.title}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(conv.id)
                      }}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="conv-ttl">
            <Icon name="info" size={15} />
            <span>{t.conversationTtlNotice}</span>
          </p>
        </section>
      </div>

      <button
        type="button"
        className={`btn btn-secondary btn-sm chat-new ${isFull ? 'is-full' : ''}`}
        disabled={isFull}
        onClick={onNew}
        title={isFull ? t.conversationLimitReachedNotice : undefined}
      >
        <Icon name="plus" size={17} />
        <span className="chat-new-label">{isFull ? t.conversationLimitBtn : t.newConversationBtn}</span>
      </button>
    </header>
  )
}
