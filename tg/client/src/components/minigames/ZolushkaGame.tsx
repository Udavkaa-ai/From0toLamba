import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Application, Container, Graphics, Text, Ticker } from 'pixi.js'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'
import { GameHeader, ScoreChip } from './GameChrome'

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

/** Если задано — после F5: сразу показываем столбики монет, без игры */
interface ZolushkaGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
  restoredErrorCount?: number | null
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
  // Плоская монета с краем-фаской вместо «шарика». Слои:
  //   1. Внешний тёмный обод (имитирует боковую грань монеты)
  //   2. Лицевая поверхность — почти плоская заливка base с лёгким
  //      градиент-намёком через два смещённых эллипса
  //   3. Тонкий световой блик сверху (lite), маленькая тёмная дуга снизу (shade)
  //   4. Декоративное внутреннее кольцо как на настоящих монетах
  // Цель: не «полушарие», а вид монеты сверху, как на царских червонцах.
  g.circle(0, 0, radius).fill(c.rim)                  // боковая грань
  g.circle(0, 0, radius - 2).fill(c.shade)            // фаска
  g.circle(0, 0, radius - 4).fill(c.base)             // лицевая поверхность
  // Лёгкий верхний блик — узкий эллипс, небольшая прозрачность
  g.ellipse(0, -radius * 0.55, radius * 0.65, radius * 0.16)
    .fill({ color: c.lite, alpha: 0.55 })
  g.ellipse(-radius * 0.25, -radius * 0.55, radius * 0.25, radius * 0.08)
    .fill({ color: c.hi, alpha: 0.7 })
  // Нижняя тёмная дуга — намёк на лежащую тень от фаски
  g.ellipse(0, radius * 0.55, radius * 0.7, radius * 0.12)
    .fill({ color: c.shade, alpha: 0.45 })
  // Декоративное внутреннее кольцо (как ободок гравировки)
  g.circle(0, 0, radius * 0.82).stroke({ width: 1.5, color: c.rim, alpha: 0.55 })
  // Чёткий внутренний контур фаски
  g.circle(0, 0, radius - 4).stroke({ width: 1, color: c.shade, alpha: 0.8 })
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

export function ZolushkaGame({ seed, onComplete, restoredErrorCount }: ZolushkaGameProps) {
  const isFrozen = restoredErrorCount !== null && restoredErrorCount !== undefined
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(isFrozen)
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
    // Финальная сцена: три столбика «настоящих» монет, поочерёдно падают
    setTimeout(() => setShowPiles(true), 80)
    onCompleteRef.current(err)
  }

  const [showPiles, setShowPiles] = useState(isFrozen)
  // Анимация столбиков: каждая монетка стартует с задержкой col*0.25 + row*0.1
  // и падает 0.5 сек на своё место. Все столбики из настоящей монеты — победный
  // декор.
  // pixiReady — чтобы эффект перезапустился, когда app смонтируется (в frozen-режиме)
  const [pixiReady, setPixiReady] = useState(false)
  useEffect(() => {
    if (!showPiles) return
    const app = refApp.current
    if (!app) return
    void pixiReady
    // Очистить активно падающие монеты
    for (const s of coinsRef.current) {
      if (!s.removed) {
        try { s.container.destroy({ children: true }) } catch { /* noop */ }
      }
    }
    coinsRef.current = []
    // removeChildren() без destroy оставляет WebGL-ресурсы фоновых элементов
    // (reference layer, шум листьев и т.д.). Сносим явно.
    const removed = app.stage.removeChildren()
    for (const r of removed) {
      try { r.destroy({ children: true }) } catch { /* noop */ }
    }

    const startMs = performance.now()
    const W = app.screen.width
    const H = app.screen.height
    const real = realCoinRef.current
    const radius = COIN_SIZE / 2
    const colX = [W * 0.22, W * 0.5, W * 0.78]
    const coinsPerCol = 5
    const verticalStep = COIN_SIZE * 0.4   // монеты перекрываются, столбик плотный
    const baseY = H - 50

    interface PileItem { container: Container; targetY: number; spawnDelay: number; x: number }
    const piles: PileItem[] = []
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < coinsPerCol; row++) {
        const container = new Container()
        // Аверс монеты (со светом, бликом, цифрой, мотивом)
        const face = buildFrontFace(real, radius)
        container.addChild(face)
        container.x = colX[col]
        container.y = -50
        container.alpha = 0
        const targetY = baseY - row * verticalStep
        const spawnDelay = col * 0.25 + row * 0.12
        piles.push({ container, targetY, spawnDelay, x: colX[col] })
        app.stage.addChild(container)
      }
    }

    const cb = () => {
      const elapsed = (performance.now() - startMs) / 1000
      for (const c of piles) {
        const t = (elapsed - c.spawnDelay) / 0.5  // 0..1 за 0.5 сек
        if (t < 0) { c.container.alpha = 0; continue }
        c.container.alpha = 1
        if (t >= 1) {
          c.container.y = c.targetY
        } else {
          // ease-out: квадратичное замедление + лёгкий bounce
          const eased = 1 - Math.pow(1 - t, 3)
          c.container.y = -50 + (c.targetY + 50) * eased
        }
      }
    }
    app.ticker.add(cb)
    return () => {
      try { app.ticker.remove(cb) } catch { /* noop */ }
      // Уничтожаем сами стопки монет — без этого 15 контейнеров с
      // вложенными Graphics-faces оставались висеть до общего app.destroy.
      for (const p of piles) {
        try { p.container.destroy({ children: true }) } catch { /* noop */ }
      }
    }
  }, [showPiles, pixiReady])

  const spawnFloat = (x: number, y: number, value: string, color: string) => {
    const id = floatIdRef.current++
    setFloats(prev => [...prev, { id, x, y, value, color }])
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1000)
  }

  useEffect(() => {
    if (isFrozen) return
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
    if (isFrozen) return
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
      // SVG-декор замка имеет position:absolute и без явного zIndex стакается
      // ПОВЕРХ static canvas — башни перекрывали монеты. Поднимаем канвас.
      app.canvas.style.position = 'relative'
      app.canvas.style.zIndex = '1'
      refApp.current = app
      setPixiReady(true)

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

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      maxWidth: '500px', margin: '0 auto', width: '100%', boxSizing: 'border-box',
      padding: spacing.md,
    }}>
      <GameHeader
        title={phase === 'reference'
          ? `Запомни монету · ${refCountdown}`
          : `Лови золотые · ${playCountdown} сек`}
        urgent={phase !== 'reference' && playCountdown <= 5}
        hint={phase === 'reference'
          ? 'Запомни обе стороны: аверс с цифрой и реверс с солнцем'
          : 'Тапай настоящую (+1), не тапай подделки (−2). 6 — пройти, 10 — раскрыть совет'}
        scoreChip={phase === 'play'
          ? (
            <ScoreChip tone={score >= TARGET_PERFECT ? 'success' : score >= TARGET_OK ? 'gold' : 'danger'}>
              Поймано: {score}
            </ScoreChip>
          )
          : undefined}
        timerProgress={phase === 'reference'
          ? refCountdown / REFERENCE_SECONDS
          : playCountdown / PLAY_SECONDS}
      />

      {!isFrozen && <ReferenceSample phase={phase} coin={realCoinRef.current} />}

      <div
        ref={refMount}
        style={{
          flex: 1,
          width: '100%',
          minHeight: '420px',
          touchAction: 'manipulation',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16,
          // Сказочный замок-бал: тёплая ночь + светящиеся окна
          background: `
            radial-gradient(ellipse at 50% 100%, rgba(255,180,80,0.15) 0%, transparent 60%),
            linear-gradient(to bottom,
              #1A1040 0%,
              #2A1860 40%,
              #3A2070 75%,
              #1A0F30 100%
            )
          `,
          boxShadow: 'inset 0 0 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* SVG-декор: сказочный замок с башнями и шпилями + звёзды */}
        <svg
          viewBox="0 0 320 420"
          preserveAspectRatio="xMidYMax slice"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'none', opacity: 0.65, zIndex: 0,
          }}
        >
          <defs>
            <linearGradient id="castle1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3A2068" />
              <stop offset="100%" stopColor="#0F0820" />
            </linearGradient>
          </defs>
          {/* Сказочный замок с башнями: 5 круглых башен с конусными шпилями,
              соединённых зубчатыми стенами. Никаких прямых высоток. */}
          {/* Левая угловая башня — низкая */}
          <path d="M 8 420 L 8 340 L 8 332 L 14 326 L 30 326 L 36 332 L 36 340 L 36 420 Z" fill="url(#castle1)" />
          <polygon points="6,332 38,332 22,288" fill="url(#castle1)" />
          {/* Маленький флажок */}
          <line x1="22" y1="288" x2="22" y2="278" stroke="#5A3A80" strokeWidth="1.2" />
          <polygon points="22,278 22,272 28,275" fill="#9060C0" opacity="0.7" />

          {/* Зубцы стены — левая часть */}
          <path d="M 36 360 L 36 340 L 44 340 L 44 348 L 52 348 L 52 340 L 60 340 L 60 348 L 68 348 L 68 340 L 76 340 L 76 348 L 84 348 L 84 340 L 92 340 L 92 360 Z" fill="url(#castle1)" />
          <rect x="36" y="360" width="56" height="60" fill="url(#castle1)" />

          {/* Главная центральная башня — высокая */}
          <path d="M 92 420 L 92 320 L 92 308 L 102 296 L 138 296 L 148 308 L 148 320 L 148 420 Z" fill="url(#castle1)" />
          <polygon points="90,308 150,308 120,238" fill="url(#castle1)" />
          {/* Маленький балкончик-обводка вокруг базы шпиля */}
          <rect x="98" y="304" width="44" height="4" fill="url(#castle1)" />
          {/* Флажок на главной башне */}
          <line x1="120" y1="238" x2="120" y2="222" stroke="#5A3A80" strokeWidth="1.2" />
          <polygon points="120,222 120,214 130,218" fill="#C080FF" opacity="0.8" />

          {/* Зубцы стены — правая часть, к правой башне */}
          <path d="M 148 360 L 148 340 L 156 340 L 156 348 L 164 348 L 164 340 L 172 340 L 172 348 L 180 348 L 180 340 L 188 340 L 188 348 L 196 348 L 196 340 L 204 340 L 204 360 Z" fill="url(#castle1)" />
          <rect x="148" y="360" width="56" height="60" fill="url(#castle1)" />

          {/* Средняя башня справа */}
          <path d="M 204 420 L 204 330 L 204 322 L 212 314 L 232 314 L 240 322 L 240 330 L 240 420 Z" fill="url(#castle1)" />
          <polygon points="202,322 242,322 222,270" fill="url(#castle1)" />
          <line x1="222" y1="270" x2="222" y2="258" stroke="#5A3A80" strokeWidth="1.2" />
          <polygon points="222,258 222,252 230,255" fill="#9060C0" opacity="0.7" />

          {/* Зубцы стены — крайняя правая часть */}
          <path d="M 240 360 L 240 340 L 248 340 L 248 348 L 256 348 L 256 340 L 264 340 L 264 348 L 272 348 L 272 340 L 280 340 L 280 360 Z" fill="url(#castle1)" />
          <rect x="240" y="360" width="40" height="60" fill="url(#castle1)" />

          {/* Правая угловая башня — низкая */}
          <path d="M 280 420 L 280 340 L 280 332 L 286 326 L 302 326 L 308 332 L 308 340 L 308 420 Z" fill="url(#castle1)" />
          <polygon points="278,332 310,332 294,294" fill="url(#castle1)" />
          <line x1="294" y1="294" x2="294" y2="282" stroke="#5A3A80" strokeWidth="1.2" />
          <polygon points="294,282 294,276 301,279" fill="#9060C0" opacity="0.7" />

          {/* Арочные окна с тёплым светом — мерцают */}
          {/* Главная башня — арочное окно */}
          <path d="M 116 340 Q 116 332 120 332 Q 124 332 124 340 L 124 348 L 116 348 Z" fill="#FFE090" opacity="0.85">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="2.8s" repeatCount="indefinite" />
          </path>
          {/* Левая башня — круглое окошко */}
          <circle cx="22" cy="350" r="2.6" fill="#FFE090" opacity="0.7">
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="3.5s" repeatCount="indefinite" />
          </circle>
          {/* Правая башня — круглое окошко */}
          <circle cx="294" cy="350" r="2.6" fill="#FFE090" opacity="0.75">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
          </circle>
          {/* Средняя башня справа — арочка */}
          <path d="M 218 338 Q 218 332 222 332 Q 226 332 226 338 L 226 344 L 218 344 Z" fill="#FFE090" opacity="0.7" />
          {/* Окошки в стенах */}
          <path d="M 60 372 Q 60 368 62 368 Q 64 368 64 372 L 64 376 L 60 376 Z" fill="#FFE090" opacity="0.65" />
          <path d="M 172 372 Q 172 368 174 368 Q 176 368 176 372 L 176 376 L 172 376 Z" fill="#FFE090" opacity="0.65">
            <animate attributeName="opacity" values="0.3;0.85;0.3" dur="4s" repeatCount="indefinite" />
          </path>
          <path d="M 258 372 Q 258 368 260 368 Q 262 368 262 372 L 262 376 L 258 376 Z" fill="#FFE090" opacity="0.65" />

          {/* Звёзды по небу */}
          {[[40,40],[100,25],[160,50],[220,35],[280,55],[60,90],[200,80],[260,100],[140,15]].map(([x,y], i) => (
            <circle key={i} cx={x} cy={y} r={1 + (i % 2)} fill="#FFE9A0" opacity={0.6 + (i % 3) * 0.1}>
              {i % 3 === 0 && (
                <animate attributeName="opacity" values="0.5;1;0.5" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" />
              )}
            </circle>
          ))}
          {/* Луна слева сверху */}
          <circle cx="40" cy="50" r="14" fill="#FFE9A0" opacity="0.5" />
          <circle cx="36" cy="46" r="11" fill="#FFF4C0" opacity="0.6" />
        </svg>

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
function hexToCss(h: number): string {
  return '#' + h.toString(16).padStart(6, '0').toUpperCase()
}

/**
 * SVG-эквивалент Pixi-функции drawMotif. Нужен, чтобы DOM-превью эталона
 * показывало ТАКОЙ ЖЕ рисунок, как у Pixi-монет в игре. Раньше тут были
 * эмодзи (☀ ★ ✚ ☘ ½ ☾ ✺), которые не совпадали с процедурными формами в Pixi.
 * Координаты внутри SVG сдвинуты так, что (0,0) в локальной системе мотива
 * соответствует центру viewBox.
 */
function MotifSVG({ motif, size, color }: { motif: Motif; size: number; color: string }) {
  const r = size / 2
  // Перевод Pixi-координат (центр 0,0) в SVG (центр в r,r)
  const cx = (x: number) => x + r
  const cy = (y: number) => y + r

  if (motif === 'sun') {
    const sR = r
    const lines: JSX.Element[] = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      lines.push(
        <line
          key={i}
          x1={cx(Math.cos(a) * sR * 0.55)} y1={cy(Math.sin(a) * sR * 0.55)}
          x2={cx(Math.cos(a) * sR * 0.78)} y2={cy(Math.sin(a) * sR * 0.78)}
          stroke={color} strokeWidth={Math.max(1.5, size * 0.04)} strokeOpacity={0.85}
          strokeLinecap="round"
        />,
      )
    }
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {lines}
        <circle cx={cx(0)} cy={cy(0)} r={sR * 0.36} fill={color} fillOpacity={0.6} />
      </svg>
    )
  }
  if (motif === 'star') {
    const sR = r
    const pts: string[] = []
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2
      const rad = i % 2 === 0 ? sR * 0.62 : sR * 0.32
      pts.push(`${cx(Math.cos(a) * rad)},${cy(Math.sin(a) * rad)}`)
    }
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <polygon points={pts.join(' ')} fill={color} fillOpacity={0.7} />
      </svg>
    )
  }
  if (motif === 'cross') {
    const sR = r
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x={cx(-sR * 0.08)} y={cy(-sR * 0.62)} width={sR * 0.16} height={sR * 1.24} fill={color} fillOpacity={0.75} />
        <rect x={cx(-sR * 0.62)} y={cy(-sR * 0.08)} width={sR * 1.24} height={sR * 0.16} fill={color} fillOpacity={0.75} />
      </svg>
    )
  }
  if (motif === 'leaf') {
    const sR = r
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <polygon
          points={`${cx(0)},${cy(-sR * 0.65)} ${cx(sR * 0.18)},${cy(-sR * 0.3)} ${cx(0)},${cy(0)} ${cx(-sR * 0.18)},${cy(-sR * 0.3)}`}
          fill={color} fillOpacity={0.7}
        />
        <polygon
          points={`${cx(0)},${cy(0)} ${cx(sR * 0.18)},${cy(sR * 0.3)} ${cx(0)},${cy(sR * 0.65)} ${cx(-sR * 0.18)},${cy(sR * 0.3)}`}
          fill={color} fillOpacity={0.7}
        />
      </svg>
    )
  }
  if (motif === 'fraction') {
    const sR = r
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x={cx(-sR * 0.45)} y={cy(-sR * 0.06)} width={sR * 0.9} height={sR * 0.12} fill={color} fillOpacity={0.8} />
      </svg>
    )
  }
  if (motif === 'moon') {
    const sR = r
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx(0)} cy={cy(0)} r={sR * 0.6} fill={color} fillOpacity={0.8} />
        <circle cx={cx(sR * 0.22)} cy={cy(-sR * 0.05)} r={sR * 0.55} fill="#FFFAEC" />
      </svg>
    )
  }
  if (motif === 'gear') {
    const sR = r
    const teeth: JSX.Element[] = []
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      teeth.push(
        <circle key={i} cx={cx(Math.cos(a) * sR * 0.6)} cy={cy(Math.sin(a) * sR * 0.6)} r={sR * 0.15} fill={color} fillOpacity={0.8} />,
      )
    }
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {teeth}
        <circle cx={cx(0)} cy={cy(0)} r={sR * 0.4} fill={color} fillOpacity={0.8} />
        <circle cx={cx(0)} cy={cy(0)} r={sR * 0.18} fill="#FFFAEC" />
      </svg>
    )
  }
  return null
}

function CoinFaceCss({ size, kind, coin }: { size: number; kind: 'front' | 'back'; coin: CoinType }) {
  const rimCss   = hexToCss(coin.rim)
  const shadeCss = hexToCss(coin.shade)
  const baseCss  = hexToCss(coin.base)
  const liteCss  = hexToCss(coin.lite)
  const hiCss    = hexToCss(coin.hi)
  // Плоская монета, не «шарик». Двухслойная структура:
  //   1. Внешний div — тёмный обод (боковая грань монеты), padding 2px
  //   2. Внутренний div — лицевая поверхность с почти плоским градиентом
  //      и узким верхним бликом + нижней тенью (inset box-shadow)
  // Цель: вид сверху как на гравюре, без полусферы.
  const rimThickness = Math.max(2, Math.round(size * 0.05))
  const faceBg = `radial-gradient(circle at 50% 38%,
    ${liteCss} 0%,
    ${baseCss} 28%,
    ${baseCss} 78%,
    ${shadeCss} 100%)`

  // Размеры мотивов соответствуют Pixi-функции drawMotif:
  //   front: r * 0.35 (35% от радиуса = 17.5% от диаметра)
  //   back:  r * 0.75
  const motifSizePx = kind === 'front' ? size * 0.35 : size * 0.75
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: rimCss,
      padding: rimThickness,
      boxShadow: `0 3px 8px rgba(0,0,0,0.55), 0 0 0 1px ${shadeCss}80`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%', height: '100%',
        borderRadius: '50%',
        background: faceBg,
        boxShadow: `
          inset 0 ${rimThickness * 0.6}px 0 ${hiCss}60,
          inset 0 -${rimThickness * 0.6}px ${rimThickness * 0.8}px ${shadeCss}88,
          inset 0 0 0 1px ${shadeCss}60
        `,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {kind === 'front' ? (
          <>
            <div style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontWeight: 800,
              fontSize: size * 0.55,
              color: rimCss,
              lineHeight: 1,
              textShadow: `0 1px 0 ${hiCss}80, 0 -1px 0 ${shadeCss}60`,
            }}>
              {coin.label}
            </div>
            <div style={{
              position: 'absolute',
              top: size * 0.08,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MotifSVG motif={coin.frontMotif} size={motifSizePx} color={rimCss} />
            </div>
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
          <MotifSVG motif={coin.backMotif} size={motifSizePx} color={rimCss} />
        )}
      </div>
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
            <div style={{ color: colors.textOnDarkMuted, fontSize: '11px', marginTop: 6 }}>Аверс</div>
          </div>
          <div style={{ color: colors.fairyGold, fontSize: 24 }}>↻</div>
          <div style={{ textAlign: 'center' }}>
            <CoinFaceCss size={sizePx} kind="back" coin={coin} />
            <div style={{ color: colors.textOnDarkMuted, fontSize: '11px', marginTop: 6 }}>Реверс</div>
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
      <span style={{ color: colors.textOnDarkMuted, fontSize: '11px' }}>Эталон:</span>
      <CoinFaceCss size={sizePx} kind="front" coin={coin} />
      <CoinFaceCss size={sizePx} kind="back" coin={coin} />
      <span style={{ color: colors.fairyGold, fontSize: '12px', fontWeight: 600 }}>{coin.label} {coin.caption}</span>
    </div>
  )
}

