import { useNavigate, useLocation } from 'react-router-dom'
import type { ComponentType } from 'react'
import { colors, spacing } from '@/theme'
import { HomeIcon, ScrollIcon, ChestIcon, ChartIcon, FlameIcon } from './icons'
import { useT } from '@/i18n'

interface IconProps {
  size?: number
  style?: React.CSSProperties
}

// Последняя вкладка — «Сегодня» (стрики + ежедневная награда + рейтинг по
// богатству внизу). Заменила собой бывшую вкладку «Рейтинг».
const TAB_PATHS = ['/', '/inbox', '/portfolio', '/stats', '/today'] as const
const TAB_ICONS: ComponentType<IconProps>[] = [HomeIcon, ScrollIcon, ChestIcon, ChartIcon, FlameIcon]

export function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const t = useT()

  const tabLabels = [t.nav.home, t.nav.inbox, t.nav.portfolio, t.nav.stats, 'Сегодня']

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
      {TAB_PATHS.map((path, idx) => {
        const Icon = TAB_ICONS[idx]
        const label = tabLabels[idx]
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
