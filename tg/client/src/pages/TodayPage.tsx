import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { ScreenBackground, PAGE_BG } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider, SkeletonCard } from '@/components/FairyCard'
import { PageTitle } from '@/components/PageTitle'
import { api, type TodayDTO } from '@/api/client'
import { colors, spacing, typography } from '@/theme'
import { useGameStore } from '@/stores/gameStore'
import { useT } from '@/i18n'
import { playSound } from '@/sounds'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

export function TodayPage() {
  const t = useT()
  const qc = useQueryClient()
  const { gameState } = useGameStore()
  const [claimedAnim, setClaimedAnim] = useState<number | null>(null)

  const { data: today, isLoading } = useQuery({
    queryKey: ['today'],
    queryFn: () => api.today.get(),
    refetchInterval: 60_000,
  })

  const claimMutation = useMutation({
    mutationFn: () => api.today.claim(),
    onSuccess: (data) => {
      haptic?.notificationOccurred('success')
      playSound('invest')
      setClaimedAnim(data.reward)
      qc.invalidateQueries({ queryKey: ['today'] })
      qc.invalidateQueries({ queryKey: ['gameState'] })
      setTimeout(() => setClaimedAnim(null), 2000)
    },
    onError: () => {
      haptic?.notificationOccurred('error')
    },
  })

  return (
    <ScreenBackground bgImage={PAGE_BG.leaderboard}>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
          <PageTitle>Сегодня</PageTitle>
          <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
            Дневной ритуал, награды за серию и купеческий рейтинг
          </div>
        </div>

        {isLoading || !today ? (
          <SkeletonCard lines={5} />
        ) : (
          <>
            <StreakBlock today={today} onClaim={() => claimMutation.mutate()} pending={claimMutation.isPending} />
            <MilestonesBlock today={today} />
            <LeaderboardBlock today={today} myTelegramId={String(gameState?.userId ?? '')} t={t} />
          </>
        )}
      </div>

      {/* Анимация награды — большие монеты в центре */}
      <AnimatePresence>
        {claimedAnim !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1.1, 1.5], y: [0, 0, -10, -60] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, times: [0, 0.18, 0.78, 1] }}
            style={{
              position: 'fixed', inset: 0, zIndex: 250,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              fontFamily: typography.headingFontFamily,
              fontSize: 64, fontWeight: 900,
              color: colors.fairyGold,
              textShadow: `0 6px 24px ${colors.fairyGold}99`,
            }}
          >
            +{claimedAnim} г
          </motion.div>
        )}
      </AnimatePresence>
    </ScreenBackground>
  )
}

function StreakBlock({ today, onClaim, pending }: {
  today: TodayDTO
  onClaim: () => void
  pending: boolean
}) {
  const streak = today.loginStreak
  const claimed = today.alreadyClaimed
  return (
    <FairyCard accent style={{ marginBottom: spacing.lg, textAlign: 'center' }}>
      <div style={{ color: colors.textSecondary, fontSize: 12 }}>Ты на ярмарке</div>
      <motion.div
        initial={{ scale: 0.85 }} animate={{ scale: 1 }}
        style={{
          color: colors.fairyGold,
          fontFamily: typography.headingFontFamily,
          fontSize: 64, fontWeight: 800, lineHeight: 1.1,
          marginTop: 4,
          textShadow: `0 0 24px ${colors.fairyGold}55`,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        🔥 {streak}
      </motion.div>
      <div style={{ color: colors.textPrimary, fontSize: 14, marginTop: 4 }}>
        {streak === 1 ? 'день подряд' : streak < 5 ? 'дня подряд' : 'дней подряд'}
      </div>

      <OrnamentDivider />

      {claimed ? (
        <div style={{ color: colors.success, fontSize: 14, fontWeight: 700, padding: `${spacing.sm} 0` }}>
          ✓ Награда получена. Заходи завтра — серия не оборвётся.
        </div>
      ) : (
        <button
          onClick={onClaim}
          disabled={pending}
          style={{
            width: '100%',
            padding: spacing.md,
            background: colors.fairyGold,
            border: 'none',
            borderRadius: 14,
            color: colors.nightBlue,
            fontWeight: 800,
            fontSize: 17,
            cursor: 'pointer',
            opacity: pending ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: `0 4px 18px ${colors.fairyGold}55`,
          }}
        >
          🎁 Забрать {today.todayReward} г
          {today.milestoneBonus > 0 && (
            <span style={{
              padding: '3px 8px', borderRadius: 6,
              background: colors.nightBlue, color: colors.fairyGold,
              fontSize: 11, fontWeight: 800,
            }}>
              +{today.milestoneBonus} БОНУС
            </span>
          )}
        </button>
      )}

      {today.nextMilestone && (
        <div style={{ color: colors.textMuted, fontSize: 11, marginTop: spacing.sm }}>
          До следующего бонуса (день {today.nextMilestone.day}, +{today.nextMilestone.bonus} г) —
          ещё {today.nextMilestone.daysLeft} {today.nextMilestone.daysLeft === 1 ? 'день' : 'дня'}.
        </div>
      )}
    </FairyCard>
  )
}

function MilestonesBlock({ today }: { today: TodayDTO }) {
  const list: Array<{ day: number; bonus: number }> = [
    { day: 3,  bonus: 50 },
    { day: 5,  bonus: 70 },
    { day: 7,  bonus: 100 },
    { day: 10, bonus: 150 },
    { day: 15, bonus: 300 },
    { day: 20, bonus: 500 },
    { day: 30, bonus: 1000 },
  ]
  return (
    <FairyCard style={{ marginBottom: spacing.lg }}>
      <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: 14, marginBottom: spacing.sm }}>
        Лестница серии
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        {list.map(m => {
          const passed = today.loginStreak >= m.day
          return (
            <div
              key={m.day}
              style={{
                flex: 1,
                padding: '8px 0',
                background: passed ? `${colors.success}22` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${passed ? colors.success : colors.cardBorder}`,
                borderRadius: 10,
                textAlign: 'center',
              }}
            >
              <div style={{
                color: passed ? colors.success : colors.textMuted,
                fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
              }}>
                {passed ? '✓' : m.day}
              </div>
              <div style={{ color: passed ? colors.success : colors.textMuted, fontSize: 9, fontWeight: 600 }}>
                +{m.bonus} г
              </div>
            </div>
          )
        })}
      </div>
    </FairyCard>
  )
}

function LeaderboardBlock({ today, myTelegramId, t }: {
  today: TodayDTO
  myTelegramId: string
  t: ReturnType<typeof useT>
}) {
  const lb = today.leaderboard
  return (
    <FairyCard>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: 14 }}>
          👑 Купеческий рейтинг
        </div>
        <div style={{ color: colors.textMuted, fontSize: 11 }}>
          {lb.totalPlayers} {lb.totalPlayers === 1 ? 'игрок' : 'игроков'}
        </div>
      </div>
      <div style={{ color: colors.textMuted, fontSize: 11, marginBottom: spacing.sm }}>
        По общему состоянию (баланс + дела). Обновляется онлайн.
      </div>
      {lb.top.length === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: 12, padding: `${spacing.md} 0`, textAlign: 'center' }}>
          {t.common.loading}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lb.top.map((entry, i) => {
            const isMe = entry.telegramId === myTelegramId
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
            return (
              <div
                key={entry.telegramId}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing.sm,
                  padding: '8px 10px',
                  background: isMe ? `${colors.fairyGold}18` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isMe ? colors.fairyGold : 'transparent'}`,
                  borderRadius: 10,
                }}
              >
                <span style={{ width: 28, fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                  {medal}
                </span>
                <span style={{
                  flex: 1,
                  color: isMe ? colors.fairyGold : colors.textPrimary,
                  fontSize: 13, fontWeight: isMe ? 700 : 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {entry.nickname || entry.firstName}
                </span>
                <span style={{
                  color: colors.fairyGold, fontWeight: 700, fontSize: 13,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {entry.wealth.toLocaleString('ru')} г
                </span>
              </div>
            )
          })}
        </div>
      )}

      {lb.myPosition && lb.myPosition > 10 && (
        <div style={{
          marginTop: spacing.sm, padding: '8px 10px',
          background: `${colors.fairyGold}10`,
          border: `1px dashed ${colors.fairyGold}55`,
          borderRadius: 10,
          color: colors.textMuted, fontSize: 12, textAlign: 'center',
        }}>
          Ты на {lb.myPosition} месте из {lb.totalPlayers}
        </div>
      )}
    </FairyCard>
  )
}
