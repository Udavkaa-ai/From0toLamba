export * from './colors'

export const typography = {
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  heading1: { fontSize: '24px', fontWeight: 700, lineHeight: 1.2 },
  heading2: { fontSize: '18px', fontWeight: 600, lineHeight: 1.3 },
  heading3: { fontSize: '15px', fontWeight: 600, lineHeight: 1.4 },
  body: { fontSize: '14px', fontWeight: 400, lineHeight: 1.5 },
  small: { fontSize: '12px', fontWeight: 400, lineHeight: 1.4 },
  caption: { fontSize: '11px', fontWeight: 400, lineHeight: 1.3 },
  mono: { fontFamily: 'monospace', fontSize: '13px' },
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
