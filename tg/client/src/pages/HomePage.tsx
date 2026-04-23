import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ScreenBackground } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider } from '@/components/FairyCard'
import { RankUpOverlay } from '@/components/RankUpOverlay'
import { api, type ProjectDTO, type DailyUpdateDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing, typography } from '@/theme'

const RANK_DISPLAY: Record<string, string> = {
  NEWBIE: 'Скоморох', AMBASSADOR: 'Купец', ANALYST: 'Мудрец', SHARK: 'Богатырь', LAMBO_SENSEI: 'Князь',
}

const MODEL_OPTIONS = [
  {
    id: 'deepseek/deepseek-chat-v3-0324',
    label: 'DeepSeek',
    subtitle: 'быстрый, дешёвый',
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    label: 'Gemini 2.5 Flash',
    subtitle: 'умнее, медленнее',
  },
]

const INTRO_CARDS = [
  {
    icon: '📜',
    title: 'Как играть',
    text: 'Каждый день во «Входящих грамотах» появляются предложения от дельцов. Большинство — обман. Твоя задача — распознать жуликов, не потеряв рубли.',
  },
  {
    icon: '🔍',
    title: 'Купеческая грамота',
    text: 'Перед вложением смотри грамоту дельца — сетка из 24 печатей. За 15 секунд найди подделки. Чем больше лжи в деле — тем больше поддельных печатей.',
  },
  {
    icon: '👁',
    title: 'Чуйка',
    text: '+1 за каждую найденную подделку, −1 за ложное обвинение, −2 за пропущенную. Чем точнее чуйка — тем выше купеческий чин.',
  },
  {
    icon: '💰',
    title: 'Вложения',
    text: 'Вложи рубли → они растут каждый день. Часть дел сбежит с деньгами, часть — принесёт иксы. Начни с малого, расти до Князя.',
  },
]

export function HomePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setGameState, gameState } = useGameStore()
  const [showSettings, setShowSettings] = useState(false)
  const [localModel, setLocalModel] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showDayNews, setShowDayNews] = useState(false)
  const [showAdStub, setShowAdStub] = useState(false)
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
    onSuccess: () => {
      tgHaptic?.notificationOccurred('success')
      qc.invalidateQueries({ queryKey: ['gameState'] })
      qc.invalidateQueries({ queryKey: ['updates'] })
      setShowDayNews(true)
    },
    onError: () => tgHaptic?.notificationOccurred('error'),
  })

  const skipAdMutation = useMutation({
    mutationFn: api.game.advanceDaySkip,
    onSuccess: () => {
      tgHaptic?.notificationOccurred('success')
      qc.invalidateQueries({ queryKey: ['gameState'] })
      qc.invalidateQueries({ queryKey: ['updates'] })
      setShowAdStub(false)
      setShowDayNews(true)
    },
  })

  const updateModelMutation = useMutation({
    mutationFn: (model: string) => api.game.updateSettings(model),
    onSuccess: (data) => {
      setLocalModel(data.preferredModel)
    },
  })

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
    <ScreenBackground>
      {gameState.pendingRankUp && <RankUpOverlay rank={gameState.pendingRankUp} />}
      {showDayNews && gameState.activeProjects.length > 0 && (
        <DayNewsOverlay projects={gameState.activeProjects} onClose={() => setShowDayNews(false)} />
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
                    Обоим по +100 ₽ в казну, когда перейдёт по ссылке
                  </div>
                </button>
              </div>

              {/* Danger zone */}
              <div>
                <div style={{ color: colors.textMuted, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Опасная зона
                </div>
                {!showResetConfirm ? (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    style={{
                      width: '100%', padding: '12px 16px',
                      background: 'rgba(244,67,54,0.1)',
                      border: `1px solid ${colors.danger}60`,
                      borderRadius: '12px',
                      color: colors.danger,
                      fontSize: '14px', fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    🔄 Начать заново
                  </button>
                ) : (
                  <div style={{
                    padding: '16px',
                    background: 'rgba(244,67,54,0.1)',
                    border: `1px solid ${colors.danger}60`,
                    borderRadius: '12px',
                  }}>
                    <div style={{ color: colors.textPrimary, fontSize: '14px', marginBottom: '12px', fontWeight: 600 }}>
                      Весь прогресс будет удалён. Продолжить?
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        style={{
                          flex: 1, padding: '10px',
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '8px',
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
                          flex: 1, padding: '10px',
                          background: colors.danger,
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px', fontWeight: 600,
                          cursor: 'pointer',
                          opacity: resetMutation.isPending ? 0.6 : 1,
                        }}
                      >
                        {resetMutation.isPending ? 'Сброс...' : 'Да, сбросить'}
                      </button>
                    </div>
                  </div>
                )}
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
          <div style={{ fontSize: '28px', fontWeight: 800, color: colors.fairyGold }}>
            Из грязи в князи
          </div>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
            ✦ День {gameState.currentDay} · {RANK_DISPLAY[gameState.investorRank] ?? gameState.investorRank} ✦
          </div>
        </motion.div>

        {/* Обучающие карточки (только до завершения онбординга) */}
        {!gameState.isOnboardingComplete && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            style={{ marginBottom: spacing.lg }}
          >
            <div
              style={{
                display: 'flex',
                overflowX: 'auto',
                gap: spacing.sm,
                paddingBottom: '4px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              } as React.CSSProperties}
            >
              {INTRO_CARDS.map((card, i) => (
                <div
                  key={i}
                  style={{
                    minWidth: '220px',
                    maxWidth: '220px',
                    height: '120px',
                    flexShrink: 0,
                    background: `linear-gradient(145deg, ${colors.cardGradientTop}, ${colors.cardGradientBottom})`,
                    border: `1px solid ${colors.fairyGold}30`,
                    borderRadius: '14px',
                    padding: '14px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                  }}
                >
                  <div style={{ fontSize: '16px', marginBottom: '4px' }}>
                    {card.icon} <span style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '13px' }}>{card.title}</span>
                  </div>
                  <div style={{ color: colors.textSecondary, fontSize: '11px', lineHeight: '1.4' }}>
                    {card.text}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Баланс */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <FairyCard style={{ marginBottom: spacing.lg, textAlign: 'center' }}>
            <div style={{ color: colors.textSecondary, fontSize: '12px', marginBottom: '4px' }}>Свободные рубли</div>
            <div style={{ color: colors.fairyGold, fontSize: '36px', fontWeight: 800 }}>
              {gameState.balance.toFixed(0)} ₽
            </div>
            <OrnamentDivider />
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: colors.textMuted, fontSize: '11px' }}>Всего злата</div>
                <div style={{ color: colors.textPrimary, fontWeight: 600 }}>{totalWealth.toFixed(0)} ₽</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: colors.textMuted, fontSize: '11px' }}>Доход</div>
                <div style={{ color: roi >= 0 ? colors.success : colors.danger, fontWeight: 600 }}>
                  {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: colors.textMuted, fontSize: '11px' }}>Чуйка 👁</div>
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

        {/* Кнопка следующий день + кулдаун-таймер */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <NextDayButton
            gameState={gameState}
            now={now}
            isPending={advanceMutation.isPending}
            isError={advanceMutation.isError}
            errorMessage={(advanceMutation.error as Error | undefined)?.message}
            onAdvance={() => { tgHaptic?.impactOccurred('medium'); advanceMutation.mutate() }}
            onWatchAd={() => setShowAdStub(true)}
          />
        </motion.div>

      </div>

      {/* Заглушка рекламы для пропуска ожидания */}
      <AnimatePresence>
        {showAdStub && (
          <AdStubOverlay
            isPending={skipAdMutation.isPending}
            onConfirm={() => skipAdMutation.mutate()}
            onClose={() => setShowAdStub(false)}
          />
        )}
      </AnimatePresence>
    </ScreenBackground>
  )
}

function handleInvite(gameState: { userId: number; firstName?: string } | any) {
  const userId = gameState?.userId
  if (!userId) return
  // Используем ?start= (а не ?startapp=) — так payload гарантированно приходит
  // в /start хендлер бота, который сохранит его в pendingReferralParam.
  // ?startapp= работает только если у бота настроена Main Mini App в BotFather.
  const botLink = `https://t.me/vknyazi_bot?start=ref_${userId}`
  const text = [
    '📜 Купеческая грамота для тебя!',
    'Приходи на ярмарку «Из грязи в князи» — будем вкладывать рубли, ловить жуликов и расти в чинах.',
    'Оба получим по 100 ₽ в казну, если перейдёшь по ссылке:',
  ].join('\n')

  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(text)}`
  const tg = (window as any).Telegram?.WebApp
  if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl)
  else window.open(shareUrl, '_blank')
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
    if (isLocked) subline = `Пачка дней исчерпана · смотри рекламу или жди ${formatRemaining(remainingMs)}`
    else if (usedConsec > 0 && remainingFreePresses > 0) {
      subline = `Быстрых переходов осталось: ${remainingFreePresses} из ${maxConsec}`
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
          📺 Посмотреть рекламу и пропустить ожидание
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

function AdStubOverlay({
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
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: spacing.md }}>📺</div>
        <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '17px', textAlign: 'center', marginBottom: spacing.sm }}>
          Реклама пока не подключена
        </div>
        <div style={{ color: colors.textSecondary, fontSize: '13px', textAlign: 'center', lineHeight: 1.5, marginBottom: spacing.lg }}>
          Скоро здесь появится короткий ролик от партнёров. После него пачка быстрых дней снова наполнится. Пока что можем пропустить просто так — нажимай.
        </div>
        <button
          onClick={onConfirm}
          disabled={isPending}
          style={{
            width: '100%',
            padding: spacing.md,
            background: colors.fairyGold,
            border: 'none',
            borderRadius: '12px',
            color: colors.nightBlue,
            fontWeight: 700,
            fontSize: '15px',
            cursor: 'pointer',
            opacity: isPending ? 0.6 : 1,
            marginBottom: spacing.sm,
          }}
        >
          {isPending ? 'Пропускаем…' : '🌅 Пропустить ожидание'}
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

  const latestUpdate: DailyUpdateDTO | undefined = updates?.[updates.length - 1]
  let newsSignal: string | null = null
  if (latestUpdate) {
    if (latestUpdate.payoutStatus === 'BOOSTED' || latestUpdate.userCountDelta > 5) newsSignal = '🟢'
    else if (latestUpdate.payoutStatus === 'DELAYED' || latestUpdate.userCountDelta < -5) newsSignal = '🔴'
    else if (latestUpdate.redFlags.length > 0) newsSignal = '⚠️'
  }

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
            <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '14px' }}>
              {project.currentValueRubles.toFixed(0)} ₽
            </div>
            <div style={{ color: profit >= 0 ? colors.success : colors.danger, fontSize: '11px' }}>
              {profit >= 0 ? '+' : ''}{profit.toFixed(1)}%
            </div>
          </div>
        </div>
        {(project.isWithdrawalLocked || newsSignal) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
            {project.isWithdrawalLocked && (
              <div style={{ color: colors.warning, fontSize: '11px' }}>
                🔒 Вывод заблокирован
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

function DayNewsOverlay({ projects, onClose }: { projects: ProjectDTO[]; onClose: () => void }) {
  const navigate = useNavigate()
  const [idx, setIdx] = useState(0)

  const total = projects.length
  const current = projects[idx]

  const dismiss = () => {
    if (idx < total - 1) setIdx(idx + 1)
    else onClose()
  }

  const goToDeal = () => {
    onClose()
    navigate('/portfolio')
  }

  if (!current) return null

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
            if (info.offset.x > 80) goToDeal()
            else if (info.offset.x < -80) dismiss()
          }}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, x: -120, scale: 0.85 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          style={{
            position: 'relative', zIndex: 202,
            width: 'min(360px, calc(100vw - 48px))',
            background: `linear-gradient(145deg, #2A1960, #0D1735)`,
            border: `1px solid rgba(255,184,0,0.35)`,
            borderRadius: '16px',
            padding: '20px',
            cursor: 'grab',
          }}
        >
          {/* Counter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ color: colors.fairyGold, fontSize: '11px', fontWeight: 600 }}>
              📜 Вести дня {idx + 1}/{total}
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '18px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          <ProjectNewsCardContent project={current} />

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
              ← Пропустить
            </button>
            <button
              onClick={e => { e.stopPropagation(); goToDeal() }}
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
              К делу →
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

function ProjectNewsCardContent({ project }: { project: ProjectDTO }) {
  const { data: updates } = useQuery({
    queryKey: ['updates', project.id],
    queryFn: () => api.projects.getUpdates(project.id),
  })

  const latest = updates?.[updates.length - 1]
  let signal = '⚪'
  let signalColor: string = colors.textMuted
  if (latest) {
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
          <div style={{ color: colors.fairyGold, fontWeight: 700 }}>{project.currentValueRubles.toFixed(0)} ₽</div>
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
          <div style={{ color: colors.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
            {latest.body.slice(0, 160)}{latest.body.length > 160 ? '...' : ''}
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
