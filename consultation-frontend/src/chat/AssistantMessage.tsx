import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import type { Translation } from '../i18n'
import type { CareLevel, HealthAnswer, Source } from '../services/chatService'
import { formatAnswerAsText } from './answerText'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  answer?: HealthAnswer
  emergency?: boolean
  sources?: Source[]
  mapCareLevel?: CareLevel | null
}

/** 支持 **粗体**，以及急症说明里突出 999 */
export function renderInline(text: string, highlight999 = false): ReactNode[] {
  return text.split(/(\*\*.*?\*\*)/g).flatMap((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return [<strong key={index}>{part.slice(2, -2)}</strong>]
    }
    if (!highlight999 || !part.includes('999')) return [part]
    return part.split(/(999)/g).map((seg, j) =>
      seg === '999' ? (
        <strong key={`${index}-${j}`} className="em-999">
          999
        </strong>
      ) : (
        seg
      ),
    )
  })
}

/** 按换行拆成段落，长链接和长单词可以断行 */
export function Paragraphs({ text, className, highlight999 }: { text: string; className?: string; highlight999?: boolean }) {
  const lines = text.split(/\n+/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return null
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className={className}>
          {renderInline(line, highlight999)}
        </p>
      ))}
    </>
  )
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function Section({ title, icon, items, tone }: { title: string; icon: IconName; items: string[]; tone?: 'watch' }) {
  if (items.length === 0) return null
  return (
    <section className={`ai-section ${tone === 'watch' ? 'ai-section-watch' : ''}`}>
      <h3 className="ai-section-title">
        <Icon name={icon} size={17} />
        <span>{title}</span>
      </h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{renderInline(item)}</li>
        ))}
      </ul>
    </section>
  )
}

const URGENCY_ICON: Record<'low' | 'medium' | 'high', IconName> = {
  low: 'check',
  medium: 'info',
  high: 'alert',
}

export const PROVIDER_LABELS: Record<string, string> = {
  cpg: 'MOH CPG',
  medlineplus: 'MedlinePlus',
  openfda: 'OpenFDA',
  rxnorm: 'RxNorm',
  kkmnow: 'KKMNow',
  nhs: 'NHS',
  icd11: 'WHO ICD-11',
}

interface AssistantMessageProps {
  message: ChatMessage
  t: Translation
  displayContent: string
  onOpenMap: (careLevel: CareLevel) => void
  onRegenerate?: () => void
}

export function AssistantMessage({
  message,
  t,
  displayContent,
  onOpenMap,
  onRegenerate,
}: AssistantMessageProps) {
  const answer = message.answer
  const isEmergency = Boolean(message.emergency || answer?.urgency === 'emergency')
  const careLevel: CareLevel | null =
    message.mapCareLevel ?? (isEmergency || answer?.urgency === 'high' ? 'hospital' : null)

  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    if (!answer) return
    const text = formatAnswerAsText(answer, t)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy answer:', err)
    }
  }

  const handleShare = async () => {
    if (!answer) return
    const text = formatAnswerAsText(answer, t)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text })
      } catch {
        // User cancelled share or share failed
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
    }
  }

  const sections = answer ? (
    answer.focusMode === 'inquiry_first' ? (
      <>
        <Section title={t.inquiryConfirm} icon="question" items={answer.followUpQuestions} />
        <Section title={t.preliminaryCauses} icon="stethoscope" items={answer.possibleCauses} />
        <Section title={t.tempReliefAdvice} icon="care" items={answer.advice} />
      </>
    ) : answer.focusMode === 'advice_first' ? (
      <>
        <Section title={t.nextStepAdvice} icon="care" items={answer.advice} />
        <Section title={t.keyPossibleCauses} icon="stethoscope" items={answer.possibleCauses} />
        <Section title={t.moreDetailsConfirm} icon="question" items={answer.followUpQuestions} />
      </>
    ) : (
      <>
        <Section title={t.keyPossibleCauses} icon="stethoscope" items={answer.possibleCauses} />
        <Section
          title={
            answer.possibleCauses.length === 0 &&
            answer.followUpQuestions.length === 0 &&
            answer.seekCareWhen.length === 0
              ? t.coreHealthPoints
              : t.nextStepAdvice
          }
          icon="care"
          items={answer.advice}
        />
        <Section title={t.moreDetailsConfirm} icon="question" items={answer.followUpQuestions} />
      </>
    )
  ) : null

  const mapButton = careLevel ? (
    <button
      type="button"
      className={`ai-map-btn ${isEmergency ? 'is-emergency' : ''}`}
      onClick={() => onOpenMap(careLevel)}
    >
      <Icon name={careLevel === 'clinic' ? 'clinic' : 'hospital'} size={18} />
      <span>{careLevel === 'clinic' ? t.viewNearbyClinics : t.viewNearbyHospitals}</span>
    </button>
  ) : null

  return (
    <article className="msg msg-ai">
      <div className="msg-ai-label">
        <span className="ai-mark" aria-hidden="true" />
        <span>{t.aiName}</span>
        <span className="ai-badge">AI</span>
      </div>

      {isEmergency ? (
        <div className="emergency-card" role="alert">
          <div className="emergency-head">
            <span className="emergency-icon">
              <Icon name="alert" size={20} strokeWidth={2.2} />
            </span>
            <strong>{t.emergencyBadge}</strong>
          </div>
          <div className="emergency-body">
            <Paragraphs text={displayContent} highlight999 />
          </div>
          {answer && <div className="emergency-sections">{sections}<Section title={t.dangerRedFlags} icon="alert" items={answer.seekCareWhen} tone="watch" /></div>}
          {mapButton}
        </div>
      ) : (
        <div className="ai-body">
          {answer && (
            <span className={`chip chip-${answer.urgency === 'emergency' ? 'high' : answer.urgency}`}>
              <Icon name={URGENCY_ICON[answer.urgency === 'emergency' ? 'high' : answer.urgency]} size={14} strokeWidth={2.2} />
              {t.urgencyLabel[answer.urgency]}
            </span>
          )}
          <div className="ai-summary">
            <Paragraphs text={displayContent} />
          </div>
          {sections}
          {answer && <Section title={t.dangerRedFlags} icon="alert" items={answer.seekCareWhen} tone="watch" />}
          {mapButton}
        </div>
      )}

      {message.sources && message.sources.length > 0 && (
        <div className="ai-sources">
          <span className="ai-sources-title">
            <Icon name="book" size={15} />
            {t.sourcesTitle}
          </span>
          <ul>
            {message.sources.map((source) => {
              const providerLabel = source.provider
                ? PROVIDER_LABELS[source.provider] ?? source.provider
                : null
              return (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.title}>
                    {providerLabel && <span className="ai-source-provider">{providerLabel}</span>}
                    <span className="ai-source-title">{source.title}</span>
                    <span className="ai-source-host">{safeHostname(source.url)}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {answer?.disclaimer && <p className="ai-disclaimer">{answer.disclaimer}</p>}

      {answer && (
        <div className="ai-actions">
          {onRegenerate && (
            <button
              type="button"
              className="ai-action-btn"
              onClick={onRegenerate}
              aria-label={t.regenerate}
            >
              <Icon name="refresh" size={15} />
              <span>{t.regenerate}</span>
            </button>
          )}
          <button type="button" className="ai-action-btn" onClick={handleCopy} aria-label={t.copyAnswer}>
            <Icon name="copy" size={15} />
            <span>{copied ? t.copied : t.copyAnswer}</span>
          </button>
          <button type="button" className="ai-action-btn" onClick={handleShare} aria-label={t.shareAnswer}>
            <Icon name="share" size={15} />
            <span>{t.shareAnswer}</span>
          </button>
        </div>
      )}
    </article>
  )
}
