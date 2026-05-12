import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Application, Container, Graphics, Text } from 'pixi.js'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const REFERENCE_SECONDS = 6
const PLAY_SECONDS = 20
const RECIPE_LENGTH = 5
const OPTIONS_PER_ROUND = 5
const FEEDBACK_MS = 450

interface BabaYagaGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
}

type Ingredient = 'frog' | 'mushroom' | 'bat' | 'skull' | 'moonstone' | 'spider' | 'fang' | 'feather'
const ALL_INGREDIENTS: Ingredient[] = ['frog', 'mushroom', 'bat', 'skull', 'moonstone', 'spider', 'fang', 'feather']

// ── Процедурное рисование ингредиентов (2D Pixi, без 3D) ──────────────────

function drawFrog(g: Graphics, size: number) {
  const green = 0x4A8A3E
  const greenD = 0x2A5022
  g.ellipse(0, size * 0.15, size * 0.55, size * 0.4).fill(green).stroke({ width: 2, color: greenD })
  g.circle(-size * 0.35, -size * 0.15, size * 0.18).fill(green).stroke({ width: 2, color: greenD })
  g.circle(size * 0.35, -size * 0.15, size * 0.18).fill(green).stroke({ width: 2, color: greenD })
  g.circle(-size * 0.35, -size * 0.15, size * 0.1).fill(0xF5E4C7)
  g.circle(size * 0.35, -size * 0.15, size * 0.1).fill(0xF5E4C7)
  g.circle(-size * 0.35, -size * 0.13, size * 0.05).fill(0x0D1735)
  g.circle(size * 0.35, -size * 0.13, size * 0.05).fill(0x0D1735)
  g.moveTo(-size * 0.2, size * 0.25).lineTo(size * 0.2, size * 0.25).stroke({ width: 3, color: greenD })
  g.ellipse(-size * 0.45, size * 0.35, size * 0.15, size * 0.08).fill(green).stroke({ width: 2, color: greenD })
  g.ellipse(size * 0.45, size * 0.35, size * 0.15, size * 0.08).fill(green).stroke({ width: 2, color: greenD })
}

function drawMushroom(g: Graphics, size: number) {
  g.poly([
    -size * 0.55, size * 0.05,
    -size * 0.5, -size * 0.35,
    size * 0.5, -size * 0.35,
    size * 0.55, size * 0.05,
  ]).fill(0xC03030).stroke({ width: 2, color: 0x5A0808 })
  g.poly([-size * 0.55, size * 0.05, -size * 0.5, -size * 0.35, size * 0.5, -size * 0.35, size * 0.55, size * 0.05, 0, size * 0.18]).fill(0xC03030)
  g.circle(-size * 0.25, -size * 0.15, size * 0.07).fill(0xFFFFFF)
  g.circle(size * 0.15, -size * 0.2, size * 0.08).fill(0xFFFFFF)
  g.circle(size * 0.3, size * 0.0, size * 0.06).fill(0xFFFFFF)
  g.circle(-size * 0.05, -size * 0.05, size * 0.05).fill(0xFFFFFF)
  g.rect(-size * 0.2, size * 0.05, size * 0.4, size * 0.5).fill(0xF5E4C7).stroke({ width: 2, color: 0x8C6200 })
  g.ellipse(0, size * 0.2, size * 0.25, size * 0.06).fill(0xE0CC9A).stroke({ width: 1.5, color: 0x8C6200 })
}

function drawBatWing(g: Graphics, size: number) {
  const dark = 0x3A2A50
  const darkD = 0x1A1024
  g.poly([
    -size * 0.6, -size * 0.2,
    -size * 0.5, -size * 0.5,
    -size * 0.2, -size * 0.55,
    size * 0.0, -size * 0.4,
    size * 0.2, -size * 0.55,
    size * 0.45, -size * 0.4,
    size * 0.5, -size * 0.1,
    size * 0.35, size * 0.2,
    size * 0.1, size * 0.35,
    -size * 0.15, size * 0.4,
    -size * 0.45, size * 0.2,
  ]).fill(dark).stroke({ width: 2, color: darkD })
  g.moveTo(-size * 0.55, -size * 0.45).lineTo(-size * 0.15, size * 0.35).stroke({ width: 2, color: darkD })
  g.moveTo(-size * 0.15, -size * 0.55).lineTo(-size * 0.1, size * 0.35).stroke({ width: 2, color: darkD })
  g.moveTo(size * 0.2, -size * 0.5).lineTo(size * 0.15, size * 0.3).stroke({ width: 2, color: darkD })
  g.moveTo(size * 0.45, -size * 0.4).lineTo(size * 0.4, size * 0.15).stroke({ width: 2, color: darkD })
}

function drawSkull(g: Graphics, size: number) {
  g.circle(0, -size * 0.05, size * 0.5).fill(0xEDE3D0).stroke({ width: 2, color: 0x6F5A30 })
  g.circle(-size * 0.18, -size * 0.1, size * 0.13).fill(0x0D0510)
  g.circle(size * 0.18, -size * 0.1, size * 0.13).fill(0x0D0510)
  g.poly([0, size * 0.05, -size * 0.06, size * 0.18, size * 0.06, size * 0.18]).fill(0x0D0510)
  g.rect(-size * 0.3, size * 0.3, size * 0.6, size * 0.18).fill(0xEDE3D0).stroke({ width: 2, color: 0x6F5A30 })
  for (let i = 0; i < 4; i++) {
    g.rect(-size * 0.25 + i * size * 0.14, size * 0.3, size * 0.04, size * 0.12).fill(0x6F5A30)
  }
}

function drawMoonstone(g: Graphics, size: number) {
  g.circle(0, 0, size * 0.55).fill({ color: 0x8FB0E0, alpha: 0.3 })
  g.ellipse(0, 0, size * 0.35, size * 0.5).fill(0xBFD4F2).stroke({ width: 2, color: 0x4A6A90 })
  g.moveTo(0, -size * 0.45).lineTo(-size * 0.3, 0).stroke({ width: 1.5, color: 0x4A6A90 })
  g.moveTo(0, -size * 0.45).lineTo(size * 0.3, 0).stroke({ width: 1.5, color: 0x4A6A90 })
  g.moveTo(0, size * 0.45).lineTo(-size * 0.3, 0).stroke({ width: 1.5, color: 0x4A6A90 })
  g.moveTo(0, size * 0.45).lineTo(size * 0.3, 0).stroke({ width: 1.5, color: 0x4A6A90 })
  g.moveTo(0, 0).lineTo(0, -size * 0.45).stroke({ width: 1.5, color: 0x4A6A90 })
  g.ellipse(-size * 0.1, -size * 0.2, size * 0.08, size * 0.15).fill(0xFFFFFF)
}

function drawSpider(g: Graphics, size: number) {
  const dark = 0x1A1024
  g.ellipse(0, size * 0.05, size * 0.25, size * 0.3).fill(dark).stroke({ width: 2, color: 0x000000 })
  g.circle(0, -size * 0.25, size * 0.18).fill(dark).stroke({ width: 2, color: 0x000000 })
  g.circle(-size * 0.08, -size * 0.28, size * 0.04).fill(0xFF4040)
  g.circle(size * 0.08, -size * 0.28, size * 0.04).fill(0xFF4040)
  for (let i = 0; i < 4; i++) {
    const ly = -size * 0.1 + i * size * 0.08
    g.moveTo(-size * 0.25, ly).lineTo(-size * 0.6, ly - size * 0.15).stroke({ width: 2, color: 0x000000 })
    g.moveTo(size * 0.25, ly).lineTo(size * 0.6, ly - size * 0.15).stroke({ width: 2, color: 0x000000 })
  }
  g.moveTo(0, -size * 0.5).lineTo(0, -size * 0.85).stroke({ width: 1, color: 0xCCCCDD })
}

function drawFang(g: Graphics, size: number) {
  g.poly([
    -size * 0.2, -size * 0.55,
    size * 0.2, -size * 0.55,
    size * 0.05, size * 0.55,
    -size * 0.05, size * 0.55,
  ]).fill(0xF8F2E0).stroke({ width: 2, color: 0x6F5A30 })
  g.poly([
    -size * 0.2, -size * 0.55,
    size * 0.2, -size * 0.55,
    size * 0.12, -size * 0.25,
    -size * 0.12, -size * 0.25,
  ]).fill(0x6F5A30)
  g.rect(-size * 0.15, -size * 0.5, size * 0.06, size * 0.9).fill({ color: 0xFFFFFF, alpha: 0.4 })
  g.circle(0, size * 0.55, size * 0.06).fill(0x8C2020)
}

function drawFeather(g: Graphics, size: number) {
  const dark = 0x1A1024
  g.moveTo(0, -size * 0.6).lineTo(0, size * 0.6).stroke({ width: 2.5, color: 0x4A2A05 })
  for (let i = 0; i < 10; i++) {
    const ty = -size * 0.5 + i * size * 0.11
    const len = (i < 5 ? size * 0.05 + i * size * 0.06 : size * 0.35 - (i - 5) * size * 0.05)
    g.moveTo(0, ty).lineTo(-len, ty - size * 0.04).stroke({ width: 1.5, color: dark })
    g.moveTo(0, ty).lineTo(len, ty - size * 0.04).stroke({ width: 1.5, color: dark })
  }
  g.poly([
    0, -size * 0.6,
    size * 0.25, -size * 0.1,
    size * 0.1, size * 0.55,
    -size * 0.1, size * 0.55,
    -size * 0.25, -size * 0.1,
  ]).stroke({ width: 1.5, color: 0x2A1A05 })
}

const DRAWERS: Record<Ingredient, (g: Graphics, size: number) => void> = {
  frog: drawFrog,
  mushroom: drawMushroom,
  bat: drawBatWing,
  skull: drawSkull,
  moonstone: drawMoonstone,
  spider: drawSpider,
  fang: drawFang,
  feather: drawFeather,
}

function drawIngredientCard(g: Graphics, ing: Ingredient, w: number, h: number, state: 'normal' | 'correct' | 'wrong' | 'consumed') {
  const bg = state === 'correct' ? 0x1A3D2A
            : state === 'wrong' ? 0x3D1A1A
            : state === 'consumed' ? 0x1A1438
            : 0x1B1438
  const border = state === 'correct' ? 0x4FD89C
                : state === 'wrong' ? 0xE06060
                : state === 'consumed' ? 0x444444
                : 0xFFB800
  g.roundRect(-w / 2, -h / 2, w, h, 14).fill(bg).stroke({ width: 3, color: border })
  DRAWERS[ing](g, Math.min(w, h) * 0.36)
}

/** Большой котёл — рисуем процедурно через Pixi.Graphics: тело + ободок + ножки + пар */
function drawCauldron(g: Graphics, w: number, h: number) {
  // Тело котла
  const bodyColor = 0x2A1A20
  const rimColor = 0x6B4A28
  // Основа (полуэллипс + прямоугольник снизу)
  g.ellipse(0, h * 0.2, w * 0.5, h * 0.3).fill(bodyColor).stroke({ width: 3, color: rimColor })
  g.rect(-w * 0.5, h * 0.0, w, h * 0.2).fill(bodyColor)
  // Верхний ободок-эллипс (видимая верхняя овальная грань)
  g.ellipse(0, -h * 0.0, w * 0.5, h * 0.12).fill(0x4A2A20).stroke({ width: 3, color: rimColor })
  g.ellipse(0, -h * 0.02, w * 0.45, h * 0.10).fill(0x150810)
  // «Бурлящая» жидкость внутри
  g.ellipse(0, -h * 0.02, w * 0.4, h * 0.08).fill({ color: 0x6A3030, alpha: 0.7 })
  g.ellipse(-w * 0.1, -h * 0.04, w * 0.08, h * 0.03).fill({ color: 0xC0608A, alpha: 0.8 })
  g.ellipse(w * 0.15, -h * 0.05, w * 0.06, h * 0.025).fill({ color: 0xC0608A, alpha: 0.8 })
  // Ручка-кольцо слева и справа
  g.ellipse(-w * 0.52, -h * 0.05, w * 0.08, h * 0.04).fill({ color: 0, alpha: 0 }).stroke({ width: 4, color: rimColor })
  g.ellipse(w * 0.52, -h * 0.05, w * 0.08, h * 0.04).fill({ color: 0, alpha: 0 }).stroke({ width: 4, color: rimColor })
  // Ножки
  g.rect(-w * 0.28, h * 0.45, w * 0.08, h * 0.18).fill(rimColor)
  g.rect(w * 0.20, h * 0.45, w * 0.08, h * 0.18).fill(rimColor)
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function BabaYagaGame({ seed, onComplete }: BabaYagaGameProps) {
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(false)
  const rngRef = useRef(rngFromSeed(seed))
  const errorsRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  // Выбираем 5 ингредиентов из 8 — детерминированно из seed
  const recipeIngredients = useMemo<Ingredient[]>(() => {
    const shuffled = shuffle(ALL_INGREDIENTS, rngRef.current)
    return shuffled.slice(0, RECIPE_LENGTH)
  }, [])
  // Порядок выбранных 5 ингредиентов в рецепте Бабы Яги
  const recipeOrder = useMemo<Ingredient[]>(() => {
    return shuffle(recipeIngredients, rngRef.current)
  }, [recipeIngredients])

  const [phase, setPhase] = useState<'reference' | 'play'>('reference')
  const [refCountdown, setRefCountdown] = useState(REFERENCE_SECONDS)
  const [playCountdown, setPlayCountdown] = useState(PLAY_SECONDS)
  const [round, setRound] = useState(0)
  const [consumed, setConsumed] = useState<Set<Ingredient>>(() => new Set())
  const [recipeProgress, setRecipeProgress] = useState<(Ingredient | null)[]>(() => Array(RECIPE_LENGTH).fill(null))
  const [stepErrors, setStepErrors] = useState(0)
  const [feedback, setFeedback] = useState<{ ing: Ingredient; state: 'correct' | 'wrong' } | null>(null)
  const [showCauldron, setShowCauldron] = useState(false)
  const cauldronStartRef = useRef<number>(0)
  const phaseRef = useRef(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])
  const roundRef = useRef(0)
  useEffect(() => { roundRef.current = round }, [round])

  const complete = (errors: number) => {
    if (doneRef.current) return
    doneRef.current = true
    const ec = Math.max(0, errors)
    haptic?.notificationOccurred(ec === 0 ? 'success' : ec === 1 ? 'warning' : 'error')
    playSound(ec <= 1 ? 'win' : 'lose')
    cauldronStartRef.current = performance.now()
    setTimeout(() => setShowCauldron(true), 80)
    onCompleteRef.current(ec)
  }

  useEffect(() => {
    if (phase !== 'reference') return
    setRefCountdown(REFERENCE_SECONDS)
    const id = setInterval(() => {
      setRefCountdown(prev => {
        if (prev <= 1) { clearInterval(id); setPhase('play'); return 0 }
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
          const remaining = RECIPE_LENGTH - roundRef.current
          complete(errorsRef.current + remaining)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const onPick = (ing: Ingredient) => {
    if (doneRef.current) return
    if (phaseRef.current !== 'play') return
    if (feedback) return
    if (consumed.has(ing)) return
    const correctIng = recipeOrder[roundRef.current]
    const isCorrect = ing === correctIng
    if (isCorrect) {
      haptic?.notificationOccurred('success')
      playSound('seal')
      setFeedback({ ing, state: 'correct' })
    } else {
      haptic?.notificationOccurred('error')
      playSound('lose')
      errorsRef.current += 1
      setStepErrors(prev => prev + 1)
      setFeedback({ ing, state: 'wrong' })
    }
    setTimeout(() => {
      setFeedback(null)
      if (isCorrect) {
        setConsumed(prev => new Set(prev).add(ing))
        setRecipeProgress(prev => {
          const next = prev.slice()
          next[roundRef.current] = ing
          return next
        })
        setStepErrors(0)
        const nextRound = roundRef.current + 1
        if (nextRound >= RECIPE_LENGTH) {
          complete(errorsRef.current)
          return
        }
        setRound(nextRound)
      }
    }, FEEDBACK_MS)
  }

  // ── Pixi-инициализация ───────────────────────────────────────────────────
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
    })()
    return () => {
      cancelled = true
      if (refApp.current) {
        try { refApp.current.destroy(true, { children: true }) } catch { /* noop */ }
        refApp.current = null
      }
    }
  }, [])

  // ── Рендер сцены: ингредиенты или финальная анимация ─────────────────────
  useEffect(() => {
    let cancelled = false
    let tickerCb: (() => void) | null = null
    const render = () => {
      const app = refApp.current
      if (cancelled) return
      if (!app) {
        requestAnimationFrame(render)
        return
      }
      // Очистка стейджа и старого тикера
      app.stage.removeChildren()
      if (tickerCb) { try { app.ticker.remove(tickerCb) } catch { /* noop */ }; tickerCb = null }

      const W = app.screen.width
      const H = app.screen.height

      // ── Финальная сцена: котёл + падающие ингредиенты ────────────────
      if (showCauldron) {
        // Котёл по центру-низу, крупный
        const cauldronW = Math.min(W * 0.7, 280)
        const cauldronH = cauldronW * 0.6
        const cauldronCY = H - cauldronH * 0.5 - 12
        const cauldron = new Graphics()
        drawCauldron(cauldron, cauldronW, cauldronH)
        const cCtr = new Container()
        cCtr.x = W / 2
        cCtr.y = cauldronCY
        cCtr.addChild(cauldron)
        app.stage.addChild(cCtr)

        // Пар над котлом — лёгкие облачка через эллипсы
        const steam = new Graphics()
        for (let i = 0; i < 3; i++) {
          steam.ellipse(-30 + i * 30, -i * 14, 18, 10).fill({ color: 0xCFCFE5, alpha: 0.18 })
        }
        steam.x = W / 2
        steam.y = cauldronCY - cauldronH * 0.4
        app.stage.addChild(steam)

        // 5 падающих ингредиентов в цикле 5.5 сек, каждый со своей задержкой
        const fallTargetY = cauldronCY - cauldronH * 0.05
        const fallStartY = -80
        const cardSize = Math.min(W * 0.22, 90)
        const fallSprites: Container[] = []
        for (let i = 0; i < recipeIngredients.length; i++) {
          const c = new Container()
          c.visible = false
          c.x = W / 2
          c.y = fallStartY
          const cardG = new Graphics()
          drawIngredientCard(cardG, recipeIngredients[i], cardSize, cardSize, 'normal')
          c.addChild(cardG)
          app.stage.addChild(c)
          fallSprites.push(c)
        }

        const totalCycle = 5.5
        const fallDur = 1.2
        tickerCb = () => {
          const now = performance.now() / 1000
          const elapsed = (now - cauldronStartRef.current / 1000) % totalCycle
          for (let i = 0; i < fallSprites.length; i++) {
            const localT = elapsed - i * 0.8
            const sprite = fallSprites[i]
            if (localT < 0 || localT > fallDur) {
              sprite.visible = false
              continue
            }
            sprite.visible = true
            const progress = localT / fallDur
            const eased = progress * progress  // ускорение
            sprite.y = fallStartY + (fallTargetY - fallStartY) * eased
            // покачивание
            sprite.rotation = Math.sin(now * 6 + i) * 0.18
            // в конце — фейд исчезновения в котле
            sprite.alpha = progress > 0.85 ? Math.max(0, (1 - progress) / 0.15) : 1
          }
        }
        app.ticker.add(tickerCb)
        return
      }

      // ── Обычная игровая сцена: ингредиенты + цифры рецепта ────────────
      // Текущие активные ингредиенты (не съеденные котлом)
      const active = recipeIngredients.filter(i => !consumed.has(i))
      const n = active.length

      // Раскладка зависит от количества:
      //   5: 3+2, 4: 2+2, 3: 3-в-ряд, 2: 2-в-ряд, 1: центр
      const positions: Array<{ x: number; y: number }> = []
      if (n === 5) {
        const colW = W / 3, rowH = H / 3
        positions.push(
          { x: W / 2 - colW, y: rowH * 0.7 },
          { x: W / 2,         y: rowH * 0.7 },
          { x: W / 2 + colW, y: rowH * 0.7 },
          { x: W / 2 - colW / 2, y: rowH * 2.0 },
          { x: W / 2 + colW / 2, y: rowH * 2.0 },
        )
      } else if (n === 4) {
        positions.push(
          { x: W * 0.28, y: H * 0.3 }, { x: W * 0.72, y: H * 0.3 },
          { x: W * 0.28, y: H * 0.7 }, { x: W * 0.72, y: H * 0.7 },
        )
      } else if (n === 3) {
        positions.push({ x: W * 0.2, y: H * 0.5 }, { x: W * 0.5, y: H * 0.5 }, { x: W * 0.8, y: H * 0.5 })
      } else if (n === 2) {
        positions.push({ x: W * 0.28, y: H * 0.5 }, { x: W * 0.72, y: H * 0.5 })
      } else if (n === 1) {
        positions.push({ x: W / 2, y: H / 2 })
      }

      // Размер карточки — крупный
      const cardW = n === 5 ? Math.min(W * 0.28, 130)
                   : n === 4 ? Math.min(W * 0.34, 150)
                   : n === 3 ? Math.min(W * 0.28, 140)
                   : n === 2 ? Math.min(W * 0.42, 180)
                   : Math.min(W * 0.55, 220)
      const cardH = cardW * 1.05

      for (let i = 0; i < active.length; i++) {
        const ing = active[i]
        const pos = positions[i]
        const fb = feedback?.ing === ing ? feedback.state : 'normal'
        const c = new Container()
        c.x = pos.x
        c.y = pos.y
        c.eventMode = 'static'
        c.cursor = 'pointer'
        const cardG = new Graphics()
        drawIngredientCard(cardG, ing, cardW, cardH, fb)
        c.addChild(cardG)

        // Цифра шага в reference-фазе
        if (phase === 'reference') {
          const stepNum = recipeOrder.indexOf(ing) + 1
          const badge = new Graphics()
          badge.circle(0, 0, 16).fill(0xFFB800).stroke({ width: 2, color: 0x3D2A05 })
          const badgeCtr = new Container()
          badgeCtr.x = 0
          badgeCtr.y = -cardH / 2 - 6
          badgeCtr.addChild(badge)
          const t = new Text({
            text: String(stepNum),
            style: { fontFamily: 'Georgia, serif', fontSize: 18, fill: 0x0D1735, fontWeight: '800' },
          })
          t.anchor.set(0.5)
          badgeCtr.addChild(t)
          c.addChild(badgeCtr)
        }

        c.on('pointertap', () => onPick(ing))
        app.stage.addChild(c)
      }
    }
    render()
    return () => {
      cancelled = true
      const app = refApp.current
      if (app && tickerCb) {
        try { app.ticker.remove(tickerCb) } catch { /* noop */ }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, consumed, feedback, showCauldron, recipeIngredients, recipeOrder])

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
          ? `Запомни рецепт · ${refCountdown}`
          : `Котёл Бабы Яги · ${playCountdown} сек`}
      </div>
      <div style={{
        color: colors.textMuted, fontSize: '12px', textAlign: 'center',
        marginBottom: spacing.sm, lineHeight: 1.4,
      }}>
        {phase === 'reference'
          ? 'Цифры — порядок добавления в котёл. Запомни и кидай по очереди.'
          : `Шаг ${Math.min(round + 1, RECIPE_LENGTH)} из ${RECIPE_LENGTH}. Какой ингредиент следующий?${stepErrors > 0 ? ` Попыток: ${stepErrors + 1}` : ''}`}
      </div>

      {phase === 'play' && !showCauldron && (
        <div style={{
          display: 'flex', gap: spacing.md, justifyContent: 'center',
          marginBottom: spacing.sm, fontSize: '13px',
        }}>
          <span style={{ color: colors.fairyGold, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {round}/{RECIPE_LENGTH}
          </span>
          <span style={{ color: errorsRef.current >= 2 ? colors.danger : colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
            Ошибки: {errorsRef.current}
          </span>
        </div>
      )}

      <div
        ref={refMount}
        style={{
          flex: 1,
          width: '100%',
          minHeight: '400px',
          touchAction: 'manipulation',
          position: 'relative',
          borderRadius: 16,
          overflow: 'hidden',
          // Мрачный чащобный фон — гнилое болото и зеленоватый туман
          background: `
            radial-gradient(ellipse at 50% 100%, rgba(40,60,40,0.6) 0%, transparent 70%),
            linear-gradient(to bottom,
              #0F1322 0%,
              #1A2030 40%,
              #1F2828 70%,
              #18221C 100%
            )
          `,
          boxShadow: 'inset 0 0 80px rgba(0,40,20,0.4)',
        }}
      >
        {/* Декор: коряги и зеленоватые огоньки болотных огней */}
        <svg
          viewBox="0 0 320 400"
          preserveAspectRatio="xMidYMax slice"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'none', opacity: 0.7,
          }}
        >
          <defs>
            <radialGradient id="bogfire1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#90E060" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#90E060" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Коряги по бокам */}
          <path d="M 0 380 Q 30 360 25 340 Q 22 320 35 310 L 25 320 L 18 305 L 8 320 L 0 350 Z"
                fill="#1A1A1A" opacity="0.8" />
          <path d="M 320 390 Q 290 370 295 348 Q 298 326 285 318 L 295 328 L 302 313 L 312 326 L 320 358 Z"
                fill="#1A1A1A" opacity="0.8" />
          {/* Болотные огоньки */}
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
      </div>

      {/* Прогресс рецепта — нижняя панель */}
      {phase === 'play' && !showCauldron && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            display: 'flex', gap: 6, justifyContent: 'center',
            marginTop: spacing.sm, padding: `${spacing.sm} 0`,
            borderTop: `1px solid ${colors.cardBorder}`,
          }}
        >
          {recipeProgress.map((filledIng, i) => {
            const isCurrent = i === round
            const filled = filledIng !== null
            const borderColor = filled ? colors.success : isCurrent ? colors.fairyGold : colors.cardBorder
            const bgColor = filled ? `${colors.success}22` : isCurrent ? `${colors.fairyGold}18` : 'rgba(255,255,255,0.03)'
            return (
              <div key={i} style={{
                flex: 1, maxWidth: 64,
                aspectRatio: '1',
                background: bgColor,
                border: `2px solid ${borderColor}`,
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
                transition: 'all 0.25s',
              }}>
                <div style={{
                  position: 'absolute', top: 2, left: 4,
                  color: filled ? colors.success : colors.textMuted,
                  fontSize: 10, fontWeight: 700,
                }}>{i + 1}</div>
                {filled
                  ? <div style={{ color: colors.success, fontSize: 28, fontWeight: 800 }}>✓</div>
                  : isCurrent
                    ? <div style={{ color: colors.fairyGold, fontSize: 20, fontWeight: 800 }}>?</div>
                    : <div style={{ color: colors.textMuted, fontSize: 14 }}>·</div>}
              </div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
