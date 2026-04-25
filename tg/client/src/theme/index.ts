export * from './colors'

const headingFamily = "'Cinzel', 'Marcellus', 'Times New Roman', serif"
const bodyFamily = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif"

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
