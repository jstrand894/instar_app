/** Small stroke icons (24px grid) that inherit the text color, used in place of emoji. */
const P = {
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  pen: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  task: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  quote: <path d="M9 7H6a2 2 0 0 0-2 2v3h4v5H4M20 7h-3a2 2 0 0 0-2 2v3h4v5h-4" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  partly: <><path d="M7 4v1.5M2.5 8.5H4M4 5.5l1 1M10.5 5.5l-1 1" /><circle cx="7" cy="9" r="2.6" /><path d="M8 20h9a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 13.6 3.2 3.2 0 0 0 8 20z" /></>,
  cloud: <path d="M7 19h10a4.5 4.5 0 0 0 .7-8.95A6 6 0 0 0 6.2 11.6 3.8 3.8 0 0 0 7 19z" />,
  fog: <path d="M5 9a5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 19 11M3 14h18M6 18h12" />,
  drizzle: <path d="M7 14h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 7.6 3.2 3.2 0 0 0 7 14zM9 17.5v1.5M13 17.5v1.5M17 17.5v1.5" />,
  rain: <path d="M7 14h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 7.6 3.2 3.2 0 0 0 7 14zM8 17l-1 3M12 17l-1 3M16 17l-1 3" />,
  snow: <path d="M12 2v20M4 7l16 10M20 7 4 17M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5" />,
  storm: <path d="M7 13h1a4 4 0 0 1-.8-7.9A5.5 5.5 0 0 1 17.6 6 4 4 0 0 1 17 13M12.5 11l-3 5h4l-2 5" />,
  wind: <path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 14h15a2.5 2.5 0 1 1-2.5 2.5M3 19h7" />,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  flame: <path d="M12 3c1 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2 1-3.2 2-4 0 1.8 1 2.5 2 2.5C10.5 9 11 6 12 3z" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  grip: <path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" strokeWidth="3" />,
  chevDown: <path d="m6 9 6 6 6-6" />,
  chevRight: <path d="m9 6 6 6-6 6" />,
  git: <><circle cx="6" cy="5" r="2.2" /><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="8" r="2.2" /><path d="M6 7.2v9.6M18 10.2c0 4-6 3-11 7.2" /></>,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  link: <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />,
  tree: <path d="M12 2.5 6.5 9.5h3L5 15.5h5.5V21h3v-5.5H19l-4.5-6h3z" />,
  mapPin: <><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></>,
  bug: <><path d="M8 8a4 4 0 0 1 8 0v7a4 4 0 0 1-8 0z" /><path d="M12 8v11M8 11H4M8 15H5M16 11h4M16 15h3M9.5 4.2 8 2.5M14.5 4.2 16 2.5" /></>,
  trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8.5 20h7" /></>,
  gift: <><rect x="3" y="9" width="18" height="12" rx="1.5" /><path d="M3 13h18M12 9v12M12 9C9.5 9 8 8 8 6.5S9.5 4 12 9zM12 9c2.5 0 4-1 4-2.5S14.5 4 12 9z" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
} as const

export type IconName = keyof typeof P

export default function Icon({ name, size = 16, filled = false, className }: { name: IconName; size?: number; filled?: boolean; className?: string }) {
  return (
    <svg className={`icon ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">{P[name]}</svg>
  )
}
