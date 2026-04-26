import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ScreenBackground, PAGE_BG } from '@/components/ScreenBackground'
import { SkeletonCard } from '@/components/FairyCard'
import { PageTitle } from '@/components/PageTitle'
import {
  api,
  type LeaderboardEntryDTO,
  type WeeklyLeaderboardEntryDTO,
  type ReferralLeaderboardEntryDTO,
} from '@/api/client'
import { colors, spacing } from '@/theme'

const RANK_EMOJI: Record<string, string> = {
  NEWBIE: '🎭',
  AMBASSADOR: '🛍️',
  ANALYST: '📚',
  SHARK: '🧥',
  LAMBO_SENSEI: '👑',
}

const RANK_LABEL: Record<string, string> = {
  NEWBIE: 'Скоморох',
  AMBASSADOR: 'Купец',
  ANALYST: 'Мудрец',
  SHARK: 'Боярин',
  LAMBO_SENSEI: 'Князь',
}

function positionBadge(pos: number) {
  if (pos === 1) return '🥇'
  if (pos === 2) return '🥈'
  if (pos === 3) return '🥉'
  return `#${pos}`
}

type Tab = 'all' | 'week' | 'referrals'

const TAB_LABELS: Record<Tab, string> = {
  all: '✦ Вечная слава',
  week: '🏪 Ярмарка недели',
  referrals: '🤝 Сваты',
}

export function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('all')

  return (
    <ScreenBackground bgImage={PAGE_BG.leaderboard}>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
          <PageTitle>Ярмарочный Рейтинг</PageTitle>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: spacing.lg,
          padding: '4px',
          background: 'rgba(10,8,24,0.7)',
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: '12px',
        }}>
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '8px 4px',
                background: tab === t ? `${colors.fairyGold}20` : 'transparent',
                border: `1px solid ${tab === t ? `${colors.fairyGold}60` : 'transparent'}`,
                borderRadius: '8px',
                color: tab === t ? colors.fairyGold : colors.textMuted,
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {tab === 'all' && <AllTimeTab />}
        {tab === 'week' && <WeekTab />}
        {tab === 'referrals' && <ReferralsTab />}
      </div>
    </ScreenBackground>
  )
}

// ─── Tabs ──────────────────────────────────────────────────────────────────

function AllTimeTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', 'all'],
    queryFn: api.leaderboard.get,
    refetchInterval: 60_000,
  })

  return (
    <>
      <Caption text={data ? `${data.totalPlayers} купцов в игре` : 'Купцы всего Лукоморья'} />
      {isLoading && [1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} lines={2} />)}
      {data?.entries.length === 0 && !isLoading && (
        <EmptyState icon="🏪" text="Пока никто не вышел на ярмарку" />
      )}
      {data?.entries.map((entry, i) => (
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
        <MyOutsidePos myPosition={data.myPosition} total={data.totalPlayers} hint="Копи злато — поднимайся выше!" />
      )}
    </>
  )
}

function WeekTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', 'week'],
    queryFn: api.leaderboard.getWeek,
    refetchInterval: 60_000,
  })

  return (
    <>
      <Caption text={
        data
          ? `${data.totalPlayers} купцов приумножили злато · неделя с ${formatDate(data.weekStart)}`
          : 'Прирост состояния с понедельника'
      } />
      {isLoading && [1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} lines={2} />)}
      {data?.entries.length === 0 && !isLoading && (
        <EmptyState icon="📅" text="На этой неделе никто ещё не заработал" />
      )}
      {data?.entries.map((entry, i) => (
        <motion.div
          key={entry.userId}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(i * 0.03, 0.6) }}
        >
          <WeeklyRow entry={entry} />
        </motion.div>
      ))}
      {data && data.myPosition && data.myPosition > 100 && (
        <MyOutsidePos myPosition={data.myPosition} total={data.totalPlayers} hint="Прокрути день — и тебя увидят!" />
      )}
    </>
  )
}

function ReferralsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', 'referrals'],
    queryFn: api.leaderboard.getReferrals,
    refetchInterval: 60_000,
  })

  return (
    <>
      <Caption text={
        data
          ? `${data.totalPlayers} купцов уже сватают на ярмарку`
          : 'Кто зазвал больше купцов на Русь'
      } />
      {isLoading && [1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} lines={2} />)}
      {data?.entries.length === 0 && !isLoading && (
        <EmptyState icon="🤝" text="Сватов пока не нашлось — будь первым" />
      )}
      {data?.entries.map((entry, i) => (
        <motion.div
          key={entry.userId}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(i * 0.03, 0.6) }}
        >
          <ReferralRow entry={entry} />
        </motion.div>
      ))}
      {data && data.myPosition && data.myPosition > 100 && (
        <MyOutsidePos myPosition={data.myPosition} total={data.totalPlayers} hint="Пригласи купца — и попадёшь в топ!" />
      )}
    </>
  )
}

// ─── Row variants ──────────────────────────────────────────────────────────

function LeaderboardRow({ entry }: { entry: LeaderboardEntryDTO }) {
  return (
    <BaseRow
      entry={entry}
      rightTop={`${Math.round(entry.totalWealth).toLocaleString('ru')} ₽`}
      rightBottom={entry.intuitionScore > 0 ? `👁 ${entry.intuitionScore}` : null}
    />
  )
}

function WeeklyRow({ entry }: { entry: WeeklyLeaderboardEntryDTO }) {
  return (
    <BaseRow
      entry={entry}
      rightTop={<span style={{ color: colors.success }}>+{Math.round(entry.weekDelta).toLocaleString('ru')} ₽</span>}
      rightBottom={`всего: ${Math.round(entry.totalWealth).toLocaleString('ru')} ₽`}
    />
  )
}

function ReferralRow({ entry }: { entry: ReferralLeaderboardEntryDTO }) {
  return (
    <BaseRow
      entry={{
        userId: entry.userId,
        firstName: entry.firstName,
        username: entry.username,
        investorRank: entry.investorRank,
        currentDay: 0,
        intuitionScore: 0,
        totalWealth: 0,
        isMe: entry.isMe,
        position: entry.position,
      }}
      hideRankDay
      rightTop={`🤝 ${entry.referralCount} куп${pluralizeCup(entry.referralCount)}`}
      rightBottom={null}
    />
  )
}

function BaseRow({
  entry, rightTop, rightBottom, hideRankDay,
}: {
  entry: LeaderboardEntryDTO
  rightTop: React.ReactNode
  rightBottom: React.ReactNode
  hideRankDay?: boolean
}) {
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

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: entry.isMe ? colors.fairyGold : isTop3 ? colors.textPrimary : colors.textSecondary,
          fontWeight: entry.isMe || isTop3 ? 700 : 500,
          fontSize: '13px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {displayName}{entry.isMe ? ' (вы)' : ''}
        </div>
        {!hideRankDay && (
          <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '2px' }}>
            {rankEmoji} {rankLabel} · день {entry.currentDay}
          </div>
        )}
        {hideRankDay && (
          <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '2px' }}>
            {rankEmoji} {rankLabel}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          color: isTop3 ? colors.fairyGold : colors.textPrimary,
          fontWeight: 700,
          fontSize: '13px',
        }}>
          {rightTop}
        </div>
        {rightBottom && (
          <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '1px' }}>
            {rightBottom}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bits ──────────────────────────────────────────────────────────────────

function Caption({ text }: { text: string }) {
  return (
    <div style={{ color: colors.textMuted, fontSize: '11px', textAlign: 'center', marginBottom: spacing.md }}>
      {text}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl }}>
      <div style={{ fontSize: '32px', marginBottom: spacing.sm }}>{icon}</div>
      <div>{text}</div>
    </div>
  )
}

function MyOutsidePos({ myPosition, total, hint }: { myPosition: number; total: number; hint: string }) {
  return (
    <div style={{
      marginTop: spacing.lg,
      padding: `${spacing.sm} ${spacing.md}`,
      background: `${colors.fairyGold}12`,
      border: `1px solid ${colors.fairyGold}30`,
      borderRadius: '10px',
      textAlign: 'center',
    }}>
      <div style={{ color: colors.fairyGold, fontSize: '13px' }}>
        Ваше место: #{myPosition} из {total}
      </div>
      <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>{hint}</div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function pluralizeCup(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return 'цов'
  if (mod10 === 1) return 'ец'
  if (mod10 >= 2 && mod10 <= 4) return 'ца'
  return 'цов'
}
