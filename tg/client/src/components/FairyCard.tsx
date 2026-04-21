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
      <path d="M9 2 L2 2 L2 9" stroke="#FFB800" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="2" cy="2" r="1.5" fill="#FFB800" />
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

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(42,25,96,0.6), rgba(13,23,53,0.8))',
      border: `1px solid rgba(255,184,0,0.1)`,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
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
