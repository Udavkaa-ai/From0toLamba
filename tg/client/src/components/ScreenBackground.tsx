import { ReactNode, useEffect } from 'react'
import { SparklesOverlay } from './SparklesOverlay'
import { gradients, colors } from '@/theme'

export const APP_VERSION = 'бета 4.0.1'

interface ScreenBackgroundProps {
  children: ReactNode
  showSparkles?: boolean
  /** Атмосферный туман — лёгкий движущийся слой. По умолчанию включён. */
  showMist?: boolean
  /** URL фонового изображения (portrait 9:16). Если не задан — только градиент. */
  bgImage?: string
}

export function ScreenBackground({ children, showSparkles = true, showMist = true, bgImage }: ScreenBackgroundProps) {
  useEffect(() => {
    fetch('/api/version')
      .then(r => r.json())
      .then(({ version }: { version: string }) => {
        if (version !== APP_VERSION) {
          window.location.reload()
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div
      style={{
        minHeight: 'var(--app-vh, 100dvh)',
        background: `${gradients.screen}, ${colors.bgDeep}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Фоновое изображение страницы */}
      {bgImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundRepeat: 'no-repeat',
            opacity: 0.18,
            zIndex: 0,
          }}
          aria-hidden
        />
      )}
      {showMist && <div className="mist-layer" aria-hidden />}
      {showSparkles && <SparklesOverlay />}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {children}
      </div>
      <div style={{
        position: 'fixed',
        bottom: '6px',
        right: '10px',
        fontSize: '10px',
        color: 'rgba(255,255,255,0.18)',
        zIndex: 9999,
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        v{APP_VERSION}
      </div>
    </div>
  )
}

/** Фон главной страницы — меняется каждые 7 дней игры (7 вариантов). */
export function homeBackground(currentDay: number): string {
  const variant = (Math.floor(currentDay / 7) % 7) + 1
  return `/backgrounds/HOME_0${variant}.webp`
}

/** Статичные фоны для остальных страниц. */
export const PAGE_BG = {
  inbox:       '/backgrounds/BG_INBOX.webp',
  portfolio:   '/backgrounds/BG_PORTFOLIO.webp',
  stats:       '/backgrounds/BG_STATS.webp',
  leaderboard: '/backgrounds/BG_LEADERBOARD.webp',
  registry:    '/backgrounds/BG_REGISTRY.webp',
} as const
