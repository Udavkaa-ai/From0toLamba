import { ReactNode } from 'react'
import { colors, typography } from '@/theme'

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
      // Двойная тень: тёплое золотое сияние + тёмная тень-стенка для читаемости
      // поверх ярких bg-картинок в Сказочной теме (Спасс на крови, ярмарка днём).
      textShadow: `0 0 18px ${colors.fairyGold}40, 0 2px 6px rgba(0,0,0,0.6), 0 0 4px rgba(0,0,0,0.5)`,
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
