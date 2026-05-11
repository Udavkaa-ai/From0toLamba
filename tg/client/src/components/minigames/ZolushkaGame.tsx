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
const PLAY_SECONDS = 15

// Лесенка результата по числу пойманных НАСТОЯЩИХ монет:
//   ≥ 12 — идеальная игра (совет чуйки)
//   ≥ 7  — победа (посул + тип, без совета)
//   < 7  — поражение (только за звёзды)
const TARGET_OK = 7
const TARGET_PERFECT = 12

const COIN_SIZE = 60
const COIN_HIT_RADIUS = COIN_SIZE  // ~ вдвое шире самой монеты — толстым пальцам легче
const COIN_FALL_SPEED = 160        // px / sec
const SPAWN_INTERVAL_SEC = 0.6
const FAKE_PROBABILITY = 0.55
const ROTATION_PERIOD_SEC = 2.0    // полный оборот (видна обе стороны) за 2 сек

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

// Эталонная (настоящая) монета
const REAL_COIN: CoinType = {
  rim: 0x6B4A00, shade: 0xB07A10, base: 0xE8A800, lite: 0xFFC838, hi: 0xFFE490,
  label: '1', caption: 'золотой',
  frontMotif: 'sun',
  backMotif: 'sun',
}

// Подделки. Чтобы было интереснее, часть из них совпадает с эталоном по
// аверсу или реверсу — придётся дождаться, пока монета повернётся.
const FAKE_COINS: CoinType[] = [
  // ── Очевидные фальшаки: оба бока отличаются ──
  {
    rim: 0x4A2A05, shade: 0x8C5A20, base: 0xC97A30, lite: 0xE9A050, hi: 0xF5C880,
    label: '5', caption: 'медяков', frontMotif: 'cross', backMotif: 'cross',
  },
  {
    rim: 0x4A4A55, shade: 0x7A7A85, base: 0xB0B0BB, lite: 0xD0D0D8, hi: 0xEFEFF5,
    label: '½', caption: 'полушка', frontMotif: 'fraction', backMotif: 'fraction',
  },
  {
    rim: 0x5A4A10, shade: 0x8C7A20, base: 0xC9B040, lite: 0xE9D080, hi: 0xF8E9B0,
    label: '3', caption: 'гривны', frontMotif: 'leaf', backMotif: 'leaf',
  },
  {
    rim: 0x402A05, shade: 0x7A5A18, base: 0xB08840, lite: 0xD0AC60, hi: 0xEFCC90,
    label: '½', caption: 'денга', frontMotif: 'star', backMotif: 'star',
  },
  // ── Хитрая подделка: ОТЛИЧАЕТСЯ ТОЛЬКО АВЕРС (номинал) ──
  // Цвет золота, реверс — солнце как у эталона. На аверсе «5 золотых» вместо «1 золотой».
  // Если игрок поймает её на реверсе, подумает «настоящая». Нужно увидеть аверс.
  {
    rim: 0x6B4A00, shade: 0xB07A10, base: 0xE8A800, lite: 0xFFC838, hi: 0xFFE490,
    label: '5', caption: 'золотых', frontMotif: 'sun', backMotif: 'sun',
  },
  {
    rim: 0x6B4A00, shade: 0xB07A10, base: 0xE8A800, lite: 0xFFC838, hi: 0xFFE490,
    label: '2', caption: 'золотых', frontMotif: 'sun', backMotif: 'sun',
  },
  // ── Хитрая подделка: ОТЛИЧАЕТСЯ ТОЛЬКО РЕВЕРС (символ на обороте) ──
  // Аверс точь-в-точь как у эталона: «1 золотой» с солнышком. На реверсе вместо
  // солнца — луна. Чтобы вскрыть, надо дождаться пол-оборота.
  {
    rim: 0x6B4A00, shade: 0xB07A10, base: 0xE8A800, lite: 0xFFC838, hi: 0xFFE490,
    label: '1', caption: 'золотой', frontMotif: 'sun', backMotif: 'moon',
  },
  {
    rim: 0x6B4A00, shade: 0xB07A10, base: 0xE8A800, lite: 0xFFC838, hi: 0xFFE490,
    label: '1', caption: 'золотой', frontMotif: 'sun', backMotif: 'gear',
  },
  // ── Хитрая подделка: тот же цвет/реверс, но цифра «1» и подпись «грош» ──
  {
    rim: 0x6B4A00, shade: 0xB07A10, base: 0xE8A800, lite: 0xFFC838, hi: 0xFFE490,
    label: '1', caption: 'грош', frontMotif: 'sun', backMotif: 'sun',
  },
]

function pickCoinType(rng: () => number): { type: CoinType; isReal: boolean } {
  if (rng() < FAKE_PROBABILITY) {
    return { type: FAKE_COINS[Math.floor(rng() * FAKE_COINS.length)], isReal: false }
  }
  return { type: REAL_COIN, isReal: true }
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
    const { type, isReal } = pickCoinType(rngRef.current)
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
 * Эталон: на reference фазе показываем обе стороны в крупном виде и большим
 * шрифтом, на play — компактную плашку с двумя бочками. Игрок должен запомнить
 * аверс (цифра + подпись) и реверс (символ).
 */
function ReferenceSample({ phase }: { phase: 'reference' | 'play' }) {
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const sizePx = phase === 'reference' ? 120 : 50

  useEffect(() => {
    let appFront: Application | null = null
    let appBack: Application | null = null
    let cancelled = false
    const radius = sizePx * 0.42
    ;(async () => {
      if (frontRef.current) {
        appFront = new Application()
        await appFront.init({
          width: sizePx, height: sizePx,
          backgroundAlpha: 0, antialias: true,
          resolution: window.devicePixelRatio || 1, autoDensity: true,
        })
        if (cancelled) { appFront.destroy(true, { children: true }); return }
        frontRef.current.innerHTML = ''
        frontRef.current.appendChild(appFront.canvas)
        const face = buildFrontFace(REAL_COIN, radius)
        face.x = sizePx / 2; face.y = sizePx / 2
        appFront.stage.addChild(face)
      }
      if (backRef.current) {
        appBack = new Application()
        await appBack.init({
          width: sizePx, height: sizePx,
          backgroundAlpha: 0, antialias: true,
          resolution: window.devicePixelRatio || 1, autoDensity: true,
        })
        if (cancelled) { appBack.destroy(true, { children: true }); return }
        backRef.current.innerHTML = ''
        backRef.current.appendChild(appBack.canvas)
        const face = buildBackFace(REAL_COIN, radius)
        face.x = sizePx / 2; face.y = sizePx / 2
        appBack.stage.addChild(face)
      }
    })()
    return () => {
      cancelled = true
      if (appFront) appFront.destroy(true, { children: true })
      if (appBack) appBack.destroy(true, { children: true })
    }
  }, [sizePx])

  if (phase === 'reference') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: spacing.sm, marginBottom: spacing.md,
      }}>
        <div style={{ display: 'flex', gap: spacing.lg, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div ref={frontRef} style={{ width: sizePx, height: sizePx }} />
            <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: 4 }}>Аверс</div>
          </div>
          <div style={{ color: colors.fairyGold, fontSize: 24 }}>↻</div>
          <div style={{ textAlign: 'center' }}>
            <div ref={backRef} style={{ width: sizePx, height: sizePx }} />
            <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: 4 }}>Реверс</div>
          </div>
        </div>
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
      <div ref={frontRef} style={{ width: sizePx, height: sizePx }} />
      <div ref={backRef} style={{ width: sizePx, height: sizePx }} />
      <span style={{ color: colors.fairyGold, fontSize: '12px', fontWeight: 600 }}>
        {REAL_COIN.label} {REAL_COIN.caption}
      </span>
    </div>
  )
}

