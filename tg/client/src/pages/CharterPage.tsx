import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ScreenBackground } from '@/components/ScreenBackground'
import { api } from '@/api/client'
import type { CharterDTO, CharterResultDTO, CharterSubmitDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing } from '@/theme'
import { Seal, generateReferenceSeal, sealForCell } from '@/components/Seal'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

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
  const [showChatLocked, setShowChatLocked] = useState(false)
  const [onboardingBonus, setOnboardingBonus] = useState<number | null>(null)
  const onboardingTriggeredRef = useRef(false)

  // Данные проекта (для баннера и claimed-полей)
  const { data: gameStateData } = useQuery({
    queryKey: ['gameState'],
    queryFn: api.game.getState,
  })
  const project = useMemo(() => {
    const s = gameStateData
    if (!s) return null
    return [...s.activeProjects, ...s.inboxProjects].find(p => p.id === projectId) ?? null
  }, [gameStateData, projectId])

  // Сессия-грамота: создаём или подтягиваем существующую
  const { data: charter, isLoading } = useQuery<CharterDTO>({
    queryKey: ['charter', projectId],
    queryFn: async () => {
      try {
        return await api.charter.get(projectId!)
      } catch {
        return api.charter.start(projectId!)
      }
    },
    enabled: !!projectId,
    staleTime: 0,
  })

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

  if (isLoading || !charter) {
    return (
      <ScreenBackground>
        <div style={loadingStyle}>Разворачиваем грамоту…</div>
      </ScreenBackground>
    )
  }

  const toggleCell = (i: number) => {
    if (phase !== 'scan') return
    haptic?.impactOccurred('light')
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
          <button onClick={() => navigate(-1)} style={backBtnStyle}>←</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '15px' }}>Купеческая грамота</div>
            <div style={{ color: colors.textMuted, fontSize: '11px' }}>
              {phaseCaption(phase, charter, scanCountdown)}
            </div>
          </div>
          <div style={{ width: '36px' }} />
        </div>

        {/* Тело — зависит от фазы */}
        {phase === 'intro' && project && (
          <IntroScreen
            project={project}
            onStart={() => setPhase('reference')}
            onChat={() => setShowChatLocked(true)}
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
          />
        )}

        {/* Футер */}
        {phase === 'scan' && (
          <div style={footerStyle}>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginBottom: spacing.sm, textAlign: 'center' }}>
              Отмечено: {selected.size} · Осталось времени: {scanCountdown ?? '—'} с
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              style={primaryBtnStyle}
            >
              {submitMutation.isPending ? 'Проверяем…' : 'Готово'}
            </button>
          </div>
        )}

        {phase === 'result' && result && (
          <ResultFooter
            result={result}
            onInvest={() => setShowInvest(true)}
            onSkip={() => navigate('/inbox')}
          />
        )}

        {/* Онбординг-бонус */}
        {onboardingBonus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={bonusStyle}
          >
            <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '16px' }}>
              🎉 +{onboardingBonus} ₽ на счёт!
            </div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
              Онбординг-бонус за первую грамоту
            </div>
          </motion.div>
        )}
      </div>

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
        {showChatLocked && (
          <ChatLockedSheet onClose={() => setShowChatLocked(false)} />
        )}
      </AnimatePresence>
    </ScreenBackground>
  )
}

// ── Фазы ───────────────────────────────────────────────────────────────────

function IntroScreen({
  project, onStart, onChat,
}: { project: any; onStart: () => void; onChat: () => void }) {
  return (
    <div style={{ flex: 1, padding: spacing.lg, maxWidth: '500px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {project.bannerImageUrl && (
        <img
          src={project.bannerImageUrl}
          alt={project.name}
          style={{ width: '100%', aspectRatio: '2 / 1', objectFit: 'cover', borderRadius: '12px', marginBottom: spacing.md, display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '18px' }}>{project.name}</div>
      <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '2px' }}>
        👤 {project.developerName}
      </div>

      <div style={paramsRowStyle}>
        <ParamChip label="Посул APY" value={`${project.claimedAPY}%`} />
        <ParamChip label="Вкладчиков" value={project.claimedUserCount.toLocaleString('ru')} />
        <ParamChip label="Артель" value={`${project.claimedTeamSize} чел.`} />
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
        background: `${colors.fairyGold}10`,
        border: `1px solid ${colors.fairyGold}40`,
        borderRadius: '12px',
        color: colors.textSecondary,
        fontSize: '12px',
        lineHeight: 1.5,
      }}>
        <div style={{ color: colors.fairyGold, fontWeight: 700, marginBottom: '4px' }}>Как проверить грамоту</div>
        Запомни эталонный купеческий знак — его покажут на пару мгновений. Потом на свитке — 24 печати. Найди подделки, тапни по каждой. Подделки могут отличаться любой мелочью: формой, цветом, поворотом, центральным знаком, числом колец или точек.
      </div>

      <button onClick={onStart} style={{ ...primaryBtnStyle, marginTop: spacing.lg }}>
        Изучить грамоту
      </button>

      <button onClick={onChat} style={secondaryBtnStyle}>
        💬 Расспросить дельца лично
        <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '2px', fontWeight: 400 }}>
          скоро — за просмотр рекламы
        </div>
      </button>
    </div>
  )
}

function ReferenceScreen({ seed, countdown }: { seed: string; countdown: number }) {
  const ref = useMemo(() => generateReferenceSeal(seed), [seed])
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <div style={{ color: colors.fairyGold, fontSize: '14px', marginBottom: spacing.lg, textAlign: 'center' }}>
        Запомни купеческий знак
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
        Подделки будут отличаться от этого знака
      </div>
    </div>
  )
}

function ScanGrid({
  charter, selected, result, onToggle,
}: {
  charter: CharterDTO
  selected: Set<number>
  result: CharterResultDTO | null
  onToggle: (i: number) => void
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
          const params = sealForCell(charter.gridSeed, i, isForged, charter.difficulty)
          const ring: 'tp' | 'fp' | 'fn' | null = result
            ? tpSet.has(i) ? 'tp' : fpSet.has(i) ? 'fp' : fnSet.has(i) ? 'fn' : null
            : null
          // Детерминированный сдвиг фазы вращения для клетки — от 0 до 18с
          const spinDelaySec = ((i * 2654435761) >>> 0) % 1800 / 100
          return (
            <button
              key={i}
              onClick={() => onToggle(i)}
              disabled={!!result}
              style={{
                aspectRatio: '1',
                background: selected.has(i) && !result ? `${colors.fairyGold}25` : 'rgba(10, 8, 24, 0.7)',
                border: `1px solid ${selected.has(i) && !result ? colors.fairyGold : colors.cardBorder}`,
                borderRadius: '10px',
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
                  selected={!result && selected.has(i)}
                  ring={ring}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ResultFooter({
  result, onInvest, onSkip,
}: { result: CharterResultDTO; onInvest: () => void; onSkip: () => void }) {
  const emoji = result.delta > 0 ? '🎯' : result.delta === 0 ? '🤔' : '😅'
  const tp = result.truePositives.length
  const fp = result.falsePositives.length
  const fn = result.falseNegatives.length
  // Бонус за чистую грамоту: подделок не было и игрок никого не обвинил
  const cleanBonus = tp === 0 && fp === 0 && fn === 0 && result.delta === 2
  const formula = cleanBonus
    ? 'Грамота была чистая — +2 за верное чутьё'
    : `+${tp} найдено${fp > 0 ? ` − ${fp} ошиб${fp === 1 ? 'ка' : fp < 5 ? 'ки' : 'ок'}` : ''}${fn > 0 ? ` − ${2 * fn} упущено (×2)` : ''} = ${result.delta >= 0 ? '+' : ''}${result.delta}`

  return (
    <div style={footerStyle}>
      <div style={{ textAlign: 'center', marginBottom: spacing.md }}>
        <div style={{ fontSize: '32px' }}>{emoji}</div>
        <div style={{ color: colors.fairyGold, fontSize: '18px', fontWeight: 700 }}>
          {result.delta > 0 ? `+${result.delta}` : `${result.delta}`} к чуйке
        </div>
        <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>
          {formula}
        </div>
      </div>
      <div style={resultRowStyle}>
        <ResultStat color={colors.success} label="Найдено" value={tp} />
        <ResultStat color={colors.danger}  label="Ошибок"  value={fp} />
        <ResultStat color={colors.warning} label="Упущено" value={fn} />
      </div>
      <div style={{ color: colors.textMuted, fontSize: '10px', textAlign: 'center', marginTop: '4px' }}>
        Каждая пропущенная подделка стоит −2 к чуйке
      </div>
      <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md }}>
        <button onClick={onSkip} style={{ ...secondaryBtnStyle, flex: 1, marginTop: 0 }}>
          Миновать
        </button>
        <button onClick={onInvest} style={{ ...primaryBtnStyle, flex: 1 }}>
          💰 Вложить
        </button>
      </div>
    </div>
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
  const [amount, setAmount] = useState('')
  const qc = useQueryClient()
  const { gameState } = useGameStore()

  const investMutation = useMutation({
    mutationFn: () => api.invest.invest(projectId, Number(amount)),
    onSuccess: () => {
      haptic?.notificationOccurred('success')
      qc.invalidateQueries({ queryKey: ['gameState'] })
      onSuccess()
    },
    onError: () => haptic?.notificationOccurred('error'),
  })

  return (
    <Sheet onClose={onClose}>
      <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '18px', marginBottom: spacing.sm }}>
        💰 Вложить рубли
      </div>
      <div style={{ color: colors.textMuted, fontSize: '12px', marginBottom: spacing.sm }}>
        Баланс: {gameState?.balance.toFixed(0) ?? '—'} ₽ · Мин. 5 ₽ · Макс. 5 000 ₽
      </div>
      <input
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Сумма в рублях"
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
      {investMutation.isError && (
        <div style={{ color: colors.danger, fontSize: '12px', marginBottom: spacing.sm }}>
          {(investMutation.error as Error).message}
        </div>
      )}
      <button
        onClick={() => investMutation.mutate()}
        disabled={!amount || investMutation.isPending}
        style={{ ...primaryBtnStyle, opacity: !amount || investMutation.isPending ? 0.6 : 1 }}
      >
        {investMutation.isPending ? '⏳' : 'Вложить'}
      </button>
    </Sheet>
  )
}

function ChatLockedSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: spacing.md }}>🎭</div>
      <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '18px', textAlign: 'center', marginBottom: spacing.sm }}>
        Беседа с дельцом
      </div>
      <div style={{ color: colors.textSecondary, fontSize: '13px', textAlign: 'center', lineHeight: 1.5, marginBottom: spacing.lg }}>
        Можно расспросить хозяина дела лично — он ответит, как умеет. Врать будет красиво, правду скрывать — изящно.
        Скоро откроется за просмотр рекламы.
      </div>
      <button onClick={onClose} style={primaryBtnStyle}>Понятно</button>
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

function phaseCaption(phase: Phase, charter: CharterDTO, scanCountdown: number | null): string {
  if (phase === 'intro')     return 'Познакомься с делом'
  if (phase === 'reference') return 'Запоминай знак'
  if (phase === 'scan')      return `Найди подделки · ${scanCountdown ?? charter.timeLimitSeconds} с`
  return 'Разбор грамоты'
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
  background: 'none', border: 'none',
  color: colors.textMuted, cursor: 'pointer', fontSize: '20px',
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
