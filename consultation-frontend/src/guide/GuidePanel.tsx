import { useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { translations, type Language } from '../i18n'
import { GuideDetail } from './GuideDetail'
import { GuideIcon } from './GuideIcon'
import { categoryLabel, GUIDE_CATEGORIES } from './guideLabels'
import { GUIDE_TOPICS } from './guideTopics'
import type { GuideCategory, GuideTopic } from './guideTypes'
import './guide.css'

interface GuidePanelProps {
  lang: Language
  onOpenMenu: () => void
  onAsk: (topic: GuideTopic) => void
}

export default function GuidePanel({ lang, onOpenMenu, onAsk }: GuidePanelProps) {
  const t = translations[lang]
  const [filter, setFilter] = useState<GuideCategory | 'all'>('all')
  const [openId, setOpenId] = useState<string>()
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())

  const topics = filter === 'all' ? GUIDE_TOPICS : GUIDE_TOPICS.filter((topic) => topic.category === filter)
  const openTopic = GUIDE_TOPICS.find((topic) => topic.id === openId)

  // 关闭详情后，焦点回到原来那张卡片
  function closeDetail() {
    const id = openId
    setOpenId(undefined)
    if (id) cardRefs.current.get(id)?.focus()
  }

  const filters: { id: GuideCategory | 'all'; label: string }[] = [
    { id: 'all', label: t.guideAll },
    ...GUIDE_CATEGORIES.map((c) => ({ id: c, label: categoryLabel(t, c) })),
  ]

  return (
    <section className="guide-view" aria-labelledby="guide-title">
      <header className="guide-toolbar">
        <button type="button" className="icon-btn ws-menu-btn" onClick={onOpenMenu} aria-label={t.openMenu}>
          <Icon name="menu" size={22} />
        </button>
        <h1 id="guide-title" className="guide-title">
          {t.guideTitle}
        </h1>
      </header>

      <div className="guide-scroll">
        <div className="guide-inner">
          <p className="guide-intro">{t.guideIntro}</p>

          <div className="guide-filters" role="group" aria-label={t.guideTitle}>
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                className="guide-filter"
                data-category={f.id}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <ul className="guide-grid">
            {topics.map((topic) => (
              <li key={topic.id}>
                <button
                  type="button"
                  className="guide-card"
                  ref={(el) => {
                    if (el) cardRefs.current.set(topic.id, el)
                    else cardRefs.current.delete(topic.id)
                  }}
                  onClick={() => setOpenId(topic.id)}
                >
                  <GuideIcon id={topic.id} category={topic.category} />
                  <span className="guide-card-title">{topic.title[lang]}</span>
                  <span className="guide-tag" data-category={topic.category}>
                    {categoryLabel(t, topic.category)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <p className="guide-disclaimer guide-page-disclaimer">{t.guideDisclaimer}</p>
        </div>
      </div>

      {openTopic && <GuideDetail topic={openTopic} lang={lang} t={t} onClose={closeDetail} onAsk={onAsk} />}
    </section>
  )
}
