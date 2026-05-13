import { useEffect, useMemo, useRef, useState } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import { rngFromSeed, pickInt, pickOne } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const REFERENCE_SECONDS = 10
const PLAY_SECONDS = 10
const ROTATION_PERIOD_SEC = 5  // полный оборот за 5 секунд

export type MiniGameDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

interface BuratinoGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
  /** Если задано — игра «заморожена», таймеры и тапы не работают (после F5). */
  restoredErrorCount?: number | null
}

interface KeyParams {
  headShape: 'circle' | 'diamond' | 'square'
  headRadius: number
  shaftLength: number
  shaftWidth: number
  teethCount: number
  teeth: Array<{ depth: number; thickness: number }>
}

const HEAD_SHAPES: KeyParams['headShape'][] = ['circle', 'diamond', 'square']

function generateBaseKey(rng: () => number): KeyParams {
  const teethCount = pickInt(rng, 3, 6)
  return {
    headShape: pickOne(rng, HEAD_SHAPES),
    headRadius: pickInt(rng, 22, 28),
    shaftLength: 110,
    shaftWidth: 14,
    teethCount,
    teeth: Array.from({ length: teethCount }, () => ({
      depth: pickInt(rng, 8, 16),
      thickness: pickInt(rng, 7, 10),
    })),
  }
}

function mutateKey(base: KeyParams, rng: () => number, difficulty: MiniGameDifficulty): KeyParams {
  const out: KeyParams = { ...base, teeth: base.teeth.map(t => ({ ...t })) }
  if (difficulty === 'EASY') {
    const choice = pickInt(rng, 0, 3)
    if (choice === 0) {
      const others = HEAD_SHAPES.filter(s => s !== base.headShape)
      out.headShape = pickOne(rng, others)
    } else if (choice === 1) {
      const delta = rng() < 0.5 ? -1 : 1
      out.teethCount = Math.max(2, Math.min(5, base.teethCount + delta))
      if (out.teethCount > base.teethCount) {
        out.teeth = [...base.teeth, { depth: pickInt(rng, 8, 16), thickness: pickInt(rng, 7, 10) }]
      } else {
        out.teeth = base.teeth.slice(0, out.teethCount)
      }
    } else {
      const i = pickInt(rng, 0, base.teethCount)
      out.teeth[i] = { ...out.teeth[i], depth: out.teeth[i].depth + 8 }
    }
  } else if (difficulty === 'MEDIUM') {
    const i = pickInt(rng, 0, base.teethCount)
    const delta = (rng() < 0.5 ? -1 : 1) * pickInt(rng, 4, 7)
    out.teeth[i] = { ...out.teeth[i], depth: Math.max(4, out.teeth[i].depth + delta) }
  } else {
    const i = pickInt(rng, 0, base.teethCount)
    const delta = (rng() < 0.5 ? -1 : 1) * pickInt(rng, 2, 4)
    out.teeth[i] = { ...out.teeth[i], depth: Math.max(4, out.teeth[i].depth + delta) }
  }
  return out
}

function keysEqual(a: KeyParams, b: KeyParams): boolean {
  if (a.headShape !== b.headShape) return false
  if (a.headRadius !== b.headRadius) return false
  if (a.teethCount !== b.teethCount) return false
  for (let i = 0; i < a.teethCount; i++) {
    if (a.teeth[i].depth !== b.teeth[i].depth) return false
    if (a.teeth[i].thickness !== b.teeth[i].thickness) return false
  }
  return true
}

/** Рисует ключ с иллюзией объёма: шток-«цилиндр» (5 вертикальных полос
 *  от тёмного рима через блик к тёмной правой кромке), головка-«сфера»
 *  (концентрические круги от тёмного края к специальному блику), бороздки
 *  с верхним хайлайтом и глубокой тенью на правом ребре.
 *  Координаты центрированы относительно (0,0) — это важно для вращения. */
function drawKey(g: Graphics, p: KeyParams, scale: number) {
  // Палитра: «золото при свете сверху-слева»
  const goldRim   = 0x6B4A00 // глубокая рим-тень
  const goldDeep  = 0x8C6200 // тень
  const goldShade = 0xB07A10 // средняя
  const gold      = 0xE8A800 // база
  const goldLite  = 0xFFC838 // светлая
  const goldHi    = 0xFFE490 // блик
  const goldSpec  = 0xFFFAEC // спекуляр
  const hole      = 0x0A1020

  const r  = p.headRadius * scale
  const sw = p.shaftWidth * scale
  const sh = p.shaftLength * scale

  const shaftTopY    = -sh / 2
  const shaftBottomY = sh / 2
  const headCenterY  = shaftTopY - r * 0.85

  // ── Шток-цилиндр: 6 полос слева-направо (рим→блик→база→тень→рим) ────────
  const stripWidths = [0.05, 0.13, 0.20, 0.22, 0.25, 0.15]
  const stripColors = [goldRim, goldHi, goldLite, gold, goldShade, goldDeep]
  let cursor = -sw / 2
  for (let i = 0; i < stripWidths.length; i++) {
    const w = sw * stripWidths[i]
    g.rect(cursor, shaftTopY, w + 0.6, sh).fill(stripColors[i])
    cursor += w
  }

  // ── Кончик (фаска) ──────────────────────────────────────────────────────
  g.rect(-sw * 0.42, shaftBottomY, sw * 0.84, 5 * scale).fill(goldDeep)
  g.rect(-sw * 0.42, shaftBottomY, sw * 0.84, 1.4).fill(goldHi)
  g.rect(-sw * 0.42, shaftBottomY + 5 * scale - 1, sw * 0.84, 1).fill(goldRim)

  // ── Бороздки справа (3D-бруски с фасками) ───────────────────────────────
  const teethSpacing = 12 * scale
  const teethTotalH = (p.teethCount - 1) * teethSpacing
  const firstTeethY = shaftBottomY - 10 * scale - teethTotalH
  for (let i = 0; i < p.teethCount; i++) {
    const t = p.teeth[i]
    const y = firstTeethY + i * teethSpacing - (t.thickness * scale) / 2
    const w = t.depth * scale
    const h = t.thickness * scale
    // База
    g.rect(sw / 2, y, w, h).fill(gold)
    // Верхний хайлайт
    g.rect(sw / 2, y, w, h * 0.28).fill(goldLite)
    g.rect(sw / 2, y, w, h * 0.12).fill(goldHi)
    // Нижняя тень
    g.rect(sw / 2, y + h * 0.7, w, h * 0.3).fill(goldShade)
    g.rect(sw / 2, y + h * 0.88, w, h * 0.12).fill(goldDeep)
    // Глубокая тень на правом торце
    g.rect(sw / 2 + w - 1.5, y, 1.5, h).fill(goldRim)
  }

  // ── Головка-«сфера»: набор концентрических фигур ────────────────────────
  if (p.headShape === 'circle') {
    // Тёмный рим
    g.circle(0, headCenterY, r + 1).fill(goldRim)
    // Затемнённая база
    g.circle(0, headCenterY, r).fill(goldDeep)
    // Слой средней тени, чуть смещён вправо-вниз — тень
    g.circle(r * 0.08, headCenterY + r * 0.08, r * 0.92).fill(goldShade)
    // Основной цвет — смещён слегка влево-вверх
    g.circle(-r * 0.04, headCenterY - r * 0.04, r * 0.84).fill(gold)
    // Световая зона
    g.circle(-r * 0.18, headCenterY - r * 0.18, r * 0.6).fill(goldLite)
    // Блик
    g.circle(-r * 0.32, headCenterY - r * 0.32, r * 0.3).fill(goldHi)
    // Спекуляр
    g.circle(-r * 0.42, headCenterY - r * 0.42, r * 0.09).fill(goldSpec)
  } else if (p.headShape === 'diamond') {
    g.poly([0, headCenterY - r - 1, r + 1, headCenterY, 0, headCenterY + r + 1, -r - 1, headCenterY]).fill(goldRim)
    g.poly([0, headCenterY - r,  r,  headCenterY, 0, headCenterY + r,  -r,  headCenterY]).fill(goldDeep)
    // Светлая (левая-верхняя) грань
    g.poly([0, headCenterY - r * 0.95, -r * 0.95, headCenterY, 0, headCenterY * 0 + headCenterY]).fill(gold)
    g.poly([0, headCenterY - r * 0.85, -r * 0.45, headCenterY - r * 0.05, 0, headCenterY - r * 0.2]).fill(goldLite)
    g.poly([0, headCenterY - r * 0.7, -r * 0.2, headCenterY - r * 0.25, 0, headCenterY - r * 0.4]).fill(goldHi)
  } else {
    // square
    g.rect(-r - 1, headCenterY - r - 1, 2 * r + 2, 2 * r + 2).fill(goldRim)
    g.rect(-r, headCenterY - r, 2 * r, 2 * r).fill(goldDeep)
    g.rect(-r, headCenterY - r, 2 * r, 2 * r * 0.65).fill(goldShade)
    g.rect(-r, headCenterY - r, 2 * r * 0.55, 2 * r * 0.55).fill(gold)
    g.rect(-r, headCenterY - r, 2 * r * 0.4, 2 * r * 0.35).fill(goldLite)
    g.rect(-r * 0.9, headCenterY - r * 0.9, r * 0.6, r * 0.25).fill(goldHi)
    g.rect(-r * 0.8, headCenterY - r * 0.85, r * 0.2, r * 0.1).fill(goldSpec)
  }
  // Дыра в головке (с фаской)
  g.circle(0, headCenterY, r * 0.42).fill(goldRim)
  g.circle(0, headCenterY, r * 0.36).fill(hole)
  // Чёрная тень внутри дыры справа-снизу
  g.circle(r * 0.06, headCenterY + r * 0.06, r * 0.32).fill({ color: 0x000000, alpha: 0.55 })
}

/** Тень-эллипс под ключом — не вращается. */
function drawShadow(g: Graphics, width: number) {
  g.ellipse(0, 95, width * 0.6, 8).fill({ color: 0x000000, alpha: 0.35 })
}

export function BuratinoGame({ seed, difficulty, onComplete, restoredErrorCount }: BuratinoGameProps) {
  const isFrozen = restoredErrorCount !== null && restoredErrorCount !== undefined
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(isFrozen)
  const spinnersRef = useRef<Container[]>([])
  const tickerCbRef = useRef<(() => void) | null>(null)
  const [phase, setPhase] = useState<'reference' | 'play'>('reference')
  const [refCountdown, setRefCountdown] = useState(REFERENCE_SECONDS)
  const [playCountdown, setPlayCountdown] = useState(PLAY_SECONDS)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  const { target, keys, correctIdx } = useMemo(() => {
    const rng = rngFromSeed(seed)
    const target = generateBaseKey(rng)
    const correctIdx = pickInt(rng, 0, 7)
    const keys: KeyParams[] = []
    for (let i = 0; i < 7; i++) {
      if (i === correctIdx) {
        keys.push(target)
        continue
      }
      let attempts = 0
      let candidate = mutateKey(target, rng, difficulty)
      while (keysEqual(candidate, target) && attempts < 6) {
        candidate = mutateKey(target, rng, difficulty)
        attempts++
      }
      keys.push(candidate)
    }
    return { target, keys, correctIdx }
  }, [seed, difficulty])

  // У Буратино одна попытка: правильный тап = 0 ошибок, неправильный или таймаут = 2
  // (т.е. сразу попадает в категорию «вложиться только за звёзды»).
  const complete = (won: boolean) => {
    if (doneRef.current) return
    doneRef.current = true
    haptic?.notificationOccurred(won ? 'success' : 'error')
    playSound(won ? 'win' : 'lose')
    onCompleteRef.current(won ? 0 : 2)
  }

  // Таймер показа эталона (в frozen-режиме не запускается)
  useEffect(() => {
    if (isFrozen) return
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

  // Таймер раунда (в frozen-режиме не запускается)
  useEffect(() => {
    if (isFrozen) return
    if (phase !== 'play') return
    setPlayCountdown(PLAY_SECONDS)
    const id = setInterval(() => {
      setPlayCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          complete(false)
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

      // Глобальный синхронизированный тикер — все ключи крутятся в одной фазе
      const startTime = performance.now()
      const cb = () => {
        const t = (performance.now() - startTime) / 1000
        const scale = Math.cos((t / ROTATION_PERIOD_SEC) * 2 * Math.PI)
        for (const c of spinnersRef.current) {
          c.scale.x = scale
        }
      }
      app.ticker.add(cb)
      tickerCbRef.current = cb
    })()
    return () => {
      cancelled = true
      if (refApp.current) {
        try { refApp.current.destroy(true, { children: true }) } catch { /* noop */ }
        refApp.current = null
      }
      tickerCbRef.current = null
      spinnersRef.current = []
    }
  }, [])

  // Рендер сцены по фазе
  useEffect(() => {
    let cancelled = false
    const render = () => {
      const app = refApp.current
      if (cancelled) return
      if (!app) {
        // Pixi ещё инициализируется — повторим на следующем кадре
        requestAnimationFrame(render)
        return
      }
      app.stage.removeChildren()
      spinnersRef.current = []

      if (phase === 'reference') {
        const outer = new Container()
        outer.x = app.screen.width / 2
        outer.y = app.screen.height / 2

        // Тень не вращается
        const shadow = new Graphics()
        drawShadow(shadow, 80)
        shadow.scale.set(1.4)
        outer.addChild(shadow)

        const spinner = new Container()
        const g = new Graphics()
        drawKey(g, target, 1.5)
        spinner.addChild(g)
        outer.addChild(spinner)
        spinnersRef.current.push(spinner)

        app.stage.addChild(outer)
      } else {
        const layout = [4, 3]
        const colWidth = app.screen.width / 4
        const rowSpacing = Math.min(180, (app.screen.height - 40) / 2)
        let idx = 0
        for (let row = 0; row < layout.length; row++) {
          const rowCount = layout[row]
          const rowOffsetX = (app.screen.width - rowCount * colWidth) / 2 + colWidth / 2
          for (let col = 0; col < rowCount; col++) {
            const myIdx = idx++
            const outer = new Container()
            outer.eventMode = 'static'
            outer.cursor = 'pointer'
            outer.x = rowOffsetX + col * colWidth
            outer.y = 90 + row * rowSpacing

            // Чувствительная зона побольше самой графики
            const hit = new Graphics()
            hit.rect(-colWidth / 2 + 4, -90, colWidth - 8, 180)
              .fill({ color: 0xFFFFFF, alpha: 0.0001 })
            outer.addChild(hit)

            // Тень — не вращается
            const shadow = new Graphics()
            drawShadow(shadow, 70)
            outer.addChild(shadow)

            // Вращающийся контейнер с ключом
            const spinner = new Container()
            const g = new Graphics()
            drawKey(g, keys[myIdx], 0.78)
            spinner.addChild(g)
            outer.addChild(spinner)
            spinnersRef.current.push(spinner)

            outer.on('pointertap', () => {
              const won = myIdx === correctIdx
              complete(won)
            })
            app.stage.addChild(outer)
          }
        }
      }
    }
    render()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, target, keys, correctIdx])

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
        marginBottom: spacing.sm,
      }}>
        {phase === 'reference'
          ? `Запомни ключ · ${refCountdown}`
          : `Найди такой же · ${playCountdown} сек`}
      </div>
      <div style={{
        color: colors.textMuted, fontSize: '12px', textAlign: 'center',
        marginBottom: spacing.sm,
      }}>
        {phase === 'reference'
          ? 'Через мгновение Буратино перемешает ключи'
          : 'Тапни ключ, что в точности повторяет образец'}
      </div>
      <div
        ref={refMount}
        style={{
          flex: 1,
          width: '100%',
          minHeight: '420px',
          touchAction: 'manipulation',
          position: 'relative',
          borderRadius: 16,
          overflow: 'hidden',
          // Каморка Карабаса: тёмное дерево + тёплое пятно свечи
          background: `
            radial-gradient(ellipse at 50% 25%, rgba(255,180,90,0.20) 0%, transparent 55%),
            repeating-linear-gradient(0deg,
              #2D1A08 0px, #2D1A08 28px,
              #3A2210 28px, #3A2210 29px
            )
          `,
          boxShadow: 'inset 0 0 80px rgba(0,0,0,0.55)',
        }}
      >
        {/* SVG-декор: гвозди на досках + язычки свечи */}
        <svg
          viewBox="0 0 320 420"
          preserveAspectRatio="xMidYMax slice"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'none', opacity: 0.7,
          }}
        >
          <defs>
            <radialGradient id="candle1" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#FFD580" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#E8A040" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#E8A040" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Гвозди — точки на досках */}
          {[[40,50],[120,52],[200,48],[280,50],[40,200],[120,198],[200,202],[280,200],[40,360],[120,358],[200,360],[280,362]].map(([x,y], i) => (
            <circle key={i} cx={x} cy={y} r="1.6" fill="#0A0500" opacity="0.7" />
          ))}
          {/* Тёплое пятно света сверху */}
          <ellipse cx="160" cy="60" rx="120" ry="60" fill="url(#candle1)">
            <animate attributeName="opacity" values="0.85;1;0.85" dur="2.5s" repeatCount="indefinite" />
          </ellipse>
        </svg>
      </div>
    </div>
  )
}
