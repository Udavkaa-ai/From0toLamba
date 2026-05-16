import { ReactNode, CSSProperties } from 'react'
import { colors, gradients, radius, spacing } from '@/theme'

interface FairyCardProps {
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
  padding?: string
  /** Тонкая золотая верхняя линия (типографский акцент) — для важных карточек. По умолчанию off. */
  accent?: boolean
  /** Подсветить — для активного/выделенного состояния. */
  highlighted?: boolean
}

/**
 * Премиальная карточка: многослойный градиент (тёплый purple → plum → dark navy),
 * двойная inset-обводка (стеклянный hairline сверху + глубокая тень снизу),
 * почти невидимая золотая граница. Без stock-fantasy уголков.
 */
export function FairyCard({
  children,
  style,
  onClick,
  padding = '18px 20px',
  accent = false,
  highlighted = false,
}: FairyCardProps) {
  const borderColor = highlighted ? colors.cardBorderBright : colors.cardBorder

  return (
    <div
      onClick={onClick}
      style={{
        background: gradients.card,
        border: `${colors.cardBorderWidth} solid ${borderColor}`,
        borderRadius: colors.cardRadius,
        padding,
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: [
          '0 6px 24px rgba(0, 0, 0, 0.45)',
          `inset 0 1px 0 ${colors.cardHighlight}`,
          `inset 0 -1px 0 ${colors.cardShade}`,
          highlighted ? `0 0 24px ${colors.fairyGold}30` : '',
        ].filter(Boolean).join(', '),
        transition: 'box-shadow 0.2s, transform 0.15s, border-color 0.2s',
        ...style,
      }}
    >
      {accent && <AccentLine />}
      {children}
    </div>
  )
}

/** Тонкая золотая линия сверху, fade по краям — типографский элемент вместо уголков */
function AccentLine() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: '12%',
        right: '12%',
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${colors.fairyGold}80, transparent)`,
        pointerEvents: 'none',
      }}
    />
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{
      background: gradients.card,
      border: `${colors.cardBorderWidth} solid ${colors.cardBorder}`,
      borderRadius: colors.cardRadius,
      padding: '18px 20px',
      marginBottom: spacing.md,
      boxShadow: `0 6px 24px rgba(0,0,0,0.45), inset 0 1px 0 ${colors.cardHighlight}`,
    }}>
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} style={{
          height: '12px',
          width: i === 0 ? '70%' : i === lines - 1 ? '90%' : '50%',
          borderRadius: '6px',
          marginBottom: i < lines - 1 ? '10px' : 0,
          background: 'linear-gradient(90deg,rgba(26,16,64,0.8) 25%,rgba(42,25,96,0.9) 50%,rgba(26,16,64,0.8) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s infinite',
        }} />
      ))}
    </div>
  )
}

/** Золотой разделитель с ромбом — типографский акцент, оставлен как был */
export function OrnamentDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0' }}>
      <div style={{ flex: 1, height: '1px', background: `${colors.fairyGold}40` }} />
      <div
        style={{
          width: '6px',
          height: '6px',
          background: colors.fairyGold,
          transform: 'rotate(45deg)',
          opacity: 0.6,
        }}
      />
      <div style={{ flex: 1, height: '1px', background: `${colors.fairyGold}40` }} />
    </div>
  )
}
