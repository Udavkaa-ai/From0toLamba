import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Application, Container, Graphics } from 'pixi.js'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const PLAY_SECONDS = 20
// MAX_ATTEMPTS убран — ограничение только по времени.
// Шкала результата БИНАРНАЯ: «собрал все пары» / «не собрал».
// В memory match нельзя «ошибиться» — открытие пары, которая не совпала, это
// часть игрового процесса, а не промах. Поэтому:
//   собрал все 6 пар в 20 секунд → 0 ошибок (победа, совет чуйки)
//   не собрал                    → 2 ошибки (поражение, только за звёзды)
const REVEAL_DELAY_MS = 700
const SYMBOL_COUNT = 6
const COLS = 3
const ROWS = 4

interface KoscheiGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
}

type CardState = 'closed' | 'open' | 'matched'

interface Card {
  symbolIdx: number
  state: CardState
}

// ── Перемешивание Fisher-Yates с детерминированным rng ─────────────────────
function dealCards(rng: () => number): Card[] {
  const indices: number[] = []
  for (let i = 0; i < SYMBOL_COUNT; i++) indices.push(i, i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices.map(symbolIdx => ({ symbolIdx, state: 'closed' as const }))
}

// ── Символы (процедурно через Pixi.Graphics) ───────────────────────────────
// Все рисуются центрированно в (0,0), параметр `size` — половина «коробки».

function drawOak(g: Graphics, size: number) {
  const trunkW = size * 0.22
  const trunkH = size * 0.55
  // Ствол
  g.rect(-trunkW / 2, size * 0.05, trunkW, trunkH).fill(0x6B4423).stroke({ width: 1.5, color: 0x2A1A08 })
  // Крона — три перекрывающихся круга
  g.circle(-size * 0.4, -size * 0.05, size * 0.42).fill(0x3D6B2B).stroke({ width: 1.5, color: 0x1F3D14 })
  g.circle(size * 0.4, -size * 0.05, size * 0.42).fill(0x3D6B2B).stroke({ width: 1.5, color: 0x1F3D14 })
  g.circle(0, -size * 0.45, size * 0.5).fill(0x4A7C3A).stroke({ width: 1.5, color: 0x1F3D14 })
  // Блик
  g.circle(-size * 0.15, -size * 0.55, size * 0.12).fill({ color: 0x8FCB6F, alpha: 0.55 })
}

function drawChest(g: Graphics, size: number) {
  const w = size * 1.4
  const h = size * 0.9
  // Основание
  g.rect(-w / 2, 0, w, h).fill(0xB8772E).stroke({ width: 1.5, color: 0x3D2A05 })
  // Крышка (дугообразная)
  g.poly([
    -w / 2,  0,
    -w / 2, -h * 0.25,
    -w * 0.45, -h * 0.55,
    w * 0.45, -h * 0.55,
    w / 2, -h * 0.25,
    w / 2, 0,
  ]).fill(0xCC8F00).stroke({ width: 1.5, color: 0x3D2A05 })
  // Окантовка
  g.rect(-w / 2, h * 0.45, w, h * 0.1).fill(0x8C6200).stroke({ width: 1, color: 0x3D2A05 })
  g.rect(-w * 0.42, h * 0.05, w * 0.04, h * 0.4).fill(0x8C6200)
  g.rect(w * 0.38, h * 0.05, w * 0.04, h * 0.4).fill(0x8C6200)
  // Замок
  g.rect(-w * 0.08, -h * 0.05, w * 0.16, h * 0.3).fill(0x3D2A05).stroke({ width: 1, color: 0x000000 })
  g.circle(0, h * 0.05, w * 0.04).fill(0xFFB800)
  // Блик на крышке
  g.rect(-w * 0.3, -h * 0.42, w * 0.2, h * 0.06).fill({ color: 0xFFE082, alpha: 0.6 })
}

function drawHare(g: Graphics, size: number) {
  const grey = 0xD0D0C8
  const greyDark = 0x6F6F68
  // Уши
  g.ellipse(-size * 0.25, -size * 0.55, size * 0.12, size * 0.35).fill(grey).stroke({ width: 1.5, color: greyDark })
  g.ellipse(size * 0.25, -size * 0.55, size * 0.12, size * 0.35).fill(grey).stroke({ width: 1.5, color: greyDark })
  // Внутреннее ухо
  g.ellipse(-size * 0.25, -size * 0.55, size * 0.05, size * 0.22).fill(0xE8B0B0)
  g.ellipse(size * 0.25, -size * 0.55, size * 0.05, size * 0.22).fill(0xE8B0B0)
  // Голова
  g.circle(0, -size * 0.1, size * 0.4).fill(grey).stroke({ width: 1.5, color: greyDark })
  // Глаза
  g.circle(-size * 0.15, -size * 0.15, size * 0.05).fill(0x0D1735)
  g.circle(size * 0.15, -size * 0.15, size * 0.05).fill(0x0D1735)
  // Нос
  g.circle(0, -size * 0.02, size * 0.06).fill(0x8C3F3F)
  // Тело
  g.ellipse(0, size * 0.45, size * 0.55, size * 0.35).fill(grey).stroke({ width: 1.5, color: greyDark })
  // Лапы
  g.ellipse(-size * 0.3, size * 0.75, size * 0.18, size * 0.1).fill(grey).stroke({ width: 1, color: greyDark })
  g.ellipse(size * 0.3, size * 0.75, size * 0.18, size * 0.1).fill(grey).stroke({ width: 1, color: greyDark })
}

function drawDuck(g: Graphics, size: number) {
  const yellow = 0xEFD08C
  const yellowDark = 0xA37A28
  // Тело
  g.ellipse(0, size * 0.25, size * 0.55, size * 0.4).fill(yellow).stroke({ width: 1.5, color: yellowDark })
  // Хвост
  g.poly([
    -size * 0.55, size * 0.25,
    -size * 0.78, size * 0.05,
    -size * 0.55, size * 0.35,
  ]).fill(yellow).stroke({ width: 1.5, color: yellowDark })
  // Голова
  g.circle(size * 0.35, -size * 0.2, size * 0.3).fill(yellow).stroke({ width: 1.5, color: yellowDark })
  // Клюв
  g.poly([
    size * 0.6,  -size * 0.25,
    size * 0.85, -size * 0.18,
    size * 0.85, -size * 0.08,
    size * 0.6,   size * 0.0,
  ]).fill(0xE89030).stroke({ width: 1.5, color: 0x5A3A12 })
  // Глаз
  g.circle(size * 0.42, -size * 0.25, size * 0.05).fill(0x0D1735)
  // Крыло (волна)
  g.ellipse(-size * 0.05, size * 0.2, size * 0.3, size * 0.18).fill(0xF5DCA0).stroke({ width: 1, color: yellowDark })
}

function drawEgg(g: Graphics, size: number) {
  // Тень
  g.ellipse(size * 0.05, size * 0.05, size * 0.55, size * 0.7).fill({ color: 0x8C6200, alpha: 0.4 })
  // Яйцо
  g.ellipse(0, 0, size * 0.55, size * 0.7).fill(0xF5E4C7).stroke({ width: 2, color: 0x8C6200 })
  // Блик
  g.ellipse(-size * 0.2, -size * 0.3, size * 0.15, size * 0.18).fill({ color: 0xFFFAEC, alpha: 0.8 })
}

function drawNeedle(g: Graphics, size: number) {
  const silver = 0xCFCFD8
  const silverDark = 0x7A7A85
  // Игла под углом (диагональ от верхне-левого к нижне-правому)
  // Тень
  g.poly([
    -size * 0.6 + 2, -size * 0.6 + 3,
    size * 0.7 + 2,  size * 0.7 + 3,
    size * 0.62 + 2, size * 0.78 + 3,
    -size * 0.68 + 2, -size * 0.52 + 3,
  ]).fill({ color: 0x000000, alpha: 0.35 })
  // Тело иглы
  g.poly([
    -size * 0.6, -size * 0.6,
    size * 0.7,  size * 0.7,
    size * 0.62, size * 0.78,
    -size * 0.68, -size * 0.52,
  ]).fill(silver).stroke({ width: 1.5, color: silverDark })
  // Ушко
  g.ellipse(-size * 0.62, -size * 0.55, size * 0.13, size * 0.18).fill(silver).stroke({ width: 1.5, color: silverDark })
  g.ellipse(-size * 0.62, -size * 0.55, size * 0.06, size * 0.1).fill(0x0D1735)
  // Острый кончик
  g.poly([
    size * 0.66, size * 0.74,
    size * 0.78, size * 0.86,
    size * 0.62, size * 0.78,
  ]).fill(silverDark)
  // Блик
  g.poly([
    -size * 0.55, -size * 0.5,
    size * 0.6, size * 0.65,
    size * 0.58, size * 0.7,
    -size * 0.6, -size * 0.45,
  ]).fill({ color: 0xFFFFFF, alpha: 0.35 })
}

const SYMBOL_DRAWERS = [drawOak, drawChest, drawHare, drawDuck, drawEgg, drawNeedle]
const SYMBOL_NAMES = ['Дуб', 'Сундук', 'Заяц', 'Утка', 'Яйцо', 'Игла']

function drawCard(g: Graphics, state: CardState, symbolIdx: number, w: number, h: number) {
  const cardFill = state === 'matched' ? 0x1A3D2A : 0x1B1438
  const cardBorder = state === 'matched' ? 0x4FD89C : (state === 'open' ? 0xFFB800 : 0x6B5C90)
  const r = 10

  // Фон карточки
  g.roundRect(-w / 2, -h / 2, w, h, r).fill(cardFill).stroke({ width: 2, color: cardBorder })

  if (state === 'closed') {
    // Орнаментальный «рубашка» — четыре ромба и центральный знак
    g.poly([0, -h * 0.3,  w * 0.18, -h * 0.15,  0, 0,  -w * 0.18, -h * 0.15])
      .fill({ color: 0xFFB800, alpha: 0.18 })
      .stroke({ width: 1, color: 0xFFB800, alpha: 0.5 })
    g.poly([0,  h * 0.3,  w * 0.18,  h * 0.15,  0, 0,  -w * 0.18,  h * 0.15])
      .fill({ color: 0xFFB800, alpha: 0.18 })
      .stroke({ width: 1, color: 0xFFB800, alpha: 0.5 })
    // Центральный знак — череп Кощея намёком (крест в круге)
    g.circle(0, 0, h * 0.08).fill(0xFFB800).stroke({ width: 1.5, color: 0x3D2A05 })
  } else {
    // Открытая или сматченная — рисуем символ
    const drawer = SYMBOL_DRAWERS[symbolIdx]
    const symbolSize = Math.min(w, h) * 0.36
    drawer(g, symbolSize)
  }
}

export function KoscheiGame({ seed, onComplete }: KoscheiGameProps) {
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(false)
  const resolvingRef = useRef(false)
  const attemptsUsedRef = useRef(0)
  const [cards, setCards] = useState<Card[]>(() => dealCards(rngFromSeed(seed)))
  const [selectedA, setSelectedA] = useState<number | null>(null)
  const [selectedB, setSelectedB] = useState<number | null>(null)
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [playCountdown, setPlayCountdown] = useState(PLAY_SECONDS)
  useEffect(() => { attemptsUsedRef.current = attemptsUsed }, [attemptsUsed])
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  // Число ошибок = лишние попытки сверх минимума (SYMBOL_COUNT). На таймауте/исчерпании
  // попыток без полного набора пар — ставим заведомо ≥2 (категория «только звёзды»).
  const complete = (won: boolean, _attemptsAtFinish: number) => {
    if (doneRef.current) return
    doneRef.current = true
    haptic?.notificationOccurred(won ? 'success' : 'error')
    playSound(won ? 'win' : 'lose')
    // В memory match понятие «ошибки» неприменимо — есть только «собрал все пары»
    // или «не успел». Поэтому бинарная шкала:
    //   собрал все 6 пар в отведённое время → 0 ошибок (победа, совет чуйки)
    //   не собрал                            → 2 ошибки (поражение, только за звёзды)
    const errorCount = won ? 0 : 2
    // Показываем «пирамидку Кощея» — отсылка к сказке «дуб → сундук → заяц → утка → яйцо → игла»
    setTimeout(() => setShowPyramid(true), 80)
    onCompleteRef.current(errorCount)
  }

  // Финальная пирамидка из 6 символов
  const [showPyramid, setShowPyramid] = useState(false)
  useEffect(() => {
    if (!showPyramid) return
    const app = refApp.current
    if (!app) return
    app.stage.removeChildren()
    const W = app.screen.width
    const H = app.screen.height
    // Пирамидка 1+2+3: верх — дуб, потом сундук+заяц, потом утка+яйцо+игла.
    // Так читается «по сказке»: дуб содержит сундук, в нём заяц с уткой,
    // в утке — яйцо, а в яйце — игла со смертью Кощея.
    const layout: Array<{ row: number; col: number; symbolIdx: number; cols: number }> = [
      { row: 0, col: 0, symbolIdx: 0, cols: 1 },                                     // Дуб
      { row: 1, col: 0, symbolIdx: 1, cols: 2 }, { row: 1, col: 1, symbolIdx: 2, cols: 2 }, // Сундук, Заяц
      { row: 2, col: 0, symbolIdx: 3, cols: 3 }, { row: 2, col: 1, symbolIdx: 4, cols: 3 }, { row: 2, col: 2, symbolIdx: 5, cols: 3 }, // Утка, Яйцо, Игла
    ]
    const cellSize = Math.min(W / 4, H / 4.5)
    const rowGap = cellSize * 0.15
    const colGap = cellSize * 0.1
    const startY = H * 0.18
    for (const item of layout) {
      const rowWidth = item.cols * cellSize + (item.cols - 1) * colGap
      const startX = (W - rowWidth) / 2
      const x = startX + item.col * (cellSize + colGap) + cellSize / 2
      const y = startY + item.row * (cellSize + rowGap) + cellSize / 2

      // Карточка-фон
      const card = new Graphics()
      card.roundRect(-cellSize / 2, -cellSize / 2, cellSize, cellSize, 12)
        .fill(0x1B1438)
        .stroke({ width: 2, color: 0xFFB800 })
      const c = new Container()
      c.x = x; c.y = y
      c.addChild(card)
      // Сам символ — рисуем процедурно из набора DRAWERS
      const sym = new Graphics()
      SYMBOL_DRAWERS[item.symbolIdx](sym, cellSize * 0.36)
      c.addChild(sym)
      app.stage.addChild(c)
    }
  }, [showPyramid])

  // Таймер
  useEffect(() => {
    const id = setInterval(() => {
      setPlayCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          complete(false, attemptsUsedRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Разрешение попытки после открытия второй карты
  useEffect(() => {
    if (selectedA === null || selectedB === null) return
    resolvingRef.current = true
    const a = selectedA
    const b = selectedB
    const isMatch = cards[a].symbolIdx === cards[b].symbolIdx
    const delay = setTimeout(() => {
      setCards(prev => {
        const next = prev.map(c => ({ ...c }))
        if (isMatch) {
          next[a].state = 'matched'
          next[b].state = 'matched'
        } else {
          next[a].state = 'closed'
          next[b].state = 'closed'
        }
        return next
      })
      const newAttempts = attemptsUsed + 1
      setAttemptsUsed(newAttempts)
      setSelectedA(null)
      setSelectedB(null)
      resolvingRef.current = false
    }, REVEAL_DELAY_MS)
    return () => clearTimeout(delay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedA, selectedB])

  // Условия завершения: ловим момент сбора всех пар. Поражение — только по таймеру.
  useEffect(() => {
    if (doneRef.current) return
    if (selectedA !== null || selectedB !== null) return
    const allMatched = cards.every(c => c.state === 'matched')
    if (allMatched) {
      complete(true, attemptsUsed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, attemptsUsed, selectedA, selectedB])

  const handleCardTap = (idx: number) => {
    if (doneRef.current || resolvingRef.current) return
    if (cards[idx].state !== 'closed') return
    if (selectedA === null) {
      haptic?.impactOccurred('light')
      setCards(prev => {
        const next = prev.map(c => ({ ...c }))
        next[idx].state = 'open'
        return next
      })
      setSelectedA(idx)
    } else if (selectedB === null && idx !== selectedA) {
      haptic?.impactOccurred('light')
      setCards(prev => {
        const next = prev.map(c => ({ ...c }))
        next[idx].state = 'open'
        return next
      })
      setSelectedB(idx)
    }
  }

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

  // Рендер карточек
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

      const padX = 14
      const padY = 14
      const cellW = (app.screen.width - padX * (COLS + 1)) / COLS
      const cellH = Math.min(140, (app.screen.height - padY * (ROWS + 1)) / ROWS)

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const idx = r * COLS + c
          if (idx >= cards.length) continue
          const card = cards[idx]
          const outer = new Container()
          outer.x = padX + c * (cellW + padX) + cellW / 2
          outer.y = padY + r * (cellH + padY) + cellH / 2
          outer.eventMode = 'static'
          outer.cursor = card.state === 'closed' ? 'pointer' : 'default'

          const g = new Graphics()
          drawCard(g, card.state, card.symbolIdx, cellW, cellH)
          outer.addChild(g)

          if (card.state === 'closed') {
            outer.on('pointertap', () => handleCardTap(idx))
          }
          app.stage.addChild(outer)
        }
      }
    }
    render()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards])

  const matchedCount = cards.filter(c => c.state === 'matched').length / 2

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      maxWidth: '500px', margin: '0 auto', width: '100%', boxSizing: 'border-box',
      padding: spacing.md,
    }}>
      <div style={{
        textAlign: 'center',
        color: playCountdown <= 5 ? colors.danger : colors.fairyGold,
        fontWeight: 700, fontSize: '17px',
      }}>
        Память Кощея · {playCountdown} сек
      </div>
      <div style={{
        color: colors.textMuted, fontSize: '12px', textAlign: 'center',
        marginBottom: spacing.sm, lineHeight: 1.4,
      }}>
        Найди {SYMBOL_COUNT} пар: дуб, сундук, заяц, утка, яйцо, игла. <br />
        Соберёшь все пары вовремя — раскроется совет чуйки
      </div>
      <div style={{
        display: 'flex', gap: spacing.md, justifyContent: 'center',
        marginBottom: spacing.sm, fontSize: '13px',
      }}>
        <span style={{ color: matchedCount === SYMBOL_COUNT ? colors.success : colors.fairyGold, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          Пары: {matchedCount}/{SYMBOL_COUNT}
        </span>
        <span style={{ color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
          Открытий: {attemptsUsed}
        </span>
      </div>
      <div
        ref={refMount}
        style={{
          flex: 1,
          width: '100%',
          minHeight: '480px',
          touchAction: 'manipulation',
          position: 'relative',
          borderRadius: 16,
          overflow: 'hidden',
          // Кащеев чертог: мрачные камни, голубоватый ледяной отсвет
          background: `
            radial-gradient(ellipse at 50% 0%, rgba(120,160,210,0.18) 0%, transparent 60%),
            linear-gradient(to bottom,
              #0E1024 0%,
              #1A1830 35%,
              #20223A 70%,
              #14182A 100%
            )
          `,
          boxShadow: 'inset 0 0 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* SVG-декор: сталагмиты + хрусталь + сине-зелёные искры */}
        <svg
          viewBox="0 0 320 480"
          preserveAspectRatio="xMidYMax slice"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'none', opacity: 0.75,
          }}
        >
          <defs>
            <linearGradient id="stone1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2A2640" />
              <stop offset="100%" stopColor="#10101A" />
            </linearGradient>
            <radialGradient id="crystal1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#80C0FF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#80C0FF" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Сталактиты с потолка */}
          <polygon points="20,0 35,80 50,0" fill="url(#stone1)" />
          <polygon points="80,0 95,60 110,0" fill="url(#stone1)" />
          <polygon points="210,0 225,70 240,0" fill="url(#stone1)" />
          <polygon points="270,0 285,55 300,0" fill="url(#stone1)" />
          {/* Сталагмиты снизу */}
          <polygon points="10,480 30,400 50,480" fill="url(#stone1)" />
          <polygon points="270,480 290,410 310,480" fill="url(#stone1)" />
          {/* Голубые искры */}
          <circle cx="60" cy="120" r="8" fill="url(#crystal1)">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="260" cy="160" r="6" fill="url(#crystal1)">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="160" cy="40" r="5" fill="url(#crystal1)">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="4s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Подпись к пирамидке — отсылка к сказке «Кощей Бессмертный» */}
        {showPyramid && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            style={{
              position: 'absolute',
              bottom: 16, left: 0, right: 0,
              textAlign: 'center',
              color: colors.fairyGold,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.3,
              pointerEvents: 'none',
              textShadow: '0 2px 10px rgba(0,0,0,0.7)',
            }}
          >
            Дуб → сундук → заяц → утка → яйцо → игла
          </motion.div>
        )}
      </div>
    </div>
  )
}

// Экспорт имён символов на случай дальнейшей локализации/подсказок
export const KOSCHEI_SYMBOL_NAMES = SYMBOL_NAMES
