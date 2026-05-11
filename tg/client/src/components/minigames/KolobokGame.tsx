import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Application, Container, Graphics, Ticker } from 'pixi.js'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const PLAY_SECONDS = 10
// Лесенка результата (по аналогии с печатями):
//   ≥ TARGET_PERFECT — идеальная игра (errorCount = 0)
//   ≥ TARGET_OK      — победа (errorCount = 1), посул + тип, но без совета
//   < TARGET_OK      — поражение (errorCount = 2), только за звёзды
const TARGET_OK = 7
const TARGET_PERFECT = 12
const COLS = 3
const ROWS = 3

const SPAWN_INTERVAL_SEC = 0.65       // как часто появляется новый персонаж
const VISIBLE_DURATION_SEC = 0.7      // как долго персонаж виден (включая анимации)
const APPEAR_SEC = 0.12
const DISAPPEAR_SEC = 0.12
const KOLOBOK_PROBABILITY = 0.32      // доля Колобков в общей выборке

interface KolobokGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
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

function drawHare(g: Graphics, size: number) {
  g.ellipse(-size * 0.32, -size * 0.85, size * 0.13, size * 0.42).fill(0xEEEEE6).stroke({ width: 2, color: 0x6F6F68 })
  g.ellipse(size * 0.32, -size * 0.85, size * 0.13, size * 0.42).fill(0xEEEEE6).stroke({ width: 2, color: 0x6F6F68 })
  g.ellipse(-size * 0.32, -size * 0.85, size * 0.06, size * 0.26).fill(0xF2A8B0)
  g.ellipse(size * 0.32, -size * 0.85, size * 0.06, size * 0.26).fill(0xF2A8B0)
  g.circle(0, 0, size * 0.55).fill(0xEEEEE6).stroke({ width: 2, color: 0x6F6F68 })
  g.circle(-size * 0.25, size * 0.15, size * 0.13).fill({ color: 0xFFFFFF, alpha: 0.6 })
  g.circle(size * 0.25, size * 0.15, size * 0.13).fill({ color: 0xFFFFFF, alpha: 0.6 })
  g.circle(-size * 0.2, -size * 0.05, size * 0.08).fill(0x0D1735)
  g.circle(size * 0.2, -size * 0.05, size * 0.08).fill(0x0D1735)
  g.circle(-size * 0.18, -size * 0.08, size * 0.03).fill(0xFFFFFF)
  g.circle(size * 0.22, -size * 0.08, size * 0.03).fill(0xFFFFFF)
  g.ellipse(0, size * 0.18, size * 0.08, size * 0.05).fill(0xF06070)
  g.rect(-size * 0.05, size * 0.22, size * 0.02, size * 0.18).fill(0x0D1735)
}

function drawWolf(g: Graphics, size: number) {
  const grey = 0x6E6E76
  const greyD = 0x40404A
  g.poly([-size * 0.45, -size * 0.3, -size * 0.18, -size * 0.95, -size * 0.08, -size * 0.35]).fill(grey).stroke({ width: 2, color: greyD })
  g.poly([size * 0.45, -size * 0.3, size * 0.18, -size * 0.95, size * 0.08, -size * 0.35]).fill(grey).stroke({ width: 2, color: greyD })
  g.poly([-size * 0.35, -size * 0.35, -size * 0.18, -size * 0.78, -size * 0.12, -size * 0.4]).fill(0x2A2A30)
  g.poly([size * 0.35, -size * 0.35, size * 0.18, -size * 0.78, size * 0.12, -size * 0.4]).fill(0x2A2A30)
  g.circle(0, 0, size * 0.55).fill(grey).stroke({ width: 2, color: greyD })
  g.ellipse(0, size * 0.18, size * 0.42, size * 0.3).fill(0xC8C8D0)
  g.circle(-size * 0.22, -size * 0.1, size * 0.09).fill(0xE9C530)
  g.circle(size * 0.22, -size * 0.1, size * 0.09).fill(0xE9C530)
  g.ellipse(-size * 0.22, -size * 0.1, size * 0.025, size * 0.07).fill(0x0D1735)
  g.ellipse(size * 0.22, -size * 0.1, size * 0.025, size * 0.07).fill(0x0D1735)
  g.ellipse(0, size * 0.3, size * 0.16, size * 0.1).fill(greyD)
  g.ellipse(0, size * 0.22, size * 0.09, size * 0.06).fill(0x0D1735)
}

function drawBear(g: Graphics, size: number) {
  const brown = 0x6B4423
  const brownD = 0x3D2810
  g.circle(-size * 0.42, -size * 0.55, size * 0.2).fill(brown).stroke({ width: 2, color: brownD })
  g.circle(size * 0.42, -size * 0.55, size * 0.2).fill(brown).stroke({ width: 2, color: brownD })
  g.circle(-size * 0.42, -size * 0.55, size * 0.1).fill(0xB07A50)
  g.circle(size * 0.42, -size * 0.55, size * 0.1).fill(0xB07A50)
  g.circle(0, 0, size * 0.6).fill(brown).stroke({ width: 2, color: brownD })
  g.ellipse(0, size * 0.2, size * 0.35, size * 0.28).fill(0xC9956A)
  g.circle(-size * 0.22, -size * 0.1, size * 0.08).fill(0x0D1735)
  g.circle(size * 0.22, -size * 0.1, size * 0.08).fill(0x0D1735)
  g.circle(-size * 0.2, -size * 0.13, size * 0.03).fill(0xFFFFFF)
  g.circle(size * 0.24, -size * 0.13, size * 0.03).fill(0xFFFFFF)
  g.ellipse(0, size * 0.12, size * 0.11, size * 0.08).fill(0x0D1735)
}

function drawFox(g: Graphics, size: number) {
  const orange = 0xE9842B
  const orangeD = 0x8C4E10
  g.poly([-size * 0.4, -size * 0.35, -size * 0.2, -size * 0.95, -size * 0.05, -size * 0.4]).fill(orange).stroke({ width: 2, color: orangeD })
  g.poly([size * 0.4, -size * 0.35, size * 0.2, -size * 0.95, size * 0.05, -size * 0.4]).fill(orange).stroke({ width: 2, color: orangeD })
  g.poly([-size * 0.32, -size * 0.4, -size * 0.2, -size * 0.78, -size * 0.1, -size * 0.42]).fill(0x40282A)
  g.poly([size * 0.32, -size * 0.4, size * 0.2, -size * 0.78, size * 0.1, -size * 0.42]).fill(0x40282A)
  g.circle(0, 0, size * 0.55).fill(orange).stroke({ width: 2, color: orangeD })
  g.poly([0, -size * 0.1, -size * 0.32, size * 0.45, size * 0.32, size * 0.45]).fill(0xF8E8D0)
  g.ellipse(-size * 0.22, -size * 0.08, size * 0.08, size * 0.06).fill(0x0D1735)
  g.ellipse(size * 0.22, -size * 0.08, size * 0.08, size * 0.06).fill(0x0D1735)
  g.poly([0, size * 0.15, -size * 0.07, size * 0.28, size * 0.07, size * 0.28]).fill(0x0D1735)
  g.rect(-size * 0.08, size * 0.32, size * 0.02, size * 0.18).fill(0x40282A)
  g.rect(size * 0.06, size * 0.32, size * 0.02, size * 0.18).fill(0x40282A)
}

function drawKolobok(g: Graphics, size: number) {
  const yellow = 0xFFCB45
  const yellowD = 0xB07A10
  g.circle(size * 0.07, size * 0.07, size * 0.62).fill({ color: 0x000000, alpha: 0.35 })
  g.circle(0, 0, size * 0.6).fill(0xC9941A)
  g.circle(-size * 0.05, -size * 0.05, size * 0.55).fill(yellow)
  g.circle(-size * 0.15, -size * 0.15, size * 0.4).fill(0xFFE090)
  g.circle(-size * 0.22, -size * 0.22, size * 0.18).fill(0xFFF6E0)
  g.circle(0, 0, size * 0.6).stroke({ width: 2, color: yellowD })
  g.circle(-size * 0.22, -size * 0.08, size * 0.07).fill(0x0D1735)
  g.circle(size * 0.22, -size * 0.08, size * 0.07).fill(0x0D1735)
  g.circle(-size * 0.35, size * 0.2, size * 0.08).fill({ color: 0xF06070, alpha: 0.5 })
  g.circle(size * 0.35, size * 0.2, size * 0.08).fill({ color: 0xF06070, alpha: 0.5 })
  g.arc(0, size * 0.1, size * 0.28, 0.15 * Math.PI, 0.85 * Math.PI).stroke({ width: 3, color: 0x0D1735 })
}

const DRAWERS: Record<Character, (g: Graphics, size: number) => void> = {
  hare: drawHare,
  wolf: drawWolf,
  bear: drawBear,
  fox: drawFox,
  kolobok: drawKolobok,
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

export function KolobokGame({ seed, onComplete }: KolobokGameProps) {
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(false)
  const rngRef = useRef(rngFromSeed(seed))
  const holesRef = useRef<HoleState[]>(Array.from({ length: COLS * ROWS }, () => ({ appearedAt: null, character: null })))
  const lastSpawnRef = useRef(performance.now())
  const scoreRef = useRef(0)
  const tickerCbRef = useRef<((ticker: Ticker) => void) | null>(null)
  const charContainersRef = useRef<Container[]>([])
  const holePositionsRef = useRef<Array<{ x: number; y: number }>>([])
  const floatIdRef = useRef(0)

  const [score, setScore] = useState(0)
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
    onCompleteRef.current(err)
  }

  const spawnFloat = (x: number, y: number, value: string, color: string) => {
    const id = floatIdRef.current++
    setFloats(prev => [...prev, { id, x, y, value, color }])
    // Автоудаление через 0.9с (длительность анимации + запас)
    setTimeout(() => {
      setFloats(prev => prev.filter(f => f.id !== id))
    }, 1000)
  }

  // Таймер раунда
  useEffect(() => {
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

          const charBox = new Container()
          charBox.x = cx
          charBox.y = cy + cellH * 0.08
          charBox.eventMode = 'static'
          charBox.cursor = 'pointer'
          charBox.visible = false

          const hit = new Graphics()
          hit.rect(-cellW * 0.42, -cellH * 0.5, cellW * 0.84, cellH).fill({ color: 0xFFFFFF, alpha: 0.0001 })
          charBox.addChild(hit)

          const charGfx = new Graphics()
          charBox.addChild(charGfx)
          ;(charBox as any).__charGfx = charGfx
          ;(charBox as any).__cellH = cellH

          const idx = r * COLS + c
          charBox.on('pointertap', () => onHoleTap(idx))

          app!.stage.addChild(charBox)
          characterContainers.push(charBox)
          // Позиция для всплывающих цифр — над персонажем
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
    const t = (performance.now() - hole.appearedAt) / 1000
    if (t > VISIBLE_DURATION_SEC - DISAPPEAR_SEC) return

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

      if (hole.appearedAt === null || !hole.character) {
        if (box.visible) box.visible = false
        continue
      }

      const t = (now - hole.appearedAt) / 1000
      if (t >= VISIBLE_DURATION_SEC) {
        hole.appearedAt = null
        hole.character = null
        box.visible = false
        continue
      }

      let s = 1
      if (t < APPEAR_SEC) {
        s = t / APPEAR_SEC
      } else if (t > VISIBLE_DURATION_SEC - DISAPPEAR_SEC) {
        s = Math.max(0, (VISIBLE_DURATION_SEC - t) / DISAPPEAR_SEC)
      }

      if (!box.visible) {
        const g: Graphics = (box as any).__charGfx
        const cellH: number = (box as any).__cellH
        g.clear()
        DRAWERS[hole.character](g, cellH * 0.32)
        box.visible = true
      }
      box.scale.y = s
      box.scale.x = 0.85 + 0.15 * s
    }
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
        color: playCountdown <= 5 ? colors.danger : colors.fairyGold,
        fontWeight: 700, fontSize: '17px',
      }}>
        Нора-нора-нора · {playCountdown} сек
      </div>
      <div style={{
        color: colors.textMuted, fontSize: '12px', textAlign: 'center',
        marginBottom: spacing.sm, lineHeight: 1.4,
      }}>
        Тапай зверушек (+1), не задень Колобка (−3). <br />
        7 — пройти, 12 — раскрыть совет чуйки
      </div>
      <div style={{
        display: 'flex', gap: spacing.md, justifyContent: 'center',
        marginBottom: spacing.sm, fontSize: '13px',
      }}>
        <span style={{ color: scoreColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          Счёт: {score}
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
      >
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
