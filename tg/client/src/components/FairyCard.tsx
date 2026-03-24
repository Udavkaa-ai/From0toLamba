import { ReactNode, CSSProperties } from 'react'
import { colors, gradients, radius, spacing } from '@/theme'

interface FairyCardProps {
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
  padding?: string
  ornaments?: boolean
}

export function FairyCard({ children, style, onClick, padding = spacing.lg, ornaments = true }: FairyCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: gradients.card,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: radius.lg,
        padding,
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {ornaments && <CardCornerOrnaments />}
      {children}
    </div>
  )
}

function CardCornerOrnaments() {
  const style: CSSProperties = {
    position: 'absolute',
    width: '16px',
    height: '16px',
    opacity: 0.5,
  }

  const corner = (top?: number | string, right?: number | string, bottom?: number | string, left?: number | string, rotate?: string) => ({
    ...style,
    top,
    right,
    bottom,
    left,
    transform: rotate ? `rotate(${rotate})` : undefined,
  })

  const Ornament = ({ pos }: { pos: CSSProperties }) => (
    <svg style={pos} viewBox="0 0 16 16" fill="none">
      <path d="M1 8 L8 1 L15 8" stroke="#FFB800" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="8" r="1.5" fill="#FFB800" />
    </svg>
  )

  return (
    <>
      <Ornament pos={corner(6, undefined, undefined, 6)} />
      <Ornament pos={corner(6, 6, undefined, undefined, '90deg')} />
      <Ornament pos={corner(undefined, undefined, 6, 6, '270deg')} />
      <Ornament pos={corner(undefined, 6, 6, undefined, '180deg')} />
    </>
  )
}

// Золотой разделитель с ромбом
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
