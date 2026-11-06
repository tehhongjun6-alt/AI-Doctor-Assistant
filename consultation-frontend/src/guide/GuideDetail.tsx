import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Icon } from '../components/Icon'
import type { Language, Translation } from '../i18n'
import { GuideIcon } from './GuideIcon'
import { categoryLabel } from './guideLabels'
import type { GuideTopic } from './guideTypes'

interface GuideDetailProps {
  topic: GuideTopic
  lang: Language
  t: Translation
  onClose: () => void
  onAsk: (topic: GuideTopic) => void
}

export function GuideDetail({ topic, lang, t, onClose, onAsk }: GuideDetailProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = `guide-detail-title-${topic.id}`

  useEffect(() => {
    closeRef.current?.focus()
  }, [topic.id])

  // Esc 关闭；Tab 在对话框里循环
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !dialogRef.current) return
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button, a[href]')
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="guide-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <header className="guide-dialog-head">
          <GuideIcon id={topic.id} category={topic.category} size="detail" />
          <div className="guide-dialog-heading">
            <h2 id={titleId} className="guide-dialog-title">
              {topic.title[lang]}
            </h2>
            <span className="guide-tag" data-category={topic.category}>
              {categoryLabel(t, topic.category)}
            </span>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn guide-dialog-close"
            onClick={onClose}
            aria-label={t.guideClose}
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="guide-dialog-body">
          <section className="guide-block">
            <h3>{t.guideWhatIs}</h3>
            <p>{topic.summary[lang]}</p>
          </section>

          <section className="guide-block">
            <h3>{t.guideSymptoms}</h3>
            <ul>
              {topic.symptoms[lang].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="guide-block">
            <h3>{t.guideCare}</h3>
            <ul>
              {topic.care[lang].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="guide-block guide-urgent" aria-labelledby={`${titleId}-urgent`}>
            <h3 id={`${titleId}-urgent`}>
              <Icon name="alert" size={18} />
              {t.guideSeeDoctor}
            </h3>
            <ul>
              {topic.seeDoctor[lang].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="guide-block guide-meta">
            <h3>{t.guideSources}</h3>
            <ul className="guide-sources">
              {topic.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.name}
                  </a>
                </li>
              ))}
            </ul>
            <p className="guide-reviewed">
              {t.guideReviewed}
              {t.colon}
              <time dateTime={topic.reviewedAt}>{topic.reviewedAt}</time>
            </p>
          </section>

          <p className="guide-disclaimer">{t.guideDisclaimer}</p>
        </div>

        <footer className="guide-dialog-foot">
          <button type="button" className="guide-ask" onClick={() => onAsk(topic)}>
            <Icon name="chat" size={18} />
            {t.guideAsk}
          </button>
        </footer>
      </div>
    </div>
  )
}
