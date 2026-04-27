// Купеческие SVG-иконки. Все наследуют цвет от родителя через `currentColor`.
// API: <CoinIcon size={20} />. Размер по умолчанию 20.
// Стиль: тонкая обводка, без заливки — гравюра/чеканка.
//
// Используем strokeLinecap/Linejoin "round" для тёплого, рукописного силуэта.

interface IconProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

const baseProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

/** Изба-сруб с трубой и дымом — Главная */
export function HomeIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} style={style}>
      <path d="M3 11 L12 4 L21 11" />
      <path d="M5 10.5 V20 H19 V10.5" />
      <path d="M10 20 V14 H14 V20" />
      <path d="M16 5.5 V8" />
    </svg>
  )
}

/** Свиток с верёвочкой — Грамоты */
export function ScrollIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} style={style}>
      <path d="M5 5 H17 a2 2 0 0 1 2 2 V17 a2 2 0 0 0 2 2 H7 a2 2 0 0 1 -2 -2 Z" />
      <path d="M5 5 a2 2 0 0 0 -2 2 a2 2 0 0 0 2 2" />
      <path d="M9 10 H15" />
      <path d="M9 14 H15" />
    </svg>
  )
}

/** Монета — Казна / суммы */
export function CoinIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} style={style}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6.5" />
      <path d="M10 8 V16 M10 8 H13.2 a2.4 2.4 0 0 1 0 4.8 H10 M8.5 13.6 H13.5" />
    </svg>
  )
}

/** Столбчатая диаграмма — Успехи */
export function ChartIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} style={style}>
      <path d="M3 21 H21" />
      <rect x="5" y="13" width="3.5" height="6" />
      <rect x="10.25" y="9" width="3.5" height="10" />
      <rect x="15.5" y="5" width="3.5" height="14" />
    </svg>
  )
}

/** Купеческая шапка с лентой — Рейтинг / Чины */
export function CrownIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} style={style}>
      <path d="M3 9 L7 14 L12 6 L17 14 L21 9 V17 H3 Z" />
      <path d="M3 17 H21" />
      <circle cx="7" cy="9" r="0.9" fill="currentColor" />
      <circle cx="12" cy="6" r="0.9" fill="currentColor" />
      <circle cx="17" cy="9" r="0.9" fill="currentColor" />
    </svg>
  )
}

/** Замо́к — заблокированный вывод */
export function LockIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} style={style}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11 V8 a4 4 0 0 1 8 0 V11" />
      <circle cx="12" cy="15" r="1.2" />
      <path d="M12 16 V18" />
    </svg>
  )
}

/** Свеча с пламенем — атмосфера / огонь */
export function FlameIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} style={style}>
      <path d="M12 3 C13.5 6 16 7.5 16 11.5 a4 4 0 0 1 -8 0 C8 9 9.5 8 10 6.5 C10.5 8 11 8.5 12 9 C12 7 11.5 5 12 3 Z" />
      <path d="M9 19 H15" />
      <path d="M10 19 V21 M14 19 V21" />
    </svg>
  )
}

/** Око — Чуйка / интуиция */
export function EyeIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} style={style}>
      <path d="M2 12 C5 7 8 5 12 5 C16 5 19 7 22 12 C19 17 16 19 12 19 C8 19 5 17 2 12 Z" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}

/** Сундук — портфель/казна (альтернативный) */
export function ChestIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} style={style}>
      <rect x="3" y="9" width="18" height="11" rx="1" />
      <path d="M3 9 a3 3 0 0 1 3 -3 H18 a3 3 0 0 1 3 3" />
      <path d="M3 13 H21" />
      <rect x="10.5" y="11.5" width="3" height="3.5" />
    </svg>
  )
}

/** Театральная маска — болтовня с дельцом */
export function MaskIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} style={style}>
      <path d="M4 6 C4 4 6 3 12 3 C18 3 20 4 20 6 V13 C20 17 16 21 12 21 C8 21 4 17 4 13 Z" />
      <circle cx="9" cy="11" r="1" fill="currentColor" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
      <path d="M9 16 C10 17 14 17 15 16" />
    </svg>
  )
}

/** Объявление-афиша — заглушка рекламы */
export function AnnouncementIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} style={style}>
      <path d="M3 9 V15 a1 1 0 0 0 1 1 H6 L13 20 V4 L6 8 H4 a1 1 0 0 0 -1 1 Z" />
      <path d="M16 9 a3 3 0 0 1 0 6" />
      <path d="M19 7 a6 6 0 0 1 0 10" />
    </svg>
  )
}

/** Календарь / летописная страница — даты */
export function CalendarIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} style={style}>
      <rect x="3" y="5" width="18" height="16" rx="1.5" />
      <path d="M3 10 H21" />
      <path d="M8 3 V7 M16 3 V7" />
      <circle cx="12" cy="15" r="0.9" fill="currentColor" />
    </svg>
  )
}

/** Стрелка вниз с чертой — Довложить (быстрое действие) */
export function PlusCoinIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} style={style}>
      <circle cx="10" cy="13" r="7" />
      <path d="M10 10 V16 M7 13 H13" />
      <path d="M16 8 H22 M19 5 V11" />
    </svg>
  )
}
