export * from './colors'
import type { CSSProperties } from 'react'
import { colors } from './colors'

const headingFamily = "'Cinzel', 'Marcellus', 'Times New Roman', serif"
const bodyFamily = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif"

/** Единый стиль больших золотых цифр (балансы, суммы наград, главные значения).
 *  Тёмная многослойная обводка + золотое свечение → цифра читается на любом
 *  фоне (тёмный градиент classic / медовый пергамент fairy / яркие bg-картинки).
 *  Размер задаётся параметром, тени масштабируются автоматически. */
export function bigNumber(size: number): CSSProperties {
  const glow = Math.round(size * 0.65)
  return {
    color: colors.fairyGold,
    fontFamily: headingFamily,
    fontSize: `${size}px`,
    fontWeight: 700,
    letterSpacing: '0.02em',
    lineHeight: 1.05,
    fontVariantNumeric: 'tabular-nums' as const,
    textShadow: [
      `0 0 ${glow}px ${colors.fairyGold}50`,
      '0 2px 4px rgba(0,0,0,0.7)',
      '1px 0 0 rgba(0,0,0,0.55)',
      '-1px 0 0 rgba(0,0,0,0.55)',
      '0 1px 0 rgba(0,0,0,0.55)',
      '0 -1px 0 rgba(0,0,0,0.55)',
    ].join(', '),
  }
}

export const typography = {
  fontFamily: bodyFamily,
  headingFontFamily: headingFamily,

  // Заголовки — сказочный шрифт с засечками, повышенная высота строки и трекинг
  heading1: {
    fontFamily: headingFamily,
    fontSize: '26px',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '0.02em',
  },
  heading2: {
    fontFamily: headingFamily,
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '0.01em',
  },
  heading3: {
    fontFamily: headingFamily,
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: 1.4,
  },

  // Тело — системный sans, без изменений
  body: { fontFamily: bodyFamily, fontSize: '14px', fontWeight: 400, lineHeight: 1.5 },
  small: { fontFamily: bodyFamily, fontSize: '12px', fontWeight: 400, lineHeight: 1.4 },
  caption: { fontFamily: bodyFamily, fontSize: '11px', fontWeight: 400, lineHeight: 1.3 },
  mono: { fontFamily: 'monospace', fontSize: '13px' },

  // Цифры баланса/сумм — заголовочный шрифт, табличные цифры
  numeric: {
    fontFamily: headingFamily,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums' as const,
    letterSpacing: '0.02em',
  },
} as const

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',
} as const

export const radius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  round: '50%',
} as const
