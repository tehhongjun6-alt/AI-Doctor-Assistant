// Medora 线性图标：统一 24 网格、1.8 线宽、圆头圆角；全部内联，不引入图标依赖
import type { SVGProps } from 'react'

const paths = {
  chat: (
    <path d="M4 12.5c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5-3.6 7.5-8 7.5c-1.2 0-2.3-.2-3.3-.6L4.5 20.5l1.2-3.6C4.6 15.7 4 14.2 4 12.5Z" />
  ),
  map: (
    <>
      <path d="M9 4.5 3.8 6.6v13l5.2-2.1 6 2.1 5.2-2.1v-13L15 6.6l-6-2.1Z" />
      <path d="M9 4.5v13M15 6.6v13" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  locate: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3.5 4.5V9H8" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1 1 0 0 0 1 .8h7.2a1 1 0 0 0 1-.8L17.5 7" />
      <path d="M10.2 11v5.5M13.8 11v5.5" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  logout: (
    <>
      <path d="M14 4.5H6.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5H14" />
      <path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.3 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4.5M12 17.2v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.8v.1" />
    </>
  ),
  wifiOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.5 16.2a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4-2.3M14.8 10.4A10 10 0 0 1 19 12.6M2 9a15 15 0 0 1 4.3-2.7M10.5 5.6A15 15 0 0 1 22 9" />
      <path d="M12 19.5v.1" />
    </>
  ),
  phone: (
    <path d="M6.6 3.5h2.6l1.6 4.2-2 1.4a11 11 0 0 0 6.1 6.1l1.4-2 4.2 1.6v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
  ),
  navigate: <path d="M20.5 3.5 3.5 10.6l7 2.4 2.4 7 7.6-16.5Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M6 3.5v5a4.5 4.5 0 0 0 9 0v-5" />
      <path d="M10.5 13v1.5a5 5 0 0 0 10 0V13" />
      <circle cx="20.5" cy="11" r="2" />
    </>
  ),
  care: (
    <>
      <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" />
      <path d="M12 10.5v5M9.5 13h5" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.7v.3M12 16.8v.1" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 5.5A1.5 1.5 0 0 1 6 4h13.5v14H6a1.5 1.5 0 0 0-1.5 1.5v-14Z" />
      <path d="M4.5 19.5A1.5 1.5 0 0 0 6 21h13.5v-3" />
    </>
  ),
  hospital: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M12 7.5v6M9 10.5h6M9.5 20.5V17h5v3.5" />
    </>
  ),
  clinic: (
    <>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5.5 9v11h13V9" />
      <path d="M12 11.5v5M9.5 14h5" />
    </>
  ),
  pharmacy: (
    <>
      <rect x="3.5" y="9" width="17" height="6" rx="3" transform="rotate(-45 12 12)" />
      <path d="m9.9 9.9 4.2 4.2" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  external: (
    <>
      <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
      <path d="M17 13.5v5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </>
  ),
} as const

export type IconName = keyof typeof paths

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 20, strokeWidth = 1.8, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  )
}
