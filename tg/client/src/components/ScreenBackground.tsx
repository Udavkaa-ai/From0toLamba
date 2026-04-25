import { ReactNode, useEffect } from 'react'
import { SparklesOverlay } from './SparklesOverlay'
import { gradients, colors } from '@/theme'

export const APP_VERSION = '2.4.1'

interface ScreenBackgroundProps {
  children: ReactNode
  showSparkles?: boolean
  /** Атмосферный туман — лёгкий движущийся слой. По умолчанию включён. */
  showMist?: boolean
}

export function ScreenBackground({ children, showSparkles = true, showMist = true }: ScreenBackgroundProps) {
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
        minHeight: '100dvh',
        background: `${gradients.screen}, ${colors.bgDeep}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
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
