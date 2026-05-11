import { useEffect, useMemo, useRef, useState } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import { rngFromSeed, pickInt, pickOne } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

export type MiniGameDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

interface BuratinoGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (won: boolean) => void
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
    // Громкая разница: либо форма головки, либо число зубьев, либо один зуб сильно длиннее.
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
    // Один зуб ощутимо отличается по длине.
    const i = pickInt(rng, 0, base.teethCount)
    const delta = (rng() < 0.5 ? -1 : 1) * pickInt(rng, 4, 7)
    out.teeth[i] = { ...out.teeth[i], depth: Math.max(4, out.teeth[i].depth + delta) }
  } else {
    // Тонкое отличие.
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

function drawKey(g: Graphics, p: KeyParams, scale: number) {
  const gold = 0xFFB800
  const goldDark = 0xCC8F00
  const accent = 0x3D2A05
  const hole = 0x0D1735

  const r = p.headRadius * scale
  const sw = p.shaftWidth * scale
  const sh = p.shaftLength * scale

  // Шток сверху — головка сверху, бороздки внизу справа.
  const shaftTopY = -sh / 2
  const shaftBottomY = sh / 2
  const headCenterY = shaftTopY - r * 0.85

  // Головка
  if (p.headShape === 'circle') {
    g.circle(0, headCenterY, r).fill(gold).stroke({ width: 2, color: accent })
  } else if (p.headShape === 'diamond') {
    g.poly([0, headCenterY - r, r, headCenterY, 0, headCenterY + r, -r, headCenterY])
      .fill(gold).stroke({ width: 2, color: accent })
  } else {
    g.rect(-r, headCenterY - r, 2 * r, 2 * r).fill(gold).stroke({ width: 2, color: accent })
  }
  // Дыра в головке
  g.circle(0, headCenterY, r * 0.38).fill(hole).stroke({ width: 1.5, color: accent })

  // Шток
  g.rect(-sw / 2, shaftTopY, sw, sh).fill(goldDark).stroke({ width: 1.5, color: accent })

  // Кончик
  g.rect(-sw * 0.35, shaftBottomY, sw * 0.7, 5 * scale).fill(goldDark).stroke({ width: 1, color: accent })

  // Бороздки (справа от штока, у нижней половины)
  const teethSpacing = 11 * scale
  const teethTotalH = (p.teethCount - 1) * teethSpacing
  const firstTeethY = shaftBottomY - 8 * scale - teethTotalH
  for (let i = 0; i < p.teethCount; i++) {
    const t = p.teeth[i]
    const y = firstTeethY + i * teethSpacing - (t.thickness * scale) / 2
    g.rect(sw / 2, y, t.depth * scale, t.thickness * scale)
      .fill(goldDark).stroke({ width: 1, color: accent })
  }
}

export function BuratinoGame({ seed, difficulty, onComplete }: BuratinoGameProps) {
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(false)
  const [phase, setPhase] = useState<'reference' | 'play'>('reference')
  const [refCountdown, setRefCountdown] = useState(3)
  const [playCountdown, setPlayCountdown] = useState(15)
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
      // Гарантируем, что подделка не совпадёт с эталоном
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

  const complete = (won: boolean) => {
    if (doneRef.current) return
    doneRef.current = true
    haptic?.notificationOccurred(won ? 'success' : 'error')
    playSound(won ? 'win' : 'lose')
    onCompleteRef.current(won)
  }

  // Таймер показа эталона
  useEffect(() => {
    if (phase !== 'reference') return
    setRefCountdown(3)
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
    setPlayCountdown(15)
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
    })()
    return () => {
      cancelled = true
      if (refApp.current) {
        try { refApp.current.destroy(true, { children: true }) } catch { /* noop */ }
        refApp.current = null
      }
    }
  }, [])

  // Рендер сцены по фазе
  useEffect(() => {
    let cancelled = false
    const render = () => {
      const app = refApp.current
      if (!app || cancelled) {
        // Pixi ещё инициализируется — повторим на следующем кадре
        if (!cancelled) requestAnimationFrame(render)
        return
      }
      app.stage.removeChildren()

      if (phase === 'reference') {
        const c = new Container()
        const g = new Graphics()
        drawKey(g, target, 1.5)
        c.addChild(g)
        c.x = app.screen.width / 2
        c.y = app.screen.height / 2
        app.stage.addChild(c)
      } else {
        // 7 ключей: верхний ряд 4, нижний — 3
        const layout = [4, 3]
        const colWidth = app.screen.width / 4
        const rowSpacing = Math.min(180, app.screen.height / 2 - 20)
        let idx = 0
        for (let row = 0; row < layout.length; row++) {
          const rowCount = layout[row]
          const rowOffsetX = (app.screen.width - rowCount * colWidth) / 2 + colWidth / 2
          for (let col = 0; col < rowCount; col++) {
            const myIdx = idx++
            const c = new Container()
            c.eventMode = 'static'
            c.cursor = 'pointer'
            const g = new Graphics()
            drawKey(g, keys[myIdx], 0.78)
            c.addChild(g)
            // Чувствительная зона побольше самой графики
            const hit = new Graphics()
            hit.rect(-colWidth / 2 + 4, -90, colWidth - 8, 180).fill({ color: 0xFFFFFF, alpha: 0.0001 })
            c.addChild(hit)
            c.x = rowOffsetX + col * colWidth
            c.y = 90 + row * rowSpacing
            c.on('pointertap', () => {
              const won = myIdx === correctIdx
              complete(won)
            })
            app.stage.addChild(c)
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
