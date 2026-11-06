// 官方 Medora Logo（来自品牌提供的原图，只裁掉了下方色板和多余白边，未缩放变形）
// 图片自带 "Medora" 字样，所以 alt 写品牌名即可，页面上不要再重复写 Medora
import logoUrl from '../assets/medora-logo.png'

const LOGO_RATIO = 310 / 97

export function Logo({ height = 28, className }: { height?: number; className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="Medora"
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      className={`medora-logo ${className ?? ''}`}
      draggable={false}
    />
  )
}
