import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ScreenBackground } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider } from '@/components/FairyCard'
import { RankUpOverlay } from '@/components/RankUpOverlay'
import { api, type ProjectDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing, typography } from '@/theme'

const RANK_DISPLAY: Record<string, string> = {
  NEWBIE: 'Скоморох', AMBASSADOR: 'Купец', ANALYST: 'Мудрец', SHARK: 'Богатырь', LAMBO_SENSEI: 'Царь',
}

export function HomePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setGameState, gameState } = useGameStore()

  const { isLoading } = useQuery({
    queryKey: ['gameState'],
    queryFn: async () => {
      const data = await api.game.getState()
      setGameState(data)
      return data
    },
    refetchInterval: 30_000,
  })

  const advanceMutation = useMutation({
    mutationFn: api.game.advanceDay,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameState'] }),
  })

  if (isLoading || !gameState) {
    return (
      <ScreenBackground>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh', color: colors.fairyGold, fontSize: '24px' }}>
          ✦
        </div>
      </ScreenBackground>
    )
  }

  const totalWealth = gameState.balance + gameState.activeProjects.reduce((s, p) => s + p.currentValueRubles, 0)
  const roi = gameState.totalInvested > 0
    ? ((gameState.totalReturned - gameState.totalInvested) / gameState.totalInvested * 100)
    : 0

  return (
    <ScreenBackground>
      {gameState.pendingRankUp && <RankUpOverlay rank={gameState.pendingRankUp} />}

      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>

        {/* Логотип */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: spacing.xxl }}
        >
          <div style={{ fontSize: '28px', fontWeight: 800, color: colors.fairyGold }}>
            Из грязи в князи
          </div>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
            ✦ День {gameState.currentDay} · {RANK_DISPLAY[gameState.investorRank] ?? gameState.investorRank} ✦
          </div>
        </motion.div>

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
