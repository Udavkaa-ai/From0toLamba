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
      fontWeight: 600,
      letterSpacing: '0.06em',
      textShadow: `0 0 18px ${colors.fairyGold}40`,
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
