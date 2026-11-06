import {
  useState,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
} from 'react'
import { authFetch } from './auth'
import { translations, type Language } from './i18n'

type Urgency = 'low' | 'medium' | 'high' | 'emergency'
type FocusMode = 'inquiry_first' | 'assessment_first' | 'advice_first'

interface HealthAnswer {
  summary: string
  focusMode?: FocusMode
  followUpQuestions: string[]
  possibleCauses: string[]
  urgency: Urgency
  advice: string[]
  seekCareWhen: string[]
  disclaimer: string
}

interface Source {
  title: string
  url: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  answer?: HealthAnswer
  emergency?: boolean
  sources?: Source[]
  mapCareLevel?: 'hospital' | 'clinic' | null
}

interface ChatApiResponse {
  success: boolean
  data?: {
    type?: 'emergency'
    conversationId?: string
    answer?: HealthAnswer
    sources?: Source[]
    mapCareLevel?: 'hospital' | 'clinic' | null
    emergency?: {
      reason?: string
      action?: string
    }
  }
  error?: {
    message?: string
  }
}

interface ChatPanelProps {
  conversationId?: string
  onConversationChanged?: (newId?: string) => void
  onOpenMap: (careLevel?: 'hospital' | 'clinic') => void
  lang: Language
  onChangeLang: (lang: Language) => void
  onOpenMobileMenu: () => void
  isMobileMenuOpen?: boolean
}

function createWelcomeMessage(): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: translations.zh.welcomeMessage,
    timestamp: getCurrentTime(),
  }
}

function formatTimeFromDate(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getCurrentTime() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function AnswerSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null

  return (
    <div className="answer-section">
      <strong className="section-title">{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{renderFormattedText(item)}</li>
        ))}
      </ul>
    </div>
  )
}

async function readChatStream(
  response: Response,
  onSummary: (summary: string) => void,
): Promise<{ ok: boolean; result: ChatApiResponse }> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('stream unavailable')
  const decoder = new TextDecoder()
  let buffer = ''
  let final: { status: number; body: ChatApiResponse } | undefined

  for (;;) {
    const { done, value } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: true })
    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf('\n\n')
      const event = block.match(/^event: (.+)$/m)?.[1]
      const data = block.match(/^data: (.+)$/m)?.[1]
      if (!event || !data) continue
      const parsed = JSON.parse(data)
      if (event === 'delta' && typeof parsed.summary === 'string') {
        onSummary(parsed.summary)
      } else if (event === 'final') {
        final = parsed
      }
    }
    if (done) break
  }

  if (!final) throw new TypeError('stream ended early')
  return { ok: final.status < 400, result: final.body }
}

/** 优先使用流式接口；后端尚未支持时自动回退到普通接口 */
async function requestChat(
  body: string,
  onSummary: (summary: string) => void,
): Promise<{ ok: boolean; result: ChatApiResponse }> {
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }
  const streamResponse = await authFetch('/api/chat/stream', init)
  const contentType = streamResponse.headers?.get('Content-Type') ?? ''

  if (streamResponse.ok && contentType.includes('text/event-stream')) {
    return readChatStream(streamResponse, onSummary)
  }

  const response =
    streamResponse.status === 404
      ? await authFetch('/api/chat', init)
      : streamResponse
  const result = (await response
    .json()
    .catch(() => ({ success: false }))) as ChatApiResponse
  return { ok: response.ok, result }
}

function ChatPanel({
  conversationId: propConversationId,
  onConversationChanged,
  onOpenMap,
  lang,
  onChangeLang,
  onOpenMobileMenu,
  isMobileMenuOpen,
}: ChatPanelProps) {
  const t = translations[lang]
  const [messages, setMessages] = useState<ChatMessage[]>([
    createWelcomeMessage(),
  ])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | undefined>(
    propConversationId,
  )
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string>()
  const [retryMessage, setRetryMessage] = useState<string>()
  const [streamingText, setStreamingText] = useState<string>()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasConversation = messages.some((message) => message.role === 'user')

  useEffect(() => {
    setConversationId(propConversationId)
  }, [propConversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages, isSending, streamingText])

  // 有指定 conversationId 时，拉取历史消息还原显示
  useEffect(() => {
    let isCancelled = false
    if (!propConversationId) {
      setMessages([createWelcomeMessage()])
      return
    }

    async function fetchConversation() {
      try {
        const res = await authFetch(`/api/conversations/${propConversationId}`)
        if (isCancelled) return
        if (res.status === 404) {
          setError(t.conversationNotFoundNotice)
          onConversationChanged?.(undefined)
          setMessages([createWelcomeMessage()])
          return
        }
        if (!res.ok) {
          throw new Error(t.errorDefault)
        }
        const data = await res.json()
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const mapped: ChatMessage[] = data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            answer: m.answer ?? undefined,
            emergency: Boolean(m.isEmergency),
            sources: m.sources ?? undefined,
            mapCareLevel: m.mapCareLevel ?? (m.isEmergency ? 'hospital' : undefined),
            timestamp: m.createdAt
              ? formatTimeFromDate(new Date(m.createdAt))
              : getCurrentTime(),
          }))
          setMessages(mapped)
        } else {
          setMessages([createWelcomeMessage()])
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load conversation messages', err)
          setMessages([createWelcomeMessage()])
        }
      }
    }

    fetchConversation()
    return () => {
      isCancelled = true
    }
  }, [propConversationId, t.conversationNotFoundNotice, t.errorDefault])

  // 输入框随内容自动增高
  useEffect(() => {
    const element = inputRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`
  }, [input])

  function handleNewChat() {
    if (isSending) return
    if (hasConversation && !window.confirm(t.newChatConfirm)) return
    onConversationChanged?.(undefined)
    setMessages([createWelcomeMessage()])
    setConversationId(undefined)
    setError(undefined)
    setRetryMessage(undefined)
    setInput('')
    inputRef.current?.focus()
  }

  async function sendMessage(message: string, appendUserMessage: boolean) {
    if (appendUserMessage) {
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'user',
          content: message,
          timestamp: getCurrentTime(),
        },
      ])
    }

    setIsSending(true)
    setError(undefined)
    setRetryMessage(undefined)

    try {
      // 发送消息时不再传递客户端 history，改由后端服务器接管
      const requestBody = JSON.stringify({
        conversationId,
        message,
        language: lang,
      })
      const { ok, result } = await requestChat(requestBody, (summary) => {
        // 流式：先显示正在生成的摘要文字
        setStreamingText(summary)
      })
      setStreamingText(undefined)

      if (!ok || !result.success || !result.data) {
        const errCode = (result as { error?: { code?: string } })?.error?.code
        if (errCode === 'CONVERSATION_LIMIT_REACHED') {
          throw new Error(t.conversationLimitReachedNotice)
        }
        if (errCode === 'CONVERSATION_FULL') {
          throw new Error(t.conversationFullNotice)
        }
        if (errCode === 'CONVERSATION_NOT_FOUND') {
          onConversationChanged?.(undefined)
          throw new Error(t.conversationNotFoundNotice)
        }
        throw new Error(result.error?.message ?? t.errorDefault)
      }

      const responseTime = getCurrentTime()
      const returnedConvId = result.data.conversationId
      if (returnedConvId) {
        setConversationId(returnedConvId)
        onConversationChanged?.()
      }

      if (result.data.type === 'emergency') {
        setMessages((current) => [
          ...current,
          {
            id: createMessageId(),
            role: 'assistant',
            content:
              result.data?.answer?.summary ??
              [result.data?.emergency?.reason, result.data?.emergency?.action]
                .filter(Boolean)
                .join('\n'),
            answer: result.data?.answer,
            emergency: true,
            mapCareLevel: 'hospital',
            timestamp: responseTime,
          },
        ])
        return
      }

      if (!result.data || !result.data.answer) {
        throw new Error(t.errorIncomplete)
      }

      const answerData = result.data.answer
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: answerData.summary ?? '',
          answer: answerData,
          sources: result.data?.sources,
          mapCareLevel: result.data?.mapCareLevel,
          timestamp: responseTime,
        },
      ])
    } catch (requestError) {
      setStreamingText(undefined)
      setError(
        requestError instanceof TypeError
          ? t.networkError
          : requestError instanceof Error && requestError.message
            ? requestError.message
            : t.errorDefault,
      )
      setRetryMessage(message)
    } finally {
      setIsSending(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = input.trim()

    if (!message || isSending) return

    setInput('')
    void sendMessage(message, true)
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 发送，Shift+Enter 换行；输入法选词时不触发发送
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  function handleQuickPrompt(prompt: string) {
    if (isSending) return
    void sendMessage(prompt, true)
  }

  function renderSections(answer: HealthAnswer) {
    return (
      <>
        {answer.focusMode === 'inquiry_first' ? (
          <>
            <AnswerSection
              title={t.inquiryConfirm}
              items={answer.followUpQuestions}
            />
            <AnswerSection
              title={t.preliminaryCauses}
              items={answer.possibleCauses}
            />
            <AnswerSection
              title={t.tempReliefAdvice}
              items={answer.advice}
            />
          </>
        ) : answer.focusMode === 'advice_first' ? (
          <>
            <AnswerSection
              title={t.nextStepAdvice}
              items={answer.advice}
            />
            <AnswerSection
              title={t.keyPossibleCauses}
              items={answer.possibleCauses}
            />
            <AnswerSection
              title={t.moreDetailsConfirm}
              items={answer.followUpQuestions}
            />
          </>
        ) : (
          <>
            <AnswerSection
              title={t.keyPossibleCauses}
              items={answer.possibleCauses}
            />
            <AnswerSection
              title={
                answer.possibleCauses.length === 0 &&
                answer.followUpQuestions.length === 0 &&
                answer.seekCareWhen.length === 0
                  ? t.coreHealthPoints
                  : t.nextStepAdvice
              }
              items={answer.advice}
            />
            <AnswerSection
              title={t.moreDetailsConfirm}
              items={answer.followUpQuestions}
            />
          </>
        )}
        <AnswerSection
          title={t.dangerRedFlags}
          items={answer.seekCareWhen}
        />
        {answer.disclaimer && (
          <small className="disclaimer-text">{answer.disclaimer}</small>
        )}
      </>
    )
  }

  return (
    <div className="chat-layout">
      {/* 顶部 Header */}
      <header className="chat-header">
        <div className="chat-header-doctor">
          <div className="doctor-avatar-circle" aria-hidden="true">
            <span className="doctor-avatar-head"></span>
          </div>
          <div className="doctor-header-info">
            <h1 className="doctor-header-name">{t.headerDoctorName}</h1>
            <div className="status-indicator">
              <span className="status-dot"></span>
              <span className="status-text">{t.onlineStatus}</span>
            </div>
          </div>
        </div>

        {/* 右上角：中英切换 + 手机端加号菜单按钮 */}
        <div className="chat-header-actions">
          <button
            type="button"
            className="new-chat-btn"
            onClick={handleNewChat}
            disabled={isSending || !hasConversation}
            title={t.newChat}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="16"
              height="16"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 13.5V19.5a1.5 1.5 0 01-1.5 1.5H4.5A1.5 1.5 0 013 19.5V6a1.5 1.5 0 011.5-1.5h6"
              />
            </svg>
            <span className="new-chat-label">{t.newChat}</span>
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

      {/* 消息对话流 */}
      <div
        className="messages-stream"
        aria-label={lang === 'zh' ? '对话内容' : 'Conversation'}
        aria-live="polite"
      >
        {messages.map((message) => {
          const isEmergency = Boolean(
            message.emergency || message.answer?.urgency === 'emergency',
          )

          if (message.role === 'user') {
            return (
              <div className="message-row user-row" key={message.id}>
                <div className="user-bubble-wrap">
                  <div className="user-bubble">
                    <p>{message.content}</p>
                  </div>
                  <div className="message-meta user-meta">
                    <span className="message-time">
                      {message.timestamp ?? t.justNow}
                    </span>
                    <span className="read-receipt" title={t.delivered}>
                      ✓✓
                    </span>
                  </div>
                </div>
                <div className="user-avatar-circle" aria-label="User avatar">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    width="20"
                    height="20"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              </div>
            )
          }

          const displayContent =
            message.id === 'welcome' ? t.welcomeMessage : message.content

          return (
            <div className="message-row assistant-row" key={message.id}>
              <div
                className="doctor-avatar-circle assistant-avatar"
                aria-hidden="true"
              >
                <span className="doctor-avatar-head"></span>
              </div>
              <div className="assistant-bubble-wrap">
                <div
                  className={`assistant-bubble ${isEmergency ? 'emergency-card' : ''}`}
                >
                  <div className="summary-section">
                    {isEmergency ? (
                      <div className="emergency-badge">{t.emergencyBadge}</div>
                    ) : (
                      message.answer &&
                      (message.answer.possibleCauses.length > 0 ||
                        message.answer.seekCareWhen.length > 0) && (
                        <span
                          className={`urgency-chip urgency-${message.answer.urgency}`}
                        >
                          <span className="urgency-dot" aria-hidden="true" />
                          {t.urgencyLabel[message.answer.urgency]}
                        </span>
                      )
                    )}
                    {message.answer &&
                      (message.answer.possibleCauses.length > 0 ||
                        message.answer.followUpQuestions.length > 0 ||
                        message.answer.seekCareWhen.length > 0) && (
                        <strong className="section-title">
                          {t.summaryTitle}
                        </strong>
                      )}
                    <p className="summary-body">
                      {renderFormattedText(displayContent)}
                    </p>
                  </div>

                  {(() => {
                    if (!message.answer) return null
                    const careLevel =
                      message.mapCareLevel ??
                      (isEmergency || message.answer.urgency === 'high'
                        ? 'hospital'
                        : null)

                    const mapButton = careLevel ? (
                      <button
                        className="map-link-button"
                        type="button"
                        onClick={() => onOpenMap(careLevel)}
                      >
                        {careLevel === 'clinic'
                          ? t.viewNearbyClinics
                          : t.viewNearbyHospitals}
                      </button>
                    ) : null

                    if (isEmergency) {
                      return (
                        <div className="emergency-action-zone">
                          {renderSections(message.answer)}
                          {mapButton}
                        </div>
                      )
                    }

                    return (
                      <>
                        {renderSections(message.answer)}
                        {mapButton}
                      </>
                    )
                  })()}

                  {message.sources && message.sources.length > 0 && (
                    <div className="sources-section">
                      <span className="sources-title">{t.sourcesTitle}</span>
                      <div className="sources-list">
                        {message.sources.map((source) => (
                          <a
                            key={source.url}
                            className="source-chip"
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={source.title}
                          >
                            <span className="source-title">{source.title}</span>
                            <span className="source-host">
                              {safeHostname(source.url)}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="message-meta assistant-meta">
                  <span className="message-time">
                    {message.timestamp ?? t.justNow}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        {!hasConversation && !isSending && (
          <div className="quick-start">
            <span className="quick-start-title">{t.quickStartTitle}</span>
            <div className="quick-start-grid">
              {t.quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="quick-prompt-chip"
                  onClick={() => handleQuickPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {isSending && streamingText && (
          <div className="message-row assistant-row">
            <div
              className="doctor-avatar-circle assistant-avatar"
              aria-hidden="true"
            >
              <span className="doctor-avatar-head"></span>
            </div>
            <div className="assistant-bubble-wrap">
              <div className="assistant-bubble streaming-bubble">
                <p className="summary-body">
                  {renderFormattedText(streamingText)}
                  <span className="stream-cursor" aria-hidden="true" />
                </p>
              </div>
            </div>
          </div>
        )}

        {isSending && !streamingText && (
          <div className="message-row assistant-row typing-row">
            <div
              className="doctor-avatar-circle assistant-avatar"
              aria-hidden="true"
            >
              <span className="doctor-avatar-head"></span>
            </div>
            <div className="typing-bubble" role="status" aria-label={t.thinking}>
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="typing-label">{t.thinking}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部输入栏 */}
      <footer className="chat-composer-area">
        {error && (
          <div className="chat-error-toast" role="alert">
            <span>{error}</span>
            {retryMessage && (
              <button
                type="button"
                className="retry-btn"
                disabled={isSending}
                onClick={() => void sendMessage(retryMessage, false)}
              >
                {t.retryBtn}
              </button>
            )}
          </div>
        )}

        <form className="composer-pill" onSubmit={handleSubmit}>
          <textarea
            id="message-input"
            ref={inputRef}
            rows={1}
            className="composer-input"
            aria-label={t.inputPlaceholder}
            placeholder={t.inputPlaceholder}
            value={input}
            maxLength={2000}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            onBlur={() => {
              window.scrollTo(0, 0)
            }}
          />

          <button
            type="submit"
            className="send-btn"
            aria-label={t.sendAria}
            disabled={isSending || input.trim().length === 0}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
        <p className="composer-hint">{t.composerHint}</p>
      </footer>
    </div>
  )
}

export default ChatPanel
