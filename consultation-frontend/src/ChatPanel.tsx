import { useState, type FormEvent, useEffect, useRef } from 'react'
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

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  answer?: HealthAnswer
  emergency?: boolean
}

interface ChatApiResponse {
  success: boolean
  data?: {
    type?: 'emergency'
    conversationId?: string
    answer?: HealthAnswer
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
  onOpenMap: () => void
  lang: Language
  onChangeLang: (lang: Language) => void
  onOpenMobileMenu: () => void
  isMobileMenuOpen?: boolean
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ??
  'http://127.0.0.1:8000'

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getCurrentTime() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function answerAsHistory(answer: HealthAnswer) {
  return [
    answer.summary,
    ...answer.followUpQuestions,
    ...answer.possibleCauses,
    ...answer.advice,
    ...answer.seekCareWhen,
  ].join('\n')
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

function ChatPanel({
  onOpenMap,
  lang,
  onChangeLang,
  onOpenMobileMenu,
  isMobileMenuOpen,
}: ChatPanelProps) {
  const t = translations[lang]
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: translations.zh.welcomeMessage,
      timestamp: '10:24',
    },
  ])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string>()
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string>()
  const [retryMessage, setRetryMessage] = useState<string>()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  async function sendMessage(message: string, appendUserMessage: boolean) {
    const history = messages.slice(-20).map((item) => ({
      role: item.role,
      content: (item.answer
        ? answerAsHistory(item.answer)
        : item.id === 'welcome'
          ? t.welcomeMessage
          : item.content
      ).slice(0, 4000),
    }))

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
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message,
          language: lang,
          history,
        }),
      })
      const result = (await response.json()) as ChatApiResponse

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error?.message ?? t.errorDefault)
      }

      const responseTime = getCurrentTime()

      if (result.data.type === 'emergency') {
        if (result.data.conversationId) {
          setConversationId(result.data.conversationId)
        }
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
            timestamp: responseTime,
          },
        ])
        return
      }

      if (!result.data || !result.data.answer) {
        throw new Error(t.errorIncomplete)
      }

      const answerData = result.data.answer
      setConversationId(result.data.conversationId)
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: answerData.summary ?? '',
          answer: answerData,
          timestamp: responseTime,
        },
      ])
    } catch (requestError) {
      setError(
        requestError instanceof Error
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
      <div className="messages-stream" aria-label="对话内容" aria-live="polite">
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
                    {isEmergency && (
                      <div className="emergency-badge">{t.emergencyBadge}</div>
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

                  {message.answer &&
                    (isEmergency ? (
                      <div className="emergency-action-zone">
                        {renderSections(message.answer)}
                        <button
                          className="map-link-button"
                          type="button"
                          onClick={onOpenMap}
                        >
                          {t.viewNearbyHospitals}
                        </button>
                      </div>
                    ) : (
                      <>
                        {renderSections(message.answer)}
                        {message.answer.urgency === 'high' && (
                          <button
                            className="map-link-button"
                            type="button"
                            onClick={onOpenMap}
                          >
                            {t.viewNearbyHospitals}
                          </button>
                        )}
                      </>
                    ))}
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

        {isSending && (
          <div className="message-row assistant-row typing-row">
            <div
              className="doctor-avatar-circle assistant-avatar"
              aria-hidden="true"
            >
              <span className="doctor-avatar-head"></span>
            </div>
            <div className="typing-bubble" aria-label="Thinking">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
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
          <button
            type="button"
            className="composer-icon-btn"
            title={t.addPromptTitle}
            onClick={() => {
              setInput((prev) => (prev ? prev : t.addPromptPrefix))
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="20"
              height="20"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>

          <input
            id="message-input"
            type="text"
            className="composer-input"
            aria-label={t.inputPlaceholder}
            placeholder={t.inputPlaceholder}
            value={input}
            disabled={isSending}
            onChange={(event) => setInput(event.target.value)}
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
      </footer>
    </div>
  )
}

export default ChatPanel
