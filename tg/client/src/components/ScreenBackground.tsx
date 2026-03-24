import { ReactNode } from 'react'
import { SparklesOverlay } from './SparklesOverlay'
import { gradients, colors } from '@/theme'

interface ScreenBackgroundProps {
  children: ReactNode
  showSparkles?: boolean
}

export function ScreenBackground({ children, showSparkles = true }: ScreenBackgroundProps) {
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
    </div>
  )
}
