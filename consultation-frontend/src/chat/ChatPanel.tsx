import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { Icon } from '../components/Icon'
import { translations, type Language } from '../i18n'
import {
  isAbortError,
  requestChat,
  type CareLevel,
} from '../services/chatService'
import { getConversation } from '../services/conversationService'
import { AssistantMessage, Paragraphs, type ChatMessage } from './AssistantMessage'
import { useSpeechInput } from './useSpeechInput'

interface ChatPanelProps {
  initialConversationId?: string
  onConversationCreated?: (id: string) => void
  onConversationMissing?: () => void
  onListChanged?: () => void
  onCanSummarizeChange?: (can: boolean) => void
  onOpenMap: (careLevel: CareLevel) => void
  lang: Language
  /** 健康指南「问 Medora」：nonce 改变时把 text 填进输入框，不自动发送 */
  prefill?: { text: string; nonce: number }
}

interface ChatError {
  message: string
  retry?: string
  tone: 'error' | 'stopped' | 'warning'
}

function timeNow(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const NEAR_BOTTOM_PX = 96

export default function ChatPanel({
  initialConversationId,
  onConversationCreated,
  onConversationMissing,
  onListChanged,
  onCanSummarizeChange,
  onOpenMap,
  lang,
  prefill,
}: ChatPanelProps) {
  const t = translations[lang]
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    const hasUser = messages.some((m) => m.role === 'user')
    onCanSummarizeChange?.(hasUser)
  }, [messages, onCanSummarizeChange])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState(initialConversationId)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(Boolean(initialConversationId))
  const [error, setError] = useState<ChatError>()
  const [notice, setNotice] = useState<string>()
  const [streamingText, setStreamingText] = useState<string>()
  const [showJump, setShowJump] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const nearBottomRef = useRef(true)
  const forceScrollRef = useRef(false)

  // 健康指南「问 Medora」：只填入、移焦点，不发送
  useEffect(() => {
    if (!prefill) return
    setInput(prefill.text)
    inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.nonce])
  const baseTextRef = useRef('')

  const speech = useSpeechInput({
    lang,
    onTranscript: (transcript) => {
      const base = baseTextRef.current
      const prefix = base
        ? base.endsWith(' ') || base.endsWith('，')
          ? base
          : base + t.transcriptSeparator
        : ''
      setInput(prefix + transcript)
    },
  })

  useEffect(() => {
    if (!speech.error) return
    if (speech.error === 'not-allowed' || speech.error === 'service-not-allowed') {
      setError({ message: t.micPermissionDenied, tone: 'warning' })
    } else {
      setError({ message: t.micError, tone: 'warning' })
    }
  }, [speech.error, t])
  // 本组件刚创建的对话 ID：父组件回传时不需要重新载入
  const createdIdRef = useRef<string | undefined>(undefined)

  const hasConversation = messages.length > 0

  // 载入历史对话（来自后端，不读浏览器存储）
  useEffect(() => {
    if (!initialConversationId || initialConversationId === createdIdRef.current) return
    let cancelled = false
    setIsLoadingHistory(true)
    getConversation(initialConversationId)
      .then((detail) => {
        if (cancelled) return
        if (detail.status === 'not_found') {
          setNotice(t.conversationNotFoundNotice)
          setConversationId(undefined)
          onConversationMissing?.()
          return
        }
        if (detail.status === 'error') {
          setError({ message: t.errorDefault, tone: 'error' })
          return
        }
        forceScrollRef.current = true
        setMessages(
          detail.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            answer: m.answer ?? undefined,
            emergency: Boolean(m.isEmergency),
            sources: m.sources ?? undefined,
            mapCareLevel: m.mapCareLevel ?? (m.isEmergency ? 'hospital' : undefined),
            timestamp: m.createdAt ? timeNow(new Date(m.createdAt)) : undefined,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setError({ message: t.networkError, tone: 'error' })
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false)
      })
    return () => {
      cancelled = true
    }
    // 只在打开某个对话时载入一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId])

  // 离开（切换对话、退出）时停止仍在进行的请求
  useEffect(() => () => abortRef.current?.abort(), [])

  // 只有用户本来就在底部（或刚发送）时才自动滚到底；向上阅读时不打扰
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (forceScrollRef.current || nearBottomRef.current) {
      el.scrollTop = el.scrollHeight
      forceScrollRef.current = false
      nearBottomRef.current = true
      setShowJump(false)
    } else {
      setShowJump(true)
    }
  }, [messages, streamingText, isSending])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
    nearBottomRef.current = near
    if (near) setShowJump(false)
  }

  function jumpToLatest() {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo?.({ top: el.scrollHeight, behavior: 'smooth' })
    nearBottomRef.current = true
    setShowJump(false)
  }

  // 输入框随内容自动增高
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden'
  }, [input])

  async function sendMessage(
    message: string,
    appendUserMessage: boolean,
    options?: { regenerate?: boolean },
  ) {
    if (appendUserMessage) {
      setMessages((cur) => [
        ...cur,
        { id: newId(), role: 'user', content: message, timestamp: timeNow() },
      ])
    }
    forceScrollRef.current = true
    setIsSending(true)
    setError(undefined)
    setNotice(undefined)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const { ok, result } = await requestChat(
        {
          conversationId,
          message,
          language: lang,
          regenerate: options?.regenerate,
        },
        (summary) => setStreamingText(summary),
        controller.signal,
      )
      setStreamingText(undefined)

      if (!ok || !result.success || !result.data) {
        const code = result.error?.code
        if (code === 'CONVERSATION_LIMIT_REACHED') throw new Error(t.conversationLimitReachedNotice)
        if (code === 'CONVERSATION_FULL') throw new Error(t.conversationFullNotice)
        if (code === 'CONVERSATION_NOT_FOUND') {
          setConversationId(undefined)
          onConversationMissing?.()
          throw new Error(t.conversationNotFoundNotice)
        }
        throw new Error(result.error?.message ?? t.errorDefault)
      }

      const data = result.data
      if (data.conversationId) {
        if (data.conversationId !== conversationId) {
          setConversationId(data.conversationId)
          createdIdRef.current = data.conversationId
          onConversationCreated?.(data.conversationId)
        }
        onListChanged?.()
      }

      if (data.type === 'emergency') {
        setMessages((cur) => [
          ...cur,
          {
            id: newId(),
            role: 'assistant',
            content:
              data.answer?.summary ??
              [data.emergency?.reason, data.emergency?.action].filter(Boolean).join('\n'),
            answer: data.answer,
            emergency: true,
            mapCareLevel: 'hospital',
            timestamp: timeNow(),
          },
        ])
        return
      }

      if (!data.answer) throw new Error(t.errorIncomplete)
      const answer = data.answer
      setMessages((cur) => [
        ...cur,
        {
          id: newId(),
          role: 'assistant',
          content: answer.summary ?? '',
          answer,
          sources: data.sources,
          mapCareLevel: data.mapCareLevel,
          timestamp: timeNow(),
        },
      ])
    } catch (err) {
      setStreamingText(undefined)
      if (isAbortError(err)) {
        setError({ message: t.stoppedNotice, retry: message, tone: 'stopped' })
      } else {
        setError({
          message:
            err instanceof TypeError
              ? t.networkError
              : err instanceof Error && err.message
                ? err.message
                : t.errorDefault,
          retry: message,
          tone: 'error',
        })
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsSending(false)
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    baseTextRef.current = ''
    speech.abort()
    if (isSending) {
      abortRef.current?.abort()
      return
    }
    const message = input.trim()
    if (!message) return
    setInput('')
    void sendMessage(message, true)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 发送，Shift+Enter 换行；输入法选词时不触发
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (!isSending) e.currentTarget.form?.requestSubmit()
    }
  }

  function handleQuickPrompt(prompt: string) {
    if (isSending) return
    void sendMessage(prompt, true)
  }

  function regenerateLast() {
    if (isSending) return
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg) return
    setMessages((cur) => {
      const idx = cur.map((m) => m.role).lastIndexOf('assistant')
      if (idx === -1) return cur
      return [...cur.slice(0, idx), ...cur.slice(idx + 1)]
    })
    void sendMessage(lastUserMsg.content, false, { regenerate: true })
  }

  const lastAssistantIndex = messages.map((m) => m.role).lastIndexOf('assistant')

  return (
    <div className="chat">
      <div
        className="chat-scroll"
        ref={scrollRef}
        onScroll={handleScroll}
        aria-label={t.chatScrollAria}
      >
        <div className="chat-column">
          {isLoadingHistory && !hasConversation && (
            <div className="chat-loading" role="status">
              <span className="spinner" aria-hidden="true" />
              <span>{t.loadingConversation}</span>
            </div>
          )}

          {!isLoadingHistory && !hasConversation && (
            <div className="chat-welcome">
              <h1 className="chat-welcome-title">{t.welcomeTitle}</h1>
              <p className="chat-welcome-body">{t.welcomeBody}</p>
              <div className="chat-prompts" role="group" aria-label={t.quickStartTitle}>
                <span className="chat-prompts-title">{t.quickStartTitle}</span>
                {t.quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="chat-prompt"
                    onClick={() => handleQuickPrompt(prompt)}
                    disabled={isSending}
                  >
                    <span>{prompt}</span>
                    <Icon name="arrowRight" size={16} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="chat-messages" aria-live="polite">
            {messages.map((message, index) =>
              message.role === 'user' ? (
                <div className="msg msg-user" key={message.id}>
                  <div className="msg-user-bubble">
                    <Paragraphs text={message.content} />
                  </div>
                  {message.timestamp && <span className="msg-time">{message.timestamp}</span>}
                </div>
              ) : (
                <AssistantMessage
                  key={message.id}
                  message={message}
                  t={t}
                  displayContent={message.content}
                  onOpenMap={onOpenMap}
                  onRegenerate={
                    !isSending && index === lastAssistantIndex
                      ? regenerateLast
                      : undefined
                  }
                />
              ),
            )}

            {isSending && streamingText && (
              <article className="msg msg-ai is-streaming">
                <div className="msg-ai-label">
                  <span className="ai-mark" aria-hidden="true" />
                  <span>{t.aiName}</span>
                  <span className="ai-badge">AI</span>
                </div>
                <p className="ai-stream">
                  {streamingText}
                  <span className="stream-caret" aria-hidden="true" />
                </p>
              </article>
            )}

            {isSending && !streamingText && (
              <div className="msg msg-ai msg-thinking" role="status">
                <div className="msg-ai-label">
                  <span className="ai-mark is-pulsing" aria-hidden="true" />
                  <span>{t.thinking}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showJump && (
        <button type="button" className="chat-jump" onClick={jumpToLatest}>
          <Icon name="arrowDown" size={16} />
          {t.jumpToLatest}
        </button>
      )}

      <div className="chat-composer-wrap">
        <div className="chat-column">
          {(error || notice) && (
            <div
              className={`chat-notice ${error?.tone === 'stopped' ? 'is-stopped' : error?.tone === 'warning' ? 'is-warning' : ''}`}
              role={error ? 'alert' : 'status'}
            >
              <Icon
                name={
                  error?.tone === 'stopped'
                    ? 'stop'
                    : error?.tone === 'warning'
                      ? 'alert'
                      : 'info'
                }
                size={18}
              />
              <span className="chat-notice-text">{error?.message ?? notice}</span>
              {error?.retry && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={isSending}
                  onClick={() => void sendMessage(error.retry!, false)}
                >
                  <Icon name="refresh" size={15} />
                  {t.retryBtn}
                </button>
              )}
              {!error?.retry && (
                <button
                  type="button"
                  className="icon-btn chat-notice-close"
                  onClick={() => {
                    setError(undefined)
                    setNotice(undefined)
                  }}
                  aria-label={t.dismiss}
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
          )}

          <form className={`composer ${isSending ? 'is-busy' : ''}`} onSubmit={handleSubmit}>
            <textarea
              id="message-input"
              ref={inputRef}
              rows={1}
              className="composer-input"
              aria-label={t.inputAria}
              placeholder={hasConversation ? t.inputPlaceholderFollow : t.inputPlaceholder}
              value={input}
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {speech.supported && (
              <button
                type="button"
                className={`composer-btn composer-mic-btn ${speech.listening ? 'is-recording' : ''}`}
                onClick={() => {
                  if (speech.listening) {
                    speech.stop()
                  } else {
                    baseTextRef.current = input
                    speech.start()
                  }
                }}
                disabled={isSending}
                aria-label={speech.listening ? t.micStop : t.micStart}
                title={speech.listening ? t.micStop : t.micStart}
              >
                <Icon name="mic" size={18} strokeWidth={2.2} />
              </button>
            )}
            {isSending ? (
              <button type="submit" className="composer-btn is-stop" aria-label={t.stopAria} title={t.stopAria}>
                <Icon name="stop" size={16} strokeWidth={2.4} />
              </button>
            ) : (
              <button
                type="submit"
                className="composer-btn"
                aria-label={t.sendAria}
                title={t.sendAria}
                disabled={input.trim().length === 0}
              >
                <Icon name="arrowUp" size={20} strokeWidth={2.2} />
              </button>
            )}
          </form>
          <p className="composer-foot">
            <span className="composer-hint">{t.composerHint}</span>
            {speech.supported && (
              <span className="composer-mic-note">{t.micPrivacyNote}</span>
            )}
            <span>{t.composerDisclaimer}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
