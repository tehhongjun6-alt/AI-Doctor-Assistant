import type { Language, translations } from './i18n'

export interface ConversationItem {
  id: string
  title: string
  messageCount: number
  createdAt?: string
  updatedAt: string
}

export interface ConversationListProps {
  conversations: ConversationItem[]
  activeId?: string
  limit?: number
  onSelect: (id?: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  t: (typeof translations)[Language]
}

function formatConversationTime(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return ''
    const now = new Date()
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    if (isToday) {
      return `${hours}:${mins}`
    }
    return `${d.getMonth() + 1}/${d.getDate()} ${hours}:${mins}`
  } catch {
    return ''
  }
}

export function ConversationList({
  conversations,
  activeId,
  limit = 3,
  onSelect,
  onDelete,
  onNew,
  t,
}: ConversationListProps) {
  const isFull = conversations.length >= limit

  return (
    <section className="conversation-list-container" aria-label={t.conversationListTitle}>
      <div className="conversation-list-header">
        <div className="conv-header-title">
          <span className="conv-title-text">{t.conversationListTitle}</span>
          <span className="conv-count-badge">
            {conversations.length}/{limit}
          </span>
        </div>
        <button
          type="button"
          className={`new-conv-btn ${isFull ? 'disabled' : ''}`}
          disabled={isFull}
          onClick={onNew}
          aria-label={isFull ? t.conversationLimitBtn : t.newConversationBtn}
        >
          {isFull ? t.conversationLimitBtn : t.newConversationBtn}
        </button>
      </div>

      <div className="conversation-list-body">
        {conversations.length === 0 ? (
          <div className="empty-conv-hint">{t.emptyConversations}</div>
        ) : (
          <ul className="conversation-items" role="list">
            {conversations.map((conv) => {
              const isSelected = conv.id === activeId
              return (
                <li
                  key={conv.id}
                  className={`conversation-item ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelect(conv.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(conv.id)
                    }
                  }}
                  aria-selected={isSelected}
                >
                  <div className="conv-item-content">
                    <div className="conv-item-title" title={conv.title}>
                      {conv.title}
                    </div>
                    <div className="conv-item-meta">
                      <span className="conv-item-time">
                        {formatConversationTime(conv.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="conv-delete-btn"
                    title={t.deleteConversationTitle}
                    aria-label={`${t.deleteConversationTitle}: ${conv.title}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(conv.id)
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="15"
                      height="15"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="conversation-ttl-notice" title={t.conversationTtlNotice}>
        {t.conversationTtlNotice}
      </div>
    </section>
  )
}

export default ConversationList
