import type { CSSProperties } from 'react'
import type { GuideCategory } from './guideTypes'

const ICON_URLS = import.meta.glob('./icons/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

interface GuideIconProps {
  id: string
  category: GuideCategory
  size?: 'card' | 'detail'
}

/** Health Icons（CC0）图标：用 mask-image 显示，颜色来自分类的 tokens 变量 */
export function GuideIcon({ id, category, size = 'card' }: GuideIconProps) {
  const url = ICON_URLS[`./icons/${id}.svg`]
  const glyph: CSSProperties = {
    maskImage: `url("${url}")`,
    WebkitMaskImage: `url("${url}")`,
    backgroundColor: `var(--guide-${category})`,
  }
  return (
    <span
      className={`guide-icon guide-icon--${size}`}
      style={{ backgroundColor: `var(--guide-${category}-bg)` }}
      aria-hidden="true"
    >
      <span className="guide-icon-glyph" style={glyph} />
    </span>
  )
}
