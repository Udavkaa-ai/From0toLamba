import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Application, Container, Graphics, Text } from 'pixi.js'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const PLAY_SECONDS = 15
const HAND_SIZE = 7

// Лесенка ошибок:
//   0 неверных тапов  — идеальная игра (совет чуйки)
//   1 неверный        — победа (посул + тип)
//   ≥2 неверных       — поражение (только за звёзды)

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
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}
const SUIT_COLOR: Record<Suit, number> = {
  spades: 0x1A1024,
  hearts: 0xB81E1E,
  diamonds: 0xB81E1E,
  clubs: 0x1A1024,
}

interface Card {
  rank: Rank
  suit: Suit
}

function cardKey(c: Card): string {
  return `${c.rank}${c.suit}`
}
function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ── Рисование карты через Pixi.Graphics + Pixi.Text ───────────────────────

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

  // Подложка-тень
  const shadow = new Graphics()
  shadow.roundRect(-w / 2 + 2, -h / 2 + 3, w, h, radius).fill({ color: 0x000000, alpha: 0.4 })
  c.addChild(shadow)

  // Основа карты
  const body = new Graphics()
  body.roundRect(-w / 2, -h / 2, w, h, radius).fill(bg).stroke({ width: 2.5, color: borderColor })
  c.addChild(body)

  // Внутренняя рамка-фаска (создаёт «дороговизну»)
  const inner = new Graphics()
  inner.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, radius - 3).stroke({ width: 1, color: 0x8C6200, alpha: 0.4 })
  c.addChild(inner)

  // Верхний левый угол: значение и масть
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
    style: {
      fontFamily: 'Georgia, serif',
      fontSize: cornerSize * 0.85,
      fill: suitColor,
    },
  })
  topSuit.anchor.set(0, 0)
  topSuit.x = 0
  topSuit.y = cornerSize * 1.05
  topLeft.addChild(topSuit)
  c.addChild(topLeft)

  // Нижний правый угол: то же, перевёрнуто на 180°
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
    style: {
      fontFamily: 'Georgia, serif',
      fontSize: cornerSize * 0.85,
      fill: suitColor,
    },
  })
  botSuit.anchor.set(0, 0)
  botSuit.x = 0
  botSuit.y = cornerSize * 1.05
  bottomRight.addChild(botSuit)
  c.addChild(bottomRight)

  // Центральный крупный символ масти
  const centerSize = Math.min(w, h) * 0.55
  const centerSymbol = new Text({
    text: symbol,
    style: {
      fontFamily: 'Georgia, serif',
      fontSize: centerSize,
      fill: suitColor,
    },
  })
  centerSymbol.anchor.set(0.5)
  centerSymbol.x = 0
  centerSymbol.y = 0
  c.addChild(centerSymbol)

  return c
}

export function IvanDurakGame({ seed, onComplete }: IvanDurakGameProps) {
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(false)
  const rngRef = useRef(rngFromSeed(seed))
  const errorsRef = useRef(0)

  // 7 уникальных карт — общий комплект на двоих
  const deck = useMemo<Card[]>(() => {
    const allCombos: Card[] = []
    for (const r of RANKS) for (const s of SUITS) allCombos.push({ rank: r, suit: s })
    return shuffle(allCombos, rngRef.current).slice(0, HAND_SIZE)
  }, [])

  const [round, setRound] = useState(0)
  const [playCountdown, setPlayCountdown] = useState(PLAY_SECONDS)
  const [feedback, setFeedback] = useState<{ idx: number; state: 'correct' | 'wrong' } | null>(null)
  // Случайный порядок карт в руке игрока каждый ход — обновляется при смене round
  const playerHandOrders = useMemo<number[][]>(() => {
    return deck.map((_, roundIdx) => {
      // На раунде R остаются карты с индексами >= R, перетасованные
      const remaining = Array.from({ length: deck.length - roundIdx }, (_, i) => roundIdx + i)
      return shuffle(remaining, rngRef.current)
    })
  }, [deck])

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

  // Общий таймер
  useEffect(() => {
    setPlayCountdown(PLAY_SECONDS)
    const id = setInterval(() => {
      setPlayCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          const remaining = HAND_SIZE - roundRef.current
          complete(errorsRef.current + remaining)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Рендер сцены: карта Ивана сверху + рука игрока внизу
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

      const ivanCard = deck[round]
      if (!ivanCard) return

      // Карта Ивана — крупная, в верхней трети
      const ivanW = Math.min(140, app.screen.width * 0.32)
      const ivanH = ivanW * 1.45
      const ivanY = ivanH / 2 + 18
      const ivanCtr = buildCard(ivanCard, ivanW, ivanH, 'normal')
      ivanCtr.x = app.screen.width / 2
      ivanCtr.y = ivanY
      app.stage.addChild(ivanCtr)

      // Рука игрока — в нижней половине, в линию с лёгким веером
      const hand = playerHandOrders[round]
      if (!hand) return
      const cardW = Math.min(74, (app.screen.width - 24) / hand.length - 6)
      const cardH = cardW * 1.45
      const gap = 4
      const totalW = hand.length * cardW + (hand.length - 1) * gap
      const startX = (app.screen.width - totalW) / 2 + cardW / 2
      const handY = app.screen.height - cardH / 2 - 20

      for (let i = 0; i < hand.length; i++) {
        const cardIdx = hand[i]
        const card = deck[cardIdx]
        const fbState = feedback?.idx === i ? feedback.state : 'normal'
        const c = buildCard(card, cardW, cardH, fbState)
        c.x = startX + i * (cardW + gap)
        c.y = handY
        // Лёгкий «веер» — карты в центре чуть выше
        const offset = i - (hand.length - 1) / 2
        c.y -= Math.abs(offset) * 2
        c.rotation = offset * 0.04
        c.eventMode = 'static'
        c.cursor = 'pointer'
        c.on('pointertap', () => onPick(i, cardIdx))
        app.stage.addChild(c)
      }
    }
    render()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, deck, playerHandOrders, feedback])

  const onPick = (handIdx: number, deckIdx: number) => {
    if (doneRef.current || feedback) return
    const ivanCard = deck[roundRef.current]
    const chosen = deck[deckIdx]
    const isCorrect = cardsEqual(chosen, ivanCard)
    if (isCorrect) {
      haptic?.notificationOccurred('success')
      playSound('seal')
      setFeedback({ idx: handIdx, state: 'correct' })
    } else {
      haptic?.notificationOccurred('error')
      playSound('lose')
      errorsRef.current += 1
      setFeedback({ idx: handIdx, state: 'wrong' })
    }
    setTimeout(() => {
      setFeedback(null)
      const nextRound = roundRef.current + 1
      if (nextRound >= HAND_SIZE) {
        complete(errorsRef.current)
        return
      }
      setRound(nextRound)
    }, 500)
  }

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
        Переводной дурак · {playCountdown} сек
      </div>
      <div style={{
        color: colors.textMuted, fontSize: '12px', textAlign: 'center',
        marginBottom: spacing.sm, lineHeight: 1.4,
      }}>
        Иван открывает карту — найди такую же в своей руке.<br />
        {round + 1} из {HAND_SIZE}. Без ошибок — раскроется совет чуйки.
      </div>
      <div style={{
        display: 'flex', gap: spacing.md, justifyContent: 'center',
        marginBottom: spacing.sm, fontSize: '13px',
      }}>
        <span style={{ color: colors.fairyGold, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {round}/{HAND_SIZE}
        </span>
        <span style={{ color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
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
        }}
      />
    </div>
  )
}

// Чтобы линтер не ругался — экспортируем для тестов и будущей локализации
export const IVAN_DURAK_SUIT_NAMES: Record<Suit, string> = {
  spades: 'Пики',
  hearts: 'Червы',
  diamonds: 'Бубны',
  clubs: 'Трефы',
}
void cardKey
