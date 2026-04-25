import { useNavigate, useLocation } from 'react-router-dom'
import type { ComponentType } from 'react'
import { colors, spacing } from '@/theme'
import { HomeIcon, ScrollIcon, ChestIcon, ChartIcon, CrownIcon } from './icons'

interface IconProps {
  size?: number
  style?: React.CSSProperties
}

const TABS: Array<{ path: string; Icon: ComponentType<IconProps>; label: string }> = [
  { path: '/', Icon: HomeIcon, label: 'Главная' },
  { path: '/inbox', Icon: ScrollIcon, label: 'Грамоты' },
  { path: '/portfolio', Icon: ChestIcon, label: 'Казна' },
  { path: '/stats', Icon: ChartIcon, label: 'Успехи' },
  { path: '/leaderboard', Icon: CrownIcon, label: 'Рейтинг' },
]

export function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (pathname.startsWith('/ama/') || pathname.startsWith('/charter/') || pathname === '/registry') return null

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        background: `rgba(10, 8, 24, 0.96)`,
        borderTop: `1px solid ${colors.cardBorder}`,
        backdropFilter: 'blur(12px)',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map(({ path, Icon, label }) => {
        const isActive = path === '/'
          ? pathname === '/'
          : pathname.startsWith(path)

        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: `${spacing.sm} 0`,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? colors.fairyGold : colors.textMuted,
              transition: 'color 0.2s, transform 0.15s',
              transform: isActive ? 'translateY(-1px)' : 'none',
            }}
          >
            <Icon size={22} style={{
              filter: isActive ? `drop-shadow(0 0 6px ${colors.fairyGold}80)` : 'none',
              transition: 'filter 0.2s',
            }} />
            <span style={{
              fontSize: '10px',
              fontWeight: isActive ? 600 : 400,
              letterSpacing: '0.02em',
            }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
