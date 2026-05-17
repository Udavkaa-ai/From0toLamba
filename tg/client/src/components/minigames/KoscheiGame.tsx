import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Application, Container, Graphics, Text } from 'pixi.js'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'
import { GameHeader, ScoreChip } from './GameChrome'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const PLAY_SECONDS = 20
// MAX_ATTEMPTS убран — ограничение только по времени.
// Шкала результата БИНАРНАЯ: «собрал все пары» / «не собрал».
// В memory match нельзя «ошибиться» — открытие пары, которая не совпала, это
// часть игрового процесса, а не промах. Поэтому:
//   собрал все 6 пар в 20 секунд → 0 ошибок (победа, совет чуйки)
//   не собрал                    → 2 ошибки (поражение, только за звёзды)
//
// Задержки между «открыл вторую карту» → «следующая попытка»:
// — для match: чуть длиннее (полюбоваться парой)
// — для miss: коротко, чтобы не накапливалось ожидание
const REVEAL_DELAY_MATCH_MS = 450
const REVEAL_DELAY_MISS_MS  = 380
const SYMBOL_COUNT = 6
const COLS = 3
const ROWS = 4

interface KoscheiGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
  /** Если задано — сразу показываем пирамидку, не запускаем игру (после F5). */
  restoredErrorCount?: number | null
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


// ── Символы — эмодзи, без процедурного рисования ───────────────────────────
// Раньше каждый символ собирался из десятков Pixi-примитивов. Сейчас рендерим
// эмодзи текстом — Telegram-клиент даёт полированный цветной emoji-глиф.
const SYMBOL_EMOJI = ['🌳', '🧰', '🐇', '🦆', '🥚', '🪡'] as const
const SYMBOL_NAMES = ['Дуб', 'Сундук', 'Заяц', 'Утка', 'Яйцо', 'Игла']
void SYMBOL_NAMES  // оставлено для будущей пасхалки/подсказки

function makeSymbolEmoji(idx: number, size: number): Text {
  const t = new Text({
    text: SYMBOL_EMOJI[idx],
    style: {
      fontSize: size * 1.6,
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
      align: 'center',
    },
  })
  t.anchor.set(0.5)
  return t
}

/** Карточка — фон (Graphics) + при необходимости emoji-символ (Text).
 *  Раньше drawCard рисовал и фон, и символ через Pixi.Graphics. Теперь
 *  символ — эмодзи через Text, для лучшего визуала. Возвращаем готовый
 *  Container'ом, чтобы вызывающий просто addChild. */
function buildCardNode(state: CardState, symbolIdx: number, w: number, h: number): Container {
  const node = new Container()
  const cardFill = state === 'matched' ? 0x1A3D2A : 0x1B1438
  const cardBorder = state === 'matched' ? 0x4FD89C : (state === 'open' ? 0xFFB800 : 0x6B5C90)
  const r = 10

  const bg = new Graphics()
  bg.roundRect(-w / 2, -h / 2, w, h, r).fill(cardFill).stroke({ width: 2, color: cardBorder })
  node.addChild(bg)

  if (state === 'closed') {
    // Орнаментальная «рубашка» — четыре ромба и центральный знак
    const orn = new Graphics()
    orn.poly([0, -h * 0.3,  w * 0.18, -h * 0.15,  0, 0,  -w * 0.18, -h * 0.15])
      .fill({ color: 0xFFB800, alpha: 0.18 })
      .stroke({ width: 1, color: 0xFFB800, alpha: 0.5 })
    orn.poly([0,  h * 0.3,  w * 0.18,  h * 0.15,  0, 0,  -w * 0.18,  h * 0.15])
      .fill({ color: 0xFFB800, alpha: 0.18 })
      .stroke({ width: 1, color: 0xFFB800, alpha: 0.5 })
    orn.circle(0, 0, h * 0.08).fill(0xFFB800).stroke({ width: 1.5, color: 0x3D2A05 })
    node.addChild(orn)
  } else {
    // Открытая или сматченная — emoji-символ
    node.addChild(makeSymbolEmoji(symbolIdx, Math.min(w, h) * 0.36))
  }
  return node
}

export function KoscheiGame({ seed, onComplete, restoredErrorCount }: KoscheiGameProps) {
  const isFrozen = restoredErrorCount !== null && restoredErrorCount !== undefined
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(isFrozen)
  const resolvingRef = useRef(false)
  const attemptsUsedRef = useRef(0)
  const [cards, setCards] = useState<Card[]>(() => dealCards(rngFromSeed(seed)))
  // Сколько пар собрано на данный момент — обновляется в useEffect ниже,
  // нужно чтобы complete() мог посчитать errorCount = SYMBOL_COUNT - matched.
  const matchedPairsRef = useRef(0)
  const [selectedA, setSelectedA] = useState<number | null>(null)
  const [selectedB, setSelectedB] = useState<number | null>(null)
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [playCountdown, setPlayCountdown] = useState(PLAY_SECONDS)
  useEffect(() => { attemptsUsedRef.current = attemptsUsed }, [attemptsUsed])
  // Обновляем счётчик собранных пар каждый раз, когда меняется состояние карт
  useEffect(() => {
    matchedPairsRef.current = cards.filter(c => c.state === 'matched').length / 2
  }, [cards])
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  /** errorCount = число НЕСОБРАННЫХ пар. 1 пара = 1 ошибка.
   *  6 пар собрано → 0 ошибок (идеал), 5 → 1 (победа), ≤4 → ≥2 (провал). */
  const complete = (won: boolean, _attemptsAtFinish: number) => {
    if (doneRef.current) return
    doneRef.current = true
    haptic?.notificationOccurred(won ? 'success' : 'error')
    playSound(won ? 'win' : 'lose')
    const errorCount = Math.max(0, SYMBOL_COUNT - matchedPairsRef.current)
    // Показываем «пирамидку Кощея» — отсылка к сказке «дуб → сундук → заяц → утка → яйцо → игла»
    setTimeout(() => setShowPyramid(true), 80)
    onCompleteRef.current(errorCount)
  }

  // Финальная анимация-пирамидка: «дуб → сундук → заяц → утка → яйцо → игла».
  // Вложенность из сказки показывается во времени: каждый следующий предмет
  // «достаётся» из предыдущего снизу вверх, с pop-эффектом и лёгкой качкой.
  // Цикл повторяется, чтобы игрок успел рассмотреть всю последовательность.
  const [showPyramid, setShowPyramid] = useState(isFrozen)
  const [pixiReady, setPixiReady] = useState(false)
  useEffect(() => {
    if (!showPyramid) return
    const app = refApp.current
    if (!app) return
    app.stage.removeChildren()
    const W = app.screen.width
    const H = app.screen.height

    // Шаги: индекс символа, размер emoji, момент появления (сек).
    const STEPS: Array<{ symbolIdx: number; size: number; spawnAt: number }> = [
      { symbolIdx: 0, size: 110, spawnAt: 0.0 },   // Дуб — основание
      { symbolIdx: 1, size: 92,  spawnAt: 0.7 },   // Сундук на дубе
      { symbolIdx: 2, size: 78,  spawnAt: 1.5 },   // Заяц из сундука
      { symbolIdx: 3, size: 66,  spawnAt: 2.3 },   // Утка из зайца
      { symbolIdx: 4, size: 54,  spawnAt: 3.1 },   // Яйцо из утки
      { symbolIdx: 5, size: 46,  spawnAt: 3.9 },   // Игла из яйца
    ]
    // После того как пирамида построилась — каждый эмодзи независимо
    // запускает цикл «увеличивается + растворяется» (bloom-fade).
    // Период одного цикла одного эмодзи + сдвиг фазы между ними = волна.
    //
    // SCALE_TO небольшой (1.12) — эмодзи разных уровней пирамиды стоят
    // в ~70px друг от друга, при крупном bloom (1.5+) фигуры физически
    // налезали друг на друга визуально. 1.12 — едва заметное «дыхание»,
    // которого хватает чтобы эффект чувствовался, но без перекрытий.
    const BLOOM_DUR = 2.4
    const BLOOM_PHASE_OFFSET = 0.4
    const BLOOM_SCALE_TO   = 1.12

    const cx = W / 2
    const baseY = H * 0.82
    const stepGap = Math.min(H / 7.5, 70)

    // Создаём по контейнеру на каждый шаг — стартово невидимы и схлопнуты в точку
    const nodes: Container[] = STEPS.map((s, i) => {
      const c = new Container()
      c.x = cx
      c.y = baseY - i * stepGap
      c.alpha = 0
      c.scale.set(0)
      c.addChild(makeSymbolEmoji(s.symbolIdx, s.size))
      app.stage.addChild(c)
      return c
    })

    // Искорки вокруг иглы — символ магии Кощеевой смерти
    const sparkles: Graphics[] = []
    for (let i = 0; i < 14; i++) {
      const g = new Graphics()
      g.circle(0, 0, 2.5).fill({ color: 0xFFD24A, alpha: 0.95 })
      g.alpha = 0
      sparkles.push(g)
      app.stage.addChild(g)
    }

    // easeOutBack — небольшая «отскок-перепрыжка» при появлении
    const easeOutBack = (t: number) => {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    }

    let raf = 0
    const start = performance.now()
    const tick = () => {
      const now = performance.now()
      // Время от старта без модуло — пирамида строится один раз, дальше
      // живёт за счёт bloom-fade каждого эмодзи (а не за счёт пересборки).
      const cycle = (now - start) / 1000

      STEPS.forEach((s, i) => {
        const node = nodes[i]
        const local = cycle - s.spawnAt
        const homeY = baseY - i * stepGap
        if (local < 0) {
          node.alpha = 0
          node.scale.set(0)
          node.y = homeY
          return
        }
        const appearDur = 0.55
        if (local < appearDur) {
          const t = local / appearDur
          const e = easeOutBack(t)
          node.alpha = Math.min(1, t * 1.6)
          node.scale.set(Math.max(0, e))
          // «Выпрыгивает» вверх: стартует чуть ниже своего места
          node.y = homeY + (1 - t) * 18
        } else {
          // Цикл bloom-fade: scale 1.0 → BLOOM_SCALE_TO + alpha 1.0 → 0.0
          // за BLOOM_DUR секунд, фаза смещена по высоте пирамиды.
          const phase = ((local - appearDur) + i * BLOOM_PHASE_OFFSET) % BLOOM_DUR
          const t = phase / BLOOM_DUR
          // smoothstep — симметричная S-кривая: плавный старт, плавное
          // окончание. Эмодзи мягко вырастает и так же мягко растворяется.
          const eased = t * t * (3 - 2 * t)
          node.scale.set(1.0 + (BLOOM_SCALE_TO - 1.0) * eased)
          node.alpha = 1.0 - eased
          node.y = homeY
        }
      })

      // Искорки появляются вместе с иглой и кружат вокруг неё
      const needleAt = STEPS[STEPS.length - 1].spawnAt
      const needleLocal = cycle - needleAt
      const needleY = baseY - (STEPS.length - 1) * stepGap
      if (needleLocal >= 0) {
        const fadeIn = Math.min(1, needleLocal * 2)
        sparkles.forEach((g, i) => {
          const ang = (i / sparkles.length) * Math.PI * 2 + cycle * 0.7
          const radius = 30 + Math.sin(cycle * 2 + i) * 5
          g.x = cx + Math.cos(ang) * radius
          g.y = needleY + Math.sin(ang) * radius * 0.6
          g.alpha = fadeIn * (0.55 + 0.45 * Math.sin(cycle * 4 + i))
        })
      } else {
        sparkles.forEach(g => { g.alpha = 0 })
      }

      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
    }
  }, [showPyramid, pixiReady])

  // Таймер (в frozen-режиме не запускается — игра не идёт)
  useEffect(() => {
    if (isFrozen) return
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
    }, isMatch ? REVEAL_DELAY_MATCH_MS : REVEAL_DELAY_MISS_MS)
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
      setPixiReady(true)
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
    // В frozen-режиме игровое поле не рисуем — нужна только пирамидка финала,
    // её соберёт отдельный useEffect (зависящий от showPyramid + pixiReady)
    if (isFrozen) return
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

          outer.addChild(buildCardNode(card.state, card.symbolIdx, cellW, cellH))

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
      <GameHeader
        title={<>Память Кощея · {playCountdown} сек</>}
        urgent={playCountdown <= 5}
        hint={<>Найди {SYMBOL_COUNT} пар: дуб, сундук, заяц, утка, яйцо, игла. Соберёшь все вовремя — раскроется совет чуйки</>}
        scoreChip={
          <ScoreChip tone={matchedCount === SYMBOL_COUNT ? 'success' : 'gold'}>
            Пар: {matchedCount}/{SYMBOL_COUNT}
          </ScoreChip>
        }
        rightSlot={
          <span style={{ color: 'rgba(232,213,168,0.55)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            Открытий: {attemptsUsed}
          </span>
        }
        timerProgress={playCountdown / PLAY_SECONDS}
      />
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
