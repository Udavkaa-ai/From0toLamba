import { ReactNode, useEffect } from 'react'
import { SparklesOverlay } from './SparklesOverlay'
import { gradients, colors } from '@/theme'
import { getTheme } from '@/theme/colors'

export const APP_VERSION = 'бета 4.4.1'

/**
 * Один раз за модульную сессию: предзагрузить ВСЕ фоновые картинки активной
 * темы (12 шт: 7 HOME + 5 BG) + 7 аватарок хозяев (RelationshipsPage).
 * После этого браузер держит их в кэше — при переключении между вкладками
 * и заходе в Relations картинки отображаются мгновенно вместо «секунда
 * на загрузку из сети».
 *
 * Запускается лениво при первом импорте модуля (одна гонка с первым рендером
 * первой страницы). Объекты Image живут в этом массиве и не GC-ятся, чтобы
 * браузер точно сохранил их в кэше.
 */
const preloadedImages: HTMLImageElement[] = []
function preloadAllBackgrounds(): void {
  if (preloadedImages.length > 0) return
  const suffix = getTheme() === 'fairy' ? '_LIGHT' : ''
  const paths: string[] = [
    `/backgrounds/HOME_01${suffix}.webp`,
    `/backgrounds/HOME_02${suffix}.webp`,
    `/backgrounds/HOME_03${suffix}.webp`,
    `/backgrounds/HOME_04${suffix}.webp`,
    `/backgrounds/HOME_05${suffix}.webp`,
    `/backgrounds/HOME_06${suffix}.webp`,
    `/backgrounds/HOME_07${suffix}.webp`,
    `/backgrounds/BG_INBOX${suffix}.webp`,
    `/backgrounds/BG_PORTFOLIO${suffix}.webp`,
    `/backgrounds/BG_STATS${suffix}.webp`,
    `/backgrounds/BG_LEADERBOARD${suffix}.webp`,
    `/backgrounds/BG_REGISTRY${suffix}.webp`,
    `/avatars/buratino${suffix}.webp`,
    `/avatars/boyarin${suffix}.webp`,
    `/avatars/kolobok${suffix}.webp`,
    `/avatars/koschei${suffix}.webp`,
    `/avatars/zolushka${suffix}.webp`,
    `/avatars/baba_yaga${suffix}.webp`,
    `/avatars/ivan_durak${suffix}.webp`,
  ]
  for (const p of paths) {
    const img = new Image()
    img.src = p
    preloadedImages.push(img)
  }
}
// Запускаем сразу при импорте модуля — раньше первого рендера страницы.
if (typeof window !== 'undefined') preloadAllBackgrounds()

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
         намёк (0.18) поверх тёмного градиента; в fairy картинки видны,
         но не доминируют (0.5) — иначе золотые сцены с жёлтыми листьями
         перебивают парчмент-карточки и золотой текст. */}
      {bgImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundRepeat: 'no-repeat',
            opacity: getTheme() === 'fairy' ? 0.5 : 0.18,
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
