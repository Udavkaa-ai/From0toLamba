import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Application, Container, Graphics } from 'pixi.js'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const REFERENCE_SECONDS = 6
const PLAY_SECONDS = 15
const RECIPE_LENGTH = 5
const OPTIONS_PER_ROUND = 5

// Лесенка ошибок:
//   0 ошибок (все 5 угадал с первого раза) — идеальная игра, совет чуйки
//   1 ошибка — победа, посул + тип
//   ≥2 ошибок — поражение, только за звёзды

interface BabaYagaGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
}

type Ingredient = 'frog' | 'mushroom' | 'bat' | 'skull' | 'moonstone' | 'spider' | 'fang' | 'feather'
const ALL_INGREDIENTS: Ingredient[] = ['frog', 'mushroom', 'bat', 'skull', 'moonstone', 'spider', 'fang', 'feather']
const NAMES: Record<Ingredient, string> = {
  frog: 'Лягушка',
  mushroom: 'Мухомор',
  bat: 'Крыло мыши',
  skull: 'Череп',
  moonstone: 'Лунный камень',
  spider: 'Паучья нить',
  fang: 'Клык волка',
  feather: 'Перо ворона',
}

// ── Процедурное рисование ингредиентов ─────────────────────────────────────

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
  // Шляпка
  g.poly([
    -size * 0.55, size * 0.05,
    -size * 0.5, -size * 0.35,
    size * 0.5, -size * 0.35,
    size * 0.55, size * 0.05,
  ]).fill(0xC03030).stroke({ width: 2, color: 0x5A0808 })
  g.poly([-size * 0.55, size * 0.05, -size * 0.5, -size * 0.35, size * 0.5, -size * 0.35, size * 0.55, size * 0.05, 0, size * 0.18]).fill(0xC03030)
  // Белые точки на шляпке
  g.circle(-size * 0.25, -size * 0.15, size * 0.07).fill(0xFFFFFF)
  g.circle(size * 0.15, -size * 0.2, size * 0.08).fill(0xFFFFFF)
  g.circle(size * 0.3, size * 0.0, size * 0.06).fill(0xFFFFFF)
  g.circle(-size * 0.05, -size * 0.05, size * 0.05).fill(0xFFFFFF)
  // Ножка
  g.rect(-size * 0.2, size * 0.05, size * 0.4, size * 0.5).fill(0xF5E4C7).stroke({ width: 2, color: 0x8C6200 })
  // Юбочка
  g.ellipse(0, size * 0.2, size * 0.25, size * 0.06).fill(0xE0CC9A).stroke({ width: 1.5, color: 0x8C6200 })
}

function drawBatWing(g: Graphics, size: number) {
  const dark = 0x3A2A50
  const darkD = 0x1A1024
  // Крыло — характерные «пальцы»
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
  // «Кости» крыла
  g.moveTo(-size * 0.55, -size * 0.45).lineTo(-size * 0.15, size * 0.35).stroke({ width: 2, color: darkD })
  g.moveTo(-size * 0.15, -size * 0.55).lineTo(-size * 0.1, size * 0.35).stroke({ width: 2, color: darkD })
  g.moveTo(size * 0.2, -size * 0.5).lineTo(size * 0.15, size * 0.3).stroke({ width: 2, color: darkD })
  g.moveTo(size * 0.45, -size * 0.4).lineTo(size * 0.4, size * 0.15).stroke({ width: 2, color: darkD })
}

function drawSkull(g: Graphics, size: number) {
  g.circle(0, -size * 0.05, size * 0.5).fill(0xEDE3D0).stroke({ width: 2, color: 0x6F5A30 })
  // Глазницы
  g.circle(-size * 0.18, -size * 0.1, size * 0.13).fill(0x0D0510)
  g.circle(size * 0.18, -size * 0.1, size * 0.13).fill(0x0D0510)
  // Нос
  g.poly([0, size * 0.05, -size * 0.06, size * 0.18, size * 0.06, size * 0.18]).fill(0x0D0510)
  // Челюсть
  g.rect(-size * 0.3, size * 0.3, size * 0.6, size * 0.18).fill(0xEDE3D0).stroke({ width: 2, color: 0x6F5A30 })
  // Зубы
  for (let i = 0; i < 4; i++) {
    g.rect(-size * 0.25 + i * size * 0.14, size * 0.3, size * 0.04, size * 0.12).fill(0x6F5A30)
  }
}

function drawMoonstone(g: Graphics, size: number) {
  // Свечение
  g.circle(0, 0, size * 0.55).fill({ color: 0x8FB0E0, alpha: 0.3 })
  // Кристалл-овал
  g.ellipse(0, 0, size * 0.35, size * 0.5).fill(0xBFD4F2).stroke({ width: 2, color: 0x4A6A90 })
  // Грани
  g.moveTo(0, -size * 0.45).lineTo(-size * 0.3, 0).stroke({ width: 1.5, color: 0x4A6A90 })
  g.moveTo(0, -size * 0.45).lineTo(size * 0.3, 0).stroke({ width: 1.5, color: 0x4A6A90 })
  g.moveTo(0, size * 0.45).lineTo(-size * 0.3, 0).stroke({ width: 1.5, color: 0x4A6A90 })
  g.moveTo(0, size * 0.45).lineTo(size * 0.3, 0).stroke({ width: 1.5, color: 0x4A6A90 })
  g.moveTo(0, 0).lineTo(0, -size * 0.45).stroke({ width: 1.5, color: 0x4A6A90 })
  // Блик
  g.ellipse(-size * 0.1, -size * 0.2, size * 0.08, size * 0.15).fill(0xFFFFFF)
}

function drawSpider(g: Graphics, size: number) {
  const dark = 0x1A1024
  // Тело
  g.ellipse(0, size * 0.05, size * 0.25, size * 0.3).fill(dark).stroke({ width: 2, color: 0x000000 })
  g.circle(0, -size * 0.25, size * 0.18).fill(dark).stroke({ width: 2, color: 0x000000 })
  // Глаза
  g.circle(-size * 0.08, -size * 0.28, size * 0.04).fill(0xFF4040)
  g.circle(size * 0.08, -size * 0.28, size * 0.04).fill(0xFF4040)
  // 8 ножек
  for (let i = 0; i < 4; i++) {
    const ly = -size * 0.1 + i * size * 0.08
    g.moveTo(-size * 0.25, ly).lineTo(-size * 0.6, ly - size * 0.15).stroke({ width: 2, color: 0x000000 })
    g.moveTo(size * 0.25, ly).lineTo(size * 0.6, ly - size * 0.15).stroke({ width: 2, color: 0x000000 })
  }
  // Нить вверх
  g.moveTo(0, -size * 0.5).lineTo(0, -size * 0.85).stroke({ width: 1, color: 0xCCCCDD })
}

function drawFang(g: Graphics, size: number) {
  // Клык — треугольник с лёгким изгибом
  g.poly([
    -size * 0.2, -size * 0.55,
    size * 0.2, -size * 0.55,
    size * 0.05, size * 0.55,
    -size * 0.05, size * 0.55,
  ]).fill(0xF8F2E0).stroke({ width: 2, color: 0x6F5A30 })
  // Корень — тёмная часть
  g.poly([
    -size * 0.2, -size * 0.55,
    size * 0.2, -size * 0.55,
    size * 0.12, -size * 0.25,
    -size * 0.12, -size * 0.25,
  ]).fill(0x6F5A30)
  // Блик
  g.rect(-size * 0.15, -size * 0.5, size * 0.06, size * 0.9).fill({ color: 0xFFFFFF, alpha: 0.4 })
  // Кровь на кончике
  g.circle(0, size * 0.55, size * 0.06).fill(0x8C2020)
}

function drawFeather(g: Graphics, size: number) {
  const dark = 0x1A1024
  // Стержень
  g.moveTo(0, -size * 0.6).lineTo(0, size * 0.6).stroke({ width: 2.5, color: 0x4A2A05 })
  // Лопасти — много мелких штрихов
  for (let i = 0; i < 10; i++) {
    const ty = -size * 0.5 + i * size * 0.11
    const len = (i < 5 ? size * 0.05 + i * size * 0.06 : size * 0.35 - (i - 5) * size * 0.05)
    g.moveTo(0, ty).lineTo(-len, ty - size * 0.04).stroke({ width: 1.5, color: dark })
    g.moveTo(0, ty).lineTo(len, ty - size * 0.04).stroke({ width: 1.5, color: dark })
  }
  // Гладкий контур пера
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

function drawIngredientCard(g: Graphics, ing: Ingredient, w: number, h: number, state: 'normal' | 'correct' | 'wrong') {
  const bg = state === 'correct' ? 0x1A3D2A : state === 'wrong' ? 0x3D1A1A : 0x1B1438
  const border = state === 'correct' ? 0x4FD89C : state === 'wrong' ? 0xE06060 : 0xFFB800
  g.roundRect(-w / 2, -h / 2, w, h, 12).fill(bg).stroke({ width: 2, color: border })
  DRAWERS[ing](g, Math.min(w, h) * 0.34)
}

// Перемешивание Fisher-Yates
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
  const tappedOnceRef = useRef(false)

  // Рецепт: 5 ингредиентов в нужном порядке
  const recipe = useMemo<Ingredient[]>(() => {
    const shuffled = shuffle(ALL_INGREDIENTS, rngRef.current)
    return shuffled.slice(0, RECIPE_LENGTH)
  }, [])

  // Варианты для каждого раунда: правильный + 4 других (8 - 1 = 7 candidates → 4 фейка)
  const roundOptions = useMemo<Ingredient[][]>(() => {
    return recipe.map((correct) => {
      const others = shuffle(ALL_INGREDIENTS.filter(x => x !== correct), rngRef.current)
        .slice(0, OPTIONS_PER_ROUND - 1)
      return shuffle([correct, ...others], rngRef.current)
    })
  }, [recipe])

  const [phase, setPhase] = useState<'reference' | 'play' | 'between'>('reference')
  const [refCountdown, setRefCountdown] = useState(REFERENCE_SECONDS)
  const [playCountdown, setPlayCountdown] = useState(PLAY_SECONDS)
  const [round, setRound] = useState(0)
  const [feedback, setFeedback] = useState<{ idx: number; state: 'correct' | 'wrong' } | null>(null)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  const phaseRef = useRef<'reference' | 'play' | 'between'>('reference')
  useEffect(() => { phaseRef.current = phase }, [phase])
  const roundRef = useRef(0)
  useEffect(() => { roundRef.current = round }, [round])

  const complete = (errors: number) => {
    if (doneRef.current) return
    doneRef.current = true
    const ec = Math.max(0, errors)
    haptic?.notificationOccurred(ec === 0 ? 'success' : ec === 1 ? 'warning' : 'error')
    playSound(ec <= 1 ? 'win' : 'lose')
    onCompleteRef.current(ec)
  }

  // Таймер показа рецепта
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

  // Общий таймер раунда
  useEffect(() => {
    if (phase !== 'play') return
    setPlayCountdown(PLAY_SECONDS)
    const id = setInterval(() => {
      setPlayCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          // Не успел — каждый невыполненный шаг = ошибка
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

  // Инициализация Pixi
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

  // Рендер сцены: либо рецепт (reference), либо текущий раунд (play)
  useEffect(() => {
    let cancelled = false
    const render = () => {
      const app = refApp.current
      if (cancelled) return
      if (!app) {
        requestAnimationFrame(render)
        return
      }
      app.stage.removeChildren()

      if (phase === 'reference') {
        // 5 ингредиентов в ряд + номера 1..5
        const padX = 8
        const cellW = (app.screen.width - padX * (RECIPE_LENGTH + 1)) / RECIPE_LENGTH
        const cellH = Math.min(110, cellW * 1.2)
        const y = app.screen.height / 2 - 10
        for (let i = 0; i < RECIPE_LENGTH; i++) {
          const c = new Container()
          c.x = padX + i * (cellW + padX) + cellW / 2
          c.y = y
          const g = new Graphics()
          drawIngredientCard(g, recipe[i], cellW, cellH, 'normal')
          c.addChild(g)
          // Номер шага
          const numC = new Container()
          numC.x = 0; numC.y = -cellH / 2 - 14
          const bg = new Graphics()
          bg.circle(0, 0, 12).fill(colors.fairyGold).stroke({ width: 2, color: 0x3D2A05 })
          numC.addChild(bg)
          // Используем DOM-overlay для цифр (Pixi.Text — оверкилл)
          c.addChild(numC)
          app.stage.addChild(c)
        }
      } else {
        // Текущий раунд: 5 вариантов в сетке (одна строка)
        const opts = roundOptions[round]
        if (!opts) return
        const padX = 6
        const cellW = (app.screen.width - padX * (OPTIONS_PER_ROUND + 1)) / OPTIONS_PER_ROUND
        const cellH = Math.min(130, cellW * 1.4)
        const y = app.screen.height / 2 - 10
        for (let i = 0; i < OPTIONS_PER_ROUND; i++) {
          const c = new Container()
          c.x = padX + i * (cellW + padX) + cellW / 2
          c.y = y
          c.eventMode = 'static'
          c.cursor = 'pointer'
          const fbState = feedback?.idx === i ? feedback.state : 'normal'
          const g = new Graphics()
          drawIngredientCard(g, opts[i], cellW, cellH, fbState)
          c.addChild(g)
          c.on('pointertap', () => onPick(i))
          app.stage.addChild(c)
        }
      }
    }
    render()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round, recipe, roundOptions, feedback])

  const onPick = (idx: number) => {
    if (doneRef.current) return
    if (phaseRef.current !== 'play') return
    if (feedback) return  // ждём анимации
    const opts = roundOptions[roundRef.current]
    const correct = recipe[roundRef.current]
    const chosen = opts[idx]
    const isCorrect = chosen === correct
    tappedOnceRef.current = true
    if (isCorrect) {
      haptic?.notificationOccurred('success')
      playSound('seal')
      setFeedback({ idx, state: 'correct' })
    } else {
      haptic?.notificationOccurred('error')
      playSound('lose')
      errorsRef.current += 1
      setFeedback({ idx, state: 'wrong' })
    }
    // Через 500мс — следующий раунд или конец
    setTimeout(() => {
      setFeedback(null)
      const nextRound = roundRef.current + 1
      if (nextRound >= RECIPE_LENGTH) {
        complete(errorsRef.current)
        return
      }
      setRound(nextRound)
    }, 500)
  }

  // Цифры-метки 1..5 для эталонного ряда (DOM-оверлей)
  const refLabels = phase === 'reference' ? recipe.map((_, i) => i + 1) : []

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
          ? `Пять ингредиентов в этом порядке. Запомни — потом выберешь по очереди.`
          : `Шаг ${Math.min(round + 1, RECIPE_LENGTH)} из ${RECIPE_LENGTH}. Какой ингредиент следующий по рецепту?`}
      </div>

      {phase === 'play' && (
        <div style={{
          display: 'flex', gap: spacing.md, justifyContent: 'center',
          marginBottom: spacing.sm, fontSize: '13px',
        }}>
          <span style={{ color: colors.fairyGold, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {round}/{RECIPE_LENGTH}
          </span>
          <span style={{ color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
            Ошибки: {errorsRef.current}
          </span>
        </div>
      )}

      <div
        ref={refMount}
        style={{
          flex: 1,
          width: '100%',
          minHeight: '180px',
          touchAction: 'manipulation',
          position: 'relative',
        }}
      >
        {/* Цифры-метки 1..5 поверх эталонных карточек */}
        {refLabels.map((n, i) => (
          <motion.div
            key={n}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            style={{
              position: 'absolute',
              left: `${(100 / RECIPE_LENGTH) * (i + 0.5)}%`,
              top: 'calc(50% - 75px)',
              transform: 'translateX(-50%)',
              width: 24, height: 24,
              borderRadius: '50%',
              background: colors.fairyGold,
              color: colors.nightBlue,
              fontWeight: 800,
              fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #3D2A05',
              pointerEvents: 'none',
            }}
          >
            {n}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export const BABA_YAGA_NAMES = NAMES
