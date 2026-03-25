import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ScreenBackground } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider } from '@/components/FairyCard'
import { RankUpOverlay } from '@/components/RankUpOverlay'
import { api, type ProjectDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing, typography } from '@/theme'

const RANK_DISPLAY: Record<string, string> = {
  NEWBIE: 'Скоморох', AMBASSADOR: 'Купец', ANALYST: 'Мудрец', SHARK: 'Богатырь', LAMBO_SENSEI: 'Царь',
}

const MODEL_OPTIONS = [
  {
    id: 'deepseek/deepseek-chat-v3-0324',
    label: 'DeepSeek',
    subtitle: 'быстрый, дешёвый',
  },
  {
    id: 'google/gemini-2.5-flash-preview',
    label: 'Gemini 2.5 Flash',
    subtitle: 'умнее, медленнее',
  },
]

const INTRO_CARDS = [
  {
    icon: '📜',
    title: 'Как играть',
    text: 'Каждый день в «Входящих грамотах» появляются новые предложения от дельцов. Большинство — обман. Твоя задача — разобраться кто есть кто.',
  },
  {
    icon: '💬',
    title: 'Беседа с хозяином',
    text: 'Задай до 10 вопросов. Честный делец отвечает одинаково, лжец путается. Слушай внимательно — детали важны.',
  },
  {
    icon: '👁',
    title: 'Чуйка',
    text: 'Отмечай темы подозрений. После беседы оцени — угадал ложь = +1 очко, ошиблись = −1. Чуйка влияет на купеческий чин.',
  },
  {
    icon: '💰',
    title: 'Вложения',
    text: 'Вложи рубли → они растут каждый день. Потерял — не беда, учись на ошибках. Начни с малого.',
  },
]

export function HomePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setGameState, gameState } = useGameStore()
  const [showSettings, setShowSettings] = useState(false)
  const [localModel, setLocalModel] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

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

  const advanceMutation = useMutation({
    mutationFn: api.game.advanceDay,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameState'] }),
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
  const roi = gameState.totalInvested > 0
    ? ((gameState.totalReturned - gameState.totalInvested) / gameState.totalInvested * 100)
    : 0

  const currentModel = localModel ?? gameState.preferredModel

  return (
    <ScreenBackground>
      {gameState.pendingRankUp && <RankUpOverlay rank={gameState.pendingRankUp} />}

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

        {/* Кнопка следующий день */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <button
            onClick={() => advanceMutation.mutate()}
            disabled={advanceMutation.isPending}
            style={{
              width: '100%',
              marginTop: spacing.xl,
              padding: `${spacing.md} ${spacing.lg}`,
              background: `linear-gradient(135deg, ${colors.enchantedPurple}, ${colors.nightBlue})`,
              border: `1px solid ${colors.fairyGold}40`,
              borderRadius: '12px',
              color: colors.fairyGold,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: advanceMutation.isPending ? 0.6 : 1,
            }}
          >
            {advanceMutation.isPending ? '⏳ Течёт время...' : '🌅 Следующий день'}
          </button>
          {advanceMutation.isError && (
            <div style={{ color: colors.danger, fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>
              {(advanceMutation.error as Error).message}
            </div>
          )}
        </motion.div>

      </div>
    </ScreenBackground>
  )
}

function ActiveProjectCard({ project, delay, onPress }: { project: ProjectDTO; delay: number; onPress: () => void }) {
  const profit = project.investedAmountRubles > 0
    ? ((project.currentValueRubles - project.investedAmountRubles) / project.investedAmountRubles * 100)
    : 0

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
        {project.isWithdrawalLocked && (
          <div style={{ marginTop: spacing.sm, color: colors.warning, fontSize: '11px' }}>
            🔒 Вывод заблокирован
          </div>
        )}
      </FairyCard>
    </motion.div>
  )
}
