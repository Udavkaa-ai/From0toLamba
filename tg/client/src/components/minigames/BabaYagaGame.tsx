import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Environment, Html } from '@react-three/drei'
import { SpinningModel, preloadModel } from './three/SpinningModel'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const REFERENCE_SECONDS = 6
const PLAY_SECONDS = 15
const RECIPE_LENGTH = 5

// 5 GLB-ингредиентов. С версии 4 рисуем именно их в 3D вместо процедурного 2D.
const INGREDIENT_MODELS = [
  { url: '/models/baba-yaga/mineral.glb',   name: 'Лунный камень' },
  { url: '/models/baba-yaga/potion.glb',    name: 'Зелье' },
  { url: '/models/baba-yaga/scroll.glb',    name: 'Свиток' },
  { url: '/models/baba-yaga/bone.glb',      name: 'Кость' },
  { url: '/models/baba-yaga/fishbone.glb',  name: 'Рыбий скелет' },
] as const

INGREDIENT_MODELS.forEach(m => preloadModel(m.url))

interface BabaYagaGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function BabaYagaGame({ seed, onComplete }: BabaYagaGameProps) {
  const doneRef = useRef(false)
  const rngRef = useRef(rngFromSeed(seed))
  const errorsRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  // Стабильный порядок ингредиентов для reference-экрана (с цифрами 1..5)
  const slotOrder = useMemo(() => shuffle(INGREDIENT_MODELS.map((_, i) => i), rngRef.current), [])
  // Рецепт — все 5 в случайном порядке, по которому игрок должен класть
  const recipe = useMemo(() => shuffle(INGREDIENT_MODELS.map((_, i) => i), rngRef.current), [])

  const [phase, setPhase] = useState<'reference' | 'play'>('reference')
  const [refCountdown, setRefCountdown] = useState(REFERENCE_SECONDS)
  const [playCountdown, setPlayCountdown] = useState(PLAY_SECONDS)
  const [round, setRound] = useState(0)
  // Уже правильно добавленные в рецепт ингредиенты — пропадают со стола
  const [consumed, setConsumed] = useState<Set<number>>(() => new Set())
  const [feedback, setFeedback] = useState<{ ingredientIdx: number; state: 'correct' | 'wrong' } | null>(null)
  const phaseRef = useRef(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])
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
          const remaining = RECIPE_LENGTH - roundRef.current
          complete(errorsRef.current + remaining)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const onPick = (ingredientIdx: number) => {
    if (doneRef.current) return
    if (phaseRef.current !== 'play') return
    if (feedback) return
    if (consumed.has(ingredientIdx)) return
    const correctIngredientIdx = recipe[roundRef.current]
    const isCorrect = ingredientIdx === correctIngredientIdx
    if (isCorrect) {
      haptic?.notificationOccurred('success')
      playSound('seal')
      setFeedback({ ingredientIdx, state: 'correct' })
    } else {
      haptic?.notificationOccurred('error')
      playSound('lose')
      errorsRef.current += 1
      setFeedback({ ingredientIdx, state: 'wrong' })
    }
    setTimeout(() => {
      setFeedback(null)
      if (isCorrect) {
        // Ингредиент уходит со стола → остальные сдвигаются к центру
        setConsumed(prev => new Set(prev).add(ingredientIdx))
      }
      const next = roundRef.current + 1
      if (next >= RECIPE_LENGTH) {
        complete(errorsRef.current)
        return
      }
      setRound(next)
    }, 500)
  }

  // Текущие слоты: ингредиенты, которые ещё не легли в котёл, в исходном порядке.
  // На фазе reference показываем ВСЕ 5 (consumed пуст). На play — оставшиеся.
  const activeIngredients = useMemo(
    () => slotOrder.filter(i => !consumed.has(i)),
    [slotOrder, consumed],
  )

  // Раскладка по X, центрируем оставшиеся
  const positions = useMemo(() => {
    const n = activeIngredients.length
    const spacing3D = 1.5
    return activeIngredients.map((_, i) => ({
      x: (i - (n - 1) / 2) * spacing3D,
      y: 0,
    }))
  }, [activeIngredients])

  // Цифры-метки 1..5 в фазе reference: номер шага рецепта для каждого ингредиента
  const refStepNum = (ingredientIdx: number) => recipe.indexOf(ingredientIdx) + 1

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
      }}>
        {phase === 'reference'
          ? `Запомни рецепт · ${refCountdown}`
          : `Котёл Бабы Яги · ${playCountdown} сек`}
      </div>
      <div style={{
        color: colors.textMuted, fontSize: '12px', textAlign: 'center',
        marginBottom: spacing.sm, lineHeight: 1.4,
      }}>
        {phase === 'reference'
          ? `Цифры — порядок добавления в котёл. Запомни и кидай по очереди.`
          : `Шаг ${Math.min(round + 1, RECIPE_LENGTH)} из ${RECIPE_LENGTH}. Какой ингредиент следующий?`}
      </div>

      {phase === 'play' && (
        <div style={{
          display: 'flex', gap: spacing.md, justifyContent: 'center',
          marginBottom: spacing.sm, fontSize: '13px',
        }}>
          <span style={{ color: colors.fairyGold, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {round}/{RECIPE_LENGTH}
          </span>
          <span style={{ color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
            Ошибки: {errorsRef.current}
          </span>
        </div>
      )}

      <div style={{ flex: 1, width: '100%', minHeight: '400px', position: 'relative' }}>
        <Canvas
          dpr={Math.min(window.devicePixelRatio, 2)}
          camera={{ position: [0, 0, 5.5], fov: 35 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent', touchAction: 'manipulation' }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 4, 5]} intensity={1.3} />
          <directionalLight position={[-3, 2, -4]} intensity={0.4} color={0x8C5AFF} />
          <Suspense fallback={null}>
            <Environment preset="forest" background={false} />
            {activeIngredients.map((ingredientIdx, slotIdx) => {
              const pos = positions[slotIdx]
              const url = INGREDIENT_MODELS[ingredientIdx].url
              const fb = feedback?.ingredientIdx === ingredientIdx ? feedback.state : null
              return (
                <group key={ingredientIdx} position={[pos.x, pos.y, 0]}>
                  <SpinningModel
                    url={url}
                    scale={1.05}
                    rotationSpeed={0.6}
                    spinPhase={ingredientIdx * 0.5}
                    onClick={(e: ThreeEvent<MouseEvent>) => {
                      e.stopPropagation()
                      onPick(ingredientIdx)
                    }}
                  />
                  {phase === 'reference' && (
                    <Html position={[0, 0.9, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
                      <div style={{
                        width: 28, height: 28,
                        borderRadius: '50%',
                        background: colors.fairyGold,
                        color: colors.nightBlue,
                        fontWeight: 800, fontSize: 16,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid #3D2A05',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                      }}>
                        {refStepNum(ingredientIdx)}
                      </div>
                    </Html>
                  )}
                  <AnimatePresenceHtml fb={fb} />
                </group>
              )
            })}
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}

/**
 * Кольцо-фидбек поверх ингредиента, оборачивает AnimatePresence в Html.
 */
function AnimatePresenceHtml({ fb }: { fb: 'correct' | 'wrong' | null }) {
  return (
    <Html position={[0, 0, 0]} center distanceFactor={5} style={{ pointerEvents: 'none' }}>
      <AnimatePresence>
        {fb && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.3, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.45 }}
            style={{
              width: 120, height: 120,
              borderRadius: '50%',
              border: `4px solid ${fb === 'correct' ? '#4FD89C' : '#E06060'}`,
              boxShadow: `0 0 24px ${fb === 'correct' ? '#4FD89C' : '#E06060'}`,
            }}
          />
        )}
      </AnimatePresence>
    </Html>
  )
}
