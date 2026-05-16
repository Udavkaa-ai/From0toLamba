import { ReactNode } from 'react'
import { colors, typography } from '@/theme'

/**
 * Подзаголовок страницы — кремовый текст с тёмной обводкой, читается
 * на любом bg-картинке (в т.ч. ярко-жёлтых осенних сценах). Раньше
 * подзаголовки рисовались textMuted полупрозрачно — на jpg-фоне сливались.
 */
export function PageSubtitle({ children }: { children: ReactNode }) {
  return (
    <div style={{
      color: '#F4E2B5',
      fontSize: '12px',
      marginTop: '4px',
      fontWeight: 600,
      letterSpacing: '0.02em',
      textShadow: '0 2px 6px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.5), 1px 0 0 rgba(0,0,0,0.55), -1px 0 0 rgba(0,0,0,0.55)',
    }}>
      {children}
    </div>
  )
}

/**
 * Заголовок страницы — Cinzel, золото, soft glow + декоративные ромбы по краям.
 * Унифицирует визуал шапок Inbox/Казна/Успехи/Рейтинг/Летопись.
 */
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{
      color: colors.fairyGold,
      fontFamily: typography.headingFontFamily,
      fontSize: '22px',
      fontWeight: 700,
      letterSpacing: '0.06em',
      // Многослойная тень: тёплое золотое сияние снаружи + тёмная stroke-обводка
      // в 4-х направлениях для читаемости на жёлтых/осенних bg-картинках.
      textShadow: [
        `0 0 18px ${colors.fairyGold}40`,
        '0 2px 6px rgba(0,0,0,0.7)',
        '1px 0 0 rgba(0,0,0,0.5)',
        '-1px 0 0 rgba(0,0,0,0.5)',
        '0 1px 0 rgba(0,0,0,0.5)',
        '0 -1px 0 rgba(0,0,0,0.5)',
      ].join(', '),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
    }}>
      <span style={{ opacity: 0.55, fontSize: '14px' }}>◆</span>
      <span>{children}</span>
      <span style={{ opacity: 0.55, fontSize: '14px' }}>◆</span>
    </div>
  )
}
