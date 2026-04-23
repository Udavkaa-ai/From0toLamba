import { ReactNode, useEffect } from 'react'
import { SparklesOverlay } from './SparklesOverlay'
import { gradients, colors } from '@/theme'

const APP_VERSION = '1.5.1'

interface ScreenBackgroundProps {
  children: ReactNode
  showSparkles?: boolean
}

export function ScreenBackground({ children, showSparkles = true }: ScreenBackgroundProps) {
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
      {showSparkles && <SparklesOverlay />}
      <div style={{ position: 'relative', zIndex: 1 }}>
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

