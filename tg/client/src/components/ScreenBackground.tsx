import { ReactNode, useEffect } from 'react'
import { SparklesOverlay } from './SparklesOverlay'
import { gradients, colors } from '@/theme'
import { getTheme } from '@/theme/colors'

export const APP_VERSION = 'бета 4.1.11'

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
      {/* Фоновое изображение страницы. Путь подбирается homeBackground()/
         PAGE_BG автоматически с суффиксом _LIGHT для Сказочной темы.
         Прозрачность тоже theme-aware: в classic картинки — атмосферный
         намёк (0.18) поверх тёмного градиента; в fairy картинки — главное
         блюдо (0.7), градиент над ними почти прозрачный. */}
      {bgImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundRepeat: 'no-repeat',
            opacity: getTheme() === 'fairy' ? 0.7 : 0.18,
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

/** Фон главной страницы — меняется каждые 7 дней игры (7 вариантов).
 *  В Сказочной теме используется параллельный набор файлов с суффиксом
 *  `_LIGHT` (солнечные ярмарочные сцены, см. tools/banners/backgrounds_light.json
 *  и generate_backgrounds_light.py). Если файла нет — ScreenBackground
 *  в fairy-теме сейчас вообще пропускает bgImage; светлые сгенерятся позже. */
export function homeBackground(currentDay: number): string {
  const variant = (Math.floor(currentDay / 7) % 7) + 1
  const suffix = getTheme() === 'fairy' ? '_LIGHT' : ''
  return `/backgrounds/HOME_0${variant}${suffix}.webp`
}

/** Статичные фоны для остальных страниц. В Сказочной теме — `_LIGHT`-вариант. */
function bgPath(name: string): string {
  const suffix = getTheme() === 'fairy' ? '_LIGHT' : ''
  return `/backgrounds/${name}${suffix}.webp`
}

export const PAGE_BG = {
  get inbox()       { return bgPath('BG_INBOX') },
  get portfolio()   { return bgPath('BG_PORTFOLIO') },
  get stats()       { return bgPath('BG_STATS') },
  get leaderboard() { return bgPath('BG_LEADERBOARD') },
  get registry()    { return bgPath('BG_REGISTRY') },
} as const
