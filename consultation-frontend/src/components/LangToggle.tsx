import type { Language } from '../i18n'

export function LangToggle({
  lang,
  onChange,
  className,
}: {
  lang: Language
  onChange: (lang: Language) => void
  className?: string
}) {
  return (
    <div className={`lang-toggle ${className ?? ''}`} role="group" aria-label="Language / 语言">
      <button type="button" aria-pressed={lang === 'zh'} onClick={() => onChange('zh')}>
        中文
      </button>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => onChange('en')}>
        EN
      </button>
    </div>
  )
}
