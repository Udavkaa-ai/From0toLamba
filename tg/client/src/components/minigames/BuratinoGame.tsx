import { useEffect, useMemo, useRef, useState } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import { rngFromSeed, pickInt, pickOne } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const REFERENCE_SECONDS = 5
const PLAY_SECONDS = 15
const ROTATION_PERIOD_SEC = 5  // полный оборот за 5 секунд

export type MiniGameDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

interface BuratinoGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (won: boolean, perfect: boolean) => void
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

/** Рисует ключ. Расчёт сделан так, чтобы (0,0) в локальных координатах
 *  контейнера было центром ключа — это нужно для корректного вращения. */
function drawKey(g: Graphics, p: KeyParams, scale: number) {
  const gold       = 0xFFB800
  const goldDark   = 0xCC8F00
  const goldShade  = 0x8C6200
  const highlight  = 0xFFE082
  const accent     = 0x3D2A05
  const hole       = 0x0D1735

  const r  = p.headRadius * scale
  const sw = p.shaftWidth * scale
  const sh = p.shaftLength * scale

  const shaftTopY    = -sh / 2
  const shaftBottomY = sh / 2
  const headCenterY  = shaftTopY - r * 0.85

  // ── Подложка-тень: смещена вправо-вниз ──────────────────────────────────
  g.rect(-sw / 2 + 2, shaftTopY + 2, sw, sh).fill({ color: goldShade, alpha: 0.55 })

  // ── Шток ────────────────────────────────────────────────────────────────
  g.rect(-sw / 2, shaftTopY, sw, sh).fill(goldDark).stroke({ width: 1.5, color: accent })
  // Подсветка слева — иллюзия цилиндра
  g.rect(-sw / 2 + 1, shaftTopY + 1, 2, sh - 2).fill({ color: highlight, alpha: 0.6 })

  // ── Кончик ──────────────────────────────────────────────────────────────
  g.rect(-sw * 0.35, shaftBottomY, sw * 0.7, 5 * scale).fill(goldDark).stroke({ width: 1, color: accent })

  // ── Бороздки справа ─────────────────────────────────────────────────────
  const teethSpacing = 11 * scale
  const teethTotalH = (p.teethCount - 1) * teethSpacing
  const firstTeethY = shaftBottomY - 8 * scale - teethTotalH
  for (let i = 0; i < p.teethCount; i++) {
    const t = p.teeth[i]
    const y = firstTeethY + i * teethSpacing - (t.thickness * scale) / 2
    const w = t.depth * scale
    const h = t.thickness * scale
    // Тень зуба
    g.rect(sw / 2 + 1, y + 1, w, h).fill({ color: goldShade, alpha: 0.6 })
    // Сам зуб
    g.rect(sw / 2, y, w, h).fill(goldDark).stroke({ width: 1, color: accent })
    // Подсветка сверху зуба
    g.rect(sw / 2, y, w, 1.5).fill({ color: highlight, alpha: 0.7 })
  }

  // ── Головка ─────────────────────────────────────────────────────────────
  // Тень-подложка
  if (p.headShape === 'circle') {
    g.circle(2, headCenterY + 2, r).fill({ color: goldShade, alpha: 0.55 })
  } else if (p.headShape === 'diamond') {
    g.poly([2, headCenterY - r + 2, r + 2, headCenterY + 2, 2, headCenterY + r + 2, -r + 2, headCenterY + 2])
      .fill({ color: goldShade, alpha: 0.55 })
  } else {
    g.rect(-r + 2, headCenterY - r + 2, 2 * r, 2 * r).fill({ color: goldShade, alpha: 0.55 })
  }
  // Сама головка
  if (p.headShape === 'circle') {
    g.circle(0, headCenterY, r).fill(gold).stroke({ width: 2, color: accent })
  } else if (p.headShape === 'diamond') {
    g.poly([0, headCenterY - r, r, headCenterY, 0, headCenterY + r, -r, headCenterY])
      .fill(gold).stroke({ width: 2, color: accent })
  } else {
    g.rect(-r, headCenterY - r, 2 * r, 2 * r).fill(gold).stroke({ width: 2, color: accent })
  }
  // Подсветка-блик слева-сверху (имитирует выпуклость)
  if (p.headShape === 'circle') {
    g.circle(-r * 0.35, headCenterY - r * 0.35, r * 0.35).fill({ color: highlight, alpha: 0.55 })
  } else {
    g.rect(-r * 0.7, headCenterY - r * 0.9, r * 0.6, 3).fill({ color: highlight, alpha: 0.7 })
  }
  // Дыра в головке
  g.circle(0, headCenterY, r * 0.38).fill(hole).stroke({ width: 1.5, color: accent })
}

/** Тень-эллипс под ключом — не вращается. */
function drawShadow(g: Graphics, width: number) {
  g.ellipse(0, 95, width * 0.6, 8).fill({ color: 0x000000, alpha: 0.35 })
}

export function BuratinoGame({ seed, difficulty, onComplete }: BuratinoGameProps) {
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(false)
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

  // У Буратино «без единой ошибки» = «победил» (всего один тап на ключ),
  // поэтому perfect совпадает с won.
  const complete = (won: boolean) => {
    if (doneRef.current) return
    doneRef.current = true
    haptic?.notificationOccurred(won ? 'success' : 'error')
    playSound(won ? 'win' : 'lose')
    onCompleteRef.current(won, won)
  }

  // Таймер показа эталона
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

  // Таймер раунда
  useEffect(() => {
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
        }}
      />
    </div>
  )
}
