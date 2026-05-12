import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Application, Container, Graphics, Text, Ticker } from 'pixi.js'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const REFERENCE_SECONDS = 5
const PLAY_SECONDS = 20

// Лесенка результата по числу пойманных НАСТОЯЩИХ монет:
//   ≥ 10 — идеальная игра (совет чуйки)
//   ≥ 6  — победа (посул + тип, без совета)
//   < 6  — поражение (только за звёзды)
const TARGET_OK = 6
const TARGET_PERFECT = 10

const COIN_SIZE = 60
const COIN_HIT_RADIUS = COIN_SIZE  // ~ вдвое шире самой монеты — толстым пальцам легче
const COIN_FALL_SPEED = 110        // px / sec (медленнее: было 160)
const SPAWN_INTERVAL_SEC = 0.75    // спавн пореже — соответствует более медленному падению
const FAKE_PROBABILITY = 0.5
const ROTATION_PERIOD_SEC = 2.2    // полный оборот (видна обе стороны)

interface ZolushkaGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
}

type Motif = 'sun' | 'star' | 'cross' | 'leaf' | 'fraction' | 'moon' | 'gear'

interface CoinType {
  /** Цвета: рим, тень, база, светлая, блик */
  rim: number
  shade: number
  base: number
  lite: number
  hi: number
  /** Аверс (номинал) */
  label: string         // крупная цифра
  caption: string       // мелкая подпись под числом
  frontMotif: Motif     // маленький мотив справа от числа
  /** Реверс (символ) */
  backMotif: Motif      // крупный мотив, занимающий ~всю монету
}

// ── Палитры цветов и пул кандидатов для «настоящей» монеты ────────────────
// Каждый запуск seed выбирает одну из этих монет как эталон.

interface CoinPalette { rim: number; shade: number; base: number; lite: number; hi: number; name: string }
const GOLD: CoinPalette   = { rim: 0x6B4A00, shade: 0xB07A10, base: 0xE8A800, lite: 0xFFC838, hi: 0xFFE490, name: 'gold'   }
const SILVER: CoinPalette = { rim: 0x4A4A55, shade: 0x7A7A85, base: 0xB0B0BB, lite: 0xD0D0D8, hi: 0xEFEFF5, name: 'silver' }
const COPPER: CoinPalette = { rim: 0x4A2A05, shade: 0x8C5A20, base: 0xC97A30, lite: 0xE9A050, hi: 0xF5C880, name: 'copper' }
const BRASS: CoinPalette  = { rim: 0x5A4A10, shade: 0x8C7A20, base: 0xC9B040, lite: 0xE9D080, hi: 0xF8E9B0, name: 'brass'  }

interface CoinTemplate {
  palette: CoinPalette
  label: string
  caption: string
  frontMotif: Motif
  backMotif: Motif
}

const REAL_TEMPLATES: CoinTemplate[] = [
  { palette: GOLD,   label: '1', caption: 'золотой',  frontMotif: 'sun',      backMotif: 'sun'      },
  { palette: GOLD,   label: '3', caption: 'червонца', frontMotif: 'star',     backMotif: 'star'     },
  { palette: SILVER, label: '2', caption: 'рубля',    frontMotif: 'cross',    backMotif: 'leaf'     },
  { palette: COPPER, label: '5', caption: 'медяков',  frontMotif: 'cross',    backMotif: 'cross'    },
  { palette: BRASS,  label: '7', caption: 'алтын',    frontMotif: 'leaf',     backMotif: 'sun'      },
  { palette: SILVER, label: '½', caption: 'полушка',  frontMotif: 'fraction', backMotif: 'fraction' },
]

function toCoinType(t: CoinTemplate): CoinType {
  return {
    rim: t.palette.rim, shade: t.palette.shade, base: t.palette.base, lite: t.palette.lite, hi: t.palette.hi,
    label: t.label, caption: t.caption,
    frontMotif: t.frontMotif, backMotif: t.backMotif,
  }
}

const ALL_MOTIFS: Motif[] = ['sun', 'star', 'cross', 'leaf', 'fraction', 'moon', 'gear']
const ALL_LABELS = ['1', '2', '3', '5', '7', '½']
const ALL_CAPTIONS = ['золотой', 'червонца', 'рубля', 'медяков', 'алтын', 'полушка', 'денга', 'грош']

function pickOther<T>(arr: readonly T[], exclude: T, rng: () => number): T {
  const others = arr.filter(x => x !== exclude)
  return others[Math.floor(rng() * others.length)]
}

/** Готовит набор подделок исходя из «настоящей» монеты:
 *  - 2 очевидных (другой цвет, номинал и мотив)
 *  - 1 хитрая: тот же цвет + тот же реверс, но другая цифра/подпись на аверсе
 *  - 1 хитрая: тот же цвет + тот же аверс, но другой реверс */
function buildFakes(real: CoinTemplate, rng: () => number): CoinType[] {
  const otherPalettes: CoinPalette[] = [GOLD, SILVER, COPPER, BRASS].filter(p => p.name !== real.palette.name)
  const fakes: CoinType[] = []

  // 2 очевидных — другие палитры
  const shuffled = otherPalettes.slice()
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  for (let i = 0; i < 2 && i < shuffled.length; i++) {
    fakes.push({
      rim: shuffled[i].rim, shade: shuffled[i].shade, base: shuffled[i].base, lite: shuffled[i].lite, hi: shuffled[i].hi,
      label: pickOther(ALL_LABELS, real.label, rng),
      caption: pickOther(ALL_CAPTIONS, real.caption, rng),
      frontMotif: pickOther(ALL_MOTIFS, real.frontMotif, rng),
      backMotif: pickOther(ALL_MOTIFS, real.backMotif, rng),
    })
  }

  // Хитрая 1: реверс совпадает с настоящей, аверс другой
  fakes.push({
    rim: real.palette.rim, shade: real.palette.shade, base: real.palette.base, lite: real.palette.lite, hi: real.palette.hi,
    label: pickOther(ALL_LABELS, real.label, rng),
    caption: pickOther(ALL_CAPTIONS, real.caption, rng),
    frontMotif: pickOther(ALL_MOTIFS, real.frontMotif, rng),
    backMotif: real.backMotif,
  })

  // Хитрая 2: аверс совпадает с настоящей, реверс другой
  fakes.push({
    rim: real.palette.rim, shade: real.palette.shade, base: real.palette.base, lite: real.palette.lite, hi: real.palette.hi,
    label: real.label,
    caption: real.caption,
    frontMotif: real.frontMotif,
    backMotif: pickOther(ALL_MOTIFS, real.backMotif, rng),
  })

  return fakes
}

// ── Базовая шейдинг-подложка монеты ────────────────────────────────────────
function drawCoinShading(g: Graphics, c: CoinType, radius: number) {
  g.circle(0, 0, radius + 1).fill(c.rim)
  g.circle(0, 0, radius).fill(c.shade)
  g.circle(radius * 0.08, radius * 0.08, radius * 0.92).fill(c.base)
  g.circle(-radius * 0.05, -radius * 0.05, radius * 0.82).fill(c.base)
  g.circle(-radius * 0.18, -radius * 0.18, radius * 0.58).fill(c.lite)
  g.circle(-radius * 0.32, -radius * 0.32, radius * 0.28).fill(c.hi)
  g.circle(-radius * 0.4, -radius * 0.4, radius * 0.08).fill(0xFFFAEC)
  g.circle(0, 0, radius * 0.82).stroke({ width: 2, color: c.rim, alpha: 0.6 })
}

function drawMotif(g: Graphics, motif: Motif, r: number, color: number, scale = 1) {
  const sR = r * scale
  if (motif === 'sun') {
    const rays = 12
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2
      const x1 = Math.cos(a) * sR * 0.55
      const y1 = Math.sin(a) * sR * 0.55
      const x2 = Math.cos(a) * sR * 0.78
      const y2 = Math.sin(a) * sR * 0.78
      g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 2.5, color, alpha: 0.85 })
    }
    g.circle(0, 0, sR * 0.36).fill({ color, alpha: 0.6 })
  } else if (motif === 'star') {
    const pts: number[] = []
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2
      const rad = i % 2 === 0 ? sR * 0.62 : sR * 0.32
      pts.push(Math.cos(a) * rad, Math.sin(a) * rad)
    }
    g.poly(pts).fill({ color, alpha: 0.7 })
  } else if (motif === 'cross') {
    g.rect(-sR * 0.08, -sR * 0.62, sR * 0.16, sR * 1.24).fill({ color, alpha: 0.75 })
    g.rect(-sR * 0.62, -sR * 0.08, sR * 1.24, sR * 0.16).fill({ color, alpha: 0.75 })
  } else if (motif === 'leaf') {
    g.poly([0, -sR * 0.65, sR * 0.18, -sR * 0.3, 0, 0, -sR * 0.18, -sR * 0.3])
      .fill({ color, alpha: 0.7 })
    g.poly([0, 0, sR * 0.18, sR * 0.3, 0, sR * 0.65, -sR * 0.18, sR * 0.3])
      .fill({ color, alpha: 0.7 })
  } else if (motif === 'fraction') {
    g.rect(-sR * 0.45, -sR * 0.06, sR * 0.9, sR * 0.12).fill({ color, alpha: 0.8 })
  } else if (motif === 'moon') {
    g.circle(0, 0, sR * 0.6).fill({ color, alpha: 0.8 })
    g.circle(sR * 0.22, -sR * 0.05, sR * 0.55).fill(0xFFFAEC)
  } else if (motif === 'gear') {
    const teeth = 8
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2
      const cx = Math.cos(a) * sR * 0.6
      const cy = Math.sin(a) * sR * 0.6
      g.circle(cx, cy, sR * 0.15).fill({ color, alpha: 0.8 })
    }
    g.circle(0, 0, sR * 0.4).fill({ color, alpha: 0.8 })
    g.circle(0, 0, sR * 0.18).fill(0xFFFAEC)
  }
}

// ── Текстовые подписи (Pixi Text) ─────────────────────────────────────────
function makeLabelText(label: string, radius: number, color: number): Text {
  const t = new Text({
    text: label,
    style: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: radius * 0.85,
      fill: color,
      fontWeight: '700',
      align: 'center',
    },
  })
  t.anchor.set(0.5)
  return t
}

function makeCaptionText(caption: string, radius: number, color: number): Text {
  const t = new Text({
    text: caption,
    style: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: radius * 0.26,
      fill: color,
      fontWeight: '600',
      letterSpacing: 0.5,
      align: 'center',
    },
  })
  t.anchor.set(0.5)
  return t
}

// ── Сборка front/back контейнеров ─────────────────────────────────────────
function buildFrontFace(c: CoinType, radius: number): Container {
  const container = new Container()
  const g = new Graphics()
  drawCoinShading(g, c, radius)
  // Маленький мотив над цифрой
  const motifG = new Graphics()
  drawMotif(motifG, c.frontMotif, radius * 0.35, c.rim)
  motifG.y = -radius * 0.45
  container.addChild(g)
  container.addChild(motifG)
  // Большая цифра
  const label = makeLabelText(c.label, radius, c.rim)
  label.y = radius * 0.05
  container.addChild(label)
  // Подпись
  const cap = makeCaptionText(c.caption, radius, c.rim)
  cap.y = radius * 0.55
  container.addChild(cap)
  return container
}

function buildBackFace(c: CoinType, radius: number): Container {
  const container = new Container()
  const g = new Graphics()
  drawCoinShading(g, c, radius)
  const motifG = new Graphics()
  drawMotif(motifG, c.backMotif, radius * 0.75, c.rim)
  container.addChild(g)
  container.addChild(motifG)
  return container
}

interface CoinSprite {
  id: number
  type: CoinType
  isReal: boolean
  x: number
  y: number
  spawnTime: number
  container: Container
  frontFace: Container
  backFace: Container
  removed: boolean
}

interface FloatLabel {
  id: number
  x: number
  y: number
  value: string
  color: string
}

export function ZolushkaGame({ seed, onComplete }: ZolushkaGameProps) {
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(false)
  const rngRef = useRef(rngFromSeed(seed))
  // Эталонная монета и набор подделок — детерминированы из seed.
  // Каждая игра — новый эталон.
  const realTemplateRef = useRef<CoinTemplate>(REAL_TEMPLATES[Math.floor(rngRef.current() * REAL_TEMPLATES.length)])
  const realCoinRef = useRef<CoinType>(toCoinType(realTemplateRef.current))
  const fakeCoinsRef = useRef<CoinType[]>(buildFakes(realTemplateRef.current, rngRef.current))
  const coinsRef = useRef<CoinSprite[]>([])
  const lastSpawnRef = useRef<number>(0)
  const scoreRef = useRef(0)
  const tickerCbRef = useRef<((ticker: Ticker) => void) | null>(null)
  const coinIdRef = useRef(0)
  const floatIdRef = useRef(0)

  const [phase, setPhase] = useState<'reference' | 'play'>('reference')
  const [refCountdown, setRefCountdown] = useState(REFERENCE_SECONDS)
  const [playCountdown, setPlayCountdown] = useState(PLAY_SECONDS)
  const [score, setScore] = useState(0)
  const [floats, setFloats] = useState<FloatLabel[]>([])
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  const phaseRef = useRef<'reference' | 'play'>('reference')
  useEffect(() => { phaseRef.current = phase }, [phase])

  const errorCountForScore = (s: number): number => {
    if (s >= TARGET_PERFECT) return 0
    if (s >= TARGET_OK) return 1
    return 2
  }

  const complete = (finalScore: number) => {
    if (doneRef.current) return
    doneRef.current = true
    const err = errorCountForScore(finalScore)
    haptic?.notificationOccurred(err === 0 ? 'success' : err === 1 ? 'warning' : 'error')
    playSound(err <= 1 ? 'win' : 'lose')
    onCompleteRef.current(err)
  }

  const spawnFloat = (x: number, y: number, value: string, color: string) => {
    const id = floatIdRef.current++
    setFloats(prev => [...prev, { id, x, y, value, color }])
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1000)
  }

  useEffect(() => {
    if (phase !== 'reference') return
    setRefCountdown(REFERENCE_SECONDS)
    const id = setInterval(() => {
      setRefCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          setPhase('play')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'play') return
    setPlayCountdown(PLAY_SECONDS)
    const id = setInterval(() => {
      setPlayCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          complete(scoreRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (!refMount.current) return
    let app: Application | null = null
    let cancelled = false
    ;(async () => {
      app = new Application()
      await app.init({
        resizeTo: refMount.current!,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      if (cancelled || !refMount.current) {
        app.destroy(true, { children: true })
        return
      }
      refMount.current.appendChild(app.canvas)
      refApp.current = app

      const cb = () => updateScene()
      app!.ticker.add(cb)
      tickerCbRef.current = cb
    })()
    return () => {
      cancelled = true
      if (refApp.current) {
        try { refApp.current.destroy(true, { children: true }) } catch { /* noop */ }
        refApp.current = null
      }
      tickerCbRef.current = null
      coinsRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const spawnCoin = (now: number) => {
    const app = refApp.current
    if (!app) return
    const isReal = rngRef.current() >= FAKE_PROBABILITY
    const type: CoinType = isReal
      ? realCoinRef.current
      : fakeCoinsRef.current[Math.floor(rngRef.current() * fakeCoinsRef.current.length)]
    const margin = COIN_SIZE * 0.7
    const x = margin + rngRef.current() * (app.screen.width - margin * 2)
    const y = -COIN_SIZE

    const container = new Container()
    container.x = x
    container.y = y
    container.eventMode = 'static'
    container.cursor = 'pointer'

    const radius = COIN_SIZE / 2
    const frontFace = buildFrontFace(type, radius)
    const backFace = buildBackFace(type, radius)
    backFace.visible = false
    container.addChild(frontFace)
    container.addChild(backFace)

    // Хит-зона — сильно шире самой монеты, перекрывает оба бока
    const hit = new Graphics()
    hit.circle(0, 0, COIN_HIT_RADIUS).fill({ color: 0xFFFFFF, alpha: 0.0001 })
    container.addChild(hit)

    const sprite: CoinSprite = {
      id: coinIdRef.current++,
      type, isReal,
      x, y,
      spawnTime: now,
      container, frontFace, backFace,
      removed: false,
    }
    container.on('pointertap', () => onCoinTap(sprite))
    app.stage.addChild(container)
    coinsRef.current.push(sprite)
  }

  const onCoinTap = (sprite: CoinSprite) => {
    if (doneRef.current || sprite.removed) return
    if (phaseRef.current !== 'play') return
    sprite.removed = true
    haptic?.impactOccurred('light')
    if (sprite.isReal) {
      scoreRef.current += 1
      playSound('seal')
      spawnFloat(sprite.x, sprite.y, '+1', colors.success)
    } else {
      scoreRef.current -= 2
      playSound('lose')
      spawnFloat(sprite.x, sprite.y, '−2', colors.danger)
    }
    setScore(scoreRef.current)
    sprite.container.destroy({ children: true })

    if (scoreRef.current >= TARGET_PERFECT) {
      complete(scoreRef.current)
    }
  }

  const updateScene = () => {
    const app = refApp.current
    if (!app || doneRef.current) return
    if (phaseRef.current !== 'play') return

    const now = performance.now()
    const dt = app.ticker.deltaMS / 1000
    const height = app.screen.height
    const remaining: CoinSprite[] = []

    if ((now - lastSpawnRef.current) / 1000 >= SPAWN_INTERVAL_SEC) {
      spawnCoin(now)
      lastSpawnRef.current = now
    }

    for (const sprite of coinsRef.current) {
      if (sprite.removed) continue
      sprite.y += COIN_FALL_SPEED * dt
      sprite.container.y = sprite.y

      // Вращение вокруг вертикальной оси — scale.x от 1 до -1 и обратно.
      const t = (now - sprite.spawnTime) / 1000
      const sx = Math.cos((t / ROTATION_PERIOD_SEC) * 2 * Math.PI)
      sprite.container.scale.x = Math.abs(sx) < 0.04 ? 0.04 : sx
      // Переключаем видимую сторону: положительный scale.x — аверс, отрицательный — реверс.
      const showFront = sx >= 0
      if (sprite.frontFace.visible !== showFront) {
        sprite.frontFace.visible = showFront
        sprite.backFace.visible = !showFront
      }

      if (sprite.y > height + COIN_SIZE) {
        sprite.container.destroy({ children: true })
        continue
      }
      remaining.push(sprite)
    }
    coinsRef.current = remaining
  }

  const scoreColor = score >= TARGET_PERFECT ? colors.success
    : score >= TARGET_OK ? colors.fairyGold
    : colors.textPrimary

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      maxWidth: '500px', margin: '0 auto', width: '100%', boxSizing: 'border-box',
      padding: spacing.md,
    }}>
      <div style={{
        textAlign: 'center',
        color: phase === 'reference' ? colors.fairyGold : (playCountdown <= 5 ? colors.danger : colors.fairyGold),
        fontWeight: 700, fontSize: '17px',
      }}>
        {phase === 'reference'
          ? `Запомни монету · ${refCountdown}`
          : `Лови золотые · ${playCountdown} сек`}
      </div>
      <div style={{
        color: colors.textMuted, fontSize: '12px', textAlign: 'center',
        marginBottom: spacing.sm, lineHeight: 1.4,
      }}>
        {phase === 'reference'
          ? 'Запомни обе стороны: аверс с цифрой и реверс с солнцем'
          : 'Тапай настоящую (+1), не тапай подделки (−2). 6 — пройти, 10 — раскрыть совет'}
      </div>

      {phase === 'play' && (
        <div style={{
          display: 'flex', gap: spacing.md, justifyContent: 'center',
          marginBottom: spacing.sm, fontSize: '13px',
        }}>
          <span style={{ color: scoreColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            Поймано: {score}
          </span>
        </div>
      )}

      <ReferenceSample phase={phase} coin={realCoinRef.current} />

      <div
        ref={refMount}
        style={{
          flex: 1,
          width: '100%',
          minHeight: '420px',
          touchAction: 'manipulation',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <AnimatePresence>
          {floats.map(f => (
            <motion.div
              key={f.id}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -60, scale: 1.5 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                left: f.x, top: f.y,
                transform: 'translate(-50%, -50%)',
                color: f.color,
                fontSize: '32px',
                fontWeight: 800,
                textShadow: '0 2px 10px rgba(0,0,0,0.7)',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {f.value}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * Эталон: на reference фазе показываем обе стороны крупно, на play —
 * компактную плашку. Раньше использовали отдельные Pixi.Application'ы для
 * front/back превью, но они конкурировали с основным канвасом за WebGL-контекст
 * и иногда не успевали почиститься при unmount-е, оставляя «зависший» чёрный
 * прямоугольник поверх результата. Теперь чисто CSS-кружки — никаких канвасов
 * вне основной игровой сцены.
 */
// Текстовый символ для каждого мотива — для DOM-превью эталонной монеты
const MOTIF_GLYPH: Record<Motif, string> = {
  sun: '☀',
  star: '★',
  cross: '✚',
  leaf: '☘',
  fraction: '½',
  moon: '☾',
  gear: '✺',
}

function hexToCss(h: number): string {
  return '#' + h.toString(16).padStart(6, '0').toUpperCase()
}

function CoinFaceCss({ size, kind, coin }: { size: number; kind: 'front' | 'back'; coin: CoinType }) {
  const rimCss   = hexToCss(coin.rim)
  const shadeCss = hexToCss(coin.shade)
  const baseCss  = hexToCss(coin.base)
  const liteCss  = hexToCss(coin.lite)
  const hiCss    = hexToCss(coin.hi)
  const bgGradient = `radial-gradient(circle at 32% 32%,
    #FFFAEC 0%,
    ${hiCss} 12%,
    ${liteCss} 30%,
    ${baseCss} 55%,
    ${shadeCss} 80%,
    ${rimCss} 100%)`
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: bgGradient,
      boxShadow: `inset 0 -2px 6px ${rimCss}80, 0 2px 8px rgba(0,0,0,0.5)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      flexShrink: 0,
    }}>
      {kind === 'front' ? (
        <>
          <div style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 800,
            fontSize: size * 0.55,
            color: rimCss,
            lineHeight: 1,
            textShadow: `0 1px 0 ${hiCss}80`,
          }}>
            {coin.label}
          </div>
          <div style={{
            position: 'absolute',
            top: size * 0.07,
            color: rimCss,
            fontSize: size * 0.16,
            fontWeight: 800,
          }}>{MOTIF_GLYPH[coin.frontMotif]}</div>
          <div style={{
            position: 'absolute',
            bottom: size * 0.08,
            color: rimCss,
            fontFamily: 'Georgia, serif',
            fontSize: size * 0.13,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}>{coin.caption}</div>
        </>
      ) : (
        <div style={{
          color: rimCss,
          fontSize: size * 0.75,
          fontWeight: 900,
          lineHeight: 1,
          textShadow: `0 1px 0 ${hiCss}66`,
        }}>{MOTIF_GLYPH[coin.backMotif]}</div>
      )}
    </div>
  )
}

function ReferenceSample({ phase, coin }: { phase: 'reference' | 'play'; coin: CoinType }) {
  const sizePx = phase === 'reference' ? 110 : 44

  if (phase === 'reference') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: spacing.sm, marginBottom: spacing.md,
      }}>
        <div style={{ display: 'flex', gap: spacing.lg, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <CoinFaceCss size={sizePx} kind="front" coin={coin} />
            <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: 6 }}>Аверс</div>
          </div>
          <div style={{ color: colors.fairyGold, fontSize: 24 }}>↻</div>
          <div style={{ textAlign: 'center' }}>
            <CoinFaceCss size={sizePx} kind="back" coin={coin} />
            <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: 6 }}>Реверс</div>
          </div>
        </div>
        <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '14px' }}>
          {coin.label} {coin.caption}
        </div>
      </div>
    )
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
      marginBottom: spacing.sm,
    }}>
      <span style={{ color: colors.textMuted, fontSize: '11px' }}>Эталон:</span>
      <CoinFaceCss size={sizePx} kind="front" coin={coin} />
      <CoinFaceCss size={sizePx} kind="back" coin={coin} />
      <span style={{ color: colors.fairyGold, fontSize: '12px', fontWeight: 600 }}>{coin.label} {coin.caption}</span>
    </div>
  )
}

