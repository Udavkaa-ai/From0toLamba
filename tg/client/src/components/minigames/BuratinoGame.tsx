import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { SpinningModel, preloadModel } from './three/SpinningModel'
import { rngFromSeed, pickInt } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

export type MiniGameDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

interface BuratinoGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
}

const REFERENCE_SECONDS = 10
const PLAY_SECONDS = 10
const KEY_COUNT = 7

// Загруженные GLB-модели ключей. Каждая визуально уникальна — головка, шток,
// бороздки разной формы. Игрок ищет среди 7 ключей точную копию эталона.
const KEY_MODELS = [
  '/models/buratino/key-1.glb',
  '/models/buratino/key-2.glb',
  '/models/buratino/key-3.glb',
  '/models/buratino/key-4.glb',
] as const

// Преload при загрузке модуля — пока игрок смотрит интро-экран, модели уже грузятся
KEY_MODELS.forEach(preloadModel)

interface KeySlot {
  modelUrl: string
  isCorrect: boolean
}

function buildKeyLineup(seed: string, _difficulty: MiniGameDifficulty): { reference: string; slots: KeySlot[] } {
  const rng = rngFromSeed(seed)
  // Эталон — одна из 4 моделей
  const referenceIdx = pickInt(rng, 0, KEY_MODELS.length)
  const reference = KEY_MODELS[referenceIdx]
  // Где разместить правильный ключ
  const correctSlot = pickInt(rng, 0, KEY_COUNT)
  const decoyModels = KEY_MODELS.filter((_, i) => i !== referenceIdx)
  const slots: KeySlot[] = []
  for (let i = 0; i < KEY_COUNT; i++) {
    if (i === correctSlot) {
      slots.push({ modelUrl: reference, isCorrect: true })
    } else {
      slots.push({ modelUrl: decoyModels[Math.floor(rng() * decoyModels.length)], isCorrect: false })
    }
  }
  return { reference, slots }
}

export function BuratinoGame({ seed, difficulty, onComplete }: BuratinoGameProps) {
  const doneRef = useRef(false)
  const [phase, setPhase] = useState<'reference' | 'play'>('reference')
  const [refCountdown, setRefCountdown] = useState(REFERENCE_SECONDS)
  const [playCountdown, setPlayCountdown] = useState(PLAY_SECONDS)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  const { reference, slots } = useMemo(() => buildKeyLineup(seed, difficulty), [seed, difficulty])

  const complete = (won: boolean) => {
    if (doneRef.current) return
    doneRef.current = true
    haptic?.notificationOccurred(won ? 'success' : 'error')
    playSound(won ? 'win' : 'lose')
    onCompleteRef.current(won ? 0 : 2)
  }

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

  // Раскладка 7 ключей: ряд 1 = 4, ряд 2 = 3.
  const layout = useMemo(() => {
    const rows = [4, 3]
    const positions: Array<{ x: number; y: number }> = []
    const rowSpacing = 1.4
    const colSpacing = 1.4
    let idx = 0
    for (let row = 0; row < rows.length; row++) {
      const cnt = rows[row]
      const offsetX = -((cnt - 1) * colSpacing) / 2
      const y = (rows.length - 1 - row) * rowSpacing - (rows.length - 1) * rowSpacing / 2
      for (let col = 0; col < cnt; col++) {
        positions.push({ x: offsetX + col * colSpacing, y })
        idx++
      }
    }
    return positions
  }, [])

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      maxWidth: '500px', margin: '0 auto', width: '100%', boxSizing: 'border-box',
      padding: spacing.md,
    }}>
      <div style={{
        textAlign: 'center',
        color: phase === 'reference' ? colors.fairyGold : (playCountdown <= 3 ? colors.danger : colors.fairyGold),
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

      <div style={{ flex: 1, width: '100%', minHeight: '420px', position: 'relative' }}>
        <Canvas
          dpr={Math.min(window.devicePixelRatio, 2)}
          camera={{ position: [0, 0, 5.5], fov: 35 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent', touchAction: 'manipulation' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 4, 5]} intensity={1.2} castShadow />
          <directionalLight position={[-3, 2, -4]} intensity={0.4} color={0xFFB800} />
          <Suspense fallback={null}>
            <Environment preset="sunset" background={false} />
            {phase === 'reference' && (
              <SpinningModel url={reference} position={[0, 0, 0]} scale={2.2} rotationSpeed={0.9} />
            )}
            {phase === 'play' && slots.map((slot, i) => (
              <SpinningModel
                key={i}
                url={slot.modelUrl}
                position={[layout[i].x, layout[i].y, 0]}
                scale={0.95}
                rotationSpeed={0.9}
                spinPhase={i * 0.4}
                onClick={(e: ThreeEvent<MouseEvent>) => {
                  e.stopPropagation()
                  complete(slot.isCorrect)
                }}
              />
            ))}
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}
