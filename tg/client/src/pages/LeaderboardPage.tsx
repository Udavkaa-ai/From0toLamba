import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ScreenBackground } from '@/components/ScreenBackground'
import { SkeletonCard } from '@/components/FairyCard'
import { api, type LeaderboardEntryDTO } from '@/api/client'
import { colors, spacing } from '@/theme'

const RANK_EMOJI: Record<string, string> = {
  NEWBIE: '🎭',
  AMBASSADOR: '🛍️',
  ANALYST: '📚',
  SHARK: '⚔️',
  LAMBO_SENSEI: '👑',
}

const RANK_LABEL: Record<string, string> = {
  NEWBIE: 'Скоморох',
  AMBASSADOR: 'Купец',
  ANALYST: 'Мудрец',
  SHARK: 'Богатырь',
  LAMBO_SENSEI: 'Царь',
}

function positionBadge(pos: number) {
  if (pos === 1) return '🥇'
  if (pos === 2) return '🥈'
  if (pos === 3) return '🥉'
  return `#${pos}`
}

export function LeaderboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: api.leaderboard.get,
    refetchInterval: 60_000,
  })

  return (
    <ScreenBackground>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
          <div style={{ color: colors.fairyGold, fontSize: '20px', fontWeight: 700 }}>
            ✦ Ярмарочный Рейтинг ✦
          </div>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
            {data ? `${data.totalPlayers} купцов в игре` : 'Купцы всего Лукоморья'}
          </div>
        </div>

        {isLoading && [1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} lines={2} />)}

        {data?.entries.length === 0 && !isLoading && (
          <div style={{ textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl }}>
            <div style={{ fontSize: '32px', marginBottom: spacing.sm }}>🏪</div>
            <div>Пока никто не вышел на ярмарку</div>
          </div>
        )}

        {data && data.entries.map((entry, i) => (
          <motion.div
            key={entry.userId}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.6) }}
          >
            <LeaderboardRow entry={entry} />
          </motion.div>
        ))}

        {data && data.myPosition && data.myPosition > 100 && (
          <div style={{
            marginTop: spacing.lg,
            padding: `${spacing.sm} ${spacing.md}`,
            background: `${colors.fairyGold}12`,
            border: `1px solid ${colors.fairyGold}30`,
            borderRadius: '10px',
            textAlign: 'center',
          }}>
            <div style={{ color: colors.fairyGold, fontSize: '13px' }}>
              Ваше место: #{data.myPosition} из {data.totalPlayers}
            </div>
            <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>
              Копи злато — поднимайся выше!
            </div>
          </div>
        )}
      </div>
    </ScreenBackground>
  )
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntryDTO }) {
  const displayName = entry.username ? `@${entry.username}` : entry.firstName
  const rankLabel = RANK_LABEL[entry.investorRank] ?? entry.investorRank
  const rankEmoji = RANK_EMOJI[entry.investorRank] ?? '🎭'
  const pos = entry.position
  const isTop3 = pos <= 3

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: `${spacing.sm} ${spacing.md}`,
      marginBottom: '6px',
      borderRadius: '10px',
      background: entry.isMe
        ? `${colors.fairyGold}15`
        : isTop3 ? 'rgba(42,25,96,0.7)' : 'rgba(13,23,53,0.5)',
      border: `1px solid ${entry.isMe
        ? colors.fairyGold + '55'
        : isTop3 ? colors.fairyGold + '30' : colors.cardBorder}`,
    }}>
      {/* Position badge */}
      <div style={{
        width: '32px',
        textAlign: 'center',
        fontSize: isTop3 ? '22px' : '12px',
        fontWeight: 700,
        color: isTop3 ? colors.fairyGold : colors.textMuted,
        flexShrink: 0,
        lineHeight: 1,
      }}>
        {positionBadge(pos)}
      </div>

      {/* Name + rank */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: entry.isMe ? colors.fairyGold : isTop3 ? colors.textPrimary : colors.textSecondary,
          fontWeight: entry.isMe || isTop3 ? 700 : 500,
          fontSize: '13px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {displayName}{entry.isMe ? ' (вы)' : ''}
        </div>
        <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '2px' }}>
          {rankEmoji} {rankLabel} · день {entry.currentDay}
        </div>
      </div>

      {/* Total wealth + intuition */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          color: isTop3 ? colors.fairyGold : colors.textPrimary,
          fontWeight: 700,
          fontSize: '13px',
        }}>
          {Math.round(entry.totalWealth).toLocaleString('ru')} ₽
        </div>
        {entry.intuitionScore > 0 && (
          <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '1px' }}>
            🔮 {entry.intuitionScore}
          </div>
        )}
      </div>
    </div>
  )
}
