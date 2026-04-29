import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ScreenBackground, APP_VERSION, homeBackground } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider } from '@/components/FairyCard'
import { RankUpOverlay } from '@/components/RankUpOverlay'
import { OnboardingTutorial } from '@/components/OnboardingTutorial'
import {
  WhatsNewOverlay, getPendingChangelog, markChangelogSeen, type ChangelogEntry,
} from '@/components/WhatsNewOverlay'
import { AchievementUnlockedOverlay } from '@/components/AchievementUnlockedOverlay'
import { CountUp } from '@/components/CountUp'
import { EyeIcon, LockIcon } from '@/components/icons'
import { api, type ProjectDTO, type DailyUpdateDTO, type ClosureSummaryDTO, type MyReferralEntryDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing, typography } from '@/theme'

const RANK_DISPLAY: Record<string, string> = {
  NEWBIE: 'Скоморох', AMBASSADOR: 'Купец', ANALYST: 'Мудрец', SHARK: 'Боярин', LAMBO_SENSEI: 'Князь',
}

const MODEL_OPTIONS = [
  {
    id: 'deepseek/deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    subtitle: 'быстрый и дешёвый, по умолчанию',
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    label: 'Gemini 2.5 Flash',
    subtitle: 'умнее, медленнее',
  },
]

export function HomePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setGameState, gameState } = useGameStore()
  const [showSettings, setShowSettings] = useState(false)
  const [localModel, setLocalModel] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showMyReferrals, setShowMyReferrals] = useState(false)
  const [showDayNews, setShowDayNews] = useState(false)
  const [dayClosures, setDayClosures] = useState<ClosureSummaryDTO[]>([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentPending, setPaymentPending] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [pendingChangelog, setPendingChangelog] = useState<ChangelogEntry | null>(null)

  // Changelog показываем после того как дойдёт gameState — нужно знать
  // завершён ли онбординг (новичкам вместо changelog идёт тур).
  useEffect(() => {
    if (!gameState) return
    const entry = getPendingChangelog(APP_VERSION, gameState.isOnboardingComplete)
    if (entry) setPendingChangelog(entry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.isOnboardingComplete])
  // Тикает каждую секунду, чтобы перерисовывать таймер кулдауна
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { isLoading, isError, error } = useQuery({
    queryKey: ['gameState'],
    queryFn: async () => {
      const data = await api.game.getState()
      setGameState(data)
      if (localModel === null) {
        setLocalModel(data.preferredModel)
      }
      return data
    },
    refetchInterval: 30_000,
  })

  const tgHaptic = (window as any).Telegram?.WebApp?.HapticFeedback

  const advanceMutation = useMutation({
    mutationFn: api.game.advanceDay,
    onSuccess: (data) => {
      tgHaptic?.notificationOccurred('success')
      qc.invalidateQueries({ queryKey: ['gameState'] })
      qc.invalidateQueries({ queryKey: ['updates'] })
      setDayClosures(data.closures ?? [])
      setShowDayNews(true)
    },
    onError: () => tgHaptic?.notificationOccurred('error'),
  })

  const handleTimerSkipPayment = async () => {
    setPaymentPending(true)
    try {
      const resp = await api.payments.createInvoice('timer_skip') as any
      if (!resp.invoiceLink) {
        qc.invalidateQueries({ queryKey: ['gameState'] })
        qc.invalidateQueries({ queryKey: ['updates'] })
        setShowPaymentModal(false)
        setDayClosures(resp.closures ?? [])
        setShowDayNews(true)
        tgHaptic?.notificationOccurred('success')
        setPaymentPending(false)
        return
      }
      const tgWebApp = (window as any).Telegram?.WebApp
      if (!tgWebApp?.openInvoice) {
        setPaymentPending(false)
        return
      }
      tgWebApp.openInvoice(resp.invoiceLink, async (status: string) => {
        if (status === 'paid') {
          try {
            const result = await api.payments.activateTimerSkip()
            qc.invalidateQueries({ queryKey: ['gameState'] })
            qc.invalidateQueries({ queryKey: ['updates'] })
            setShowPaymentModal(false)
            setDayClosures(result.closures ?? [])
            setShowDayNews(true)
            tgHaptic?.notificationOccurred('success')
          } catch {
            tgHaptic?.notificationOccurred('error')
          }
        }
        setPaymentPending(false)
      })
    } catch {
      tgHaptic?.notificationOccurred('error')
      setPaymentPending(false)
    }
  }

  const updateModelMutation = useMutation({
    mutationFn: (model: string) => api.game.updateSettings(model),
    onSuccess: (data) => {
      setLocalModel(data.preferredModel)
    },
  })

  const completeOnboardingMutation = useMutation({
    mutationFn: api.game.completeOnboarding,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameState'] }),
  })

  // Первый вход — показываем вводный тур один раз. После этого
  // isOnboardingComplete=true и автозапуска больше не будет.
  useEffect(() => {
    if (gameState && !gameState.isOnboardingComplete && !showTutorial) {
      setShowTutorial(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.isOnboardingComplete])

  const resetMutation = useMutation({
    mutationFn: api.game.resetGame,
    onSuccess: () => {
      setShowResetConfirm(false)
      setShowSettings(false)
      qc.invalidateQueries({ queryKey: ['gameState'] })
      navigate('/')
    },
  })

  if (isLoading) {
    return (
      <ScreenBackground>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh', color: colors.fairyGold, fontSize: '24px' }}>
          ✦
        </div>
      </ScreenBackground>
    )
  }

  if (isError || !gameState) {
    return (
      <ScreenBackground>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh', gap: '12px', padding: '24px' }}>
          <div style={{ color: colors.fairyGold, fontSize: '32px' }}>⚠️</div>
          <div style={{ color: colors.textPrimary, fontSize: '16px', fontWeight: 600, textAlign: 'center' }}>
            Не удалось загрузить данные
          </div>
          <div style={{ color: colors.textMuted, fontSize: '13px', textAlign: 'center' }}>
            {(error as Error)?.message ?? 'Ошибка соединения с сервером'}
          </div>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['gameState'] })}
            style={{
              marginTop: '8px',
              padding: '10px 24px',
              background: `linear-gradient(135deg, ${colors.enchantedPurple}, ${colors.nightBlue})`,
              border: `1px solid ${colors.fairyGold}40`,
              borderRadius: '12px',
              color: colors.fairyGold,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Попробовать снова
          </button>
        </div>
      </ScreenBackground>
    )
  }

  const totalWealth = gameState.balance + gameState.activeProjects.reduce((s, p) => s + p.currentValueRubles, 0)
  const activeValue = gameState.activeProjects.reduce((s, p) => s + p.currentValueRubles, 0)
  // Доход учитывает и уже полученные деньги, и нереализованную прибыль по активным делам —
  // иначе сразу после первого вложения ROI будет −100%, хотя деньги не потеряны, а «в работе»
  const roi = gameState.totalInvested > 0
    ? ((gameState.totalReturned + activeValue - gameState.totalInvested) / gameState.totalInvested * 100)
    : 0

  const currentModel = localModel ?? gameState.preferredModel

  return (
    <ScreenBackground bgImage={homeBackground(gameState.currentDay)}>
      {gameState.pendingRankUp && <RankUpOverlay rank={gameState.pendingRankUp} />}
      <AnimatePresence>
        {showTutorial && (
          <OnboardingTutorial
            onClose={() => {
              setShowTutorial(false)
              if (!gameState.isOnboardingComplete) completeOnboardingMutation.mutate()
            }}
          />
        )}
        {pendingChangelog && !showTutorial && (
          <WhatsNewOverlay
            entry={pendingChangelog}
            onClose={() => {
              markChangelogSeen(APP_VERSION)
              setPendingChangelog(null)
            }}
          />
        )}
      </AnimatePresence>
      {!showTutorial && !pendingChangelog && <AchievementUnlockedOverlay />}

      {/* Reset confirmation modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            key="reset-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowResetConfirm(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.80)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px',
            }}
          >
            <motion.div
              key="reset-modal"
              initial={{ opacity: 0, scale: 0.88, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: '360px',
                background: `linear-gradient(180deg, #1a0a08 0%, ${colors.nightBlue} 100%)`,
                border: `1px solid ${colors.danger}50`,
                borderRadius: '16px',
                padding: '24px',
                maxHeight: 'calc(100dvh - 40px)',
                overflowY: 'auto',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: `${colors.danger}20`, border: `2px solid ${colors.danger}`,
                  color: colors.danger, fontSize: '20px', fontWeight: 900, marginBottom: '12px',
                }}>!</div>
                <div style={{ color: colors.textPrimary, fontSize: '16px', fontWeight: 700 }}>
                  Начать заново?
                </div>
              </div>
              <div style={{
                padding: '12px',
                background: `${colors.danger}10`,
                border: `1px solid ${colors.danger}30`,
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '12px',
                color: colors.textSecondary,
                lineHeight: 1.6,
              }}>
                <div style={{ fontWeight: 700, color: colors.danger, marginBottom: '6px' }}>Будет удалено:</div>
                {[
                  '🪙 Все гроши и история баланса',
                  '📦 Все активные и закрытые дела',
                  '👁 Чуйка и счётчик дней',
                  '🎭 Купеческий чин',
                  '📜 Разобранные грамоты',
                  '🏆 Все подвиги',
                ].map(item => (
                  <div key={item} style={{ marginTop: '3px' }}>{item}</div>
                ))}
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${colors.danger}20`, color: colors.textMuted, fontSize: '11px' }}>
                  Рефералы и настройки нейронки сохранятся
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  style={{
                    flex: 1, padding: '11px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '10px',
                    color: colors.textPrimary,
                    fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={() => resetMutation.mutate()}
                  disabled={resetMutation.isPending}
                  style={{
                    flex: 1, padding: '11px',
                    background: colors.danger,
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer',
                    opacity: resetMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {resetMutation.isPending ? 'Сброс...' : 'Да, начать заново'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {showMyReferrals && (
        <MyReferralsSheet onClose={() => setShowMyReferrals(false)} />
      )}

      {showDayNews && gameState.activeProjects.length > 0 && (
        <DayNewsOverlay projects={gameState.activeProjects} closures={dayClosures} onClose={() => setShowDayNews(false)} />
      )}

      {/* Settings Sheet */}
      <AnimatePresence>
        {showSettings && (
          <>
            {/* Backdrop */}
            <motion.div
              key="settings-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowSettings(false); setShowResetConfirm(false) }}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
              }}
            />
            {/* Sheet */}
            <motion.div
              key="settings-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
                background: `linear-gradient(180deg, ${colors.enchantedPurple} 0%, ${colors.nightBlue} 100%)`,
                borderTop: `1px solid ${colors.fairyGold}40`,
                borderRadius: '20px 20px 0 0',
                padding: '24px 20px 40px',
                maxHeight: '80dvh',
                overflowY: 'auto',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ color: colors.fairyGold, fontSize: '18px', fontWeight: 700 }}>⚙️ Настройки</div>
                <button
                  onClick={() => { setShowSettings(false); setShowResetConfirm(false) }}
                  style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}
                >
                  ✕
                </button>
              </div>

              {/* Model section */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Нейронка для хозяев дел
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {MODEL_OPTIONS.map(option => {
                    const isSelected = currentModel === option.id
                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          setLocalModel(option.id)
                          updateModelMutation.mutate(option.id)
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: isSelected ? `${colors.fairyGold}18` : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${isSelected ? colors.fairyGold : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'left',
                        }}
                      >
                        <div>
                          <div style={{ color: isSelected ? colors.fairyGold : colors.textPrimary, fontSize: '14px', fontWeight: 600 }}>
                            {option.label}
                          </div>
                          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '2px' }}>
                            {option.subtitle}
                          </div>
                        </div>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          border: `2px solid ${isSelected ? colors.fairyGold : 'rgba(255,255,255,0.3)'}`,
                          background: isSelected ? colors.fairyGold : 'transparent',
                          flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.nightBlue }} />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Повторный просмотр вводного рассказа */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Подсказки
                </div>
                <button
                  onClick={() => { setShowSettings(false); setShowTutorial(true) }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: `${colors.fairyGold}18`,
                    border: `1px solid ${colors.fairyGold}55`,
                    borderRadius: '12px',
                    color: colors.fairyGold,
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  📖 Как играть
                  <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px', fontWeight: 400 }}>
                    Вводный рассказ о делах, хозяевах и судьбах
                  </div>
                </button>
              </div>

              {/* Пригласительная грамота */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Пригласительная грамота
                </div>
                <button
                  onClick={() => handleInvite(gameState)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: `${colors.fairyGold}18`,
                    border: `1px solid ${colors.fairyGold}55`,
                    borderRadius: '12px',
                    color: colors.fairyGold,
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  📜 Зазвать купца на ярмарку
                  <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px', fontWeight: 400 }}>
                    Обоим по +100 г, когда сосватанный наберёт 10 чуйки
                  </div>
                </button>
                <button
                  onClick={() => { setShowSettings(false); setShowMyReferrals(true) }}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '10px 16px',
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: '12px',
                    color: colors.textSecondary,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  🤝 Мои сосватанные
                  <span style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 400 }}>→</span>
                </button>
              </div>

              {/* Правила · Отказ от ответственности */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ color: colors.textMuted, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Правила и ответственность
                </div>
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '12px',
                  color: colors.textMuted,
                  fontSize: '11px',
                  lineHeight: 1.7,
                }}>
                  <strong style={{ color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>
                    Из грязи в князи — симуляционная игра
                  </strong>
                  Все проекты, персонажи и события в игре <strong style={{ color: colors.textPrimary }}>вымышлены</strong> и не являются инвестиционными советами или рекомендациями. Любое сходство с реальными проектами или людьми случайно.
                  <br /><br />
                  Игровые гроши (г) — внутриигровая валюта, не имеющая реальной стоимости.
                  <br /><br />
                  Платежи за дополнительные возможности (Telegram Stars) обрабатываются Telegram. Разработчик игры не хранит данные платёжных карт и не несёт ответственности за действия платёжной платформы.
                  <br /><br />
                  Разработчик не несёт ответственности за действия третьих лиц, сбои сети, а также за любые убытки, возникшие в результате использования приложения.
                  <br /><br />
                  Используя приложение, вы подтверждаете, что вам исполнилось 18 лет или имеется согласие родителей/опекунов.
                  <br /><br />
                  <span style={{ color: `${colors.fairyGold}90` }}>@vknyazi_bot · Версия {APP_VERSION}</span>
                </div>
              </div>

              {/* Reset button */}
              <div>
                <button
                  onClick={() => { setShowSettings(false); setShowResetConfirm(true) }}
                  style={{
                    width: '100%', padding: '12px 16px',
                    background: 'rgba(244,67,54,0.12)',
                    border: `1px solid ${colors.danger}60`,
                    borderRadius: '12px',
                    color: colors.danger,
                    fontSize: '14px', fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '20px', height: '20px',
                    borderRadius: '50%',
                    background: colors.danger,
                    color: '#fff',
                    fontSize: '13px', fontWeight: 900, lineHeight: 1,
                    flexShrink: 0,
                  }}>!</span>
                  Начать заново
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>

        {/* Логотип + кнопка настроек */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: spacing.xxl, position: 'relative' }}
        >
          <button
            onClick={() => setShowSettings(true)}
            style={{
              position: 'absolute', right: 0, top: 0,
              background: 'none', border: 'none',
              color: colors.textMuted, fontSize: '20px',
              cursor: 'pointer', padding: '4px',
              lineHeight: 1,
            }}
          >
            ⚙️
          </button>
          <div style={{
            fontFamily: typography.headingFontFamily,
            fontSize: '28px',
            fontWeight: 700,
            color: colors.fairyGold,
            letterSpacing: '0.06em',
            textShadow: `0 0 24px ${colors.fairyGold}40`,
          }}>
            Из грязи в князи
          </div>
          <div style={{
            display: 'inline-block',
            marginTop: '6px',
            padding: '3px 10px',
            background: `${colors.fairyGold}18`,
            border: `1px solid ${colors.fairyGold}40`,
            borderRadius: '12px',
            color: colors.fairyGold,
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.03em',
          }}>
            🏆 Бета · с 1 мая — конкурс с призами
          </div>
          {(() => {
            const WEEK_DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
            const maxC = gameState.maxConsecutiveAdvances ?? 7
            const usedC = gameState.consecutiveAdvances ?? 0
            const dayName = usedC > 0 ? WEEK_DAYS[Math.min(usedC, maxC) - 1] : null
            return dayName ? (
              <div style={{ color: `${colors.fairyGold}70`, fontSize: '11px', marginTop: '2px', letterSpacing: '0.05em' }}>
                {dayName}
              </div>
            ) : null
          })()}
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '2px' }}>
            ✦ День {gameState.currentDay} · {RANK_DISPLAY[gameState.investorRank] ?? gameState.investorRank} ✦
          </div>
        </motion.div>

        {/* Баланс */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <FairyCard accent style={{ marginBottom: spacing.lg, textAlign: 'center' }}>
            <div style={{ color: colors.textSecondary, fontSize: '12px', marginBottom: '4px' }}>Свободные гроши</div>
            <div style={{
              color: colors.fairyGold,
              fontFamily: typography.headingFontFamily,
              fontSize: '40px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              textShadow: `0 0 28px ${colors.fairyGold}50`,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <CountUp value={gameState.balance} />
              <span style={{ fontSize: '26px', marginLeft: '6px', opacity: 0.85 }}>г</span>
            </div>
            <OrnamentDivider />
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: colors.textMuted, fontSize: '11px' }}>Вложено</div>
                <div style={{ color: colors.textSecondary, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {gameState.totalInvested.toFixed(0)} г
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: colors.textMuted, fontSize: '11px' }}>Получено</div>
                <div style={{ color: colors.textSecondary, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {(gameState.totalReturned + activeValue).toFixed(0)} г
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: colors.textMuted, fontSize: '11px' }}>Итог</div>
                <div style={{ color: roi >= 0 ? colors.success : colors.danger, fontWeight: 700 }}>
                  {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: colors.textMuted, fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                  Чуйка <EyeIcon size={11} />
                </div>
                <div style={{ color: colors.textPrimary, fontWeight: 600 }}>{gameState.intuitionScore}</div>
              </div>
            </div>
          </FairyCard>
        </motion.div>

        {/* Активные дела */}
        {gameState.activeProjects.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div style={{ color: colors.fairyGold, fontSize: '13px', fontWeight: 600, marginBottom: spacing.sm, marginLeft: '4px' }}>
              ✦ Активные дела ({gameState.activeProjects.length})
            </div>
            {gameState.activeProjects.map((p, i) => (
              <ActiveProjectCard key={p.id} project={p} delay={0.2 + i * 0.05} onPress={() => navigate(`/portfolio`)} />
            ))}
          </motion.div>
        )}

        {/* Входящие */}
        {gameState.inboxProjects.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div style={{ color: colors.fairyGold, fontSize: '13px', fontWeight: 600, margin: `${spacing.lg} 0 ${spacing.sm} 4px` }}>
              ✦ Входящие грамоты ({gameState.inboxProjects.length})
            </div>
            <FairyCard onClick={() => navigate('/inbox')} style={{ cursor: 'pointer' }}>
              <div style={{ color: colors.textPrimary, fontSize: '14px' }}>
                Новые предложения ждут тебя
              </div>
              <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
                Открой и поговори с хозяевами →
              </div>
            </FairyCard>
          </motion.div>
        )}

      </div>

      {/* Модалка оплаты для пропуска ожидания */}
      <AnimatePresence>
        {showPaymentModal && (
          <StarsPaymentOverlay
            isPending={paymentPending}
            onConfirm={handleTimerSkipPayment}
            onClose={() => setShowPaymentModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Плавающая кнопка «Следующий день» — скрыта когда открыты настройки/модалки */}
      {!showSettings && !showPaymentModal && (
        <NextDayFab
          gameState={gameState}
          now={now}
          isPending={advanceMutation.isPending}
          onAdvance={() => { tgHaptic?.impactOccurred('medium'); advanceMutation.mutate() }}
          onWatchAd={() => setShowPaymentModal(true)}
        />
      )}
    </ScreenBackground>
  )
}

function MyReferralsSheet({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['referrals', 'my'],
    queryFn: api.referrals.getMy,
  })
  const threshold = data?.threshold ?? 10

  return (
    <AnimatePresence>
      <motion.div
        key="referrals-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }}
      />
      <motion.div
        key="referrals-sheet"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
          background: `linear-gradient(180deg, ${colors.enchantedPurple} 0%, ${colors.nightBlue} 100%)`,
          borderTop: `1px solid ${colors.fairyGold}40`,
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 40px',
          maxHeight: '75dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ color: colors.fairyGold, fontSize: '17px', fontWeight: 700 }}>🤝 Мои сосватанные</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>
        <div style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '16px', lineHeight: 1.5 }}>
          Бонус +100 г обоим начисляется когда сосватанный набирает {threshold} чуйки
        </div>

        {isLoading && [1, 2, 3].map(i => (
          <div key={i} style={{ height: '52px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', marginBottom: '8px', animation: 'pulse 1.5s infinite' }} />
        ))}

        {!isLoading && data?.referrals.length === 0 && (
          <div style={{ textAlign: 'center', color: colors.textMuted, padding: '32px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📜</div>
            <div>Никого пока не сосватал</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>Поделись пригласительной грамотой</div>
          </div>
        )}

        {data?.referrals.map((r: MyReferralEntryDTO) => {
          const done = r.bonusGranted
          const pct = Math.min(100, Math.round((r.intuitionScore / threshold) * 100))
          const displayName = r.username ? '@' + r.username : r.firstName
          return (
            <div key={r.userId} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 12px',
              marginBottom: '8px',
              borderRadius: '10px',
              background: done ? `${colors.success}12` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${done ? colors.success + '40' : colors.cardBorder}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: done ? colors.success : colors.textPrimary, fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                {!done && (
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: colors.fairyGold, borderRadius: '2px', transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '3px' }}>
                      Чуйка: {r.intuitionScore} / {threshold}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                {done ? (
                  <div style={{ color: colors.success, fontSize: '12px', fontWeight: 700 }}>+100 г ✓</div>
                ) : (
                  <div style={{ color: colors.textMuted, fontSize: '11px' }}>День {r.currentDay}</div>
                )}
              </div>
            </div>
          )
        })}
      </motion.div>
    </AnimatePresence>
  )
}

function handleInvite(gameState: { userId: number; firstName?: string } | any) {
  const userId = gameState?.userId
  if (!userId) return
  // ?startapp= — payload приходит в initData.start_param, не зависит от того,
  // жал ли получатель Start раньше (с ?start= deeplink молчит у активного юзера).
  // Требует настроенной Main Mini App в BotFather (см. CLAUDE.md → Реферальная программа).
  const botLink = `https://t.me/vknyazi_bot?startapp=ref_${userId}`
  const text = [
    '📜 Купеческая грамота для тебя!',
    'Приходи на ярмарку «Из грязи в князи» — будем вкладывать гроши, ловить жуликов и расти в чинах.',
    'Оба получим по 100 г в казну, если перейдёшь по ссылке:',
  ].join('\n')

  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(text)}`
  const tg = (window as any).Telegram?.WebApp
  if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl)
  else window.open(shareUrl, '_blank')
}

function NextDayFab({
  gameState, now, isPending, onAdvance, onWatchAd,
}: {
  gameState: { lastAdvancedAt: string | null; advanceCooldownMs: number; consecutiveAdvances: number; maxConsecutiveAdvances: number }
  now: number
  isPending: boolean
  onAdvance: () => void
  onWatchAd: () => void
}) {
  const lastMs = gameState.lastAdvancedAt ? new Date(gameState.lastAdvancedAt).getTime() : 0
  const cooldownMs = gameState.advanceCooldownMs ?? 2 * 60 * 60 * 1000
  const remainingFreePresses = Math.max(0, (gameState.maxConsecutiveAdvances ?? 3) - (gameState.consecutiveAdvances ?? 0))
  const remainingMs = Math.max(0, lastMs + cooldownMs - now)
  const isLocked = remainingFreePresses === 0 && remainingMs > 0

  const label = isPending
    ? '⏳ Течёт время...'
    : isLocked
      ? `⏳ ${formatRemaining(remainingMs)}`
      : '🌅 Следующий день'

  const maxConsec = gameState.maxConsecutiveAdvances ?? 7
  const usedConsec = gameState.consecutiveAdvances ?? 0
  const WEEK_DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
  const currentDayName = usedConsec > 0 ? WEEK_DAYS[Math.min(usedConsec, maxConsec) - 1] : null

  return (
    <div style={{
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: 'calc(68px + env(safe-area-inset-bottom))',
      zIndex: 110,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
    }}>
      {currentDayName && (
        <div style={{
          color: isLocked ? `${colors.fairyGold}80` : colors.textMuted,
          fontSize: '10px',
          whiteSpace: 'nowrap',
        }}>
          {currentDayName}
        </div>
      )}
      <motion.button
        whileTap={{ scale: isLocked || isPending ? 1 : 0.95 }}
        transition={{ duration: 0.1 }}
        onClick={() => { if (!isLocked && !isPending) onAdvance() }}
        disabled={isPending || isLocked}
        style={{
          padding: '10px 24px',
          background: isLocked
            ? `rgba(13, 23, 53, 0.85)`
            : `linear-gradient(135deg, ${colors.enchantedPurple}ee, ${colors.nightBlue}ee)`,
          border: `1px solid ${isLocked ? `${colors.fairyGold}25` : `${colors.fairyGold}60`}`,
          borderRadius: '24px',
          color: isLocked ? colors.textMuted : colors.fairyGold,
          fontSize: '13px',
          fontWeight: 600,
          cursor: isLocked || isPending ? 'not-allowed' : 'pointer',
          backdropFilter: 'blur(12px)',
          boxShadow: isLocked ? 'none' : `0 4px 20px ${colors.fairyGold}30`,
          whiteSpace: 'nowrap',
          opacity: isPending ? 0.7 : 1,
        }}
      >
        {label}
      </motion.button>

      {isLocked && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onWatchAd}
          style={{
            padding: '7px 18px',
            background: 'rgba(13, 23, 53, 0.80)',
            border: `1px dashed ${colors.fairyGold}45`,
            borderRadius: '20px',
            color: colors.fairyGold,
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            whiteSpace: 'nowrap',
          }}
        >
          ⭐ 10 звёзд · пропустить
        </motion.button>
      )}
    </div>
  )
}

function NextDayButton({
  gameState, now, isPending, isError, errorMessage, onAdvance, onWatchAd,
}: {
  gameState: {
    lastAdvancedAt: string | null
    advanceCooldownMs: number
    consecutiveAdvances: number
    maxConsecutiveAdvances: number
  }
  now: number
  isPending: boolean
  isError: boolean
  errorMessage: string | undefined
  onAdvance: () => void
  onWatchAd: () => void
}) {
  const lastMs = gameState.lastAdvancedAt ? new Date(gameState.lastAdvancedAt).getTime() : 0
  const cooldownMs = gameState.advanceCooldownMs ?? 2 * 60 * 60 * 1000
  const maxConsec = gameState.maxConsecutiveAdvances ?? 3
  const usedConsec = gameState.consecutiveAdvances ?? 0
  const remainingFreePresses = Math.max(0, maxConsec - usedConsec)
  const remainingMs = Math.max(0, lastMs + cooldownMs - now)
  // Блокировка только когда пачка быстрых дней исчерпана И кулдаун ещё идёт
  const isLocked = remainingFreePresses === 0 && remainingMs > 0

  const label = isPending
    ? '⏳ Течёт время...'
    : isLocked
      ? `⏳ Передышка: ${formatRemaining(remainingMs)}`
      : '🌅 Следующий день'

  // Подпись под кнопкой: только когда пачка уже начала расходоваться
  let subline: string | null = null
  if (!isPending) {
    if (isLocked) subline = `Перерыв · жди ${formatRemaining(remainingMs)} или потрать 10 ⭐`
    else if (usedConsec > 0 && remainingFreePresses > 0) {
      subline = `Осталось переходов: ${remainingFreePresses} из ${maxConsec}`
    }
  }

  return (
    <>
      <motion.button
        whileTap={{ scale: isLocked ? 1 : 0.97 }}
        transition={{ duration: 0.1 }}
        onClick={() => { if (!isLocked && !isPending) onAdvance() }}
        disabled={isPending || isLocked}
        style={{
          width: '100%',
          marginTop: spacing.xl,
          padding: `${spacing.md} ${spacing.lg}`,
          background: `linear-gradient(135deg, ${colors.enchantedPurple}, ${colors.nightBlue})`,
          border: `1px solid ${isLocked ? `${colors.fairyGold}25` : `${colors.fairyGold}40`}`,
          borderRadius: '12px',
          color: isLocked ? colors.textMuted : colors.fairyGold,
          fontSize: '14px',
          fontWeight: 600,
          cursor: isLocked || isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {label}
      </motion.button>
      {subline && (
        <div style={{ color: colors.textMuted, fontSize: '11px', textAlign: 'center', marginTop: '6px' }}>
          {subline}
        </div>
      )}
      {isLocked && (
        <button
          onClick={onWatchAd}
          style={{
            width: '100%',
            marginTop: spacing.sm,
            padding: `${spacing.sm} ${spacing.md}`,
            background: 'transparent',
            border: `1px dashed ${colors.fairyGold}50`,
            borderRadius: '12px',
            color: colors.fairyGold,
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ⭐ 10 звёзд · пропустить ожидание
        </button>
      )}
      {isError && !isLocked && (
        <div style={{ color: colors.danger, fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>
          {errorMessage}
        </div>
      )}
    </>
  )
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}ч ${m.toString().padStart(2, '0')}м`
  if (m > 0) return `${m}м ${s.toString().padStart(2, '0')}с`
  return `${s}с`
}

function StarsPaymentOverlay({
  isPending, onConfirm, onClose,
}: { isPending: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 250,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
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
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: spacing.md }}>⭐</div>
        <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '17px', textAlign: 'center', marginBottom: spacing.sm }}>
          Пропустить ожидание
        </div>
        <div style={{ color: colors.textSecondary, fontSize: '13px', textAlign: 'center', lineHeight: 1.5, marginBottom: spacing.lg }}>
          За <strong style={{ color: colors.fairyGold }}>10 Telegram Stars</strong> перерыв закончится прямо сейчас — и можно идти дальше. Оплата через встроенный кошелёк Telegram.
        </div>
        <button
          onClick={onConfirm}
          disabled={isPending}
          style={{
            width: '100%',
            padding: spacing.md,
            background: `linear-gradient(135deg, #FFB800, #FF8C00)`,
            border: 'none',
            borderRadius: '12px',
            color: '#1a0a00',
            fontWeight: 700,
            fontSize: '15px',
            cursor: 'pointer',
            opacity: isPending ? 0.6 : 1,
            marginBottom: spacing.sm,
          }}
        >
          {isPending ? 'Открываем оплату…' : '⭐ Заплатить 10 звёзд'}
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: spacing.md,
            background: 'transparent',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '12px',
            color: colors.textMuted,
            fontWeight: 500,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Подождать ещё
        </button>
      </motion.div>
    </motion.div>
  )
}

function ActiveProjectCard({ project, delay, onPress }: { project: ProjectDTO; delay: number; onPress: () => void }) {
  const navigate = useNavigate()
  const profit = project.investedAmountRubles > 0
    ? ((project.currentValueRubles - project.investedAmountRubles) / project.investedAmountRubles * 100)
    : 0

  const { data: updates } = useQuery({
    queryKey: ['updates', project.id],
    queryFn: () => api.projects.getUpdates(project.id),
  })

  const latestUpdate: DailyUpdateDTO | undefined = updates?.[0]
  // Свежее случайное событие — отдельная плашка ниже, заметная и в характере.
  // Обычные сигналы (payoutStatus, userCountDelta, redFlags) — мелкой строкой как раньше.
  const eventKind = latestUpdate?.eventKind
  let newsSignal: string | null = null
  if (latestUpdate && !eventKind) {
    if (latestUpdate.payoutStatus === 'BOOSTED' || latestUpdate.userCountDelta > 5) newsSignal = '🟢'
    else if (latestUpdate.payoutStatus === 'DELAYED' || latestUpdate.userCountDelta < -5) newsSignal = '🔴'
    else if (latestUpdate.redFlags.length > 0) newsSignal = '⚠️'
  }
  const eventColor = eventKind === 'NEGATIVE' ? colors.danger
    : eventKind === 'POSITIVE' ? colors.success
    : eventKind === 'NEUTRAL' ? colors.fairyGold
    : null
  const eventGlyph = eventKind === 'NEUTRAL' ? '◇' : '◆'

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}>
      <FairyCard onClick={onPress} style={{ marginBottom: spacing.sm }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '14px' }}>{project.name}</div>
            <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>
              {project.developerName} · {project.daysSinceJoined} дн.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: colors.textMuted, fontSize: '10px', letterSpacing: '0.02em' }}>
              вложено {project.investedAmountRubles.toFixed(0)} г
            </div>
            <div style={{
              color: colors.fairyGold,
              fontFamily: typography.headingFontFamily,
              fontSize: '20px',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '0.02em',
              fontVariantNumeric: 'tabular-nums',
              textShadow: `0 0 14px ${colors.fairyGold}30`,
              marginTop: '2px',
            }}>
              <CountUp value={project.currentValueRubles} /> г
            </div>
            <div style={{ color: profit >= 0 ? colors.success : colors.danger, fontSize: '11px', fontWeight: 600 }}>
              {profit >= 0 ? '+' : ''}{profit.toFixed(1)}%
            </div>
          </div>
        </div>
        {/* Свежее событие — заголовок + полный текст вести прямо на карточке.
            Игрок не должен лезть в Казну чтобы порадоваться/огорчиться. */}
        {eventKind && eventColor && latestUpdate && (
          <div style={{
            marginTop: spacing.sm,
            padding: '10px 12px',
            borderRadius: '10px',
            background: `${eventColor}18`,
            border: `1px solid ${eventColor}55`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color: eventColor, fontSize: '14px', lineHeight: 1 }}>{eventGlyph}</span>
              <span style={{ color: colors.textPrimary, fontSize: '13px', fontWeight: 700, flex: 1 }}>
                {latestUpdate.title}
              </span>
            </div>
            <div style={{ color: colors.textSecondary, fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
              {latestUpdate.body}
            </div>
          </div>
        )}
        {(project.isWithdrawalLocked || newsSignal) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
            {project.isWithdrawalLocked && (
              <div style={{ color: colors.warning, fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <LockIcon size={12} /> Вывод заблокирован
              </div>
            )}
            {newsSignal && !project.isWithdrawalLocked && (
              <div style={{ color: colors.textMuted, fontSize: '11px' }}>
                {newsSignal} {latestUpdate?.title}
              </div>
            )}
          </div>
        )}
        <div style={{ marginTop: spacing.sm, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={e => { e.stopPropagation(); navigate('/portfolio') }}
            style={{
              padding: '4px 10px', background: `${colors.fairyGold}15`,
              border: `1px solid ${colors.fairyGold}40`, borderRadius: '6px',
              color: colors.fairyGold, cursor: 'pointer', fontSize: '11px',
            }}
          >
            + Довложить
          </button>
        </div>
      </FairyCard>
    </motion.div>
  )
}

function DayNewsOverlay({
  projects, closures, onClose,
}: {
  projects: ProjectDTO[]
  closures: ClosureSummaryDTO[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [idx, setIdx] = useState(0)

  // Сначала карточки итогов закрытий (драма), потом — обычные новости активных дел
  const closureCount = closures.length
  const total = closureCount + projects.length
  const isClosure = idx < closureCount
  const currentClosure = isClosure ? closures[idx] : null
  const currentProject = !isClosure ? projects[idx - closureCount] : null

  const dismiss = () => {
    if (idx < total - 1) setIdx(idx + 1)
    else onClose()
  }

  const goPrimary = () => {
    onClose()
    navigate(isClosure ? '/registry' : '/portfolio')
  }

  if (!currentClosure && !currentProject) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(6, 4, 18, 0.88)' }}
        onClick={dismiss}
      />

      {/* Card stack hint */}
      {total - idx - 1 > 0 && (
        <div style={{
          position: 'absolute',
          width: 'min(360px, calc(100vw - 48px))',
          height: '200px',
          background: `linear-gradient(145deg, #1a1040, #0D1735)`,
          border: `1px solid rgba(255,184,0,0.2)`,
          borderRadius: '16px',
          transform: 'translateY(12px) scale(0.95)',
          zIndex: 201,
        }} />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.3}
          onDragEnd={(_, info) => {
            if (info.offset.x > 80) goPrimary()
            else if (info.offset.x < -80) dismiss()
          }}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{
            opacity: 1, scale: 1, y: 0,
            // Пульс рамки только для closure-карточек, чтобы итог дела бил в глаза
            boxShadow: isClosure
              ? [`0 0 0 ${currentClosure!.profitPercent >= 0 && !currentClosure!.forcedByMafia ? colors.success : colors.danger}40`,
                 `0 0 32px ${currentClosure!.profitPercent >= 0 && !currentClosure!.forcedByMafia ? colors.success : colors.danger}80`,
                 `0 0 0 ${currentClosure!.profitPercent >= 0 && !currentClosure!.forcedByMafia ? colors.success : colors.danger}40`]
              : '0 0 0 rgba(0,0,0,0)',
          }}
          exit={{ opacity: 0, x: -120, scale: 0.85 }}
          transition={{
            type: 'spring', damping: 22, stiffness: 260,
            boxShadow: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
          }}
          style={{
            position: 'relative', zIndex: 202,
            width: 'min(360px, calc(100vw - 48px))',
            background: `linear-gradient(145deg, #2A1960, #0D1735)`,
            border: isClosure
              ? `2px solid ${currentClosure!.profitPercent >= 0 && !currentClosure!.forcedByMafia ? colors.success : colors.danger}`
              : `1px solid rgba(255,184,0,0.35)`,
            borderRadius: '16px',
            padding: '20px',
            cursor: 'grab',
          }}
        >
          {/* Counter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ color: colors.fairyGold, fontSize: '11px', fontWeight: 600 }}>
              {isClosure ? `🏛 Итоги дела ${idx + 1}/${total}` : `📜 Вести ${idx + 1}/${total}`}
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '18px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {currentClosure
            ? <ClosureCardContent closure={currentClosure} />
            : currentProject && <ProjectNewsCardContent project={currentProject} />}

          {/* Действия: кнопки + свайп */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={e => { e.stopPropagation(); dismiss() }}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${colors.textMuted}40`,
                borderRadius: '10px',
                color: colors.textSecondary,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ← Дальше
            </button>
            <button
              onClick={e => { e.stopPropagation(); goPrimary() }}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: `${colors.fairyGold}20`,
                border: `1px solid ${colors.fairyGold}70`,
                borderRadius: '10px',
                color: colors.fairyGold,
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isClosure ? 'В летопись →' : 'К делу →'}
            </button>
          </div>
          <div style={{ color: colors.textMuted, fontSize: '10px', textAlign: 'center', marginTop: '8px', opacity: 0.7 }}>
            или смахни карточку
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function ClosureCardContent({ closure }: { closure: ClosureSummaryDTO }) {
  const profitable = closure.profitPercent >= 0
  const accent = closure.forcedByMafia
    ? colors.danger
    : profitable
      ? colors.success
      : closure.profitPercent <= -50
        ? colors.danger
        : colors.warning

  const fateLabel = closure.fate === 'INSTANT_SCAM' ? 'Сбежал с деньгами'
    : closure.fate === 'SLOW_DRAIN' ? 'Тихо угас'
    : closure.fate === 'HONEST_FAIL' ? 'Честный провал'
    : closure.fate === 'SURVIVOR' ? 'Выжил с прибылью'
    : closure.fate === 'UNICORN' ? 'Жар-птица за хвост'
    : closure.fate

  const fateEmoji = closure.forcedByMafia ? '⚡'
    : closure.fate === 'UNICORN' ? '🔥'
    : closure.fate === 'SURVIVOR' ? '⚓'
    : closure.fate === 'INSTANT_SCAM' ? '💀'
    : closure.fate === 'SLOW_DRAIN' ? '🕯️'
    : closure.fate === 'HONEST_FAIL' ? '😔'
    : '📜'

  // Haptic-сигнал при появлении карточки итогов — игрок физически почувствует
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp?.HapticFeedback
    if (!tg) return
    if (closure.forcedByMafia || !profitable) tg.notificationOccurred('warning')
    else tg.notificationOccurred('success')
  }, [closure.id])

  return (
    <div>
      {/* Большой fate-эмодзи сверху — драма, кричит «дело закрылось» */}
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <motion.div
          initial={{ scale: 0.5, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
          style={{ fontSize: '56px', lineHeight: 1, filter: `drop-shadow(0 0 12px ${accent}80)` }}
        >
          {fateEmoji}
        </motion.div>
        <div style={{
          color: accent,
          fontFamily: typography.headingFontFamily,
          fontSize: '14px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginTop: '6px',
          textShadow: `0 0 16px ${accent}60`,
        }}>
          Дело закрылось
        </div>
      </div>

      {/* Заголовок: имя + delta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '15px' }}>{closure.name}</div>
          <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>
            {closure.developerName} · {closure.daysActive} дн.
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: accent, fontFamily: typography.headingFontFamily, fontSize: '22px', fontWeight: 700, lineHeight: 1.1 }}>
            {profitable ? '+' : ''}{closure.profitPercent.toFixed(1)}%
          </div>
          <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '2px' }}>{fateLabel}</div>
        </div>
      </div>

      {/* Причина закрытия (наратив) */}
      <div style={{
        padding: '10px 12px',
        background: `${accent}15`,
        border: `1px solid ${accent}50`,
        borderRadius: '10px',
        color: colors.textSecondary,
        fontSize: '12px',
        lineHeight: 1.5,
        marginBottom: '12px',
        whiteSpace: 'pre-line',
      }}>
        {closure.forcedByMafia && (
          <div style={{ color: colors.danger, fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
            ⚡ Не вышел вовремя — отдал половину
          </div>
        )}
        {closure.closureReason}
      </div>

      {/* Числа: Вложено → Получено */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: colors.textMuted, fontSize: '10px' }}>Вложено</div>
          <div style={{ color: colors.textSecondary, fontWeight: 600, fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
            {closure.investedAmount.toFixed(0)} г
          </div>
        </div>
        <div style={{ color: colors.textMuted, fontSize: '14px' }}>→</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: colors.textMuted, fontSize: '10px' }}>Получено</div>
          <div style={{
            color: accent,
            fontFamily: typography.headingFontFamily,
            fontSize: '20px',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 12px ${accent}40`,
          }}>
            {closure.returnedAmount.toFixed(0)} г
          </div>
        </div>
      </div>
    </div>
  )
}

function ProjectNewsCardContent({ project }: { project: ProjectDTO }) {
  const { data: updates } = useQuery({
    queryKey: ['updates', project.id],
    queryFn: () => api.projects.getUpdates(project.id),
  })

  const latest = updates?.[0]
  // Случайное событие имеет приоритет в подаче — заметный цветной ромб
  let signal = '⚪'
  let signalColor: string = colors.textMuted
  if (latest?.eventKind === 'NEGATIVE') { signal = '◆'; signalColor = colors.danger }
  else if (latest?.eventKind === 'POSITIVE') { signal = '◆'; signalColor = colors.success }
  else if (latest?.eventKind === 'NEUTRAL') { signal = '◇'; signalColor = colors.fairyGold }
  else if (latest) {
    if (latest.payoutStatus === 'BOOSTED' || latest.userCountDelta > 5) { signal = '🟢'; signalColor = colors.success }
    else if (latest.payoutStatus === 'DELAYED' || latest.userCountDelta < -5) { signal = '🔴'; signalColor = colors.danger }
  }

  const profit = project.investedAmountRubles > 0
    ? ((project.currentValueRubles - project.investedAmountRubles) / project.investedAmountRubles * 100)
    : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '15px' }}>{project.name}</div>
          <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>{project.developerName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: colors.fairyGold, fontWeight: 700 }}>{project.currentValueRubles.toFixed(0)} г</div>
          <div style={{ color: profit >= 0 ? colors.success : colors.danger, fontSize: '11px' }}>
            {profit >= 0 ? '+' : ''}{profit.toFixed(1)}%
          </div>
        </div>
      </div>

      {latest ? (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${signalColor}40`,
          borderRadius: '10px',
          padding: '10px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px' }}>{signal}</span>
            <span style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600 }}>{latest.title}</span>
          </div>
          <div style={{ color: colors.textMuted, fontSize: '11px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
            {latest.body.slice(0, 220)}{latest.body.length > 220 ? '…' : ''}
          </div>
          {latest.redFlags.length > 0 && (
            <div style={{ marginTop: '6px' }}>
              {latest.redFlags.slice(0, 2).map((flag, i) => (
                <div key={i} style={{ color: colors.warning, fontSize: '10px' }}>⚠️ {flag}</div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: colors.textMuted, fontSize: '12px', textAlign: 'center', padding: '12px' }}>
          Вести загружаются...
        </div>
      )}
    </div>
  )
}
