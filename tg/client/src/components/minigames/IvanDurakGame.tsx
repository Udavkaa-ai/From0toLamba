import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Application, Container, Graphics, Text } from 'pixi.js'
import { rngFromSeed, pickInt } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const HAND_SIZE = 7
const ROUNDS = 7
const ROUND_SECONDS = 2.0       // 2 секунды на каждый ход
const FEEDBACK_MS = 300         // длительность фидбека (зелёная/красная подсветка)
const DECK_POOL_SIZE = HAND_SIZE + ROUNDS  // 14 уникальных карт нужно подготовить

// Лесенка ошибок:
//   0   ошибок — идеальная игра (совет чуйки)
//   1   ошибка  — победа (посул + тип)
//   ≥2  ошибок  — поражение (только за звёзды)

interface IvanDurakGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
}

type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
type Rank = '6' | '7' | '8' | '9' | '10' | 'В' | 'Д'
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['6', '7', '8', '9', '10', 'В', 'Д']
const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
}
const SUIT_COLOR: Record<Suit, number> = {
  spades: 0x1A1024, hearts: 0xB81E1E, diamonds: 0xB81E1E, clubs: 0x1A1024,
}

interface Card {
  rank: Rank
  suit: Suit
}

function cardKey(c: Card): string { return `${c.rank}${c.suit}` }
function cardsEqual(a: Card, b: Card): boolean { return a.rank === b.rank && a.suit === b.suit }

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function buildCard(card: Card, w: number, h: number, state: 'normal' | 'correct' | 'wrong'): Container {
  const c = new Container()
  const radius = 10
  const bg = state === 'correct' ? 0xE8F5E8 : state === 'wrong' ? 0xF8D8D8 : 0xF8F2E0
  const borderColor =
    state === 'correct' ? 0x4FD89C :
    state === 'wrong'   ? 0xE06060 :
    0x8C6200
  const suitColor = SUIT_COLOR[card.suit]
  const symbol = SUIT_SYMBOL[card.suit]

  const shadow = new Graphics()
  shadow.roundRect(-w / 2 + 2, -h / 2 + 3, w, h, radius).fill({ color: 0x000000, alpha: 0.4 })
  c.addChild(shadow)

  const body = new Graphics()
  body.roundRect(-w / 2, -h / 2, w, h, radius).fill(bg).stroke({ width: 2.5, color: borderColor })
  c.addChild(body)

  const inner = new Graphics()
  inner.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, radius - 3).stroke({ width: 1, color: 0x8C6200, alpha: 0.4 })
  c.addChild(inner)

  const cornerSize = Math.min(w, h) * 0.18
  const topLeft = new Container()
  topLeft.x = -w / 2 + 8
  topLeft.y = -h / 2 + 6
  const topRank = new Text({
    text: card.rank,
    style: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: cornerSize,
      fill: suitColor,
      fontWeight: '700',
    },
  })
  topRank.anchor.set(0, 0)
  topLeft.addChild(topRank)
  const topSuit = new Text({
    text: symbol,
    style: { fontFamily: 'Georgia, serif', fontSize: cornerSize * 0.85, fill: suitColor },
  })
  topSuit.anchor.set(0, 0)
  topSuit.x = 0
  topSuit.y = cornerSize * 1.05
  topLeft.addChild(topSuit)
  c.addChild(topLeft)

  const bottomRight = new Container()
  bottomRight.x = w / 2 - 8
  bottomRight.y = h / 2 - 6
  bottomRight.rotation = Math.PI
  const botRank = new Text({
    text: card.rank,
    style: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: cornerSize,
      fill: suitColor,
      fontWeight: '700',
    },
  })
  botRank.anchor.set(0, 0)
  bottomRight.addChild(botRank)
  const botSuit = new Text({
    text: symbol,
    style: { fontFamily: 'Georgia, serif', fontSize: cornerSize * 0.85, fill: suitColor },
  })
  botSuit.anchor.set(0, 0)
  botSuit.x = 0
  botSuit.y = cornerSize * 1.05
  bottomRight.addChild(botSuit)
  c.addChild(bottomRight)

  const centerSize = Math.min(w, h) * 0.55
  const centerSymbol = new Text({
    text: symbol,
    style: { fontFamily: 'Georgia, serif', fontSize: centerSize, fill: suitColor },
  })
  centerSymbol.anchor.set(0.5)
  c.addChild(centerSymbol)

  return c
}

interface RoundData {
  ivanCard: Card
  hand: Card[]              // в каком составе рука перед этим ходом
}

/**
 * Готовим симуляцию: 17 уникальных карт, начальная рука — первые 7, далее
 * каждый раунд Иван играет случайную карту из текущей руки, она уходит,
 * на её место приходит следующая из «колоды-склада». В сумме игрок видит
 * 10 разных карт Ивана (один раз каждая), но рука всегда остаётся 7.
 */
function buildRounds(seed: string): RoundData[] {
  const rng = rngFromSeed(seed)
  const allCombos: Card[] = []
  for (const r of RANKS) for (const s of SUITS) allCombos.push({ rank: r, suit: s })
  const deck = shuffle(allCombos, rng).slice(0, DECK_POOL_SIZE)

  const rounds: RoundData[] = []
  let hand = deck.slice(0, HAND_SIZE)
  let nextSpare = HAND_SIZE

  for (let r = 0; r < ROUNDS; r++) {
    // Иван играет случайную карту из текущей руки
    const ivanIdx = pickInt(rng, 0, hand.length)
    const ivanCard = hand[ivanIdx]
    rounds.push({ ivanCard, hand: hand.slice() })
    // Снимаем сыгранную и добавляем «спрятанную» из склада
    hand = hand.filter((_, i) => i !== ivanIdx)
    if (nextSpare < deck.length) {
      hand.push(deck[nextSpare++])
    }
  }
  return rounds
}

export function IvanDurakGame({ seed, onComplete }: IvanDurakGameProps) {
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(false)
  const errorsRef = useRef(0)
  const rngRef = useRef(rngFromSeed(seed))

  const rounds = useMemo(() => buildRounds(seed), [seed])
  // Порядок отображения карт в руке каждый раунд — независимая случайная перестановка
  const handOrders = useMemo<number[][]>(() => {
    return rounds.map(rd => shuffle(rd.hand.map((_, i) => i), rngRef.current))
  }, [rounds])

  const [round, setRound] = useState(0)
  const [feedback, setFeedback] = useState<{ idx: number; state: 'correct' | 'wrong' } | null>(null)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
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

  // Раундовый таймер: 1 секунда. После таймаута — ошибка и переход.
  useEffect(() => {
    if (doneRef.current) return
    if (feedback) return  // во время фидбека таймер на паузе
    const id = setTimeout(() => {
      if (doneRef.current) return
      // Время вышло — считаем ошибкой и идём дальше
      errorsRef.current += 1
      haptic?.notificationOccurred('error')
      playSound('lose')
      advanceRound()
    }, ROUND_SECONDS * 1000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, feedback])

  const advanceRound = () => {
    const next = roundRef.current + 1
    if (next >= ROUNDS) {
      complete(errorsRef.current)
      return
    }
    setRound(next)
  }

  // Pixi-приложение
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

  // Рендер сцены: карта Ивана сверху + рука игрока внизу (перетасована)
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

      const rd = rounds[round]
      if (!rd) return

      // Иван — крупная карта сверху
      const ivanW = Math.min(140, app.screen.width * 0.32)
      const ivanH = ivanW * 1.45
      const ivanY = ivanH / 2 + 18
      const ivanCtr = buildCard(rd.ivanCard, ivanW, ivanH, 'normal')
      ivanCtr.x = app.screen.width / 2
      ivanCtr.y = ivanY
      app.stage.addChild(ivanCtr)

      // Рука: HAND_SIZE карт в нижней половине
      const order = handOrders[round]
      const cardW = Math.min(72, (app.screen.width - 24) / order.length - 6)
      const cardH = cardW * 1.45
      const gap = 4
      const totalW = order.length * cardW + (order.length - 1) * gap
      const startX = (app.screen.width - totalW) / 2 + cardW / 2
      const handY = app.screen.height - cardH / 2 - 20

      for (let i = 0; i < order.length; i++) {
        const handIdx = order[i]
        const card = rd.hand[handIdx]
        const fb = feedback?.idx === i ? feedback.state : 'normal'
        const c = buildCard(card, cardW, cardH, fb)
        c.x = startX + i * (cardW + gap)
        c.y = handY
        const offset = i - (order.length - 1) / 2
        c.y -= Math.abs(offset) * 2
        c.rotation = offset * 0.04
        c.eventMode = 'static'
        c.cursor = 'pointer'
        c.on('pointertap', () => onPick(i, card))
        app.stage.addChild(c)
      }
    }
    render()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, rounds, handOrders, feedback])

  const onPick = (handPosIdx: number, chosen: Card) => {
    if (doneRef.current || feedback) return
    const rd = rounds[roundRef.current]
    const isCorrect = cardsEqual(chosen, rd.ivanCard)
    if (isCorrect) {
      haptic?.notificationOccurred('success')
      playSound('seal')
      setFeedback({ idx: handPosIdx, state: 'correct' })
    } else {
      haptic?.notificationOccurred('error')
      playSound('lose')
      errorsRef.current += 1
      setFeedback({ idx: handPosIdx, state: 'wrong' })
    }
    setTimeout(() => {
      setFeedback(null)
      advanceRound()
    }, FEEDBACK_MS)
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      maxWidth: '500px', margin: '0 auto', width: '100%', boxSizing: 'border-box',
      padding: spacing.md,
    }}>
      <div style={{
        textAlign: 'center',
        color: colors.fairyGold,
        fontWeight: 700, fontSize: '17px',
      }}>
        Переводной дурак · ход {Math.min(round + 1, ROUNDS)} из {ROUNDS}
      </div>
      <div style={{
        color: colors.textMuted, fontSize: '12px', textAlign: 'center',
        marginBottom: spacing.sm, lineHeight: 1.4,
      }}>
        Иван открывает карту — у тебя в руке такая же. Тапай за секунду.<br />
        0 ошибок — совет чуйки; 1 — пройдёшь без подсказок; ≥2 — только за звёзды.
      </div>

      {/* Полоса-таймер раунда: жёлтая полоска сжимается от 100% до 0% за 1 секунду */}
      <div style={{
        width: '100%', height: 5,
        background: 'rgba(255,184,0,0.15)',
        borderRadius: 3, overflow: 'hidden',
        marginBottom: spacing.sm,
      }}>
        <motion.div
          key={`${round}-${feedback ? 'pause' : 'go'}`}
          initial={{ width: '100%' }}
          animate={{ width: feedback ? '100%' : '0%' }}
          transition={{ duration: feedback ? 0 : ROUND_SECONDS, ease: 'linear' }}
          style={{ height: '100%', background: colors.fairyGold, borderRadius: 3 }}
        />
      </div>

      <div style={{
        display: 'flex', gap: spacing.md, justifyContent: 'center',
        marginBottom: spacing.sm, fontSize: '13px',
      }}>
        <span style={{ color: colors.fairyGold, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {round}/{ROUNDS}
        </span>
        <span style={{ color: errorsRef.current >= 2 ? colors.danger : colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
          Ошибки: {errorsRef.current}
        </span>
      </div>
      <div
        ref={refMount}
        style={{
          flex: 1,
          width: '100%',
          minHeight: '460px',
          touchAction: 'manipulation',
          position: 'relative',
          borderRadius: 16,
          overflow: 'hidden',
          // Игровой стол: зелёное сукно + тёплая лампа сверху
          background: `
            radial-gradient(ellipse at 50% 40%, rgba(255,200,100,0.18) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, #2A5F40 0%, #1A4030 60%, #0F2418 100%)
          `,
          boxShadow: 'inset 0 0 100px rgba(0,0,0,0.7)',
        }}
      >
        {/* SVG-декор: контур стола + рамка лампы */}
        <svg
          viewBox="0 0 320 460"
          preserveAspectRatio="xMidYMax slice"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'none', opacity: 0.5,
          }}
        >
          {/* Чёткие границы стола */}
          <ellipse cx="160" cy="230" rx="155" ry="200" fill="none" stroke="#8C6200" strokeWidth="2" opacity="0.5" />
          <ellipse cx="160" cy="230" rx="148" ry="192" fill="none" stroke="#4A3210" strokeWidth="1" opacity="0.5" />
          {/* Лампа сверху */}
          <ellipse cx="160" cy="20" rx="40" ry="6" fill="#3A2410" />
          <path d="M 130 24 Q 160 50 190 24 Q 175 28 160 28 Q 145 28 130 24" fill="#FFC060" opacity="0.4" />
        </svg>
      </div>
    </div>
  )
}

void cardKey
