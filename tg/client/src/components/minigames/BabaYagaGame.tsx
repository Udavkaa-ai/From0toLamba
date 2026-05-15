import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Application, Container, Graphics, Text } from 'pixi.js'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const REFERENCE_SECONDS = 7
const PLAY_SECONDS = 25
const RECIPE_LENGTH = 5
const FLY_MS = 550        // длительность падения ингредиента в котёл
const SHAKE_MS = 420      // длительность взрыва+тряски при ошибке

interface BabaYagaGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
  /** Если задано — сразу показываем котёл и финальную сцену (после F5). */
  restoredErrorCount?: number | null
}

// 12 узнаваемых ингредиентов. Из них для каждой партии выбираются RECIPE_LENGTH
// (=5) случайно — так подбор разный каждый раз, как и просил тестировщик.
type Ingredient =
  | 'frog' | 'mushroom' | 'spider' | 'skull' | 'bat'
  | 'eye' | 'snake' | 'bone' | 'pumpkin'
  | 'acorn' | 'bottle' | 'worm'
const ALL_INGREDIENTS: Ingredient[] = [
  'frog', 'mushroom', 'spider', 'skull', 'bat',
  'eye', 'snake', 'bone', 'pumpkin',
  'acorn', 'bottle', 'worm',
]

// ── Процедурное рисование ингредиентов (2D Pixi, без 3D) ──────────────────


// ── Ингредиенты — эмодзи, не рисованные ────────────────────────────────────
// Раньше каждый ингредиент собирался из десятков Pixi-примитивов (circle/poly/
// bezier), и лягушка/змея/червяк выглядели уродливо. Теперь рендерим эмодзи
// текстом — Telegram-клиент на любом устройстве отрисует их полированно.
const INGREDIENT_EMOJI: Record<Ingredient, string> = {
  frog:      '🐸',
  mushroom:  '🍄',
  spider:    '🕷️',
  skull:     '💀',
  bat:       '🦇',
  eye:       '👁️',
  snake:     '🐍',
  bone:      '🦴',
  pumpkin:   '🎃',
  acorn:     '🌰',
  bottle:    '🧪',
  worm:      '🪱',
}

/** Добавляем эмодзи-Text как ребёнок переданного Container'а.
 *  Аналог старого drawIngredientCard на Graphics, но визуал лучше. */
function addIngredientEmoji(parent: Container, ing: Ingredient, size: number) {
  const t = new Text({
    text: INGREDIENT_EMOJI[ing],
    style: {
      fontSize: size * 1.6,
      // Системные шрифты Android/iOS включают полноцветные emoji
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
      align: 'center',
    },
  })
  t.anchor.set(0.5)
  parent.addChild(t)
}


/** Котёл с подставкой и огнём под ней — как на референсе колдуньи.
 *  Координаты в системе котла: y=0 — верхний край отверстия, y=h —
 *  низ подставки. Тело занимает 0-0.7h, подставка-тренога 0.6-0.85h,
 *  огонь и поленья 0.82-1.0h. */
function drawCauldron(g: Graphics, w: number, h: number) {
  const bodyColor = 0x252028
  const bodyHi = 0x4A4248
  const bodyShade = 0x12101A
  const rimColor = 0x8C7A48
  const ironColor = 0x504048

  // ── Тело котла: округлая бочкообразная форма, 0 → 0.7h ─────────────────
  // Левая стенка → дно → правая стенка через безье
  g.moveTo(-w * 0.48, h * 0.05)
    .bezierCurveTo(-w * 0.56, h * 0.32,  -w * 0.48, h * 0.65,  -w * 0.25, h * 0.7)
    .lineTo(w * 0.25, h * 0.7)
    .bezierCurveTo(w * 0.48, h * 0.65,  w * 0.56, h * 0.32,  w * 0.48, h * 0.05)
    .closePath()
    .fill(bodyColor)
    .stroke({ width: 3, color: bodyShade })

  // Лёгкий блик слева (источник света сверху-слева)
  g.moveTo(-w * 0.42, h * 0.08)
    .bezierCurveTo(-w * 0.5, h * 0.32,  -w * 0.44, h * 0.55,  -w * 0.32, h * 0.62)
    .lineTo(-w * 0.32, h * 0.62)
    .bezierCurveTo(-w * 0.34, h * 0.55,  -w * 0.4, h * 0.3,  -w * 0.36, h * 0.08)
    .closePath()
    .fill({ color: bodyHi, alpha: 0.45 })

  // Тёмная тень справа
  g.moveTo(w * 0.2, h * 0.1)
    .bezierCurveTo(w * 0.45, h * 0.35,  w * 0.38, h * 0.6,  w * 0.2, h * 0.66)
    .lineTo(w * 0.2, h * 0.1)
    .closePath()
    .fill({ color: bodyShade, alpha: 0.55 })

  // ── Ободок и отверстие ─────────────────────────────────────────────────
  // Толстый верхний ободок (внешний край шире тела)
  g.ellipse(0, h * 0.03, w * 0.5, h * 0.1).fill(bodyShade).stroke({ width: 3, color: rimColor })
  // Сама дырка
  g.ellipse(0, h * 0.04, w * 0.44, h * 0.085).fill(0x100612)
  // Бурлящая зелёная жидкость
  g.ellipse(0, h * 0.04, w * 0.4, h * 0.07).fill({ color: 0x4A8030, alpha: 0.85 })
  // Пузыри-кругляши
  g.circle(-w * 0.1, h * 0.02, w * 0.04).fill({ color: 0x8FD060, alpha: 0.9 })
  g.circle(w * 0.13, h * 0.0, w * 0.03).fill({ color: 0x8FD060, alpha: 0.9 })
  g.circle(w * 0.02, h * 0.06, w * 0.025).fill({ color: 0xB0E080, alpha: 0.95 })

  // ── Ручки-кольца по бокам ──────────────────────────────────────────────
  g.ellipse(-w * 0.5, h * 0.18, w * 0.08, h * 0.04)
    .fill({ color: 0, alpha: 0 })
    .stroke({ width: 4, color: rimColor })
  g.ellipse(w * 0.5, h * 0.18, w * 0.08, h * 0.04)
    .fill({ color: 0, alpha: 0 })
    .stroke({ width: 4, color: rimColor })

  // ── Кованая подставка-тренога ──────────────────────────────────────────
  // Горизонтальная перекладина под котлом
  g.rect(-w * 0.35, h * 0.7, w * 0.7, h * 0.025).fill(ironColor).stroke({ width: 1, color: bodyShade })
  // Левая «ножка» подставки с завитком внизу
  g.moveTo(-w * 0.3, h * 0.72)
    .lineTo(-w * 0.36, h * 0.88)
    .stroke({ width: 4, color: ironColor })
  g.circle(-w * 0.38, h * 0.9, w * 0.04)
    .fill({ color: 0, alpha: 0 })
    .stroke({ width: 3, color: ironColor })
  // Правая «ножка»
  g.moveTo(w * 0.3, h * 0.72)
    .lineTo(w * 0.36, h * 0.88)
    .stroke({ width: 4, color: ironColor })
  g.circle(w * 0.38, h * 0.9, w * 0.04)
    .fill({ color: 0, alpha: 0 })
    .stroke({ width: 3, color: ironColor })
  // Центральная стойка
  g.moveTo(0, h * 0.72).lineTo(0, h * 0.9).stroke({ width: 3, color: ironColor })

  // ── Огонь и поленья под котлом ─────────────────────────────────────────
  // Поленья — два коричневых прямоугольника крест-накрест
  g.rect(-w * 0.25, h * 0.92, w * 0.5, h * 0.05).fill(0x6A3810).stroke({ width: 1.5, color: 0x3A1F08 })
  g.rect(-w * 0.18, h * 0.95, w * 0.36, h * 0.04).fill(0x4A2810).stroke({ width: 1, color: 0x3A1F08 })
  // Линии волокон на полене
  g.moveTo(-w * 0.2, h * 0.94).lineTo(w * 0.2, h * 0.94).stroke({ width: 1, color: 0x3A1F08 })
  // Языки пламени — три красно-оранжевых треугольных формы
  // Левый
  g.moveTo(-w * 0.18, h * 0.92)
    .quadraticCurveTo(-w * 0.2, h * 0.82,  -w * 0.12, h * 0.78)
    .quadraticCurveTo(-w * 0.08, h * 0.86, -w * 0.1, h * 0.92)
    .closePath()
    .fill(0xFF6020)
  g.moveTo(-w * 0.16, h * 0.92)
    .quadraticCurveTo(-w * 0.14, h * 0.85, -w * 0.13, h * 0.83)
    .quadraticCurveTo(-w * 0.1, h * 0.88, -w * 0.12, h * 0.92)
    .closePath()
    .fill(0xFFCB45)
  // Центральный — самый высокий
  g.moveTo(-w * 0.06, h * 0.92)
    .quadraticCurveTo(-w * 0.05, h * 0.76,  0, h * 0.72)
    .quadraticCurveTo(w * 0.05, h * 0.78,  w * 0.06, h * 0.92)
    .closePath()
    .fill(0xFF6020)
  g.moveTo(-w * 0.03, h * 0.92)
    .quadraticCurveTo(-w * 0.02, h * 0.82, 0, h * 0.78)
    .quadraticCurveTo(w * 0.03, h * 0.85, w * 0.03, h * 0.92)
    .closePath()
    .fill(0xFFCB45)
  // Правый
  g.moveTo(w * 0.1, h * 0.92)
    .quadraticCurveTo(w * 0.08, h * 0.83, w * 0.14, h * 0.8)
    .quadraticCurveTo(w * 0.2, h * 0.86, w * 0.18, h * 0.92)
    .closePath()
    .fill(0xFF6020)
  g.moveTo(w * 0.12, h * 0.92)
    .quadraticCurveTo(w * 0.11, h * 0.86, w * 0.14, h * 0.84)
    .quadraticCurveTo(w * 0.17, h * 0.88, w * 0.16, h * 0.92)
    .closePath()
    .fill(0xFFCB45)
}

/** Раскладка котла и слотов из размера канваса. Используется и в Pixi-рендере,
 *  и в React DOM-overlay для хит-зон. Координаты в CSS-пикселях, origin (0,0) —
 *  верхний левый угол канваса; для слотов x,y — центр квадрата. */
function computeLayout(W: number, H: number) {
  const cauldronW = Math.min(W * 0.62, 280)
  const cauldronH = cauldronW * 0.85
  const cauldronCX = W / 2
  const cauldronTopY = H - cauldronH - 12
  const cauldronMouthY = cauldronTopY + cauldronH * 0.03

  const slotsAreaTop = 12
  const slotsAreaBottom = cauldronTopY - 12
  const slotsAreaH = Math.max(120, slotsAreaBottom - slotsAreaTop)
  const rowGap = 10
  const colGap = 10
  const sideMargin = 10
  const row1Count = 3
  const row2Count = 2
  const maxSlotByH = (slotsAreaH - rowGap) / 2
  // Верхний ряд из 3 слотов + 2 промежутка — лимитирующий по ширине
  const maxSlotByW = (W - sideMargin * 2 - colGap * (row1Count - 1)) / row1Count
  const slotW = Math.max(56, Math.min(maxSlotByH, maxSlotByW, 130))
  const slotH = slotW
  const row1Y = slotsAreaTop + slotH / 2 + 4
  const row2Y = row1Y + slotH + rowGap
  const row1TotalW = row1Count * slotW + (row1Count - 1) * colGap
  const row2TotalW = row2Count * slotW + (row2Count - 1) * colGap
  const row1StartX = (W - row1TotalW) / 2 + slotW / 2
  const row2StartX = (W - row2TotalW) / 2 + slotW / 2
  const positions: Array<{ x: number; y: number }> = []
  for (let i = 0; i < row1Count; i++) {
    positions.push({ x: row1StartX + i * (slotW + colGap), y: row1Y })
  }
  for (let i = 0; i < row2Count; i++) {
    positions.push({ x: row2StartX + i * (slotW + colGap), y: row2Y })
  }
  return {
    cauldronW, cauldronH, cauldronCX, cauldronTopY, cauldronMouthY,
    slotW, slotH, positions,
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// === Главный компонент ====================================================

interface SlotAnim {
  /** Состояние слота: idle (в покое) / flying (летит в котёл) /
   *  shake (взрыв при ошибке) / reappearing (всплывает на новом месте) */
  state: 'idle' | 'flying' | 'shake' | 'reappearing' | 'consumed'
  /** Время начала текущего состояния в performance.now() мс */
  startedAt: number
  /** Куда лететь (центр котла) — заполняется в момент перехода в flying */
  targetX: number
  targetY: number
  /** Home-позиция в текущей раскладке */
  homeX: number
  homeY: number
}

interface SlotState {
  ingredient: Ingredient
  anim: SlotAnim
}

interface Bubble {
  startedAt: number
  durationMs: number
  x0: number
  y0: number
  driftX: number
  radius: number
}

interface ExplosionParticle {
  startedAt: number
  durationMs: number
  x: number
  y: number
  vx: number
  vy: number
}

export function BabaYagaGame({ seed, onComplete, restoredErrorCount }: BabaYagaGameProps) {
  const isFrozen = restoredErrorCount !== null && restoredErrorCount !== undefined
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(isFrozen)
  const rngRef = useRef(rngFromSeed(seed))
  const errorsRef = useRef(0)
  const collectedRef = useRef(0)
  const stepRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  // Recipe — 7 уникальных ингредиентов из 8 в случайном порядке
  const recipe = useMemo<Ingredient[]>(() => {
    const pool = shuffle(ALL_INGREDIENTS, rngRef.current).slice(0, RECIPE_LENGTH)
    return shuffle(pool, rngRef.current)
  }, [])

  const [phase, setPhase] = useState<'reference' | 'play'>(isFrozen ? 'play' : 'reference')
  const [refCountdown, setRefCountdown] = useState(REFERENCE_SECONDS)
  const [playCountdown, setPlayCountdown] = useState(PLAY_SECONDS)
  const [collected, setCollected] = useState(0)
  const [, forceRerender] = useState(0)

  // Размеры канваса. Мониторим через ResizeObserver и используем для
  // расчёта раскладки в DOM-overlay (хит-зоны слотов) и в Pixi-рендере.
  const [canvasDims, setCanvasDims] = useState<{ w: number; h: number } | null>(null)

  // Слоты — текущая раскладка 7 ингредиентов
  const slotsRef = useRef<SlotState[]>([])
  const bubblesRef = useRef<Bubble[]>([])
  const explosionsRef = useRef<ExplosionParticle[]>([])

  // Инициализация: первая раскладка = recipe (на reference визуально
  // показывает порядок «слева направо, сверху вниз»)
  if (slotsRef.current.length === 0) {
    slotsRef.current = recipe.map(ing => ({
      ingredient: ing,
      anim: { state: 'idle' as const, startedAt: 0, targetX: 0, targetY: 0, homeX: 0, homeY: 0 },
    }))
  }

  /** errorCount = неправильные клики + несобранные ингредиенты.
   *  Стандартная лесенка по ошибкам: 0 = идеально, 1 = победа, ≥2 = провал. */
  const complete = () => {
    if (doneRef.current) return
    doneRef.current = true
    const missing = Math.max(0, RECIPE_LENGTH - collectedRef.current)
    const ec = errorsRef.current + missing
    haptic?.notificationOccurred(ec === 0 ? 'success' : ec === 1 ? 'warning' : 'error')
    playSound(ec <= 1 ? 'win' : 'lose')
    onCompleteRef.current(ec)
    // Финальная сцена: оставшиеся слоты по одному падают в котёл с задержкой
    triggerDrain()
  }

  // Финальная сцена: циклический «дождь» ингредиентов сверху в котёл.
  // Раз в DRAIN_INTERVAL_MS из верха канваса спавнится частица — летит
  // 1.2 сек по дуге в жерло котла, на приземлении взлетают зелёные пузыри.
  // Цикл повторяется бесконечно, пока компонент смонтирован (т.е. до
  // навигации). Слоты-карты убираем — после complete их все ставим в
  // state 'consumed' (невидимы), сцена остаётся «бабушка-варит-зелье».
  const drainModeRef = useRef(false)
  const drainParticlesRef = useRef<Array<{
    ingredient: Ingredient
    startedAt: number
    durationMs: number
    startX: number
    startY: number
    targetX: number
    targetY: number
    spin: number
  }>>([])
  const drainNextSpawnRef = useRef(0)
  const triggerDrain = () => {
    drainModeRef.current = true
    // Прячем все слоты — финальный «дождь» приходит сверху, отдельно от них
    for (const slot of slotsRef.current) {
      slot.anim.state = 'consumed'
      slot.anim.startedAt = performance.now()
    }
    drainNextSpawnRef.current = performance.now()  // первая частица сразу
  }

  // Мониторим размер канваса — для DOM-overlay хит-зон и совпадающей с Pixi
  // В frozen-режиме (после F5) сразу запускаем drain — финальная сцена с
  // падающими в котёл ингредиентами вместо статичной раскладки.
  useEffect(() => {
    if (!isFrozen) return
    if (!canvasDims) return
    const id = setTimeout(triggerDrain, 200)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFrozen, canvasDims])

  // раскладки. autoDensity:true делает app.canvas.style.width в CSS-пикселях,
  // что совпадает с ResizeObserver.contentRect.
  useEffect(() => {
    if (!refMount.current) return
    const el = refMount.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      setCanvasDims({ w: rect.width, h: rect.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (isFrozen) return
    if (phase !== 'reference') return
    setRefCountdown(REFERENCE_SECONDS)
    const id = setInterval(() => {
      setRefCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          // Перед стартом игры перетасовываем ингредиенты: в reference они
          // лежали в порядке рецепта (для запоминания), на игру — должны
          // оказаться на других местах, иначе первый шаг тривиален.
          const slots = slotsRef.current
          const ings = slots.map(s => s.ingredient)
          for (let i = ings.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[ings[i], ings[j]] = [ings[j], ings[i]]
          }
          const now = performance.now()
          for (let i = 0; i < slots.length; i++) {
            slots[i].ingredient = ings[i]
            slots[i].anim = {
              state: 'reappearing',
              startedAt: now,
              targetX: 0, targetY: 0,
              homeX: slots[i].anim.homeX,
              homeY: slots[i].anim.homeY,
            }
          }
          setPhase('play')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, isFrozen])

  useEffect(() => {
    if (isFrozen) return
    if (phase !== 'play') return
    setPlayCountdown(PLAY_SECONDS)
    const id = setInterval(() => {
      setPlayCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          complete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isFrozen])

  // ── Pixi init ────────────────────────────────────────────────────────────
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
      // SVG-декор с position:absolute стакается над static canvas — без явного
      // z-index канвас оказывается под SVG, и тапы могут не доходить. Поднимаем.
      app.canvas.style.position = 'relative'
      app.canvas.style.zIndex = '1'
      refApp.current = app
    })()
    return () => {
      cancelled = true
      if (refApp.current) {
        try { refApp.current.destroy(true, { children: true }) } catch { /* noop */ }
        refApp.current = null
      }
    }
  }, [])

  // ── Главный рендер-цикл через rAF ────────────────────────────────────────
  // Каждый кадр: очищаем сцену → рисуем котёл → 7 слотов с их анимациями
  // → пузыри → искры взрывов. Никаких отдельных pixi-контейнеров «надолго»
  // — всё пересоздаётся каждый кадр, так проще управлять анимациями.
  useEffect(() => {
    let raf = 0
    let cancelled = false
    const tick = () => {
      const app = refApp.current
      if (cancelled) return
      if (!app) {
        raf = requestAnimationFrame(tick)
        return
      }

      const W = app.screen.width
      const H = app.screen.height
      app.stage.removeChildren()

      const layout = computeLayout(W, H)
      const { cauldronW, cauldronH, cauldronCX, cauldronTopY, cauldronMouthY,
              slotW, slotH, positions } = layout
      void cauldronMouthY  // используется ниже в обработчиках
      const cauldronG = new Graphics()
      drawCauldron(cauldronG, cauldronW, cauldronH)
      const cCtr = new Container()
      cCtr.x = cauldronCX
      cCtr.y = cauldronTopY
      cCtr.addChild(cauldronG)
      app.stage.addChild(cCtr)

      const now = performance.now()
      const slots = slotsRef.current

      // ── Слоты ──────────────────────────────────────────────────────────
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]
        const pos = positions[i] ?? { x: W / 2, y: H / 2 }
        slot.anim.homeX = pos.x
        slot.anim.homeY = pos.y

        let drawX = pos.x
        let drawY = pos.y
        let scale = 1
        let alpha = 1
        let rotation = 0
        let cardState: 'normal' | 'correct' | 'wrong' | 'consumed' = 'normal'
        let drawCard = true

        if (slot.anim.state === 'consumed') {
          drawCard = false  // в котле — не рисуем
        } else if (slot.anim.state === 'flying') {
          const t = Math.min(1, (now - slot.anim.startedAt) / FLY_MS)
          const eased = t * t
          drawX = pos.x + (slot.anim.targetX - pos.x) * eased
          drawY = pos.y + (slot.anim.targetY - pos.y) * eased
          scale = 1 - eased * 0.6
          alpha = 1 - Math.max(0, (t - 0.8) / 0.2)
          rotation = eased * Math.PI * 0.6
          cardState = 'correct'
        } else if (slot.anim.state === 'shake') {
          const t = Math.min(1, (now - slot.anim.startedAt) / SHAKE_MS)
          const shake = Math.sin(t * Math.PI * 8) * (1 - t) * 6
          drawX = pos.x + shake
          drawY = pos.y - Math.sin(t * Math.PI) * 4
          rotation = shake * 0.03
          cardState = 'wrong'
        } else if (slot.anim.state === 'reappearing') {
          const t = Math.min(1, (now - slot.anim.startedAt) / 300)
          scale = 0.6 + 0.4 * t + (t > 0.7 ? (1 - t) * 0.4 : 0)
          alpha = t
        }

        if (drawCard) {
          const ctr = new Container()
          // Состояние cardState раньше окрашивало рамку; сейчас рамок нет,
          // визуал «правильно/неправильно» выражают анимации (полёт, тряска,
          // зелёные пузыри, искры взрыва). Параметр оставлен на будущее.
          void cardState
          addIngredientEmoji(ctr, slot.ingredient, Math.min(slotW, slotH) * 0.46)
          ctr.x = drawX
          ctr.y = drawY
          ctr.scale.set(scale)
          ctr.rotation = rotation
          ctr.alpha = alpha
          // Тапы обрабатываются в DOM-overlay (см. JSX ниже), здесь Pixi
          // только рисует. Это надёжнее, чем pointertap на перерисовываемых
          // каждый кадр контейнерах — у них pointerdown и pointerup попадают
          // на разные инстансы, и тап не регистрируется.
          app.stage.addChild(ctr)
        }

        // Переходы между состояниями
        if (slot.anim.state === 'flying' && now - slot.anim.startedAt >= FLY_MS) {
          finalizeCorrectPick()
        } else if (slot.anim.state === 'shake' && now - slot.anim.startedAt >= SHAKE_MS) {
          slot.anim.state = 'idle'
        } else if (slot.anim.state === 'reappearing' && now - slot.anim.startedAt >= 300) {
          slot.anim.state = 'idle'
        }
      }

      // ── Циклический дождь после игры ─────────────────────────────────
      // Раз в DRAIN_INTERVAL_MS из верха канваса вылетает новая частица —
      // случайный ингредиент из рецепта, летит по дуге в жерло котла.
      if (drainModeRef.current) {
        const DRAIN_INTERVAL_MS = 650
        const DRAIN_FALL_MS = 1300
        if (now >= drainNextSpawnRef.current) {
          drainNextSpawnRef.current = now + DRAIN_INTERVAL_MS
          const ing = recipe[Math.floor(Math.random() * recipe.length)]
          drainParticlesRef.current.push({
            ingredient: ing,
            startedAt: now,
            durationMs: DRAIN_FALL_MS,
            startX: cauldronCX + (Math.random() - 0.5) * (W * 0.5),
            startY: -slotH * 0.5,
            targetX: cauldronCX + (Math.random() - 0.5) * (cauldronW * 0.25),
            targetY: cauldronMouthY,
            spin: (Math.random() - 0.5) * Math.PI * 3,
          })
        }
        const particles = drainParticlesRef.current
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]
          const t = (now - p.startedAt) / p.durationMs
          if (t >= 1) {
            particles.splice(i, 1)
            spawnBubbles(cauldronCX, cauldronMouthY)
            continue
          }
          const eased = t * t * 0.85 + t * 0.15  // ускорение к низу
          const cx = p.startX + (p.targetX - p.startX) * eased
          const cy = p.startY + (p.targetY - p.startY) * eased
          const fadeAlpha = t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1
          const c = new Container()
          c.x = cx
          c.y = cy
          c.rotation = p.spin * eased
          c.alpha = fadeAlpha
          c.scale.set(1 - eased * 0.3)
          addIngredientEmoji(c, p.ingredient, slotH * 0.46)
          app.stage.addChild(c)
        }
      }

      // ── Зелёные пузыри над котлом (правильный ответ) ──────────────────
      const bubbles = bubblesRef.current
      const bubblesGfx = new Graphics()
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]
        const t = (now - b.startedAt) / b.durationMs
        if (t < 0) continue   // ещё не стартовал (с задержкой)
        if (t >= 1) { bubbles.splice(i, 1); continue }
        const eased = 1 - Math.pow(1 - t, 2)
        const cx = b.x0 + b.driftX * eased
        const cy = b.y0 - (cauldronH * 0.85) * eased
        const a = 1 - t
        bubblesGfx.circle(cx, cy, b.radius * (0.7 + 0.3 * (1 - t)))
          .fill({ color: 0x80E090, alpha: a * 0.85 })
          .stroke({ width: 1.5, color: 0x4FD89C, alpha: a * 0.95 })
      }
      app.stage.addChild(bubblesGfx)

      // ── Искры взрыва (неправильный ответ) ─────────────────────────────
      const exps = explosionsRef.current
      const expsGfx = new Graphics()
      for (let i = exps.length - 1; i >= 0; i--) {
        const p = exps[i]
        const t = (now - p.startedAt) / p.durationMs
        if (t >= 1) { exps.splice(i, 1); continue }
        const cx = p.x + p.vx * t
        const cy = p.y + p.vy * t + (220 * t * t)
        const r = 5 * (1 - t * 0.5)
        const a = 1 - t
        expsGfx.circle(cx, cy, r)
          .fill({ color: t < 0.4 ? 0xFFCB45 : 0xFF6020, alpha: a })
      }
      app.stage.addChild(expsGfx)

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Обработчики ──────────────────────────────────────────────────────────

  const onPickSlot = (slotIdx: number) => {
    if (doneRef.current || isFrozen) return
    if (phase !== 'play') return
    if (!canvasDims) return
    const slot = slotsRef.current[slotIdx]
    if (!slot || slot.anim.state !== 'idle') return
    const { cauldronCX, cauldronMouthY } = computeLayout(canvasDims.w, canvasDims.h)

    const expected = recipe[stepRef.current]
    const isCorrect = slot.ingredient === expected
    if (isCorrect) {
      slot.anim.state = 'flying'
      slot.anim.startedAt = performance.now()
      slot.anim.targetX = cauldronCX
      slot.anim.targetY = cauldronMouthY
      haptic?.notificationOccurred('success')
      playSound('seal')
    } else {
      slot.anim.state = 'shake'
      slot.anim.startedAt = performance.now()
      errorsRef.current += 1
      haptic?.notificationOccurred('error')
      playSound('lose')
      spawnExplosion(slot.anim.homeX, slot.anim.homeY)
      forceRerender(x => x + 1)
    }
  }

  const spawnExplosion = (x: number, y: number) => {
    const now = performance.now()
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4
      const speed = 80 + Math.random() * 60
      explosionsRef.current.push({
        startedAt: now,
        durationMs: 600,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
      })
    }
  }

  const spawnBubbles = (cauldronCX: number, cauldronTopY: number) => {
    const now = performance.now()
    for (let i = 0; i < 8; i++) {
      bubblesRef.current.push({
        startedAt: now + i * 40,
        durationMs: 900 + Math.random() * 400,
        x0: cauldronCX + (Math.random() - 0.5) * 60,
        y0: cauldronTopY,
        driftX: (Math.random() - 0.5) * 50,
        radius: 4 + Math.random() * 5,
      })
    }
  }

  /** Ингредиент долетел до котла. Шафлим 7 слотов и запускаем reappearing. */
  const finalizeCorrectPick = () => {
    const slots = slotsRef.current
    const ingredients = slots.map(s => s.ingredient)
    // Перетасовываем — каждое правильное действие даёт новую раскладку.
    // Math.random здесь намеренно (rngRef быстро вычерпывается за игру).
    for (let i = ingredients.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ingredients[i], ingredients[j]] = [ingredients[j], ingredients[i]]
    }
    if (canvasDims) {
      const { cauldronCX, cauldronMouthY } = computeLayout(canvasDims.w, canvasDims.h)
      spawnBubbles(cauldronCX, cauldronMouthY)
    }
    const now = performance.now()
    for (let i = 0; i < slots.length; i++) {
      slots[i].ingredient = ingredients[i]
      slots[i].anim = {
        state: 'reappearing',
        startedAt: now,
        targetX: 0, targetY: 0,
        homeX: slots[i].anim.homeX,
        homeY: slots[i].anim.homeY,
      }
    }
    stepRef.current += 1
    collectedRef.current += 1
    setCollected(collectedRef.current)
    if (collectedRef.current >= RECIPE_LENGTH) {
      complete()
    }
  }

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      maxWidth: '500px', margin: '0 auto', width: '100%', boxSizing: 'border-box',
      padding: spacing.md,
    }}>
      <div style={{
        textAlign: 'center',
        color: phase === 'reference' ? colors.fairyGold : (playCountdown <= 5 && !isFrozen ? colors.danger : colors.fairyGold),
        fontWeight: 700, fontSize: '17px',
      }}>
        {isFrozen
          ? 'Котёл Бабы Яги · разобрано'
          : phase === 'reference'
            ? `Запомни порядок · ${refCountdown}`
            : `Котёл Бабы Яги · ${playCountdown} сек`}
      </div>
      <div style={{
        color: colors.textMuted, fontSize: '12px', textAlign: 'center',
        marginBottom: spacing.sm, lineHeight: 1.4,
      }}>
        {phase === 'reference'
          ? 'Слева направо, сверху вниз — порядок броска ингредиентов'
          : isFrozen
            ? 'Уже сыграно'
            : `Шаг ${Math.min(collected + 1, RECIPE_LENGTH)} из ${RECIPE_LENGTH}. Бросай ингредиенты в котёл по порядку`}
      </div>

      {/* Прогресс-точки 7 шт (только в play, не во frozen) */}
      {phase === 'play' && !isFrozen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            display: 'flex', gap: 6, justifyContent: 'center',
            marginBottom: spacing.sm,
          }}
        >
          {Array.from({ length: RECIPE_LENGTH }).map((_, i) => {
            const filled = i < collected
            const isCurrent = i === collected
            const borderColor = filled ? colors.success : isCurrent ? colors.fairyGold : colors.cardBorder
            const bgColor = filled ? `${colors.success}22` : isCurrent ? `${colors.fairyGold}22` : 'rgba(255,255,255,0.04)'
            return (
              <div key={i} style={{
                width: 22, height: 22, borderRadius: '50%',
                background: bgColor,
                border: `2px solid ${borderColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800,
                color: filled ? colors.success : isCurrent ? colors.fairyGold : colors.textMuted,
                transition: 'all 0.25s',
              }}>
                {filled ? '✓' : isCurrent ? '?' : '·'}
              </div>
            )
          })}
        </motion.div>
      )}

      {/* Канвас с котлом и ингредиентами */}
      <div
        ref={refMount}
        style={{
          flex: 1, width: '100%', minHeight: 460,
          touchAction: 'manipulation', position: 'relative',
          borderRadius: 16, overflow: 'hidden',
          background: `
            radial-gradient(ellipse at 50% 100%, rgba(40,60,40,0.6) 0%, transparent 70%),
            linear-gradient(to bottom, #0F1322 0%, #1A2030 40%, #1F2828 70%, #18221C 100%)
          `,
          boxShadow: 'inset 0 0 80px rgba(0,40,20,0.4)',
        }}
      >
        {/* SVG-декор: коряги по краям + болотные огоньки */}
        <svg
          viewBox="0 0 320 400"
          preserveAspectRatio="xMidYMax slice"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'none', opacity: 0.7, zIndex: 0,
          }}
        >
          <defs>
            <radialGradient id="bogfire1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#90E060" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#90E060" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M 0 380 Q 30 360 25 340 Q 22 320 35 310 L 25 320 L 18 305 L 8 320 L 0 350 Z"
                fill="#1A1A1A" opacity="0.8" />
          <path d="M 320 390 Q 290 370 295 348 Q 298 326 285 318 L 295 328 L 302 313 L 312 326 L 320 358 Z"
                fill="#1A1A1A" opacity="0.8" />
          <circle cx="50" cy="280" r="14" fill="url(#bogfire1)">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="280" cy="300" r="10" fill="url(#bogfire1)">
            <animate attributeName="opacity" values="1;0.3;1" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="160" cy="50" r="8" fill="url(#bogfire1)">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="4s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* DOM-overlay для тапов — Pixi-обработчики на пересоздаваемых каждый
            кадр контейнерах не успевают сопоставить pointerdown и pointerup.
            7 невидимых кнопок поверх канваса, тапы идут сюда. */}
        {!isFrozen && phase === 'play' && canvasDims && computeLayout(canvasDims.w, canvasDims.h).positions.map((pos, i) => {
          const layout = computeLayout(canvasDims.w, canvasDims.h)
          return (
            <button
              key={i}
              onClick={() => onPickSlot(i)}
              aria-label={`Слот ${i + 1}`}
              style={{
                position: 'absolute',
                left: pos.x - layout.slotW / 2,
                top: pos.y - layout.slotH / 2,
                width: layout.slotW,
                height: layout.slotH,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                zIndex: 2,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
