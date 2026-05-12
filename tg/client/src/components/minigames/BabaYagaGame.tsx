import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Environment, Html } from '@react-three/drei'
import * as THREE from 'three'
import { SpinningModel, preloadModel } from './three/SpinningModel'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const REFERENCE_SECONDS = 6
const PLAY_SECONDS = 20    // больше времени, так как теперь не штрафуем переходом
const RECIPE_LENGTH = 5
const FEEDBACK_MS = 450

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
  // Прогресс рецепта: для каждой позиции 0..RECIPE_LENGTH-1 — индекс правильно
  // добавленного ингредиента (null = ещё не заполнено).
  const [recipeProgress, setRecipeProgress] = useState<(number | null)[]>(() => Array(RECIPE_LENGTH).fill(null))
  // Счётчик ошибок на ТЕКУЩЕМ шаге — показываем игроку «попыток подряд»
  const [stepErrors, setStepErrors] = useState(0)
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
    setTimeout(() => setShowCauldron(true), 80)
    onCompleteRef.current(ec)
  }

  // Финальная анимация — большой котёл и 5 ингредиентов поочерёдно падают в него.
  // Через 5.5 сек анимация перезапускается, пока MiniGameResultSheet висит наверху.
  const [showCauldron, setShowCauldron] = useState(false)

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
          // Таймер вышел — оставшиеся незаполненные шаги добавляем как ошибки
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
      setStepErrors(prev => prev + 1)
      setFeedback({ ingredientIdx, state: 'wrong' })
    }
    setTimeout(() => {
      setFeedback(null)
      if (isCorrect) {
        // Правильный ингредиент уходит со стола, заполняет слот рецепта.
        // Шаг переходит к следующему, счётчик попыток сбрасывается.
        setConsumed(prev => new Set(prev).add(ingredientIdx))
        setRecipeProgress(prev => {
          const next = prev.slice()
          next[roundRef.current] = ingredientIdx
          return next
        })
        setStepErrors(0)
        const nextRound = roundRef.current + 1
        if (nextRound >= RECIPE_LENGTH) {
          complete(errorsRef.current)
          return
        }
        setRound(nextRound)
      }
      // Если неверно — НЕ переходим к следующему шагу, ингредиент остаётся
      // на столе, игрок выбирает другой. Ошибка засчитана.
    }, FEEDBACK_MS)
  }

  const activeIngredients = useMemo(
    () => slotOrder.filter(i => !consumed.has(i)),
    [slotOrder, consumed],
  )

  // Раскладка: 5 шт → 2+2+1 (3 ряда). Позиции учитывают узкий портретный
  // viewport — aspect ~0.8 на телефоне.
  const positions = useMemo(() => {
    const n = activeIngredients.length
    if (n === 5) {
      return [
        { x: -1.2, y:  1.8 }, { x: 1.2, y:  1.8 },  // верх
        { x: -1.2, y:  0   }, { x: 1.2, y:  0   },  // середина
        { x:  0,   y: -1.8 },                       // низ
      ]
    }
    if (n === 4) {
      return [
        { x: -1.3, y:  1.3 }, { x: 1.3, y:  1.3 },
        { x: -1.3, y: -1.3 }, { x: 1.3, y: -1.3 },
      ]
    }
    if (n === 3) {
      return [
        { x: 0, y:  1.5 },
        { x: -1.3, y: -1.0 }, { x: 1.3, y: -1.0 },
      ]
    }
    if (n === 2) return [{ x: -1.3, y: 0 }, { x: 1.3, y: 0 }]
    return [{ x: 0, y: 0 }]
  }, [activeIngredients])

  // Существенно крупнее: камера придвинута к z=4 при fov=80° — модели занимают
  // существенную часть экрана.
  const modelScale = useMemo(() => {
    const n = activeIngredients.length
    if (n === 5) return 2.6
    if (n === 4) return 3.0
    if (n === 3) return 3.2
    if (n === 2) return 3.6
    return 4.4
  }, [activeIngredients])

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
          : `Шаг ${Math.min(round + 1, RECIPE_LENGTH)} из ${RECIPE_LENGTH}. Какой ингредиент следующий?${stepErrors > 0 ? ` Попыток: ${stepErrors + 1}` : ''}`}
      </div>

      {phase === 'play' && (
        <div style={{
          display: 'flex', gap: spacing.md, justifyContent: 'center',
          marginBottom: spacing.sm, fontSize: '13px',
        }}>
          <span style={{ color: colors.fairyGold, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {round}/{RECIPE_LENGTH}
          </span>
          <span style={{ color: errorsRef.current >= 2 ? colors.danger : colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
            Ошибки: {errorsRef.current}
          </span>
        </div>
      )}

      <div style={{ flex: 1, width: '100%', minHeight: '300px', position: 'relative' }}>
        <Canvas
          dpr={Math.min(window.devicePixelRatio, 2)}
          camera={{ position: [0, 0, 4.0], fov: 80 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent', touchAction: 'manipulation' }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 4, 5]} intensity={1.3} />
          <directionalLight position={[-3, 2, -4]} intensity={0.4} color={0x8C5AFF} />
          <Suspense fallback={
            <Html center>
              <div style={{ color: '#FFB800', fontSize: 14, fontWeight: 700, pointerEvents: 'none' }}>
                Готовим ингредиенты…
              </div>
            </Html>
          }>
            <Environment preset="forest" background={false} />
            {/* Финальная сцена: котёл по центру-низ + 5 ингредиентов поочерёдно
                падают в него. Котёл — внутри 3D-сцены через drei <Html>, так
                ингредиенты приземляются именно ТУДА, где он нарисован. */}
            {showCauldron && (
              <Html position={[0, -2.4, 0]} center distanceFactor={6.5} style={{ pointerEvents: 'none' }}>
                <div style={{
                  fontSize: 130,
                  lineHeight: 1,
                  filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.85))',
                  userSelect: 'none',
                }}>🍲</div>
              </Html>
            )}
            {showCauldron && INGREDIENT_MODELS.map((m, i) => (
              <FallingIngredient
                key={`fall-${i}`}
                url={m.url}
                delay={i * 0.8}
                cycle={5.5}
                fallDur={1.3}
                startY={3.2}
                endY={-2.4}
              />
            ))}
            {!showCauldron && activeIngredients.map((ingredientIdx, slotIdx) => {
              const pos = positions[slotIdx]
              const url = INGREDIENT_MODELS[ingredientIdx].url
              const fb = feedback?.ingredientIdx === ingredientIdx ? feedback.state : null
              return (
                <group key={ingredientIdx} position={[pos.x, pos.y, 0]}>
                  <SpinningModel
                    url={url}
                    scale={modelScale}
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
                  <FeedbackRing fb={fb} />
                </group>
              )
            })}
          </Suspense>
        </Canvas>

        {/* Котёл рендерится внутри 3D-сцены через <Html> — ингредиенты падают
            прямо в него. Старый DOM-overlay снизу удалён. */}
      </div>

      {/* Прогресс рецепта внизу: 5 слотов котла, заполняются правильными ингредиентами */}
      {phase === 'play' && !showCauldron && (
        <div style={{
          display: 'flex', gap: 6, justifyContent: 'center',
          marginTop: spacing.sm, padding: `${spacing.sm} 0`,
          borderTop: `1px solid ${colors.cardBorder}`,
        }}>
          {recipeProgress.map((filledIdx, i) => {
            const isCurrent = i === round
            const filled = filledIdx !== null
            const borderColor = filled ? colors.success : isCurrent ? colors.fairyGold : colors.cardBorder
            const bgColor = filled ? `${colors.success}22` : isCurrent ? `${colors.fairyGold}18` : 'rgba(255,255,255,0.03)'
            return (
              <div key={i} style={{
                flex: 1, maxWidth: 64,
                aspectRatio: '1',
                background: bgColor,
                border: `2px solid ${borderColor}`,
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
                transition: 'all 0.25s',
              }}>
                <div style={{
                  position: 'absolute', top: 2, left: 4,
                  color: filled ? colors.success : colors.textMuted,
                  fontSize: 10, fontWeight: 700,
                }}>{i + 1}</div>
                {filled ? (
                  <div style={{ color: colors.success, fontSize: 28, fontWeight: 800 }}>✓</div>
                ) : isCurrent ? (
                  <div style={{ color: colors.fairyGold, fontSize: 20, fontWeight: 800 }}>?</div>
                ) : (
                  <div style={{ color: colors.textMuted, fontSize: 14 }}>·</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Один «падающий» ингредиент для финальной сцены. Использует useFrame: каждый
 * ингредиент стартует с задержкой = i * 0.8 сек, падает с y=3 до y=-2.5 за
 * 1.4 секунды, потом скрывается. Полный цикл — 5.5 сек, потом повтор.
 */
function FallingIngredient({ url, delay, cycle, fallDur, startY, endY }: {
  url: string
  delay: number
  cycle: number
  fallDur: number
  startY: number
  endY: number
}) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!group.current) return
    const t = state.clock.getElapsedTime() % cycle - delay
    if (t < 0 || t > fallDur) {
      group.current.visible = false
      return
    }
    group.current.visible = true
    const progress = t / fallDur
    // Падает сверху прямо в центр котла. Лёгкое квадратичное ускорение —
    // в начале медленнее, ближе к котлу быстрее.
    const eased = progress * progress
    group.current.position.y = startY + (endY - startY) * eased
    group.current.position.x = 0
    // Покачивание + вращение в полёте
    group.current.rotation.y += 0.06
    group.current.rotation.z = Math.sin(state.clock.getElapsedTime() * 5 + delay) * 0.18
  })
  return (
    <group ref={group} visible={false}>
      <SpinningModel url={url} scale={2.0} rotationSpeed={0} />
    </group>
  )
}

function FeedbackRing({ fb }: { fb: 'correct' | 'wrong' | null }) {
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
              width: 140, height: 140,
              borderRadius: '50%',
              border: `5px solid ${fb === 'correct' ? '#4FD89C' : '#E06060'}`,
              boxShadow: `0 0 30px ${fb === 'correct' ? '#4FD89C' : '#E06060'}`,
            }}
          />
        )}
      </AnimatePresence>
    </Html>
  )
}
