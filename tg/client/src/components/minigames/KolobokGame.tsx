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

const PLAY_SECONDS = 15
// Лесенка результата (по аналогии с печатями):
//   ≥ TARGET_PERFECT — идеальная игра (errorCount = 0)
//   ≥ TARGET_OK      — победа (errorCount = 1), посул + тип, но без совета
//   < TARGET_OK      — поражение (errorCount = 2), только за звёзды
const TARGET_OK = 7
const TARGET_PERFECT = 12
const COLS = 3
const ROWS = 3

const SPAWN_INTERVAL_SEC = 0.75       // как часто появляется новый персонаж
const VISIBLE_DURATION_SEC = 0.9      // как долго персонаж виден (включая анимации появления/ухода)
const APPEAR_SEC = 0.18               // длительность выпрыгивания с overshoot
const DISAPPEAR_SEC = 0.15            // длительность утаптывания в нору
const KOLOBOK_PROBABILITY = 0.32      // доля Колобков в общей выборке

// Easing-функции для весёлой анимации выпрыгивания
function easeOutBack(x: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
function easeInCubic(x: number): number {
  return x * x * x
}

interface KolobokGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
  /** Если задано — стартуем сразу в финальной сцене с этим errorCount, без игры.
   *  Используется в фазе 'miniresult' после F5: красивый финал без возможности
   *  перепройти. onComplete не вызываем. */
  restoredErrorCount?: number | null
}

type Character = 'hare' | 'wolf' | 'bear' | 'fox' | 'kolobok'
const ANIMALS: Character[] = ['hare', 'wolf', 'bear', 'fox']

interface HoleState {
  appearedAt: number | null
  character: Character | null
}

function pickCharacter(rng: () => number): Character {
  if (rng() < KOLOBOK_PROBABILITY) return 'kolobok'
  return ANIMALS[Math.floor(rng() * ANIMALS.length)]
}

// ── Рисование персонажей ───────────────────────────────────────────────────


// ── Персонажи через эмодзи ──────────────────────────────────────────────
// Раньше каждое существо рисовалось примитивами Pixi.Graphics (≈80 строк).
// У Telegram-клиента полированные emoji уже есть — пользуемся ими.
// Для Колобка — 🤗 (круглое лицастое с румяными щеками), для зверушек — 🐰🐺🐻🦊.
const CHARACTER_EMOJI: Record<Character, string> = {
  hare:    '🐰',
  wolf:    '🐺',
  bear:    '🐻',
  fox:     '🦊',
  kolobok: '🤗',
}

/** Помещаем эмодзи персонажа в Container (заменяет старый Graphics-рисунок). */
function addCharacterEmoji(parent: Container, ch: Character, size: number): Text {
  const t = new Text({
    text: CHARACTER_EMOJI[ch],
    style: {
      fontSize: size * 1.8,
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
      align: 'center',
    },
  })
  t.anchor.set(0.5)
  parent.addChild(t)
  return t
}

function drawHole(g: Graphics, w: number, h: number) {
  g.ellipse(0, 0, w / 2, h * 0.32).fill(0x0A0512).stroke({ width: 2, color: 0x2A1A05 })
  g.ellipse(0, h * 0.04, w / 2 + 4, h * 0.36).stroke({ width: 3, color: 0x5A3A15, alpha: 0.7 })
}

interface FloatLabel {
  id: number
  x: number          // в координатах канваса (CSS px)
  y: number
  value: string
  color: string
}

export function KolobokGame({ seed, onComplete, restoredErrorCount }: KolobokGameProps) {
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const isFrozen = restoredErrorCount !== null && restoredErrorCount !== undefined
  // doneRef=true в frozen-режиме: блокирует таймер и тапы (на всякий случай)
  const doneRef = useRef(isFrozen)
  const rngRef = useRef(rngFromSeed(seed))
  const holesRef = useRef<HoleState[]>(Array.from({ length: COLS * ROWS }, () => ({ appearedAt: null, character: null })))
  const lastSpawnRef = useRef(performance.now())
  // В frozen-режиме сразу подсовываем представительный счёт для отображения
  // в финальной плашке («12», «9», «5») в зависимости от errorCount
  const initialFrozenScore = isFrozen
    ? (restoredErrorCount === 0 ? 12 : restoredErrorCount === 1 ? 9 : 5)
    : 0
  const scoreRef = useRef(initialFrozenScore)
  const tickerCbRef = useRef<((ticker: Ticker) => void) | null>(null)
  const charContainersRef = useRef<Container[]>([])
  const holePositionsRef = useRef<Array<{ x: number; y: number }>>([])
  const floatIdRef = useRef(0)

  const [score, setScore] = useState(initialFrozenScore)
  const [playCountdown, setPlayCountdown] = useState(PLAY_SECONDS)
  const [floats, setFloats] = useState<FloatLabel[]>([])
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  // Перевод итогового счёта в errorCount по «лесенке».
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
    // Слегка с задержкой — финальная сцена и плавающие очки успеют отрисоваться
    setTimeout(() => setShowCelebration(true), 80)
    onCompleteRef.current(err)
  }

  // После завершения показываем праздничную сцену: Колобок в центре + 4 зверушки.
  // В frozen-режиме сразу показываем финал, без игровой фазы
  const [showCelebration, setShowCelebration] = useState(isFrozen)
  // Триггер пересборки финальной сцены, когда Pixi инициализировался
  const [pixiReady, setPixiReady] = useState(false)
  useEffect(() => {
    if (!showCelebration) return
    const app = refApp.current
    if (!app) return
    void pixiReady  // зависимость, чтобы эффект перезапустился после init
    // Снимаем игровой тикер, чтобы не дёргать ушедшие контейнеры
    if (tickerCbRef.current) {
      try { app.ticker.remove(tickerCbRef.current) } catch { /* noop */ }
      tickerCbRef.current = null
    }
    app.stage.removeChildren()
    const cx = app.screen.width / 2
    const cy = app.screen.height / 2

    // Колобок крупным планом по центру
    const koloC = new Container()
    koloC.x = cx; koloC.y = cy
    addCharacterEmoji(koloC, 'kolobok', 64)
    app.stage.addChild(koloC)

    // 4 зверушки вокруг — по часовой стрелке, начиная сверху
    const radius = Math.min(app.screen.width, app.screen.height) * 0.32
    const ring: Array<{ ch: Character; angle: number; ctr: Container }> = [
      { ch: 'hare', angle: -Math.PI / 2, ctr: new Container() },        // сверху
      { ch: 'wolf', angle: 0, ctr: new Container() },                   // справа
      { ch: 'bear', angle: Math.PI / 2, ctr: new Container() },         // снизу
      { ch: 'fox',  angle: Math.PI, ctr: new Container() },             // слева
    ]
    for (const item of ring) {
      const c = item.ctr
      c.x = cx + Math.cos(item.angle) * radius
      c.y = cy + Math.sin(item.angle) * radius
      addCharacterEmoji(c, item.ch, 44)
      app.stage.addChild(c)
    }

    // Праздничный тикер — Колобок пульсирует, зверушки прыгают по фазам
    const start = performance.now()
    const cb = () => {
      const t = (performance.now() - start) / 1000
      koloC.scale.set(1 + Math.sin(t * 3) * 0.08)
      koloC.rotation = Math.sin(t * 2) * 0.08
      for (let i = 0; i < ring.length; i++) {
        const phase = t * 2.5 + i * Math.PI / 2
        const bob = Math.abs(Math.sin(phase)) * 14
        const item = ring[i]
        item.ctr.x = cx + Math.cos(item.angle) * radius
        item.ctr.y = cy + Math.sin(item.angle) * radius - bob
        item.ctr.rotation = Math.sin(phase * 2) * 0.12
      }
    }
    app.ticker.add(cb)
    return () => {
      try { app.ticker.remove(cb) } catch { /* noop */ }
    }
  }, [showCelebration, pixiReady])

  const spawnFloat = (x: number, y: number, value: string, color: string) => {
    const id = floatIdRef.current++
    setFloats(prev => [...prev, { id, x, y, value, color }])
    // Автоудаление через 0.9с (длительность анимации + запас)
    setTimeout(() => {
      setFloats(prev => prev.filter(f => f.id !== id))
    }, 1000)
  }

  // Таймер раунда (в frozen-режиме не запускается — игры нет, только финал)
  useEffect(() => {
    if (isFrozen) return
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
  }, [])

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

      // В frozen-режиме игровое поле не строим — нужна только финальная сцена,
      // которую соберёт отдельный useEffect (зависящий от pixiReady)
      if (isFrozen) return

      const padX = 12
      const cellW = (app.screen.width - padX * (COLS + 1)) / COLS
      const cellH = Math.min(140, (app.screen.height - 60) / ROWS)
      const totalRowsH = cellH * ROWS
      const startY = (app.screen.height - totalRowsH) / 2 + 30

      const characterContainers: Container[] = []
      const positions: Array<{ x: number; y: number }> = []

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cx = padX + c * (cellW + padX) + cellW / 2
          const cy = startY + r * cellH + cellH / 2

          const holeGfx = new Graphics()
          drawHole(holeGfx, cellW * 0.85, cellH * 0.7)
          holeGfx.x = cx
          holeGfx.y = cy + cellH * 0.18
          app!.stage.addChild(holeGfx)

          // Внешний контейнер — не масштабируется, держит хит-зону. Без сжатия
          // в моменты появления/ухода персонажа, поэтому пальцем легко попасть
          // в любой кадр анимации.
          const charBox = new Container()
          charBox.x = cx
          charBox.y = cy + cellH * 0.08
          charBox.eventMode = 'none'
          charBox.cursor = 'pointer'
          charBox.visible = false

          // Хит-зона: больше визуальной клетки во все стороны (1.5×1.5 cell).
          // Кружок — комфортнее для пальца, чем прямоугольник.
          const hit = new Graphics()
          hit.circle(0, 0, Math.max(cellW, cellH) * 0.75).fill({ color: 0xFFFFFF, alpha: 0.0001 })
          charBox.addChild(hit)

          // Внутренний контейнер — здесь scale.y анимируется (выскакивание).
          // Внутри лежит emoji-Text персонажа; пересоздаётся при каждом spawn.
          const inner = new Container()
          charBox.addChild(inner)
          ;(charBox as any).__inner = inner
          ;(charBox as any).__cellH = cellH

          const idx = r * COLS + c
          charBox.on('pointertap', () => onHoleTap(idx))

          app!.stage.addChild(charBox)
          characterContainers.push(charBox)
          positions.push({ x: cx, y: cy - cellH * 0.2 })
        }
      }
      charContainersRef.current = characterContainers
      holePositionsRef.current = positions

      startTimeRef.current = performance.now()
      lastSpawnRef.current = performance.now()
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
      charContainersRef.current = []
      holePositionsRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Стартовое время игры (для гипотетических аналитик/отладки)
  const startTimeRef = useRef(performance.now())

  // ── Логика тапов ────────────────────────────────────────────────────────

  const onHoleTap = (idx: number) => {
    if (doneRef.current) return
    const hole = holesRef.current[idx]
    if (hole.appearedAt === null || !hole.character) return
    // Раньше тут было ограничение «не считать тап в последние 0.12с (фаза
    // ухода)» — игрок жаловался, что тап перед самым концом не засчитывается.
    // Теперь принимаем тапы пока персонаж в норе хоть как-то виден.
    const t = (performance.now() - hole.appearedAt) / 1000
    if (t > VISIBLE_DURATION_SEC) return

    haptic?.impactOccurred('light')
    const pos = holePositionsRef.current[idx]
    if (hole.character === 'kolobok') {
      scoreRef.current -= 3
      playSound('lose')
      if (pos) spawnFloat(pos.x, pos.y, '−3', colors.danger)
    } else {
      scoreRef.current += 1
      playSound('seal')
      if (pos) spawnFloat(pos.x, pos.y, '+1', colors.success)
    }
    setScore(scoreRef.current)

    // Идеальная игра — сразу заканчиваем как только дошли до подсказки
    if (scoreRef.current >= TARGET_PERFECT) {
      complete(scoreRef.current)
    }

    hole.appearedAt = null
    hole.character = null
  }

  const updateScene = () => {
    if (doneRef.current) return
    const now = performance.now()

    if ((now - lastSpawnRef.current) / 1000 >= SPAWN_INTERVAL_SEC) {
      const empty = holesRef.current
        .map((h, i) => ({ h, i }))
        .filter(x => x.h.appearedAt === null)
      if (empty.length > 0) {
        const pick = empty[Math.floor(rngRef.current() * empty.length)]
        pick.h.character = pickCharacter(rngRef.current)
        pick.h.appearedAt = now
      }
      lastSpawnRef.current = now
    }

    for (let i = 0; i < holesRef.current.length; i++) {
      const hole = holesRef.current[i]
      const box = charContainersRef.current[i]
      if (!box) continue
      const inner: Container = (box as any).__inner

      if (hole.appearedAt === null || !hole.character) {
        if (box.visible) {
          box.visible = false
          box.eventMode = 'none'
        }
        continue
      }

      const t = (now - hole.appearedAt) / 1000
      if (t >= VISIBLE_DURATION_SEC) {
        hole.appearedAt = null
        hole.character = null
        box.visible = false
        box.eventMode = 'none'
        continue
      }

      // Bouncy выпрыгивание (overshoot до 1.15) + утаптывание в нору.
      // В стабильной фазе — лёгкое покачивание (wiggle) + плавающая высота.
      let sy = 1
      let sx = 1
      let wiggle = 0
      let bobY = 0
      if (t < APPEAR_SEC) {
        // Squash → stretch: x растягивается вниз, y вытягивается вверх
        const k = easeOutBack(t / APPEAR_SEC)
        sy = k
        sx = 1.15 - 0.15 * k
      } else if (t > VISIBLE_DURATION_SEC - DISAPPEAR_SEC) {
        const k = (VISIBLE_DURATION_SEC - t) / DISAPPEAR_SEC
        sy = easeInCubic(Math.max(0, k))
        sx = 1.0 + 0.15 * (1 - sy)
      } else {
        // Стабильная фаза — wiggle и bob
        const localT = (now - hole.appearedAt) / 1000
        wiggle = Math.sin(localT * 14) * 0.05
        bobY = -Math.sin(localT * 8) * 2
        sy = 1 + Math.sin(localT * 10) * 0.04
        sx = 1 - Math.sin(localT * 10) * 0.04
      }

      if (!box.visible) {
        const innerCtr: Container = (box as any).__inner
        const cellH: number = (box as any).__cellH
        // Удаляем старого персонажа из inner-контейнера и кладём нового.
        // КРИТИЧЕСКОЕ: destroy({children:true}) — иначе Text glyph-атлас
        // эмодзи не освобождается. На длинной игре копится ~50-80 Text'ов.
        const oldKids = innerCtr.removeChildren()
        for (const k of oldKids) {
          try { k.destroy({ children: true }) } catch { /* noop */ }
        }
        addCharacterEmoji(innerCtr, hole.character, cellH * 0.32)
        box.visible = true
        box.eventMode = 'static'
      }
      // Сжимаем только визуал, хит-зона на внешнем контейнере остаётся в полном размере
      if (inner) {
        inner.scale.y = sy
        inner.scale.x = sx
        inner.rotation = wiggle
        inner.y = bobY
      }
    }
  }

  const scoreColor = score >= TARGET_PERFECT ? colors.success
    : score >= TARGET_OK ? colors.fairyGold
    : colors.textOnDark

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      maxWidth: '500px', margin: '0 auto', width: '100%', boxSizing: 'border-box',
      padding: spacing.md,
    }}>
      <GameHeader
        title={<>Нора-нора-нора · {playCountdown} сек</>}
        urgent={playCountdown <= 5}
        hint={<>Тапай зверушек (+1), не задень Колобка (−3). 7 — пройти, 12 — раскрыть совет чуйки</>}
        scoreChip={
          <ScoreChip tone={score >= TARGET_PERFECT ? 'success' : score >= TARGET_OK ? 'gold' : 'danger'}>
            Счёт: {score}
          </ScoreChip>
        }
        timerProgress={playCountdown / PLAY_SECONDS}
      />
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
          // Лесной фон: вечернее небо → силуэты елей → земля
          background: `
            linear-gradient(to bottom,
              #0D1735 0%,
              #1A2256 35%,
              #2B1F4A 60%,
              #1A0F30 85%,
              #0A0512 100%
            )
          `,
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Силуэты елей по краям сцены */}
        <svg
          viewBox="0 0 320 460"
          preserveAspectRatio="xMidYMax slice"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'none', opacity: 0.55,
          }}
        >
          <defs>
            <linearGradient id="treeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1E3025" />
              <stop offset="100%" stopColor="#0A1410" />
            </linearGradient>
          </defs>
          {/* Дальние ели слева */}
          <polygon points="10,300 30,200 50,300" fill="url(#treeGrad)" />
          <polygon points="35,320 60,220 85,320" fill="url(#treeGrad)" />
          {/* Дальние ели справа */}
          <polygon points="280,300 300,210 320,300" fill="url(#treeGrad)" />
          <polygon points="245,320 270,225 295,320" fill="url(#treeGrad)" />
          {/* Звёзды над лесом */}
          <circle cx="80" cy="50" r="1.5" fill="#FFE090" opacity="0.7" />
          <circle cx="150" cy="35" r="1" fill="#FFE090" opacity="0.5" />
          <circle cx="220" cy="60" r="1.5" fill="#FFE090" opacity="0.7" />
          <circle cx="60" cy="90" r="1" fill="#FFE090" opacity="0.5" />
          <circle cx="260" cy="100" r="1.2" fill="#FFE090" opacity="0.6" />
          {/* Луна */}
          <circle cx="280" cy="50" r="14" fill="#FFE9A0" opacity="0.55" />
          <circle cx="275" cy="46" r="11" fill="#FFF4C0" opacity="0.7" />
        </svg>

        {/* Финальное число очков — крупно над праздничной сценой */}
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{
              position: 'absolute',
              top: 12, left: 0, right: 0,
              textAlign: 'center',
              color: scoreColor,
              fontSize: 40,
              fontWeight: 900,
              textShadow: '0 4px 14px rgba(0,0,0,0.7)',
              pointerEvents: 'none',
              userSelect: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {score}
            <div style={{ color: colors.textOnDarkMuted, fontSize: 12, fontWeight: 600, marginTop: 2 }}>
              очков набрано
            </div>
          </motion.div>
        )}

        {/* Всплывающие очки */}
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
                fontSize: '34px',
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
