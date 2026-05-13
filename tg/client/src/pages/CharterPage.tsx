import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ScreenBackground } from '@/components/ScreenBackground'
import { api } from '@/api/client'
import type { CharterDTO, CharterResultDTO, CharterSubmitDTO, GameStateDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing } from '@/theme'
import { Seal, generateReferenceSeal, sealForCell, mutateSeal, RANK_MUT_POOLS } from '@/components/Seal'
import type { MutTarget } from '@/components/Seal'
import { MiniGame } from '@/components/minigames/MiniGame'
import { MINIGAME_INFO, isMiniGameArchetype } from '@/components/minigames/info'
import { CoinIcon } from '@/components/icons'
import { useTelegramBackHandler } from '@/hooks/useTelegramBackButton'
import { playSound } from '@/sounds'
import { useT } from '@/i18n'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

// Эталон и примеры мутаций для обучалки — вычисляются один раз на весь модуль
const TUTORIAL_SEED = 'tutorial-ref'
const TUTORIAL_REF = generateReferenceSeal(TUTORIAL_SEED)
const TUTORIAL_EXAMPLES: Record<MutTarget, ReturnType<typeof generateReferenceSeal>> = {
  shape:      mutateSeal(TUTORIAL_REF, TUTORIAL_SEED, 0, 'EASY', ['shape']),
  size:       mutateSeal(TUTORIAL_REF, TUTORIAL_SEED, 1, 'EASY', ['size']),
  dots:       mutateSeal(TUTORIAL_REF, TUTORIAL_SEED, 2, 'EASY', ['dots']),
  colorHue:   mutateSeal(TUTORIAL_REF, TUTORIAL_SEED, 3, 'EASY', ['colorHue']),
  rings:      mutateSeal(TUTORIAL_REF, TUTORIAL_SEED, 4, 'EASY', ['rings']),
  emblemSame: mutateSeal(TUTORIAL_REF, TUTORIAL_SEED, 5, 'EASY', ['emblemSame']),
}

// Все архетипы теперь идут через единый интро-экран в стиле мини-игр и единый
// лист результата по errorCount. BOYARIN сохраняет свою механику (24 печати,
// фазы reference→scan), остальные — мини-игры (фаза minigame). Лист результата
// общий — miniresult.
type Phase = 'intro' | 'reference' | 'scan' | 'minigame' | 'miniresult'

const REFERENCE_SECONDS = 3

export function CharterPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { gameState, setGameState } = useGameStore()

  const [phase, setPhase] = useState<Phase>('intro')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [refCountdown, setRefCountdown] = useState(REFERENCE_SECONDS)
  const [scanCountdown, setScanCountdown] = useState<number | null>(null)
  const [result, setResult] = useState<CharterResultDTO | null>(null)
  const [miniGameResult, setMiniGameResult] = useState<{ errorCount: number; perfectInsight: string | null } | null>(null)
  const [showInvest, setShowInvest] = useState(false)
  const [onboardingBonus, setOnboardingBonus] = useState<number | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const onboardingTriggeredRef = useRef(false)

  // Показываем обучалку один раз при первом посещении
  useEffect(() => {
    if (!localStorage.getItem('charter_tutorial_seen')) {
      setShowTutorial(true)
      localStorage.setItem('charter_tutorial_seen', '1')
    }
  }, [])

  // До сабмита любой выход приравнивается к пропуску дела — иначе
  // игрок смог бы выйти, заглянуть в эталон ещё раз, снова зайти и т.д.
  const skipMutation = useMutation({
    mutationFn: () => api.projects.skip(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gameState'] })
      qc.invalidateQueries({ queryKey: ['charter', projectId] })
      navigate('/inbox')
    },
  })

  const tryGoBack = () => {
    // Уже разобрано — просто уходим
    if (phase === 'miniresult') {
      navigate(-1)
      return
    }
    setShowExitConfirm(true)
  }

  // Системный «назад» в Telegram Mini App тоже перехватываем в те же правила
  useTelegramBackHandler(tryGoBack)

  // Перехватываем свайп-назад (edge swipe на iOS/Android). useBlocker не работает
  // с BrowserRouter, поэтому используем трюк: пушим дубль текущего URL в history,
  // тогда свайп-назад попадает обратно на тот же URL (React Router не демонтирует
  // компонент) и мы перехватываем popstate, чтобы показать тот же попап.
  useEffect(() => {
    if (phase === 'miniresult') return
    window.history.pushState(null, '', window.location.pathname)
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.pathname)
      setShowExitConfirm(true)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [phase])

  // Сессия-грамота: create-or-return. startCharter идемпотентен —
  // существующую сессию вернёт как есть, закрытый проект даст 410 CHARTER_EXPIRED
  const { data: charter, isLoading, error: charterError } = useQuery<CharterDTO>({
    queryKey: ['charter', projectId],
    queryFn: () => api.charter.start(projectId!),
    enabled: !!projectId,
    staleTime: 0,
    retry: false,
  })

  const project = charter?.project ?? null
  const isExpired = !!charterError && /истекла/i.test((charterError as Error).message)

  // Если сессия уже сабмичена — сразу на лист результата. perfectInsight на reload
  // null (одноразовое раскрытие).
  useEffect(() => {
    if (!charter?.isSubmitted || !charter.result) return
    setMiniGameResult({ errorCount: charter.result.errorCount, perfectInsight: null })
    setSelected(new Set(charter.result.selectedIndices))
    setResult(charter.result)
    setPhase('miniresult')
  }, [charter?.isSubmitted])

  // Таймер показа эталона
  useEffect(() => {
    if (phase !== 'reference') return
    setRefCountdown(REFERENCE_SECONDS)
    const id = setInterval(() => {
      setRefCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          setPhase('scan')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  // Сабмит результата мини-игры (не-BOYARIN архетипы)
  const submitMiniGameMutation = useMutation({
    mutationFn: (errorCount: number) => api.charter.submitMiniGame(projectId!, errorCount),
    onSuccess: ({ errorCount, perfectInsight }) => {
      setMiniGameResult({ errorCount, perfectInsight })
      setPhase('miniresult')
      const ok = errorCount <= 1
      haptic?.notificationOccurred(errorCount === 0 ? 'success' : ok ? 'warning' : 'error')
      playSound(ok ? 'win' : 'lose')
      qc.invalidateQueries({ queryKey: ['gameState'] })

      if (gameState?.isOnboardingComplete === false && !onboardingTriggeredRef.current) {


        onboardingTriggeredRef.current = true
        api.game.completeOnboarding().then((r: any) => {
          if (r?.bonusAwarded) {
            setOnboardingBonus(r.bonusAwarded)
            if (gameState) {
              setGameState({
                ...gameState,
                balance: gameState.balance + r.bonusAwarded,
                isOnboardingComplete: true,
              })
            }
          }
        }).catch(() => {})
      }
    },
    // Если API упал — не оставляем игрока на чёрном экране. Показываем лист
    // как при поражении: ничего о деле не раскрыто, доступен только звёздный bypass.
    onError: (err: Error, errorCount) => {
      console.error('[submitMiniGame] failed:', err)
      setMiniGameResult({ errorCount: Math.max(2, errorCount), perfectInsight: null })
      setPhase('miniresult')
      haptic?.notificationOccurred('error')
      playSound('lose')
    },
  })

  const handleMiniGameComplete = (errorCount: number) => {
    if (submitMiniGameMutation.isPending) return
    submitMiniGameMutation.mutate(errorCount)
  }

  // Сабмит грамоты BOYARIN: тоже идёт через единый лист результата (по errorCount)
  const submitMutation = useMutation({
    mutationFn: (indices: number[]) => api.charter.submit(projectId!, indices),
    onSuccess: (res: CharterSubmitDTO) => {
      const { forgedIndices, ...rest } = res
      setResult(rest)
      setMiniGameResult({ errorCount: res.errorCount, perfectInsight: res.perfectInsight })
      setPhase('miniresult')
      const ok = res.errorCount <= 1
      haptic?.notificationOccurred(res.errorCount === 0 ? 'success' : ok ? 'warning' : 'error')
      playSound(ok ? 'win' : 'lose')
      qc.invalidateQueries({ queryKey: ['gameState'] })

      // Онбординг-бонус по первой проверенной грамоте
      if (gameState?.isOnboardingComplete === false && !onboardingTriggeredRef.current) {
        onboardingTriggeredRef.current = true
        api.game.completeOnboarding().then((r: any) => {
          if (r?.bonusAwarded) {
            setOnboardingBonus(r.bonusAwarded)
            if (gameState) {
              setGameState({
                ...gameState,
                balance: gameState.balance + r.bonusAwarded,
                isOnboardingComplete: true,
              })
            }
          }
        }).catch(() => {})
      }
    },
  })

  useEffect(() => {
    if (phase !== 'scan' || !charter) return
    setScanCountdown(charter.timeLimitSeconds)
    const id = setInterval(() => {
      setScanCountdown(prev => {
        if (prev === null) return null
        if (prev <= 1) {
          clearInterval(id)
          // Автосабмит
          if (!submitMutation.isPending && !submitMutation.isSuccess) {
            submitMutation.mutate([...selectedRef.current])
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, charter?.sessionId])

  // Храним выбор в ref, чтобы таймер-автосабмит не замыкался на стейт
  const selectedRef = useRef(selected)
  useEffect(() => { selectedRef.current = selected }, [selected])

  const t = useT()

  if (isExpired) {
    return (
      <ScreenBackground showSparkles={false}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100dvh', padding: spacing.xxl, textAlign: 'center', gap: spacing.md,
        }}>
          <div style={{ fontSize: '56px' }}>📜</div>
          <div style={{ color: colors.fairyGold, fontSize: '20px', fontWeight: 700 }}>{t.charter.expired}</div>
          <div style={{ color: colors.textSecondary, fontSize: '14px', maxWidth: '320px', lineHeight: 1.5 }}>
            {t.charter.expiredHint}
          </div>
          <button
            onClick={() => navigate('/inbox')}
            style={{
              marginTop: spacing.md, padding: `${spacing.md} ${spacing.xl}`,
              background: colors.fairyGold, border: 'none', borderRadius: '12px',
              color: colors.nightBlue, fontWeight: 700, fontSize: '14px', cursor: 'pointer',
            }}
          >
            {t.charter.expiredBtn}
          </button>
        </div>
      </ScreenBackground>
    )
  }

  if (isLoading || !charter) {
    return (
      <ScreenBackground>
        <div style={loadingStyle}>{t.common.loading}</div>
      </ScreenBackground>
    )
  }

  const toggleCell = (i: number) => {
    if (phase !== 'scan') return
    haptic?.impactOccurred('light')
    playSound('seal')
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      // Сразу обновляем ref, чтобы автосабмит на последней секунде увидел
      // актуальный выбор (раньше ref обновлялся в useEffect — мог отстать на тик)
      selectedRef.current = next
      return next
    })
  }

  const handleSubmit = () => {
    if (submitMutation.isPending) return
    submitMutation.mutate([...selected])
  }

  return (
    <ScreenBackground showSparkles={false}>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>

        {/* Шапка */}
        <div style={headerStyle}>
          <button onClick={tryGoBack} style={backBtnStyle}>
            <span style={{ fontSize: '16px', lineHeight: 1 }}>←</span>
            {t.common.back}
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '15px' }}>{pageTitle(project?.personaArchetype, t)}</div>
            <div style={{ color: colors.textMuted, fontSize: '11px' }}>
              {phaseCaption(phase, charter, scanCountdown, t)}
            </div>
          </div>
          <button
            onClick={() => setShowTutorial(true)}
            style={{
              width: '36px', height: '36px',
              background: `${colors.fairyGold}15`,
              border: `1px solid ${colors.fairyGold}40`,
              borderRadius: '10px',
              color: colors.fairyGold,
              fontSize: '16px', fontWeight: 700,
              cursor: 'pointer', padding: 0,
            }}
          >?</button>
        </div>

        {/* Тело — зависит от фазы */}
        {phase === 'intro' && project && (
          <MiniGameIntroScreen
            project={project}
            onStart={() => setPhase(project.personaArchetype === 'BOYARIN' ? 'reference' : 'minigame')}
            onChat={() => navigate(`/ama/${projectId}`)}
          />
        )}

        {/* Канвас мини-игры остаётся видимым и в 'miniresult' — за счёт этого
            играли финальные сцены (Колобок + 4 зверя, пирамидка Кощея, котёл
            Бабы-Яги). Если свернуть лист результата, игрок их увидит. */}
        {(phase === 'minigame' || (phase === 'miniresult' && project?.personaArchetype !== 'BOYARIN')) && project && (
          <MiniGame
            archetype={project.personaArchetype}
            seed={charter.gridSeed}
            difficulty={charter.difficulty}
            pending={submitMiniGameMutation.isPending}
            onComplete={handleMiniGameComplete}
          />
        )}

        {phase === 'reference' && (
          <ReferenceScreen seed={charter.gridSeed} countdown={refCountdown} />
        )}

        {(phase === 'scan' || (phase === 'miniresult' && charter.project.personaArchetype === 'BOYARIN')) && (
          <ScanGrid
            charter={charter}
            selected={selected}
            result={phase === 'miniresult' ? result : null}
            onToggle={toggleCell}
            rank={gameState?.investorRank ?? 'NEWBIE'}
          />
        )}

        {/* Футер */}
        {phase === 'scan' && (
          <div style={footerStyle}>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginBottom: spacing.sm, textAlign: 'center' }}>
              {t.charter.seals}: {selected.size} · {t.charter.timer}: {scanCountdown ?? '—'}
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              style={primaryBtnStyle}
            >
              {submitMutation.isPending ? t.common.loading : t.common.done}
            </button>
          </div>
        )}

        {/* Разбор и кнопки действий после мини-игры показываем модальным листом,
            чтобы игрок не пропустил «Вложить / Миновать», скроллом не уйдя ниже. */}

        {/* Онбординг-бонус */}
        {onboardingBonus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={bonusStyle}
          >
            <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '16px' }}>
              {t.charter.onboardingBonus.replace('{bonus}', String(onboardingBonus))}
            </div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
              {t.charter.onboardingBonusHint}
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {phase === 'miniresult' && miniGameResult && project && !showInvest && (
          <MiniGameResultSheet
            errorCount={miniGameResult.errorCount}
            perfectInsight={miniGameResult.perfectInsight}
            project={project}
            onInvest={() => setShowInvest(true)}
            onSkip={() => navigate('/inbox')}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInvest && projectId && (
          <InvestSheet
            projectId={projectId}
            onClose={() => setShowInvest(false)}
            onSuccess={() => navigate('/portfolio')}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExitConfirm && (
          <ExitConfirmSheet
            pending={skipMutation.isPending}
            onStay={() => setShowExitConfirm(false)}
            onLeave={() => skipMutation.mutate()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTutorial && (
          <TutorialSheet
            rank={gameState?.investorRank ?? 'NEWBIE'}
            archetype={project?.personaArchetype ?? 'BOYARIN'}
            onClose={() => setShowTutorial(false)}
          />
        )}
      </AnimatePresence>
    </ScreenBackground>
  )
}

// ── Обучалка ──────────────────────────────────────────────────────────────

/**
 * Графический примерчик для подсказки `?`: показывает игроку наглядно, что
 * отличает правильный выбор от неправильного в конкретной мини-игре. Тут не
 * рендерим Pixi/Three (сложно и тяжеловесно), а собираем картинки из CSS-
 * кружков и эмодзи — этого хватает, чтобы пояснить механику.
 */
function TutorialGraphicalExample({ archetype }: { archetype: string }) {
  const Card = ({ children, label, tone = 'neutral' }: {
    children: React.ReactNode
    label: string
    tone?: 'good' | 'bad' | 'neutral'
  }) => {
    const borderColor =
      tone === 'good' ? colors.success :
      tone === 'bad' ? colors.danger :
      colors.fairyGold
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
        <div style={{
          width: 64, height: 64,
          borderRadius: 12,
          background: 'rgba(42, 25, 96, 0.4)',
          border: `2px solid ${borderColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30,
        }}>
          {children}
        </div>
        <div style={{ color: borderColor, fontSize: 10, fontWeight: 700, textAlign: 'center' }}>
          {label}
        </div>
      </div>
    )
  }

  if (archetype === 'BURATINO') {
    return (
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
          Среди 7 ключей один в точности совпадает с эталоном по форме головки и рисунку бороздок:
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Card label="Эталон" tone="neutral">🗝️</Card>
          <div style={{ alignSelf: 'center', color: colors.textMuted, fontSize: 18 }}>→</div>
          <Card label="Тот же" tone="good">🗝️</Card>
          <Card label="Похож, но не он" tone="bad">🪛</Card>
        </div>
      </div>
    )
  }

  if (archetype === 'KOSCHEI') {
    return (
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
          Открывай по две карточки. Совпали символы — пара остаётся открытой:
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Card label="🌳 дуб" tone="good">🌳</Card>
          <Card label="🌳 дуб" tone="good">🌳</Card>
          <div style={{ alignSelf: 'center', color: colors.success, fontSize: 22 }}>✓</div>
          <Card label="не пара" tone="bad">🐇</Card>
          <Card label="не пара" tone="bad">🦆</Card>
        </div>
      </div>
    )
  }

  if (archetype === 'KOLOBOK') {
    return (
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
          Тапай зверушек, обходи Колобка. Цель — 7 баллов за 15 секунд (12 для совета):
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Card label="+1" tone="good">🐇</Card>
          <Card label="+1" tone="good">🐺</Card>
          <Card label="+1" tone="good">🦊</Card>
          <Card label="−3" tone="bad">🥮</Card>
        </div>
      </div>
    )
  }

  if (archetype === 'ZOLUSHKA') {
    return (
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
          Лови монету, что совпадает с эталоном с обеих сторон. Подделка может быть похожа только аверсом ИЛИ только реверсом:
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Card label="Эталон" tone="neutral">🪙</Card>
          <Card label="Та же (лови)" tone="good">🪙</Card>
          <Card label="Подделка" tone="bad">🥈</Card>
          <Card label="Подделка" tone="bad">🥉</Card>
        </div>
      </div>
    )
  }

  if (archetype === 'BABA_YAGA') {
    return (
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
          Запомни порядок и кидай ингредиенты в котёл по очереди. Ошибся — шаг остаётся, выбирай другой:
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Card label="1️⃣" tone="good">🪨</Card>
          <div style={{ color: colors.textMuted, fontSize: 16 }}>→</div>
          <Card label="2️⃣" tone="good">🧪</Card>
          <div style={{ color: colors.textMuted, fontSize: 16 }}>→</div>
          <Card label="3️⃣" tone="good">📜</Card>
        </div>
      </div>
    )
  }

  if (archetype === 'IVAN_DURAK') {
    return (
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
          Иван открывает карту — найди такую же в своей руке за 2 секунды. Карты тасуются после каждого хода:
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Card label="Иван" tone="neutral">7♠</Card>
          <div style={{ color: colors.textMuted, fontSize: 16 }}>↓</div>
          <Card label="Тапни" tone="good">7♠</Card>
          <Card label="Не она" tone="bad">9♦</Card>
          <Card label="Не она" tone="bad">К♥</Card>
        </div>
      </div>
    )
  }

  return null
}

function TutorialSheet({ rank, archetype, onClose }: { rank: string; archetype: string; onClose: () => void }) {
  const t = useT()
  const isBoyarin = archetype === 'BOYARIN'
  const pool = RANK_MUT_POOLS[rank] ?? RANK_MUT_POOLS.NEWBIE
  const nextHintRaw = t.charter.rankNextHint[rank as keyof typeof t.charter.rankNextHint] ?? ''
  const nextHint = nextHintRaw || null
  const info = MINIGAME_INFO[archetype]
  const gameName = info?.name ?? t.charter.tutorialTitle
  const gameHint = info?.hint ?? ''

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 310,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '500px',
          background: colors.nightBlue,
          borderRadius: '20px 20px 0 0',
          border: `1px solid ${colors.cardBorder}`,
          maxHeight: '88dvh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Шапка */}
        <div style={{ padding: `${spacing.md} ${spacing.xl} ${spacing.sm}`, textAlign: 'center', flexShrink: 0 }}>
          <div style={{
            width: '40px', height: '4px', borderRadius: '2px',
            background: `${colors.fairyGold}50`, margin: '0 auto 12px',
          }} />
          <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '17px' }}>
            {gameName}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
            {isBoyarin ? t.charter.tutorialBody : 'Правила испытания и лесенка наград'}
          </div>
        </div>

        {/* Прокручиваемое тело */}
        <div style={{ overflowY: 'auto', flex: 1, padding: `0 ${spacing.xl}` }}>

          {/* Графический пример — для не-BOYARIN'a показывает наглядную механику */}
          {!isBoyarin && <TutorialGraphicalExample archetype={archetype} />}

          {/* Правила игры — общее для всех архетипов */}
          {gameHint && (
            <div style={{
              padding: spacing.md,
              background: `${colors.fairyGold}12`,
              border: `1px solid ${colors.fairyGold}40`,
              borderRadius: '12px',
              color: colors.textSecondary,
              fontSize: '13px',
              lineHeight: 1.6,
              marginBottom: spacing.md,
            }}>
              {gameHint}
            </div>
          )}

          {/* Лесенка наград — единый блок для всех мини-игр */}
          <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '13px', marginBottom: spacing.sm }}>
            За что получишь награду:
          </div>
          <TierLadder />

          {isBoyarin && (
            <>
              {/* Подделки печатей — только для BOYARIN */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: spacing.md,
                marginTop: spacing.lg,
                marginBottom: spacing.lg,
                padding: spacing.md,
                background: `${colors.fairyGold}12`,
                border: `1px solid ${colors.fairyGold}40`,
                borderRadius: '12px',
              }}>
                <Seal params={TUTORIAL_REF} size={60} />
                <div>
                  <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '13px' }}>
                    {t.charter.tutorialRef}
                  </div>
                  <div style={{ color: colors.textSecondary, fontSize: '12px', lineHeight: 1.5 }}>
                    {t.charter.tutorialRefHint}
                  </div>
                </div>
              </div>

              <div style={{ color: colors.textSecondary, fontSize: '12px', marginBottom: spacing.sm }}>
                {t.charter.tutorialMutations}
              </div>

              {(Object.entries(t.charter.mutLabels) as [MutTarget, string][])
                .filter(([target]) => pool.includes(target))
                .map(([target, label]) => (
                  <div
                    key={target}
                    style={{
                      display: 'flex', alignItems: 'center', gap: spacing.sm,
                      marginBottom: '8px',
                      padding: `${spacing.sm} ${spacing.md}`,
                      background: 'rgba(42,25,96,0.35)',
                      borderRadius: '10px',
                    }}
                  >
                    <Seal params={TUTORIAL_REF} size={44} />
                    <div style={{ color: colors.textMuted, fontSize: '18px', lineHeight: 1 }}>→</div>
                    <Seal params={TUTORIAL_EXAMPLES[target]} size={44} />
                    <div style={{ color: colors.textSecondary, fontSize: '12px', flex: 1, lineHeight: 1.4 }}>
                      {label}
                    </div>
                  </div>
                ))
              }

              {nextHint && (
                <div style={{
                  marginTop: spacing.sm,
                  padding: spacing.sm,
                  color: colors.textMuted, fontSize: '11px',
                  fontStyle: 'italic',
                  textAlign: 'center',
                }}>
                  📈 {nextHint}
                </div>
              )}
            </>
          )}

          <div style={{ height: spacing.lg }} />
        </div>

        {/* Кнопка */}
        <div style={{
          padding: `${spacing.md} ${spacing.xl}`,
          paddingBottom: `calc(${spacing.md} + env(safe-area-inset-bottom))`,
          flexShrink: 0,
        }}>
          <button onClick={onClose} style={primaryBtnStyle}>
            {t.charter.tutorialStart}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ExitConfirmSheet({
  pending, onStay, onLeave,
}: { pending: boolean; onStay: () => void; onLeave: () => void }) {
  const t = useT()
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onStay}
      style={{
        position: 'fixed', inset: 0, zIndex: 240,
        background: 'rgba(6, 4, 18, 0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: spacing.lg,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '380px',
          background: `linear-gradient(145deg, ${colors.enchantedPurple}, ${colors.nightBlue})`,
          border: `1px solid ${colors.danger}80`,
          borderRadius: '16px',
          padding: spacing.xl,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
          <div style={{ fontSize: '44px', marginBottom: '4px' }}>⚠️</div>
          <div style={{ color: colors.fairyGold, fontSize: '17px', fontWeight: 700 }}>
            {t.charter.exitTitle}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: '13px', marginTop: spacing.sm, lineHeight: 1.5 }}>
            {t.charter.exitHint}
          </div>
        </div>
        <div style={{ display: 'flex', gap: spacing.sm }}>
          <button
            onClick={onStay}
            disabled={pending}
            style={{
              flex: 1, padding: spacing.md,
              background: `${colors.fairyGold}18`,
              border: `1px solid ${colors.fairyGold}55`,
              borderRadius: '12px',
              color: colors.fairyGold,
              fontSize: '14px', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t.charter.exitCancel}
          </button>
          <button
            onClick={onLeave}
            disabled={pending}
            style={{
              flex: 1, padding: spacing.md,
              background: colors.danger,
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '14px', fontWeight: 700,
              cursor: 'pointer',
              opacity: pending ? 0.6 : 1,
            }}
          >
            {pending ? t.common.loading : t.charter.exitConfirm}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Фазы ───────────────────────────────────────────────────────────────────

function forgeryColor(n: number): string {
  if (n <= 2) return colors.success
  if (n <= 4) return colors.warning
  return colors.danger
}

// Интро для не-BOYARIN: тот же блок дела (баннер, имя, чипсы, описание), но вместо
// характеристик грамоты — название и описание мини-игры.
// ── Общие подкомпоненты для интро и результата ─────────────────────────────

/** 3-уровневая лесенка-индикатор: 0 ошибок / 1 ошибка / ≥2 ошибок.
 *  Если передан currentTier — соответствующий уровень подсвечивается. */
function TierLadder({ currentTier }: { currentTier?: 0 | 1 | 2 }) {
  const tiers: Array<{ emoji: string; title: string; subtitle: string; color: string }> = [
    { emoji: '🎯', title: '0 ошибок',  subtitle: 'совет чуйки + посул + тип', color: colors.success },
    { emoji: '🙂', title: '1 ошибка',  subtitle: 'посул и тип, без совета',   color: colors.fairyGold },
    { emoji: '😅', title: '≥2 ошибок', subtitle: 'только за 10⭐',             color: colors.danger },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: spacing.sm }}>
      {tiers.map((tier, i) => {
        const isCurrent = currentTier === i
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: spacing.sm,
            padding: '6px 10px',
            borderRadius: 8,
            background: isCurrent ? `${tier.color}22` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isCurrent ? tier.color : colors.cardBorder}`,
            opacity: currentTier !== undefined && !isCurrent ? 0.45 : 1,
            transition: 'all 0.2s',
          }}>
            <div style={{ fontSize: 18 }}>{tier.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: isCurrent ? tier.color : colors.textPrimary, fontWeight: 700, fontSize: 12 }}>
                {tier.title}
              </div>
              <div style={{ color: colors.textMuted, fontSize: 10 }}>
                {tier.subtitle}
              </div>
            </div>
            {isCurrent && (
              <div style={{ color: tier.color, fontSize: 14, fontWeight: 800 }}>← ты</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface MinigameStatsRow {
  played: number; perfect: number; won: number; lost: number
}

/** Сводка по архетипу: «сыграно с дельцом N раз, из них M идеально и т.д.».
 *  Если передан `delta` — для соответствующего счётчика подсветим «+1». */
function MinigameStatsBlock({
  stats, delta, gameName,
}: {
  stats: MinigameStatsRow
  delta?: 'perfect' | 'won' | 'lost' | null
  gameName: string
}) {
  if (stats.played === 0 && !delta) {
    return (
      <div style={{
        padding: spacing.sm + ' ' + spacing.md,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 10,
        color: colors.textMuted,
        fontSize: 12,
        textAlign: 'center',
      }}>
        Впервые играешь в «{gameName}» — покажи, на что способен.
      </div>
    )
  }
  const Cell = ({ label, value, color, highlight }: { label: string; value: number; color: string; highlight: boolean }) => (
    <div style={{
      flex: 1,
      padding: '6px 4px',
      background: highlight ? `${color}33` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${highlight ? color : colors.cardBorder}`,
      borderRadius: 8,
      textAlign: 'center',
      transition: 'all 0.2s',
    }}>
      <div style={{ color, fontWeight: 800, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
        {value}{highlight ? ' +1' : ''}
      </div>
      <div style={{ color: colors.textMuted, fontSize: 9, marginTop: 2 }}>{label}</div>
    </div>
  )
  return (
    <div style={{
      padding: spacing.md,
      background: 'rgba(42, 25, 96, 0.3)',
      border: `1px solid ${colors.cardBorder}`,
      borderRadius: 12,
    }}>
      <div style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 6, textAlign: 'center' }}>
        Твоя история с этим дельцом · сыграно <b style={{ color: colors.fairyGold }}>{stats.played}{delta ? ' +1' : ''}</b>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Cell label="🎯 идеал"  value={stats.perfect} color={colors.success}   highlight={delta === 'perfect'} />
        <Cell label="🙂 победа" value={stats.won}     color={colors.fairyGold} highlight={delta === 'won'} />
        <Cell label="😅 провал" value={stats.lost}    color={colors.danger}    highlight={delta === 'lost'} />
      </div>
    </div>
  )
}

const EMPTY_STATS: MinigameStatsRow = { played: 0, perfect: 0, won: 0, lost: 0 }

function getMinigameStats(gs: GameStateDTO | null, archetype: string): MinigameStatsRow {
  return gs?.minigameStats?.[archetype] ?? EMPTY_STATS
}

function MiniGameIntroScreen({
  project, onStart, onChat,
}: {
  project: any
  onStart: () => void
  onChat: () => void
}) {
  const t = useT()
  const { gameState } = useGameStore()
  const info = MINIGAME_INFO[project.personaArchetype]
  const gameName = info?.name ?? 'Испытание хозяина'
  const gameHint = info?.hint ?? 'Хозяин предложит испытание. Пройди его — и сможешь вложиться.'
  const gameBtn  = info?.startBtn ?? 'Принять испытание →'
  const stats = getMinigameStats(gameState, project.personaArchetype)

  return (
    <div style={{ flex: 1, padding: spacing.lg, maxWidth: '500px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      {project.bannerImageUrl && (
        <img
          src={project.bannerImageUrl}
          alt={project.name}
          style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: '12px', marginBottom: spacing.md, display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '18px' }}>{project.name}</div>
      <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '2px' }}>
        👤 {project.developerName}
      </div>

      {/* Посул скрыт до прохождения испытания — он часть награды за победу. */}
      <div style={paramsRowStyle}>
        <ParamChip label={t.charter.users} value={project.currentUserCount.toLocaleString('ru')} />
        <ParamChip label={t.charter.guild} value={`${project.claimedTeamSize} чел.`} />
      </div>

      <div style={{
        marginTop: spacing.lg,
        padding: spacing.md,
        background: 'rgba(42, 25, 96, 0.35)',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: '12px',
        color: colors.textSecondary,
        fontSize: '13px',
        lineHeight: 1.5,
      }}>
        {project.description}
      </div>

      <div style={{
        marginTop: spacing.lg,
        padding: spacing.md,
        background: `${colors.fairyGold}12`,
        border: `1px solid ${colors.fairyGold}50`,
        borderRadius: '12px',
      }}>
        <div style={{ color: colors.fairyGold, fontSize: '14px', fontWeight: 700, marginBottom: spacing.sm }}>
          🎯 {gameName}
        </div>
        <div style={{ color: colors.textSecondary, fontSize: '12px', lineHeight: 1.5 }}>
          {gameHint}
        </div>
        <div style={{ color: colors.textMuted, fontSize: 11, marginTop: spacing.sm, marginBottom: 4 }}>
          За что получишь награду:
        </div>
        <TierLadder />
      </div>

      <div style={{ marginTop: spacing.md }}>
        <MinigameStatsBlock stats={stats} gameName={gameName} />
      </div>

      <button onClick={onStart} style={{ ...primaryBtnStyle, marginTop: spacing.lg }}>
        {gameBtn}
      </button>

      {/* Альтернативный путь — беседа с хозяином. Сделана крупно и активно:
          пульсирующий ободок и подзаголовок-намёк. */}
      <div style={{ marginTop: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <div style={{ flex: 1, height: 1, background: `${colors.fairyGold}25` }} />
        <div style={{ color: colors.textMuted, fontSize: 11, letterSpacing: '0.08em' }}>ИЛИ</div>
        <div style={{ flex: 1, height: 1, background: `${colors.fairyGold}25` }} />
      </div>

      <motion.button
        onClick={onChat}
        whileTap={{ scale: 0.98 }}
        animate={{ boxShadow: [
          `0 0 0 0 ${colors.fairyGold}55`,
          `0 0 0 8px ${colors.fairyGold}00`,
        ] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        style={{
          width: '100%',
          marginTop: spacing.sm,
          padding: spacing.md,
          background: `linear-gradient(135deg, ${colors.enchantedPurple}cc, ${colors.nightBlue}cc)`,
          border: `2px solid ${colors.fairyGold}`,
          borderRadius: '14px',
          color: colors.fairyGold,
          fontWeight: 700,
          fontSize: '15px',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <div style={{ fontSize: 32, lineHeight: 1 }}>💬</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Беседа с дельцом</span>
            <span style={{
              fontSize: 10, padding: '2px 6px',
              background: colors.fairyGold, color: colors.nightBlue,
              borderRadius: 6, fontWeight: 800, letterSpacing: '0.04em',
            }}>10 ⭐</span>
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 400, marginTop: 3, lineHeight: 1.4 }}>
            Задай до 10 вопросов лично. Опытный жулик звучит убедительно, но под давлением проговаривается — самый верный способ почуять скам.
          </div>
        </div>
      </motion.button>
    </div>
  )
}

function IntroScreen({
  project, forgeryCount, timeLimitSeconds, difficulty, showForgeryCount, onStart, onChat,
}: {
  project: any
  forgeryCount: number
  timeLimitSeconds: number
  difficulty: string
  showForgeryCount: boolean
  onStart: () => void
  onChat: () => void
}) {
  const t = useT()
  const diffHint = t.charter.diffHints[difficulty as keyof typeof t.charter.diffHints] ?? t.charter.diffHints.EASY
  const diffValue = difficulty === 'EASY' ? t.charter.diffEasy : difficulty === 'MEDIUM' ? t.charter.diffMedium : t.charter.diffHard

  return (
    <div style={{ flex: 1, padding: spacing.lg, maxWidth: '500px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      {project.bannerImageUrl && (
        <img
          src={project.bannerImageUrl}
          alt={project.name}
          style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: '12px', marginBottom: spacing.md, display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '18px' }}>{project.name}</div>
      <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '2px' }}>
        👤 {project.developerName}
      </div>

      <div style={paramsRowStyle}>
        <ParamChip label={t.charter.apy} value={`${project.claimedAPY}%`} />
        <ParamChip label={t.charter.users} value={project.currentUserCount.toLocaleString('ru')} />
        <ParamChip label={t.charter.guild} value={`${project.claimedTeamSize} чел.`} />
      </div>

      <div style={{
        marginTop: spacing.lg,
        padding: spacing.md,
        background: 'rgba(42, 25, 96, 0.35)',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: '12px',
        color: colors.textSecondary,
        fontSize: '13px',
        lineHeight: 1.5,
      }}>
        {project.description}
      </div>

      {/* Параметры грамоты — подделки (только Скомороху), время, сложность */}
      <div style={{
        marginTop: spacing.md,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: spacing.sm,
      }}>
        {showForgeryCount
          ? <CharterStat
              label={t.charter.seals}
              value={t.charter.forgedCount(forgeryCount)}
              valueColor={forgeryColor(forgeryCount)}
            />
          : <CharterStat
              label={t.charter.seals}
              value={t.charter.forgedUnknown}
              valueColor={colors.textMuted}
            />
        }
        <CharterStat
          label={t.charter.timer}
          value={`${timeLimitSeconds} ${t.charter.timer}`}
          valueColor={timeLimitSeconds <= 10 ? colors.danger : timeLimitSeconds <= 15 ? colors.warning : colors.textPrimary}
        />
        <CharterStat
          label={t.charter.diffLabel}
          value={diffValue}
          valueColor={difficulty === 'HARD' ? colors.warning : colors.textPrimary}
        />
      </div>

      <div style={{
        marginTop: spacing.sm,
        padding: `${spacing.sm} ${spacing.md}`,
        background: `${forgeryColor(forgeryCount)}10`,
        border: `1px solid ${forgeryColor(forgeryCount)}40`,
        borderRadius: '10px',
        color: colors.textSecondary,
        fontSize: '11px',
        lineHeight: 1.5,
      }}>
        {diffHint}
      </div>

      <button onClick={onStart} style={{ ...primaryBtnStyle, marginTop: spacing.lg }}>
        {t.inbox.studyBtn}
      </button>

      <button onClick={onChat} style={secondaryBtnStyle}>
        💬 {t.inbox.amaBtn}
        <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '2px', fontWeight: 400 }}>
          10 Telegram Stars · {t.ama.paywallCost}
        </div>
      </button>
    </div>
  )
}

function CharterStat({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <div style={{
      padding: `${spacing.sm} ${spacing.md}`,
      background: 'rgba(42, 25, 96, 0.4)',
      border: `1px solid ${colors.cardBorder}`,
      borderRadius: '10px',
      textAlign: 'center',
    }}>
      <div style={{ color: valueColor, fontWeight: 700, fontSize: '15px' }}>{value}</div>
      <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '2px' }}>{label}</div>
    </div>
  )
}

function ReferenceScreen({ seed, countdown }: { seed: string; countdown: number }) {
  const t = useT()
  const ref = useMemo(() => generateReferenceSeal(seed), [seed])
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <div style={{ color: colors.fairyGold, fontSize: '14px', marginBottom: spacing.lg, textAlign: 'center' }}>
        {t.charter.memorizeTitle}
      </div>
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25 }}
        style={{
          padding: spacing.xxl,
          background: 'rgba(42, 25, 96, 0.5)',
          border: `2px solid ${colors.fairyGold}`,
          borderRadius: '20px',
          boxShadow: `0 0 30px ${colors.fairyGold}40`,
        }}
      >
        <Seal params={ref} size={180} />
      </motion.div>
      <div style={{ color: colors.fairyGold, fontSize: '28px', fontWeight: 700, marginTop: spacing.xl }}>
        {countdown}
      </div>
      <div style={{ color: colors.textMuted, fontSize: '11px' }}>
        {t.charter.memorizeHint}
      </div>
    </div>
  )
}

function ScanGrid({
  charter, selected, result, onToggle, rank,
}: {
  charter: CharterDTO
  selected: Set<number>
  result: CharterResultDTO | null
  onToggle: (i: number) => void
  rank: string
}) {
  const forgedSet = useMemo(() => new Set(charter.forgedIndices), [charter.forgedIndices])
  const tpSet = useMemo(() => new Set(result?.truePositives ?? []), [result])
  const fpSet = useMemo(() => new Set(result?.falsePositives ?? []), [result])
  const fnSet = useMemo(() => new Set(result?.falseNegatives ?? []), [result])

  return (
    <div style={{ flex: 1, padding: spacing.md, overflow: 'auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '6px',
        maxWidth: '420px',
        margin: '0 auto',
        padding: spacing.sm,
        background: 'rgba(42, 25, 96, 0.3)',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: '12px',
      }}>
        {Array.from({ length: charter.gridSize }, (_, i) => {
          const isForged = forgedSet.has(i)
          const params = sealForCell(charter.gridSeed, i, isForged, charter.difficulty, rank)
          const ring: 'tp' | 'fp' | 'fn' | null = result
            ? tpSet.has(i) ? 'tp' : fpSet.has(i) ? 'fp' : fnSet.has(i) ? 'fn' : null
            : null
          const isSelected = !result && selected.has(i)
          // Детерминированный сдвиг фазы вращения для клетки — от 0 до 18с
          const spinDelaySec = ((i * 2654435761) >>> 0) % 1800 / 100

          // Обводка ячейки — вместо круга в SVG, чтобы не перекрывать точки-розетку
          const ringColor =
            ring === 'tp' ? colors.success :
            ring === 'fp' ? colors.danger :
            ring === 'fn' ? colors.warning : null
          const boxShadow = ringColor
            ? `inset 0 0 0 3px ${ringColor}`
            : isSelected
              ? `inset 0 0 0 2px ${colors.fairyGold}`
              : undefined

          return (
            <button
              key={i}
              onClick={() => onToggle(i)}
              disabled={!!result}
              style={{
                aspectRatio: '1',
                background: isSelected ? `${colors.fairyGold}25` : 'rgba(10, 8, 24, 0.7)',
                border: `1px solid ${isSelected ? colors.fairyGold : colors.cardBorder}`,
                borderRadius: '10px',
                boxShadow,
                padding: 0,
                cursor: result ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                className={result ? undefined : 'seal-spin'}
                style={{ ['--seal-delay' as any]: `-${spinDelaySec}s`, lineHeight: 0 }}
              >
                <Seal
                  params={params}
                  size={Math.min(78, Math.floor((window.innerWidth - 64) / 4) - 12)}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Лист результата по числу ошибок:
//   0 ошибок → раскрываем посул, тип дела и совет по делу, даём вложить
//   1 ошибка → раскрываем посул и тип дела, даём вложить (без совета)
//   ≥2 ошибок → ничего не раскрываем, только звёздный bypass
//
// После выкупа за 10⭐ (bypassed=true) считаем игру как идеальную: показываем
// полную картину (посул + тип + совет) и кнопку «Вложить», чтобы игрок мог
// принять осознанное решение, а не сразу вводить сумму вслепую.
function MiniGameResultSheet({
  errorCount, perfectInsight, project, onInvest, onSkip,
}: {
  errorCount: number
  perfectInsight: string | null
  project: { id: string; claimedAPY: number; type: string; personaArchetype: string }
  onInvest: () => void
  onSkip: () => void
}) {
  const t = useT()
  const { gameState } = useGameStore()
  const [bypassPending, setBypassPending] = useState(false)
  const [bypassError, setBypassError] = useState<string | null>(null)
  const [bypassed, setBypassed] = useState(false)
  const [revealedInsight, setRevealedInsight] = useState<string | null>(null)
  // Свернуть лист, чтобы посмотреть поле под ним (где сыграно — где ошибся)
  const [collapsed, setCollapsed] = useState(false)
  const effectiveErrorCount = bypassed ? 0 : errorCount
  const effectiveInsight = bypassed ? revealedInsight : perfectInsight
  const canInvest = bypassed || errorCount <= 1
  // Уровень-«ступенька» в лесенке: 0=идеал, 1=победа, 2=провал.
  // bypassed смещает в идеал визуально.
  const currentTier: 0 | 1 | 2 = effectiveErrorCount === 0 ? 0 : effectiveErrorCount === 1 ? 1 : 2
  // Сразу показываем обновлённую статистику (gameState ещё не подтянулся — считаем сами).
  const archetype = project.personaArchetype
  const baseStats = getMinigameStats(gameState, archetype)
  const deltaKey: 'perfect' | 'won' | 'lost' = errorCount === 0 ? 'perfect' : errorCount === 1 ? 'won' : 'lost'
  const liveStats: MinigameStatsRow = {
    played: baseStats.played + 1,
    perfect: baseStats.perfect + (deltaKey === 'perfect' ? 1 : 0),
    won:     baseStats.won     + (deltaKey === 'won' ? 1 : 0),
    lost:    baseStats.lost    + (deltaKey === 'lost' ? 1 : 0),
  }
  const info = MINIGAME_INFO[archetype]
  const gameName = info?.name ?? 'Испытание'
  const emoji = effectiveErrorCount === 0 ? '🎯' : effectiveErrorCount === 1 ? '🙂' : '😅'
  const titleText = bypassed
    ? 'Дело раскрыто за звёзды'
    : errorCount === 0 ? 'Безупречно!'
    : errorCount === 1 ? 'Почти в точку'
    : 'Чуйка промахнулась'
  const subtitleText = bypassed
    ? 'Посмотри детали и реши — вкладываться или передумать'
    : errorCount === 0 ? 'Хозяин не утаит от тебя ничего важного'
    : errorCount === 1 ? 'Одна осечка — детали дела открыты, но без подсказок'
    : 'Дело осталось тайной — раскроется только за звёзды'
  const dealTypeLabel = (t.inbox.types as Record<string, string>)[project.type] ?? project.type
  const smartAmount = smartDefaultInvestAmount(gameState)

  const handleBypass = async () => {
    if (bypassPending) return
    setBypassError(null)
    setBypassPending(true)
    try {
      const resp = await api.payments.createInvoice('minigame_bypass', project.id) as {
        invoiceLink: string | null
        perfectInsight?: string | null
      }
      if (resp.invoiceLink) {
        tg.openInvoice(resp.invoiceLink, async (status: string) => {
          if (status === 'paid') {
            try {
              const activation = await api.payments.activateMinigameBypass(project.id)
              haptic?.notificationOccurred('success')
              setRevealedInsight(activation.perfectInsight ?? null)
              setBypassed(true)
            } catch (err: any) {
              setBypassError(err.message)
            }
          }
          setBypassPending(false)
        })
      } else {
        // Dev-режим: при createInvoice фича уже активирована, insight пришёл сразу.
        haptic?.notificationOccurred('success')
        setRevealedInsight(resp.perfectInsight ?? null)
        setBypassed(true)
        setBypassPending(false)
      }
    } catch (err: any) {
      setBypassError(err.message)
      setBypassPending(false)
    }
  }

  // Без backdrop — игрок видит финальную сцену игры за листом, поток ощущается
  // как продолжение интро (а не «модалка поверх всего»).
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 220,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          width: '100%', maxWidth: '500px',
          background: `linear-gradient(180deg, ${colors.nightBlue}f0 0%, ${colors.nightBlue} 35%)`,
          borderRadius: '20px 20px 0 0',
          border: `1px solid ${colors.fairyGold}40`,
          borderBottom: 'none',
          padding: collapsed
            ? `${spacing.sm} ${spacing.xl}`
            : `${spacing.xxl} ${spacing.xl} calc(${spacing.xl} + env(safe-area-inset-bottom))`,
          paddingBottom: collapsed
            ? `calc(${spacing.sm} + env(safe-area-inset-bottom))`
            : `calc(${spacing.xl} + env(safe-area-inset-bottom))`,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
          pointerEvents: 'auto',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Маркер-ручка: тап по верху листа переключает свёрнутое состояние —
            игрок может подсмотреть, где он ошибся, на доске под листом */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            display: 'block',
            width: '100%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: colors.textMuted, fontSize: 11,
            padding: '4px 0',
            margin: `0 0 ${collapsed ? '4px' : spacing.sm}`,
          }}
        >
          <div style={{
            width: '40px', height: '4px', borderRadius: '2px',
            background: `${colors.fairyGold}50`, margin: '0 auto 4px',
          }} />
          {collapsed ? '▲ Развернуть' : '▼ Свернуть лист'}
        </button>

        {collapsed && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: spacing.md,
            color: colors.textSecondary, fontSize: 12,
            paddingBottom: spacing.sm,
          }}>
            <span>{emoji}</span>
            <span style={{ color: colors.fairyGold, fontWeight: 700 }}>{titleText}</span>
            <span>· ошибок: {errorCount}</span>
          </div>
        )}

        {!collapsed && (
          <>

        <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
          <div style={{ fontSize: '40px' }}>{emoji}</div>
          <div style={{ color: colors.fairyGold, fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>
            {titleText}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
            {subtitleText}
          </div>
        </div>

        {/* 0..1 ошибки (или выкуп) — раскрываем посул и тип дела. */}
        {canInvest && (
          <div style={paramsRowStyle}>
            <ParamChip label={t.charter.apy} value={`${project.claimedAPY}%`} />
            <ParamChip label="Тип дела" value={dealTypeLabel} />
          </div>
        )}

        {/* Совет по типу дела — при идеальной игре или после выкупа. */}
        {effectiveErrorCount === 0 && effectiveInsight && (
          <div style={{
            marginTop: spacing.md,
            padding: spacing.md,
            background: `${colors.fairyGold}15`,
            border: `1px solid ${colors.fairyGold}60`,
            borderRadius: '12px',
            color: colors.textPrimary,
            fontSize: '13px',
            lineHeight: 1.5,
            textAlign: 'center',
          }}>
            <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '12px', marginBottom: '4px' }}>
              🔮 Совет по делу{bypassed ? ' · раскрыто за звёзды' : ' · идеальная игра'}
            </div>
            {effectiveInsight}
          </div>
        )}

        {!canInvest && (
          <div style={{
            marginTop: spacing.md,
            padding: spacing.md,
            background: 'rgba(42, 25, 96, 0.4)',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '12px',
            color: colors.textSecondary,
            fontSize: '12px',
            lineHeight: 1.5,
            textAlign: 'center',
          }}>
            Посул, тип дела и совет чуйки не раскрыты. Заплати 10 звёзд — увидишь полную картину и сможешь вложиться, если захочешь.
          </div>
        )}

        {/* Лесенка наград — показываем игроку, какой уровень он взял и до какого не дотянул */}
        <div style={{ marginTop: spacing.md }}>
          <div style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4, textAlign: 'center' }}>
            Лесенка наград:
          </div>
          <TierLadder currentTier={currentTier} />
        </div>

        {/* Сводная статистика по этой мини-игре */}
        <div style={{ marginTop: spacing.md }}>
          <MinigameStatsBlock stats={liveStats} delta={deltaKey} gameName={gameName} />
        </div>

        {bypassError && (
          <div style={{ color: colors.danger, fontSize: '12px', textAlign: 'center', marginTop: spacing.sm }}>
            {bypassError}
          </div>
        )}
          </>
        )}

        <div style={{ display: 'flex', gap: spacing.sm, marginTop: collapsed ? 0 : spacing.lg }}>
          <button onClick={onSkip} style={{ ...secondaryBtnStyle, flex: 1, marginTop: 0 }}>
            {t.charter.resultSkip}
          </button>
          {canInvest ? (
            <button
              onClick={onInvest}
              style={{ ...primaryBtnStyle, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <CoinIcon size={16} />
              {smartAmount > 0 ? `Вложить ${smartAmount} г` : t.charter.resultInvest}
            </button>
          ) : (
            <button
              onClick={handleBypass}
              disabled={bypassPending}
              style={{ ...primaryBtnStyle, flex: 1, opacity: bypassPending ? 0.6 : 1 }}
            >
              {bypassPending ? '⏳' : '10 ⭐ — раскрыть дело'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function ResultSheet({
  result, onInvest, onSkip,
}: { result: CharterResultDTO; onInvest: () => void; onSkip: () => void }) {
  const t = useT()
  const [collapsed, setCollapsed] = useState(false)
  const emoji = result.delta > 0 ? '🎯' : result.delta === 0 ? '🤔' : '😅'
  const tp = result.truePositives.length
  const fp = result.falsePositives.length
  const fn = result.falseNegatives.length
  const cleanBonus = tp === 0 && fp === 0 && fn === 0 && result.delta === 2
  const formula = cleanBonus
    ? t.charter.resultCleanBonus
    : `+${tp} ${t.charter.resultFound.toLowerCase()}${fp > 0 ? ` − ${fp} ${t.charter.resultErrors.toLowerCase()}` : ''}${fn > 0 ? ` − ${2 * fn} ${t.charter.resultMissed.toLowerCase()} (×2)` : ''} = ${result.delta >= 0 ? '+' : ''}${result.delta}`

  // Действие обязательно, поэтому backdrop без onClose, выйти можно
  // только через «Миновать» или «Вложить». Но лист можно свернуть кнопкой
  // «▼ Посмотреть разбор» — тогда сетка полностью видна.
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 220,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          width: '100%', maxWidth: '500px',
          background: `linear-gradient(180deg, ${colors.nightBlue}f0 0%, ${colors.nightBlue} 35%)`,
          borderRadius: '20px 20px 0 0',
          border: `1px solid ${colors.fairyGold}40`,
          borderBottom: 'none',
          padding: collapsed
            ? `${spacing.sm} ${spacing.xl}`
            : `${spacing.xxl} ${spacing.xl} ${spacing.xl}`,
          paddingBottom: collapsed
            ? `calc(${spacing.sm} + env(safe-area-inset-bottom))`
            : `calc(${spacing.xl} + env(safe-area-inset-bottom))`,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
          pointerEvents: 'auto',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Маркер-ручка: тап по верху листа переключает свёрнутое состояние */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            display: 'block',
            margin: `0 auto ${collapsed ? '6px' : spacing.sm}`,
            width: '100%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: colors.textMuted, fontSize: '11px',
            padding: '4px 0',
          }}
        >
          <div style={{
            width: '40px', height: '4px', borderRadius: '2px',
            background: `${colors.fairyGold}50`, margin: '0 auto 4px',
          }} />
          {collapsed ? '▲' : '▼'}
        </button>

        {!collapsed && (
          <>
            <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
              <div style={{ fontSize: '40px' }}>{emoji}</div>
              <div style={{ color: colors.fairyGold, fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>
                {result.delta > 0 ? `+${result.delta}` : `${result.delta}`} {t.common.intuition.toLowerCase()}
              </div>
              <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
                {formula}
              </div>
            </div>

            <div style={resultRowStyle}>
              <ResultStat color={colors.success} label={t.charter.resultFound} value={tp} />
              <ResultStat color={colors.danger}  label={t.charter.resultErrors} value={fp} />
              <ResultStat color={colors.warning} label={t.charter.resultMissed} value={fn} />
            </div>
            <div style={{ color: colors.textMuted, fontSize: '10px', textAlign: 'center', marginTop: '6px' }}>
              {t.charter.tutorialMiss}
            </div>

            <div style={{ color: colors.fairyGold, fontSize: '13px', fontWeight: 600, textAlign: 'center', marginTop: spacing.lg }}>
              {t.charter.resultNext}
            </div>
          </>
        )}

        {collapsed && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: spacing.md,
            color: colors.textSecondary, fontSize: '12px',
            marginBottom: spacing.sm,
          }}>
            <span style={{ color: colors.fairyGold, fontWeight: 700 }}>
              {result.delta > 0 ? `+${result.delta}` : result.delta} {t.common.intuition.toLowerCase()}
            </span>
            <span style={{ color: colors.success }}>✓ {tp}</span>
            {fp > 0 && <span style={{ color: colors.danger }}>✕ {fp}</span>}
            {fn > 0 && <span style={{ color: colors.warning }}>⚠ {fn}</span>}
          </div>
        )}

        <div style={{ display: 'flex', gap: spacing.sm, marginTop: collapsed ? 0 : spacing.sm }}>
          <button onClick={onSkip} style={{ ...secondaryBtnStyle, flex: 1, marginTop: 0 }}>
            {t.charter.resultSkip}
          </button>
          <button onClick={onInvest} style={{ ...primaryBtnStyle, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <CoinIcon size={16} /> {t.charter.resultInvest}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ResultStat({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ color, fontSize: '20px', fontWeight: 700 }}>{value}</div>
      <div style={{ color: colors.textMuted, fontSize: '11px' }}>{label}</div>
    </div>
  )
}

function ParamChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      flex: 1,
      padding: `${spacing.sm} ${spacing.md}`,
      background: 'rgba(42, 25, 96, 0.4)',
      border: `1px solid ${colors.cardBorder}`,
      borderRadius: '10px',
      textAlign: 'center',
    }}>
      <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '14px' }}>{value}</div>
      <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '2px' }}>{label}</div>
    </div>
  )
}

// ── Оверлеи ───────────────────────────────────────────────────────────────

function InvestSheet({ projectId, onClose, onSuccess, initialAmount }: {
  projectId: string
  onClose: () => void
  onSuccess: () => void
  initialAmount?: number
}) {
  const t = useT()
  const { gameState } = useGameStore()
  // Smart-default суммы: подставляем средний прошлый чек или 10% свободных грошей,
  // ограничив [5, 5000] и текущим балансом. Если предложили — берём его.
  const computedDefault = initialAmount ?? smartDefaultInvestAmount(gameState)
  const [amount, setAmount] = useState<string>(computedDefault > 0 ? String(computedDefault) : '')
  const [showExtraSlot, setShowExtraSlot] = useState(false)
  const qc = useQueryClient()

  const investMutation = useMutation({
    mutationFn: () => api.invest.invest(projectId, Number(amount)),
    onSuccess: () => {
      haptic?.notificationOccurred('success')
      qc.invalidateQueries({ queryKey: ['gameState'] })
      onSuccess()
    },
    onError: (err: Error) => {
      haptic?.notificationOccurred('error')
      if (err.message === 'MAX_PROJECTS_REACHED') setShowExtraSlot(true)
    },
  })

  if (showExtraSlot) {
    return (
      <ExtraSlotModal
        projectId={projectId}
        amount={Number(amount)}
        gameState={gameState}
        onClose={onClose}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['gameState'] })
          onSuccess()
        }}
      />
    )
  }

  return (
    <Sheet onClose={onClose}>
      <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '18px', marginBottom: spacing.sm, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CoinIcon size={20} /> {t.inbox.investBtn}
      </div>
      <div style={{ color: colors.textMuted, fontSize: '12px', marginBottom: spacing.sm }}>
        {t.portfolio.balanceLabel}: {gameState != null ? Math.floor(gameState.balance) : '—'} {t.common.currency} · {t.portfolio.addBalance(5).split('·')[1]?.trim() ?? ''}
      </div>
      <input
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder={t.portfolio.confirmAdd}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(42, 25, 96, 0.4)',
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: '12px',
          padding: `${spacing.md}`,
          color: colors.textPrimary,
          fontSize: '18px',
          outline: 'none',
          marginBottom: spacing.lg,
        }}
      />
      {investMutation.isError && (investMutation.error as Error).message !== 'MAX_PROJECTS_REACHED' && (
        <div style={{ color: colors.danger, fontSize: '12px', marginBottom: spacing.sm }}>
          {(investMutation.error as Error).message}
        </div>
      )}
      <button
        onClick={() => investMutation.mutate()}
        disabled={!amount || investMutation.isPending}
        style={{ ...primaryBtnStyle, opacity: !amount || investMutation.isPending ? 0.6 : 1 }}
      >
        {investMutation.isPending ? '⏳' : t.charter.resultInvest}
      </button>
    </Sheet>
  )
}

function ExtraSlotModal({
  projectId, amount, gameState, onClose, onSuccess,
}: {
  projectId: string
  amount: number
  gameState: GameStateDTO | null
  onClose: () => void
  onSuccess: () => void
}) {
  const t = useT()
  const [error, setError] = useState<string | null>(null)
  const [starsPending, setStarsPending] = useState(false)

  const groshyMutation = useMutation({
    mutationFn: () => api.invest.invest(projectId, amount, 'groshy'),
    onSuccess: () => {
      haptic?.notificationOccurred('success')
      onSuccess()
    },
    onError: (err: Error) => {
      haptic?.notificationOccurred('error')
      setError(err.message === 'MAX_EXTRA_SLOTS_REACHED' ? t.extraSlot.maxReached
        : err.message === 'INSUFFICIENT_BALANCE' ? t.extraSlot.noBalance
        : err.message)
    },
  })

  const usePrePurchasedMutation = useMutation({
    mutationFn: () => api.invest.invest(projectId, amount, 'stars'),
    onSuccess: () => {
      haptic?.notificationOccurred('success')
      onSuccess()
    },
    onError: (err: Error) => {
      haptic?.notificationOccurred('error')
      setError(err.message)
    },
  })

  const handleStars = async () => {
    setError(null)
    setStarsPending(true)
    try {
      const { invoiceLink } = await api.payments.createInvoice('extra_slot')
      if (invoiceLink) {
        tg.openInvoice(invoiceLink, async (status: string) => {
          if (status === 'paid') {
            try {
              await api.payments.activateExtraSlot()
              await api.invest.invest(projectId, amount, 'stars')
              haptic?.notificationOccurred('success')
              onSuccess()
            } catch (err: any) {
              setError(err.message)
            }
          }
          setStarsPending(false)
        })
      } else {
        // Dev mode: already activated in invoice call
        await api.invest.invest(projectId, amount, 'stars')
        haptic?.notificationOccurred('success')
        onSuccess()
        setStarsPending(false)
      }
    } catch (err: any) {
      setError(err.message)
      setStarsPending(false)
    }
  }

  const balance = gameState?.balance ?? 0
  const extraSlotsBalance = gameState?.extraSlotsBalance ?? 0
  const canAffordGroshy = balance >= amount + 1000
  const isPending = groshyMutation.isPending || usePrePurchasedMutation.isPending || starsPending

  return (
    <Sheet onClose={onClose}>
      <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
        <div style={{ fontSize: '40px', marginBottom: spacing.sm }}>🏪</div>
        <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '17px' }}>
          {t.extraSlot.title}
        </div>
        <div style={{ color: colors.textSecondary, fontSize: '13px', marginTop: spacing.sm, lineHeight: 1.5 }}>
          {t.extraSlot.body}
        </div>
      </div>

      {error && (
        <div style={{ color: colors.danger, fontSize: '12px', marginBottom: spacing.sm, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {extraSlotsBalance > 0 && (
        <>
          <div style={{ color: colors.fairyGold, fontSize: '12px', textAlign: 'center', marginBottom: spacing.sm }}>
            {t.extraSlot.available(extraSlotsBalance)}
          </div>
          <button
            onClick={() => usePrePurchasedMutation.mutate()}
            disabled={isPending}
            style={{
              ...primaryBtnStyle,
              marginBottom: spacing.sm,
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? '⏳' : t.extraSlot.useSlot}
          </button>
        </>
      )}

      <button
        onClick={() => groshyMutation.mutate()}
        disabled={!canAffordGroshy || isPending}
        style={{
          ...primaryBtnStyle,
          marginBottom: spacing.sm,
          background: canAffordGroshy ? colors.fairyGold : 'rgba(255,255,255,0.1)',
          color: canAffordGroshy ? colors.nightBlue : colors.textMuted,
          cursor: canAffordGroshy ? 'pointer' : 'default',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? '⏳' : t.extraSlot.buyGroshy}
      </button>

      <button
        onClick={handleStars}
        disabled={isPending}
        style={{
          ...secondaryBtnStyle,
          marginTop: 0,
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? '⏳' : t.extraSlot.buyStars}
      </button>
    </Sheet>
  )
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
      }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '500px',
          background: colors.nightBlue,
          borderRadius: '20px 20px 0 0',
          border: `1px solid ${colors.cardBorder}`,
          padding: spacing.xxl,
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

// ── Вспомогательное ───────────────────────────────────────────────────────

function phaseCaption(phase: Phase, charter: CharterDTO, scanCountdown: number | null, t: ReturnType<typeof useT>): string {
  const archetype = charter.project.personaArchetype
  if (phase === 'intro')      return t.charter.phaseIntro
  if (phase === 'reference')  return t.charter.phaseMemorize
  if (phase === 'scan')       return `${t.charter.phaseFind} · ${scanCountdown ?? charter.timeLimitSeconds} ${t.charter.timer}`
  if (phase === 'minigame')   return MINIGAME_INFO[archetype]?.name ?? 'Испытание'
  return 'Разбор испытания'
}

function pageTitle(archetype: string | undefined, t: ReturnType<typeof useT>): string {
  if (archetype && MINIGAME_INFO[archetype]) return MINIGAME_INFO[archetype].name
  return t.charter.title
}

// ── Стили ─────────────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  padding: `${spacing.md} ${spacing.lg}`,
  background: 'rgba(10, 8, 24, 0.95)',
  borderBottom: `1px solid ${colors.cardBorder}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const backBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  background: `${colors.fairyGold}15`,
  border: `1px solid ${colors.fairyGold}40`,
  borderRadius: '10px',
  color: colors.fairyGold, cursor: 'pointer',
  fontSize: '13px', fontWeight: 600,
  padding: '8px 12px',
}

const footerStyle: React.CSSProperties = {
  padding: `${spacing.md} ${spacing.lg}`,
  background: 'rgba(10, 8, 24, 0.95)',
  borderTop: `1px solid ${colors.cardBorder}`,
}

/**
 * Smart-default сумма для нового вложения. Логика:
 *   1. Если игрок уже брал дела — берём средний чек (totalInvested / dealsCount)
 *   2. Иначе — 10% свободных грошей
 *   3. Зажимаем в [5; 5000] (границы InvestService) и не больше текущего баланса
 *   4. Если на балансе меньше минимума (5) — возвращаем 0, тогда поле остаётся пустым
 */
function smartDefaultInvestAmount(gs: GameStateDTO | null): number {
  if (!gs) return 0
  const balance = Math.floor(gs.balance)
  if (balance < 5) return 0
  const avg = gs.dealsCount > 0 ? gs.totalInvested / gs.dealsCount : 0
  const fallback = Math.floor(balance * 0.1)
  const raw = Math.floor(avg > 0 ? avg : fallback)
  const clamped = Math.max(5, Math.min(5000, raw))
  return Math.min(clamped, balance)
}

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: spacing.md,
  background: colors.fairyGold,
  border: 'none',
  borderRadius: '12px',
  color: colors.nightBlue,
  fontWeight: 700,
  fontSize: '15px',
  cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  width: '100%',
  marginTop: spacing.sm,
  padding: spacing.md,
  background: 'rgba(42, 25, 96, 0.5)',
  border: `1px solid ${colors.fairyGold}40`,
  borderRadius: '12px',
  color: colors.fairyGold,
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
}

const paramsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: spacing.sm,
  marginTop: spacing.md,
}

const resultRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: spacing.sm,
  padding: `${spacing.sm} 0`,
}

const loadingStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'center', alignItems: 'center',
  minHeight: '100dvh', color: colors.fairyGold, fontSize: '20px',
}

const bonusStyle: React.CSSProperties = {
  position: 'fixed',
  top: '70px',
  left: '50%',
  transform: 'translateX(-50%)',
  padding: `${spacing.md} ${spacing.lg}`,
  background: `${colors.fairyGold}20`,
  border: `1px solid ${colors.fairyGold}`,
  borderRadius: '12px',
  textAlign: 'center',
  zIndex: 150,
  backdropFilter: 'blur(8px)',
}
