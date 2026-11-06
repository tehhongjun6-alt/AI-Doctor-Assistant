import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import type { Language, Translation } from '../i18n'
import {
  requestVisitSummary,
  type CaseSummary,
} from '../services/visitSummaryService'

interface VisitSummaryDialogProps {
  conversationId: string
  lang: Language
  t: Translation
  isOpen: boolean
  onClose: () => void
}

function formatSummaryAsPlainText(
  summary: CaseSummary,
  t: Translation,
  generatedAt?: string
): string {
  const parts: string[] = []
  parts.push(`【${t.visitSummaryTitle}】`)
  parts.push(`（${t.visitSummaryDisclaimer}）\n`)

  if (summary.chiefComplaint?.trim()) {
    parts.push(`■ ${t.chiefComplaintTitle}\n${summary.chiefComplaint.trim()}\n`)
  }
  if (summary.duration?.trim()) {
    parts.push(`■ ${t.durationTitle}\n${summary.duration.trim()}\n`)
  }
  if (summary.symptoms && summary.symptoms.length > 0) {
    parts.push(`■ ${t.symptomsTitle}\n${summary.symptoms.map((s) => `- ${s}`).join('\n')}\n`)
  }
  if (summary.medications && summary.medications.length > 0) {
    parts.push(`■ ${t.medicationsTitle}\n${summary.medications.map((m) => `- ${m}`).join('\n')}\n`)
  }
  if (summary.allergies && summary.allergies.length > 0) {
    parts.push(`■ ${t.allergiesTitle}\n${summary.allergies.map((a) => `- ${a}`).join('\n')}\n`)
  }
  if (summary.relevantHistory && summary.relevantHistory.length > 0) {
    parts.push(`■ ${t.relevantHistoryTitle}\n${summary.relevantHistory.map((h) => `- ${h}`).join('\n')}\n`)
  }
  if (summary.aiAssessment && summary.aiAssessment.length > 0) {
    parts.push(`■ ${t.aiAssessmentTitle}\n${summary.aiAssessment.map((a) => `- ${a}`).join('\n')}\n`)
  }
  if (summary.redFlags && summary.redFlags.length > 0) {
    parts.push(`■ ${t.redFlagsTitle}\n${summary.redFlags.map((r) => `- ${r}`).join('\n')}\n`)
  }
  if (summary.questionsForDoctor && summary.questionsForDoctor.length > 0) {
    parts.push(`■ ${t.questionsForDoctorTitle}\n${summary.questionsForDoctor.map((q) => `- ${q}`).join('\n')}\n`)
  }
  if (generatedAt) {
    const d = new Date(generatedAt)
    const formatted = Number.isNaN(d.getTime()) ? generatedAt : d.toLocaleString()
    parts.push(`${t.generatedAtLabel}: ${formatted}`)
  }
  return parts.join('\n').trim()
}

export function VisitSummaryDialog({
  conversationId,
  lang,
  t,
  isOpen,
  onClose,
}: VisitSummaryDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [summary, setSummary] = useState<CaseSummary | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isOpen || !conversationId) return

    let cancelled = false
    setIsLoading(true)
    setError(null)
    setSummary(null)
    setGeneratedAt(null)

    requestVisitSummary(conversationId, lang)
      .then((res) => {
        if (cancelled) return
        if (res.ok && res.summary) {
          setSummary(res.summary)
          setGeneratedAt(res.generatedAt ?? new Date().toISOString())
        } else {
          setError(res.error?.message ?? t.summaryErrorNotice)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : t.summaryErrorNotice)
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [conversationId, isOpen, lang, t.summaryErrorNotice])

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  if (!isOpen) return null

  async function handleCopy() {
    if (!summary) return
    const text = formatSummaryAsPlainText(summary, t, generatedAt ?? undefined)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy summary to clipboard', err)
    }
  }

  function handlePrint() {
    window.print()
  }

  const hasContent =
    summary &&
    Boolean(
      summary.chiefComplaint?.trim() ||
        summary.duration?.trim() ||
        (summary.symptoms && summary.symptoms.length > 0) ||
        (summary.medications && summary.medications.length > 0) ||
        (summary.allergies && summary.allergies.length > 0) ||
        (summary.relevantHistory && summary.relevantHistory.length > 0) ||
        (summary.aiAssessment && summary.aiAssessment.length > 0) ||
        (summary.redFlags && summary.redFlags.length > 0) ||
        (summary.questionsForDoctor && summary.questionsForDoctor.length > 0)
    )

  return (
    <div
      className="visit-summary-overlay"
      role="presentation"
      onClick={() => {
        if (!isLoading) onClose()
      }}
    >
      <div
        className="visit-summary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="visit-summary-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="visit-summary-header visit-summary-no-print">
          <div className="visit-summary-title-wrap">
            <span className="visit-summary-icon">
              <Icon name="stethoscope" size={20} />
            </span>
            <h2 id="visit-summary-title" className="visit-summary-title">
              {t.visitSummaryTitle}
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn visit-summary-close"
            onClick={onClose}
            aria-label={t.closeSummary}
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="visit-summary-body visit-summary-print-area">
          {isLoading && (
            <div className="visit-summary-loading" role="status">
              <span className="spinner" aria-hidden="true" />
              <p>{t.loadingSummary}</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="visit-summary-error" role="alert">
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && summary && (
            <>
              <div className="visit-summary-print-header">
                <h2>{t.visitSummaryTitle}</h2>
              </div>

              <div className="visit-summary-disclaimer">
                <Icon name="info" size={16} />
                <span>{t.visitSummaryDisclaimer}</span>
              </div>

              {!hasContent ? (
                <p className="visit-summary-empty">{t.summaryEmptyNotice}</p>
              ) : (
                <div className="visit-summary-sections">
                  {summary.chiefComplaint?.trim() && (
                    <section className="visit-summary-section">
                      <h3>{t.chiefComplaintTitle}</h3>
                      <p>{summary.chiefComplaint.trim()}</p>
                    </section>
                  )}

                  {summary.duration?.trim() && (
                    <section className="visit-summary-section">
                      <h3>{t.durationTitle}</h3>
                      <p>{summary.duration.trim()}</p>
                    </section>
                  )}

                  {summary.symptoms && summary.symptoms.length > 0 && (
                    <section className="visit-summary-section">
                      <h3>{t.symptomsTitle}</h3>
                      <ul>
                        {summary.symptoms.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {summary.medications && summary.medications.length > 0 && (
                    <section className="visit-summary-section">
                      <h3>{t.medicationsTitle}</h3>
                      <ul>
                        {summary.medications.map((m, idx) => (
                          <li key={idx}>{m}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {summary.allergies && summary.allergies.length > 0 && (
                    <section className="visit-summary-section">
                      <h3>{t.allergiesTitle}</h3>
                      <ul>
                        {summary.allergies.map((a, idx) => (
                          <li key={idx}>{a}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {summary.relevantHistory && summary.relevantHistory.length > 0 && (
                    <section className="visit-summary-section">
                      <h3>{t.relevantHistoryTitle}</h3>
                      <ul>
                        {summary.relevantHistory.map((h, idx) => (
                          <li key={idx}>{h}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {summary.aiAssessment && summary.aiAssessment.length > 0 && (
                    <section className="visit-summary-section">
                      <h3>{t.aiAssessmentTitle}</h3>
                      <ul>
                        {summary.aiAssessment.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {summary.redFlags && summary.redFlags.length > 0 && (
                    <section className="visit-summary-section visit-summary-red-flags">
                      <h3>{t.redFlagsTitle}</h3>
                      <ul>
                        {summary.redFlags.map((flag, idx) => (
                          <li key={idx}>{flag}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {summary.questionsForDoctor && summary.questionsForDoctor.length > 0 && (
                    <section className="visit-summary-section">
                      <h3>{t.questionsForDoctorTitle}</h3>
                      <ul>
                        {summary.questionsForDoctor.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              )}

              {generatedAt && (
                <div className="visit-summary-meta">
                  <span>
                    {t.generatedAtLabel}:{' '}
                    {new Date(generatedAt).toLocaleString(
                      t.dateLocale
                    )}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="visit-summary-footer visit-summary-no-print">
          <div className="visit-summary-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={isLoading || !summary || !hasContent}
              onClick={handlePrint}
            >
              <Icon name="print" size={16} />
              <span>{t.printSummary}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={isLoading || !summary || !hasContent}
              onClick={() => void handleCopy()}
            >
              <Icon name={copied ? 'check' : 'copy'} size={16} />
              <span>{copied ? t.copiedSummary : t.copySummary}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onClose}
            >
              <span>{t.closeSummary}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
