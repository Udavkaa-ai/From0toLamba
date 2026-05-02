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

type Phase = 'intro' | 'reference' | 'scan' | 'result'

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
    if (phase === 'result') {
      navigate(-1)
      return
    }
    setShowExitConfirm(true)
  }

  // Системный «назад» в Telegram Mini App тоже перехватываем в те же правила
  useTelegramBackHandler(tryGoBack)

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

  // Если грамота уже сабмичена — сразу на result
  useEffect(() => {
    if (charter?.isSubmitted && charter.result) {
      setResult(charter.result)
      setSelected(new Set(charter.result.selectedIndices))
      setPhase('result')
    }
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

  // Таймер проверки
  const submitMutation = useMutation({
    mutationFn: (indices: number[]) => api.charter.submit(projectId!, indices),
    onSuccess: (res: CharterSubmitDTO) => {
      const { forgedIndices, ...rest } = res
      setResult(rest)
      setPhase('result')
      haptic?.notificationOccurred(res.delta > 0 ? 'success' : res.delta < 0 ? 'error' : 'warning')
      playSound(res.delta >= 0 ? 'win' : 'lose')
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
            <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '15px' }}>{t.charter.title}</div>
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
          <IntroScreen
            project={project}
            forgeryCount={charter.forgedIndices.length}
            timeLimitSeconds={charter.timeLimitSeconds}
            difficulty={charter.difficulty}
            showForgeryCount={!gameState?.investorRank || gameState.investorRank === 'NEWBIE'}
            onStart={() => setPhase('reference')}
            onChat={() => navigate(`/ama/${projectId}`)}
          />
        )}

        {phase === 'reference' && (
          <ReferenceScreen seed={charter.gridSeed} countdown={refCountdown} />
        )}

        {(phase === 'scan' || phase === 'result') && (
          <ScanGrid
            charter={charter}
            selected={selected}
            result={phase === 'result' ? result : null}
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
        {phase === 'result' && result && !showInvest && (
          <ResultSheet
            result={result}
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
            onClose={() => setShowTutorial(false)}
          />
        )}
      </AnimatePresence>
    </ScreenBackground>
  )
}

// ── Обучалка ──────────────────────────────────────────────────────────────

function TutorialSheet({ rank, onClose }: { rank: string; onClose: () => void }) {
  const t = useT()
  const pool = RANK_MUT_POOLS[rank] ?? RANK_MUT_POOLS.NEWBIE
  const nextHintRaw = t.charter.rankNextHint[rank as keyof typeof t.charter.rankNextHint] ?? ''
  const nextHint = nextHintRaw || null

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
            {t.charter.tutorialTitle}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
            {t.charter.tutorialBody}
          </div>
        </div>

        {/* Прокручиваемое тело */}
        <div style={{ overflowY: 'auto', flex: 1, padding: `0 ${spacing.xl}` }}>

          {/* Эталон */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: spacing.md,
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

          {/* Виды подделок на текущем чине */}
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

          {/* Подсказка о следующем чине */}
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

          {/* Формула чуйки */}
          <div style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            background: 'rgba(42,25,96,0.35)',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '12px',
          }}>
            <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '13px', marginBottom: spacing.sm }}>
              {t.charter.tutorialIntuition}
            </div>
            <div style={{ fontSize: '12px', color: colors.textSecondary, lineHeight: 1.8 }}>
              <div><span style={{ color: colors.success }}>+1</span> {t.charter.tutorialFound}</div>
              <div><span style={{ color: colors.danger }}>−1</span> {t.charter.tutorialFalse}</div>
              <div><span style={{ color: colors.warning }}>−2</span> {t.charter.tutorialMiss}</div>
              <div><span style={{ color: colors.fairyGold }}>+2</span> {t.charter.tutorialClean}</div>
            </div>
          </div>

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
        background: collapsed ? 'transparent' : 'rgba(0,0,0,0.55)',
        pointerEvents: collapsed ? 'none' : 'auto',
        transition: 'background 0.2s',
      }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          width: '100%', maxWidth: '500px',
          background: colors.nightBlue,
          borderRadius: '20px 20px 0 0',
          border: `1px solid ${colors.cardBorder}`,
          padding: collapsed
            ? `${spacing.sm} ${spacing.xl}`
            : `${spacing.xxl} ${spacing.xl} ${spacing.xl}`,
          paddingBottom: collapsed
            ? `calc(${spacing.sm} + env(safe-area-inset-bottom))`
            : `calc(${spacing.xl} + env(safe-area-inset-bottom))`,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
          pointerEvents: 'auto',
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

function InvestSheet({ projectId, onClose, onSuccess }: { projectId: string; onClose: () => void; onSuccess: () => void }) {
  const t = useT()
  const [amount, setAmount] = useState('')
  const [showExtraSlot, setShowExtraSlot] = useState(false)
  const qc = useQueryClient()
  const { gameState } = useGameStore()

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
  if (phase === 'intro')     return t.charter.phaseIntro
  if (phase === 'reference') return t.charter.phaseMemorize
  if (phase === 'scan')      return `${t.charter.phaseFind} · ${scanCountdown ?? charter.timeLimitSeconds} ${t.charter.timer}`
  return t.charter.phaseResult
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
