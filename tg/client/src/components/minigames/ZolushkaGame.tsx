import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Application, Container, Graphics, Ticker } from 'pixi.js'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const REFERENCE_SECONDS = 5
const PLAY_SECONDS = 15

// Лесенка результата по числу пойманных НАСТОЯЩИХ монет:
//   ≥ 12 — идеальная игра (совет чуйки)
//   ≥ 7  — победа (посул + тип, без совета)
//   < 7  — поражение (только за звёзды)
const TARGET_OK = 7
const TARGET_PERFECT = 12

const COIN_SIZE = 56
const COIN_FALL_SPEED = 160        // px / sec
const SPAWN_INTERVAL_SEC = 0.6
const FAKE_PROBABILITY = 0.5       // настоящих и фальшивых поровну
const ROTATION_PERIOD_SEC = 1.6    // полный оборот вокруг вертикальной оси

interface ZolushkaGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
}

interface CoinType {
  /** Главный символ в центре (число номинала) */
  label: string
  /** Подпись номинала под полем */
  caption: string
  /** Цвета: рим, тень, база, светлая зона, блик */
  rim: number
  shade: number
  base: number
  lite: number
  hi: number
  /** Лёгкий доп.штрих в центре, чтобы монеты различались на одной палитре */
  motif?: 'sun' | 'star' | 'cross' | 'leaf' | 'fraction'
}

// Эталонная (настоящая) монета и набор подделок.
// Все монеты одной палитры — это часть сложности: глаз должен ловить символ,
// а не цвет. Размер и шрифт одинаковые.
const REAL_COIN: CoinType = {
  label: '1', caption: 'золотой',
  rim: 0x6B4A00, shade: 0xB07A10, base: 0xE8A800, lite: 0xFFC838, hi: 0xFFE490,
  motif: 'sun',
}

const FAKE_COINS: CoinType[] = [
  {
    label: '5', caption: 'медяков',
    rim: 0x4A2A05, shade: 0x8C5A20, base: 0xC97A30, lite: 0xE9A050, hi: 0xF5C880,
    motif: 'cross',
  },
  {
    label: '½', caption: 'полушка',
    rim: 0x4A4A55, shade: 0x7A7A85, base: 0xB0B0BB, lite: 0xD0D0D8, hi: 0xEFEFF5,
    motif: 'fraction',
  },
  {
    label: '3', caption: 'гривны',
    rim: 0x5A4A10, shade: 0x8C7A20, base: 0xC9B040, lite: 0xE9D080, hi: 0xF8E9B0,
    motif: 'leaf',
  },
  {
    label: '½', caption: 'денга',
    rim: 0x402A05, shade: 0x7A5A18, base: 0xB08840, lite: 0xD0AC60, hi: 0xEFCC90,
    motif: 'star',
  },
]

function pickCoinType(rng: () => number): { type: CoinType; isReal: boolean } {
  if (rng() < FAKE_PROBABILITY) {
    return { type: FAKE_COINS[Math.floor(rng() * FAKE_COINS.length)], isReal: false }
  }
  return { type: REAL_COIN, isReal: true }
}

// ── Рисование монеты с объёмом (концентрические круги) ─────────────────────

function drawCoin(g: Graphics, c: CoinType, radius: number) {
  // Тёмный рим
  g.circle(0, 0, radius + 1).fill(c.rim)
  // База-затенение
  g.circle(0, 0, radius).fill(c.shade)
  // Средний тон, чуть смещён вправо-вниз (теневая сторона)
  g.circle(radius * 0.08, radius * 0.08, radius * 0.92).fill(c.base)
  // Основной цвет, смещён влево-вверх
  g.circle(-radius * 0.05, -radius * 0.05, radius * 0.82).fill(c.base)
  // Светлая зона
  g.circle(-radius * 0.18, -radius * 0.18, radius * 0.58).fill(c.lite)
  // Блик
  g.circle(-radius * 0.32, -radius * 0.32, radius * 0.28).fill(c.hi)
  // Спекуляр
  g.circle(-radius * 0.4, -radius * 0.4, radius * 0.08).fill(0xFFFAEC)
  // Внутренний ободок (медальон)
  g.circle(0, 0, radius * 0.78).stroke({ width: 2, color: c.rim, alpha: 0.7 })

  // Дополнительный мотив — рисуется ДО надписи
  drawMotif(g, c.motif ?? null, radius, c.rim)
}

function drawMotif(g: Graphics, motif: CoinType['motif'] | null, r: number, rim: number) {
  if (!motif) return
  if (motif === 'sun') {
    // Солнце с лучами вокруг номинала
    const rays = 12
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2
      const x1 = Math.cos(a) * r * 0.55
      const y1 = Math.sin(a) * r * 0.55
      const x2 = Math.cos(a) * r * 0.7
      const y2 = Math.sin(a) * r * 0.7
      g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 2, color: rim, alpha: 0.7 })
    }
  } else if (motif === 'star') {
    // 8-конечная звезда
    const pts: number[] = []
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2
      const rad = i % 2 === 0 ? r * 0.55 : r * 0.32
      pts.push(Math.cos(a) * rad, Math.sin(a) * rad)
    }
    g.poly(pts).fill({ color: rim, alpha: 0.25 })
  } else if (motif === 'cross') {
    // Крест
    g.rect(-r * 0.04, -r * 0.5, r * 0.08, r * 1.0).fill({ color: rim, alpha: 0.4 })
    g.rect(-r * 0.5, -r * 0.04, r * 1.0, r * 0.08).fill({ color: rim, alpha: 0.4 })
  } else if (motif === 'leaf') {
    // Простой колос (две диагональные линии)
    g.poly([0, -r * 0.6, r * 0.12, -r * 0.3, 0, 0, -r * 0.12, -r * 0.3]).fill({ color: rim, alpha: 0.35 })
    g.poly([0, 0, r * 0.12, r * 0.3, 0, r * 0.6, -r * 0.12, r * 0.3]).fill({ color: rim, alpha: 0.35 })
  } else if (motif === 'fraction') {
    // Горизонтальная черта дроби
    g.rect(-r * 0.3, -r * 0.04, r * 0.6, r * 0.08).fill({ color: rim, alpha: 0.45 })
  }
}

// Текст рисуется через DOM — Pixi v8 Text усложняет жизнь со шрифтами в Mini App,
// а нам нужно всего пара символов на монету. Координаты тоже DOM (px относительно
// контейнера канваса), потому что у нас уже есть слой всплывающих очков.
interface CoinSprite {
  id: number
  type: CoinType
  isReal: boolean
  x: number
  y: number
  spawnTime: number   // ms
  container: Container
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
  const coinsRef = useRef<CoinSprite[]>([])
  const lastSpawnRef = useRef<number>(0)
  const scoreRef = useRef(0)
  const startTimeRef = useRef(performance.now())
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

  // Pre-render-ref: чтобы handler видел актуальную фазу
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

  // ── Таймер показа эталона ──────────────────────────────────────────────
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

  // ── Таймер раунда ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') return
    startTimeRef.current = performance.now()
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

  // ── Инициализация Pixi ─────────────────────────────────────────────────
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

  // ── Логика спавна / падения / тапов ────────────────────────────────────

  const spawnCoin = (now: number) => {
    const app = refApp.current
    if (!app) return
    const { type, isReal } = pickCoinType(rngRef.current)
    const margin = COIN_SIZE * 0.7
    const x = margin + rngRef.current() * (app.screen.width - margin * 2)
    const y = -COIN_SIZE
    const container = new Container()
    container.x = x
    container.y = y
    container.eventMode = 'static'
    container.cursor = 'pointer'

    const gfx = new Graphics()
    drawCoin(gfx, type, COIN_SIZE / 2)
    container.addChild(gfx)

    // Хит-зона побольше монеты — толстые пальцы тоже должны попадать
    const hit = new Graphics()
    hit.circle(0, 0, COIN_SIZE * 0.7).fill({ color: 0xFFFFFF, alpha: 0.0001 })
    container.addChild(hit)

    const sprite: CoinSprite = {
      id: coinIdRef.current++,
      type, isReal,
      x, y,
      spawnTime: now,
      container,
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

    // Спавн новых монет
    if ((now - lastSpawnRef.current) / 1000 >= SPAWN_INTERVAL_SEC) {
      spawnCoin(now)
      lastSpawnRef.current = now
    }

    // Обновляем позиции и вращение
    const height = app.screen.height
    const remaining: CoinSprite[] = []
    for (const sprite of coinsRef.current) {
      if (sprite.removed) continue
      sprite.y += COIN_FALL_SPEED * dt
      sprite.container.y = sprite.y
      // Псевдо-вращение вокруг вертикальной оси
      const t = (now - sprite.spawnTime) / 1000
      sprite.container.scale.x = Math.cos((t / ROTATION_PERIOD_SEC) * 2 * Math.PI)
      // Снизу экрана — удаляем (упущенная монета)
      if (sprite.y > height + COIN_SIZE) {
        sprite.container.destroy({ children: true })
        continue
      }
      remaining.push(sprite)
    }
    coinsRef.current = remaining
  }

  // ── Стили ──────────────────────────────────────────────────────────────
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
          ? 'Только эту монету нужно ловить — остальные пропускай'
          : 'Тапай настоящую (+1), не тапай подделки (−2). 7 — пройти, 12 — раскрыть совет'}
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

      {/* Эталон-монета (большой превью на reference, мини на play) */}
      <ReferenceSample phase={phase} />

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
 * Эталонная монета: на reference фазе — большая по центру, на play — маленькая
 * наклейка в шапке, чтобы можно было свериться.
 */
function ReferenceSample({ phase }: { phase: 'reference' | 'play' }) {
  const refMount = useRef<HTMLDivElement>(null)
  const sizePx = phase === 'reference' ? 140 : 48

  useEffect(() => {
    if (!refMount.current) return
    let app: Application | null = null
    let cancelled = false
    ;(async () => {
      app = new Application()
      await app.init({
        width: sizePx,
        height: sizePx,
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
      const g = new Graphics()
      drawCoin(g, REAL_COIN, sizePx * 0.42)
      g.x = sizePx / 2
      g.y = sizePx / 2
      app.stage.addChild(g)
    })()
    return () => {
      cancelled = true
      if (app) app.destroy(true, { children: true })
    }
  }, [sizePx])

  if (phase === 'reference') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: spacing.sm, marginBottom: spacing.md,
      }}>
        <div ref={refMount} style={{ width: sizePx, height: sizePx }} />
        <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '14px' }}>
          {REAL_COIN.label} {REAL_COIN.caption}
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
      <div ref={refMount} style={{ width: sizePx, height: sizePx }} />
      <span style={{ color: colors.fairyGold, fontSize: '12px', fontWeight: 600 }}>
        {REAL_COIN.label} {REAL_COIN.caption}
      </span>
    </div>
  )
}
