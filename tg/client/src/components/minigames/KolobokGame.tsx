import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics, Ticker } from 'pixi.js'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const PLAY_SECONDS = 15
const TARGET_SCORE = 7
const COLS = 3
const ROWS = 3

const SPAWN_INTERVAL_SEC = 0.75       // как часто появляется новый персонаж
const VISIBLE_DURATION_SEC = 0.7      // как долго персонаж виден (включая анимации)
const APPEAR_SEC = 0.12
const DISAPPEAR_SEC = 0.12
const KOLOBOK_PROBABILITY = 0.35      // доля Колобков в общей выборке

interface KolobokGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
}

type Character = 'hare' | 'wolf' | 'bear' | 'fox' | 'kolobok'
const ANIMALS: Character[] = ['hare', 'wolf', 'bear', 'fox']

interface HoleState {
  // Когда персонаж появился (мс с performance.now()). null = нора пустая
  appearedAt: number | null
  character: Character | null
}

function pickCharacter(rng: () => number): Character {
  if (rng() < KOLOBOK_PROBABILITY) return 'kolobok'
  return ANIMALS[Math.floor(rng() * ANIMALS.length)]
}

// ── Рисование персонажей через Pixi.Graphics ───────────────────────────────

function drawHare(g: Graphics, size: number) {
  // Уши
  g.ellipse(-size * 0.32, -size * 0.85, size * 0.13, size * 0.42).fill(0xEEEEE6).stroke({ width: 2, color: 0x6F6F68 })
  g.ellipse(size * 0.32, -size * 0.85, size * 0.13, size * 0.42).fill(0xEEEEE6).stroke({ width: 2, color: 0x6F6F68 })
  g.ellipse(-size * 0.32, -size * 0.85, size * 0.06, size * 0.26).fill(0xF2A8B0)
  g.ellipse(size * 0.32, -size * 0.85, size * 0.06, size * 0.26).fill(0xF2A8B0)
  // Голова
  g.circle(0, 0, size * 0.55).fill(0xEEEEE6).stroke({ width: 2, color: 0x6F6F68 })
  // Щёчки-блики
  g.circle(-size * 0.25, size * 0.15, size * 0.13).fill({ color: 0xFFFFFF, alpha: 0.6 })
  g.circle(size * 0.25, size * 0.15, size * 0.13).fill({ color: 0xFFFFFF, alpha: 0.6 })
  // Глаза
  g.circle(-size * 0.2, -size * 0.05, size * 0.08).fill(0x0D1735)
  g.circle(size * 0.2, -size * 0.05, size * 0.08).fill(0x0D1735)
  g.circle(-size * 0.18, -size * 0.08, size * 0.03).fill(0xFFFFFF)
  g.circle(size * 0.22, -size * 0.08, size * 0.03).fill(0xFFFFFF)
  // Нос + усы
  g.ellipse(0, size * 0.18, size * 0.08, size * 0.05).fill(0xF06070)
  g.rect(-size * 0.05, size * 0.22, size * 0.02, size * 0.18).fill(0x0D1735)
}

function drawWolf(g: Graphics, size: number) {
  const grey = 0x6E6E76
  const greyD = 0x40404A
  // Уши (треугольники)
  g.poly([-size * 0.45, -size * 0.3, -size * 0.18, -size * 0.95, -size * 0.08, -size * 0.35]).fill(grey).stroke({ width: 2, color: greyD })
  g.poly([size * 0.45, -size * 0.3, size * 0.18, -size * 0.95, size * 0.08, -size * 0.35]).fill(grey).stroke({ width: 2, color: greyD })
  g.poly([-size * 0.35, -size * 0.35, -size * 0.18, -size * 0.78, -size * 0.12, -size * 0.4]).fill(0x2A2A30)
  g.poly([size * 0.35, -size * 0.35, size * 0.18, -size * 0.78, size * 0.12, -size * 0.4]).fill(0x2A2A30)
  // Голова
  g.circle(0, 0, size * 0.55).fill(grey).stroke({ width: 2, color: greyD })
  // Светлая нижняя «маска»
  g.ellipse(0, size * 0.18, size * 0.42, size * 0.3).fill(0xC8C8D0)
  // Глаза
  g.circle(-size * 0.22, -size * 0.1, size * 0.09).fill(0xE9C530)
  g.circle(size * 0.22, -size * 0.1, size * 0.09).fill(0xE9C530)
  g.ellipse(-size * 0.22, -size * 0.1, size * 0.025, size * 0.07).fill(0x0D1735)
  g.ellipse(size * 0.22, -size * 0.1, size * 0.025, size * 0.07).fill(0x0D1735)
  // Морда + нос
  g.ellipse(0, size * 0.3, size * 0.16, size * 0.1).fill(greyD)
  g.ellipse(0, size * 0.22, size * 0.09, size * 0.06).fill(0x0D1735)
}

function drawBear(g: Graphics, size: number) {
  const brown = 0x6B4423
  const brownD = 0x3D2810
  // Уши (круглые)
  g.circle(-size * 0.42, -size * 0.55, size * 0.2).fill(brown).stroke({ width: 2, color: brownD })
  g.circle(size * 0.42, -size * 0.55, size * 0.2).fill(brown).stroke({ width: 2, color: brownD })
  g.circle(-size * 0.42, -size * 0.55, size * 0.1).fill(0xB07A50)
  g.circle(size * 0.42, -size * 0.55, size * 0.1).fill(0xB07A50)
  // Голова
  g.circle(0, 0, size * 0.6).fill(brown).stroke({ width: 2, color: brownD })
  // Светлая морда
  g.ellipse(0, size * 0.2, size * 0.35, size * 0.28).fill(0xC9956A)
  // Глаза
  g.circle(-size * 0.22, -size * 0.1, size * 0.08).fill(0x0D1735)
  g.circle(size * 0.22, -size * 0.1, size * 0.08).fill(0x0D1735)
  g.circle(-size * 0.2, -size * 0.13, size * 0.03).fill(0xFFFFFF)
  g.circle(size * 0.24, -size * 0.13, size * 0.03).fill(0xFFFFFF)
  // Нос
  g.ellipse(0, size * 0.12, size * 0.11, size * 0.08).fill(0x0D1735)
}

function drawFox(g: Graphics, size: number) {
  const orange = 0xE9842B
  const orangeD = 0x8C4E10
  // Уши (треугольники)
  g.poly([-size * 0.4, -size * 0.35, -size * 0.2, -size * 0.95, -size * 0.05, -size * 0.4]).fill(orange).stroke({ width: 2, color: orangeD })
  g.poly([size * 0.4, -size * 0.35, size * 0.2, -size * 0.95, size * 0.05, -size * 0.4]).fill(orange).stroke({ width: 2, color: orangeD })
  g.poly([-size * 0.32, -size * 0.4, -size * 0.2, -size * 0.78, -size * 0.1, -size * 0.42]).fill(0x40282A)
  g.poly([size * 0.32, -size * 0.4, size * 0.2, -size * 0.78, size * 0.1, -size * 0.42]).fill(0x40282A)
  // Голова
  g.circle(0, 0, size * 0.55).fill(orange).stroke({ width: 2, color: orangeD })
  // Белый треугольник на морде
  g.poly([0, -size * 0.1, -size * 0.32, size * 0.45, size * 0.32, size * 0.45]).fill(0xF8E8D0)
  // Глаза — хитрый прищур
  g.ellipse(-size * 0.22, -size * 0.08, size * 0.08, size * 0.06).fill(0x0D1735)
  g.ellipse(size * 0.22, -size * 0.08, size * 0.08, size * 0.06).fill(0x0D1735)
  // Нос
  g.poly([0, size * 0.15, -size * 0.07, size * 0.28, size * 0.07, size * 0.28]).fill(0x0D1735)
  // Бакенбарды
  g.rect(-size * 0.08, size * 0.32, size * 0.02, size * 0.18).fill(0x40282A)
  g.rect(size * 0.06, size * 0.32, size * 0.02, size * 0.18).fill(0x40282A)
}

function drawKolobok(g: Graphics, size: number) {
  // Тёплый жёлтый шар с улыбкой — намеренно ПОХОЖ на зверушек по силуэту
  const yellow = 0xFFCB45
  const yellowD = 0xB07A10
  // Тень-подложка
  g.circle(size * 0.07, size * 0.07, size * 0.62).fill({ color: 0x000000, alpha: 0.35 })
  // Основная сфера: концентрические круги для объёма
  g.circle(0, 0, size * 0.6).fill(0xC9941A)
  g.circle(-size * 0.05, -size * 0.05, size * 0.55).fill(yellow)
  g.circle(-size * 0.15, -size * 0.15, size * 0.4).fill(0xFFE090)
  g.circle(-size * 0.22, -size * 0.22, size * 0.18).fill(0xFFF6E0)
  // Контур
  g.circle(0, 0, size * 0.6).stroke({ width: 2, color: yellowD })
  // Глаза
  g.circle(-size * 0.22, -size * 0.08, size * 0.07).fill(0x0D1735)
  g.circle(size * 0.22, -size * 0.08, size * 0.07).fill(0x0D1735)
  // Румянец
  g.circle(-size * 0.35, size * 0.2, size * 0.08).fill({ color: 0xF06070, alpha: 0.5 })
  g.circle(size * 0.35, size * 0.2, size * 0.08).fill({ color: 0xF06070, alpha: 0.5 })
  // Улыбка
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
  // Тёмный овал — нора
  g.ellipse(0, 0, w / 2, h * 0.32).fill(0x0A0512).stroke({ width: 2, color: 0x2A1A05 })
  // Ободок: коричневая земля
  g.ellipse(0, h * 0.04, w / 2 + 4, h * 0.36).stroke({ width: 3, color: 0x5A3A15, alpha: 0.7 })
}

export function KolobokGame({ seed, onComplete }: KolobokGameProps) {
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(false)
  const rngRef = useRef(rngFromSeed(seed))
  const holesRef = useRef<HoleState[]>(Array.from({ length: COLS * ROWS }, () => ({ appearedAt: null, character: null })))
  const lastSpawnRef = useRef(performance.now())
  const scoreRef = useRef(0)
  const kolobokTapsRef = useRef(0)
  const startTimeRef = useRef(performance.now())
  const tickerCbRef = useRef<((ticker: Ticker) => void) | null>(null)

  // Pixi-контейнеры, которые мы обновляем каждый кадр
  const charContainersRef = useRef<Container[]>([])

  const [score, setScore] = useState(0)
  const [playCountdown, setPlayCountdown] = useState(PLAY_SECONDS)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  const complete = (won: boolean) => {
    if (doneRef.current) return
    doneRef.current = true
    haptic?.notificationOccurred(won ? 'success' : 'error')
    playSound(won ? 'win' : 'lose')
    // Каждый тап Колобка — отдельная ошибка. Проигрыш по таймеру → минимум 2 ошибки.
    let errorCount = kolobokTapsRef.current
    if (!won) errorCount = Math.max(2, errorCount)
    onCompleteRef.current(errorCount)
  }

  // Таймер раунда
  useEffect(() => {
    const id = setInterval(() => {
      setPlayCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          complete(scoreRef.current >= TARGET_SCORE)
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

      // Геометрия: 3x3 поверх «земли». Расставим норы и под каждой — контейнер
      // для текущего персонажа.
      const padX = 12
      const cellW = (app.screen.width - padX * (COLS + 1)) / COLS
      const cellH = Math.min(140, (app.screen.height - 60) / ROWS)
      const totalRowsH = cellH * ROWS
      const startY = (app.screen.height - totalRowsH) / 2 + 30

      const characterContainers: Container[] = []

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cx = padX + c * (cellW + padX) + cellW / 2
          const cy = startY + r * cellH + cellH / 2

          // Нора
          const holeGfx = new Graphics()
          drawHole(holeGfx, cellW * 0.85, cellH * 0.7)
          holeGfx.x = cx
          holeGfx.y = cy + cellH * 0.18
          app!.stage.addChild(holeGfx)

          // Контейнер персонажа (поверх норы, чуть выше центра — будет «торчать»)
          const charBox = new Container()
          charBox.x = cx
          charBox.y = cy + cellH * 0.08
          charBox.eventMode = 'static'
          charBox.cursor = 'pointer'
          charBox.visible = false

          // Хит-зона (всегда на месте, но реагирует только когда charBox.visible)
          const hit = new Graphics()
          hit.rect(-cellW * 0.42, -cellH * 0.5, cellW * 0.84, cellH).fill({ color: 0xFFFFFF, alpha: 0.0001 })
          charBox.addChild(hit)

          // Графика самого персонажа (перерисовываем при спавне)
          const charGfx = new Graphics()
          charBox.addChild(charGfx)
          ;(charBox as any).__charGfx = charGfx
          ;(charBox as any).__cellH = cellH

          const idx = r * COLS + c
          charBox.on('pointertap', () => onHoleTap(idx))

          app!.stage.addChild(charBox)
          characterContainers.push(charBox)
        }
      }
      charContainersRef.current = characterContainers

      // Запускаем игровой тикер
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Логика спавна / анимаций / тапов ───────────────────────────────────

  const onHoleTap = (idx: number) => {
    if (doneRef.current) return
    const hole = holesRef.current[idx]
    if (hole.appearedAt === null || !hole.character) return
    const t = (performance.now() - hole.appearedAt) / 1000
    // Тап засчитывается только в фазах появления/удержания, не на «уходе»
    if (t > VISIBLE_DURATION_SEC - DISAPPEAR_SEC) return

    haptic?.impactOccurred('light')
    if (hole.character === 'kolobok') {
      scoreRef.current -= 3
      kolobokTapsRef.current += 1
      playSound('lose')
    } else {
      scoreRef.current += 1
      playSound('seal')
    }
    setScore(scoreRef.current)
    // Победа сразу при наборе цели
    if (scoreRef.current >= TARGET_SCORE) {
      complete(true)
    }
    // Прячем персонажа моментально
    hole.appearedAt = null
    hole.character = null
  }

  const updateScene = () => {
    if (doneRef.current) return
    const now = performance.now()

    // Спавн нового персонажа, если истёк интервал и есть пустые норы
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

    // Обновляем визуал каждой норы
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
        // Время вышло — нора снова пуста (промах игрока)
        hole.appearedAt = null
        hole.character = null
        box.visible = false
        continue
      }

      // Анимация scale.y: появление (0→1), удержание (1), исчезновение (1→0)
      let s = 1
      if (t < APPEAR_SEC) {
        s = t / APPEAR_SEC
      } else if (t > VISIBLE_DURATION_SEC - DISAPPEAR_SEC) {
        s = Math.max(0, (VISIBLE_DURATION_SEC - t) / DISAPPEAR_SEC)
      }

      if (!box.visible) {
        // Перерисовать графику для нового персонажа
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
        marginBottom: spacing.sm,
      }}>
        Тапай зверушек, не задень Колобка
      </div>
      <div style={{
        display: 'flex', gap: spacing.md, justifyContent: 'center',
        marginBottom: spacing.sm, fontSize: '12px',
      }}>
        <span style={{ color: score >= TARGET_SCORE ? colors.success : colors.fairyGold, fontWeight: 700 }}>
          Счёт: {score} / {TARGET_SCORE}
        </span>
      </div>
      <div
        ref={refMount}
        style={{
          flex: 1,
          width: '100%',
          minHeight: '460px',
          touchAction: 'manipulation',
        }}
      />
    </div>
  )
}
