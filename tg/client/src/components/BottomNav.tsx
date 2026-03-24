import { useNavigate, useLocation } from 'react-router-dom'
import { colors, spacing } from '@/theme'

const TABS = [
  { path: '/', icon: '🏠', label: 'Главная' },
  { path: '/inbox', icon: '📜', label: 'Грамоты' },
  { path: '/portfolio', icon: '💰', label: 'Казна' },
  { path: '/stats', icon: '📊', label: 'Успехи' },
]

export function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // На экране беседы навигация не нужна — она перекрывает поле ввода
  if (pathname.startsWith('/ama/')) return null

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
      {TABS.map(tab => {
        const isActive = tab.path === '/'
          ? pathname === '/'
          : pathname.startsWith(tab.path)

        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              padding: `${spacing.sm} 0`,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? colors.fairyGold : colors.textMuted,
              transition: 'color 0.2s',
            }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: isActive ? 600 : 400 }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
