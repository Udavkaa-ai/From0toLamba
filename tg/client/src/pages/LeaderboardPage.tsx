import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ScreenBackground, PAGE_BG } from '@/components/ScreenBackground'
import { SkeletonCard } from '@/components/FairyCard'
import { PageTitle } from '@/components/PageTitle'
import {
  api,
  type LeaderboardEntryDTO,
  type AchievementLeaderboardEntryDTO,
  type ReferralLeaderboardEntryDTO,
  type TiesLeaderboardEntryDTO,
} from '@/api/client'
import { colors, spacing } from '@/theme'
import { useT } from '@/i18n'

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

// С версии 4 «чуйка» убрана из игры — вкладка intuition больше не используется,
// в т.ч. строка переключателя её не показывает.
type Tab = 'wealth' | 'days' | 'deals' | 'referrals' | 'ties'

export function LeaderboardPage() {
  const t = useT()
  const [tab, setTab] = useState<Tab>('wealth')
  // Фильтруем — intuition больше не существует
  const tabKeys = (Object.keys(t.leaderboard.tabs) as Tab[]).filter(k => k !== ('intuition' as any))

  return (
    <ScreenBackground bgImage={PAGE_BG.leaderboard}>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
          <PageTitle>{t.leaderboard.title}</PageTitle>
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
          {tabKeys.map(key => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1,
                padding: '8px 4px',
                background: tab === key ? `${colors.fairyGold}20` : 'transparent',
                border: `1px solid ${tab === key ? colors.fairyGold + '60' : 'transparent'}`,
                borderRadius: '8px',
                color: tab === key ? colors.fairyGold : colors.textMuted,
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t.leaderboard.tabs[key]}
            </button>
          ))}
        </div>

        {tab === 'wealth' && <MoneyTab />}
        {tab === 'days' && <DaysTab />}
        {tab === 'deals' && <AchievementsTab />}
        {tab === 'referrals' && <ReferralsTab />}
        {tab === 'ties' && <TiesTab />}
      </div>
    </ScreenBackground>
  )
}

// ─── Tabs ──────────────────────────────────────────────────────────────────

function ShowAllButton({ onClick }: { onClick: () => void }) {
  const t = useT()
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', marginTop: spacing.sm,
        padding: '10px',
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: '10px',
        color: colors.textMuted,
        fontSize: '12px', fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {t.leaderboard.showAll}
    </button>
  )
}

function MoneyTab() {
  const t = useT()
  const [showAll, setShowAll] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', 'wealth'],
    queryFn: api.leaderboard.get,
    refetchInterval: 60_000,
  })
  const entries = showAll ? data?.entries : data?.entries.slice(0, 5)

  return (
    <>
      <Caption description={t.leaderboard.captions.wealth} totalPlayers={data?.totalPlayers} totalAllPlayers={data?.totalAllPlayers} />
      {isLoading && [1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} lines={2} />)}
      {entries?.length === 0 && !isLoading && <EmptyState icon="💰" text={t.leaderboard.empty.wealth} />}
      {entries?.map((entry, i) => (
        <motion.div key={entry.userId} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
          <LeaderboardRow entry={entry} />
        </motion.div>
      ))}
      {data && data.myPosition && data.myPosition > (showAll ? data.entries.length : 5) && (
        <MyOutsidePos myPosition={data.myPosition} total={data.totalPlayers} hint={t.leaderboard.hints.wealth} />
      )}
      {!showAll && data && data.entries.length > 5 && <ShowAllButton onClick={() => setShowAll(true)} />}
    </>
  )
}

function IntuitionTab() {
  const t = useT()
  const [showAll, setShowAll] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', 'intuition'],
    queryFn: api.leaderboard.getByIntuition,
    refetchInterval: 60_000,
  })
  const entries = showAll ? data?.entries : data?.entries.slice(0, 5)

  return (
    <>
      <Caption description={t.leaderboard.captions.intuition} totalPlayers={data?.totalPlayers} />
      {isLoading && [1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} lines={2} />)}
      {entries?.length === 0 && !isLoading && <EmptyState icon="👁" text={t.leaderboard.empty.intuition} />}
      {entries?.map((entry, i) => (
        <motion.div key={entry.userId} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
          <IntuitionRow entry={entry} />
        </motion.div>
      ))}
      {data && data.myPosition && data.myPosition > (showAll ? data.entries.length : 5) && (
        <MyOutsidePos myPosition={data.myPosition} total={data.totalPlayers} hint={t.leaderboard.hints.intuition} />
      )}
      {!showAll && data && data.entries.length > 5 && <ShowAllButton onClick={() => setShowAll(true)} />}
    </>
  )
}

function DaysTab() {
  const t = useT()
  const [showAll, setShowAll] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', 'days'],
    queryFn: api.leaderboard.getByDays,
    refetchInterval: 60_000,
  })
  const entries = showAll ? data?.entries : data?.entries.slice(0, 5)

  return (
    <>
      <Caption description={t.leaderboard.captions.days} totalPlayers={data?.totalPlayers} />
      {isLoading && [1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} lines={2} />)}
      {entries?.length === 0 && !isLoading && <EmptyState icon="📅" text={t.leaderboard.empty.days} />}
      {entries?.map((entry, i) => (
        <motion.div key={entry.userId} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
          <DaysRow entry={entry} />
        </motion.div>
      ))}
      {data && data.myPosition && data.myPosition > (showAll ? data.entries.length : 5) && (
        <MyOutsidePos myPosition={data.myPosition} total={data.totalPlayers} hint={t.leaderboard.hints.days} />
      )}
      {!showAll && data && data.entries.length > 5 && <ShowAllButton onClick={() => setShowAll(true)} />}
    </>
  )
}

function AchievementsTab() {
  const t = useT()
  const [showAll, setShowAll] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', 'deals'],
    queryFn: api.leaderboard.getByAchievements,
    refetchInterval: 60_000,
  })
  const entries = showAll ? data?.entries : data?.entries.slice(0, 5)

  return (
    <>
      <Caption description={t.leaderboard.captions.deals} totalPlayers={data?.totalPlayers} />
      {isLoading && [1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} lines={2} />)}
      {entries?.length === 0 && !isLoading && <EmptyState icon="🎯" text={t.leaderboard.empty.deals} />}
      {entries?.map((entry, i) => (
        <motion.div key={entry.userId} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
          <AchievementRow entry={entry} />
        </motion.div>
      ))}
      {data && data.myPosition && data.myPosition > (showAll ? data.entries.length : 5) && (
        <MyOutsidePos myPosition={data.myPosition} total={data.totalPlayers} hint={t.leaderboard.hints.deals} />
      )}
      {!showAll && data && data.entries.length > 5 && <ShowAllButton onClick={() => setShowAll(true)} />}
    </>
  )
}

function ReferralsTab() {
  const t = useT()
  const [showAll, setShowAll] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', 'referrals'],
    queryFn: api.leaderboard.getReferrals,
    refetchInterval: 60_000,
  })
  const entries = showAll ? data?.entries : data?.entries.slice(0, 5)

  return (
    <>
      <Caption description={t.leaderboard.captions.referrals} totalPlayers={data?.totalPlayers} />
      {isLoading && [1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} lines={2} />)}
      {entries?.length === 0 && !isLoading && <EmptyState icon="🤝" text={t.leaderboard.empty.referrals} />}
      {entries?.map((entry, i) => (
        <motion.div key={entry.userId} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
          <ReferralRow entry={entry} />
        </motion.div>
      ))}
      {data && data.myPosition && data.myPosition > (showAll ? data.entries.length : 5) && (
        <MyOutsidePos myPosition={data.myPosition} total={data.totalPlayers} hint={t.leaderboard.hints.referrals} />
      )}
      {!showAll && data && data.entries.length > 5 && <ShowAllButton onClick={() => setShowAll(true)} />}
    </>
  )
}

function TiesTab() {
  const t = useT()
  const [showAll, setShowAll] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', 'ties'],
    queryFn: api.leaderboard.getTies,
    refetchInterval: 60_000,
  })
  const entries = showAll ? data?.entries : data?.entries.slice(0, 5)

  return (
    <>
      <Caption description={t.leaderboard.captions.ties} totalPlayers={data?.totalPlayers} />
      {isLoading && [1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} lines={2} />)}
      {entries?.length === 0 && !isLoading && <EmptyState icon="⚡" text={t.leaderboard.empty.ties} />}
      {entries?.map((entry, i) => (
        <motion.div key={entry.userId} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
          <TiesRow entry={entry} />
        </motion.div>
      ))}
      {data && data.myPosition && data.myPosition > (showAll ? data.entries.length : 5) && (
        <MyOutsidePos myPosition={data.myPosition} total={data.totalPlayers} hint={t.leaderboard.hints.ties} />
      )}
      {!showAll && data && data.entries.length > 5 && <ShowAllButton onClick={() => setShowAll(true)} />}
    </>
  )
}

// ─── Row variants ──────────────────────────────────────────────────────────

function LeaderboardRow({ entry }: { entry: LeaderboardEntryDTO }) {
  return (
    <BaseRow
      entry={entry}
      rightTop={`${Math.round(entry.totalWealth).toLocaleString('ru')} г`}
      rightBottom={null}
    />
  )
}

function IntuitionRow({ entry }: { entry: LeaderboardEntryDTO }) {
  return (
    <BaseRow
      entry={entry}
      rightTop={<span style={{ color: colors.fairyGold }}>👁 {entry.intuitionScore}</span>}
      rightBottom={`${Math.round(entry.totalWealth).toLocaleString('ru')} г`}
    />
  )
}

function DaysRow({ entry }: { entry: LeaderboardEntryDTO }) {
  const t = useT()
  return (
    <BaseRow
      entry={entry}
      rightTop={t.leaderboard.days(entry.currentDay)}
      rightBottom={null}
      hideDayInSub
    />
  )
}

function AchievementRow({ entry }: { entry: AchievementLeaderboardEntryDTO }) {
  const t = useT()
  return (
    <BaseRow
      entry={entry}
      rightTop={`📦 ${t.leaderboard.investments(entry.closedProjectsCount)}`}
      rightBottom={t.leaderboard.charters(entry.chartersSubmitted)}
    />
  )
}

function ReferralRow({ entry }: { entry: ReferralLeaderboardEntryDTO }) {
  const t = useT()
  const displayName = entry.username ? `@${entry.username}` : entry.firstName
  const rankLabel = RANK_LABEL[entry.investorRank] ?? entry.investorRank
  const rankEmoji = RANK_EMOJI[entry.investorRank] ?? '🎭'
  const pos = entry.position
  const isTop3 = pos <= 3

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: `${spacing.sm} ${spacing.md}`, marginBottom: '6px',
      borderRadius: '10px',
      background: entry.isMe ? `${colors.fairyGold}15` : isTop3 ? 'rgba(42,25,96,0.7)' : 'rgba(13,23,53,0.5)',
      border: `1px solid ${entry.isMe ? colors.fairyGold + '55' : isTop3 ? colors.fairyGold + '30' : colors.cardBorder}`,
    }}>
      <div style={{ width: '32px', textAlign: 'center', fontSize: isTop3 ? '22px' : '12px', fontWeight: 700, color: isTop3 ? colors.fairyGold : colors.textMuted, flexShrink: 0, lineHeight: 1 }}>
        {positionBadge(pos)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: entry.isMe ? colors.fairyGold : isTop3 ? colors.textPrimary : colors.textSecondary, fontWeight: entry.isMe || isTop3 ? 700 : 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}{entry.isMe ? ' (вы)' : ''}
        </div>
        <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '2px' }}>
          {rankEmoji} {rankLabel}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: isTop3 ? colors.fairyGold : colors.textPrimary, fontWeight: 700, fontSize: '13px' }}>
          {t.leaderboard.refs(entry.referralCount)}
        </div>
      </div>
    </div>
  )
}

function TiesRow({ entry }: { entry: TiesLeaderboardEntryDTO }) {
  const t = useT()
  const displayName = entry.username ? `@${entry.username}` : entry.firstName
  const rankLabel = RANK_LABEL[entry.investorRank] ?? entry.investorRank
  const rankEmoji = RANK_EMOJI[entry.investorRank] ?? '🎭'
  const pos = entry.position
  const isTop3 = pos <= 3

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: `${spacing.sm} ${spacing.md}`, marginBottom: '6px',
      borderRadius: '10px',
      background: entry.isMe ? `${colors.fairyGold}15` : isTop3 ? 'rgba(42,25,96,0.7)' : 'rgba(13,23,53,0.5)',
      border: `1px solid ${entry.isMe ? colors.fairyGold + '55' : isTop3 ? colors.fairyGold + '30' : colors.cardBorder}`,
    }}>
      <div style={{ width: '32px', textAlign: 'center', fontSize: isTop3 ? '22px' : '12px', fontWeight: 700, color: isTop3 ? colors.fairyGold : colors.textMuted, flexShrink: 0, lineHeight: 1 }}>
        {positionBadge(pos)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: entry.isMe ? colors.fairyGold : isTop3 ? colors.textPrimary : colors.textSecondary, fontWeight: entry.isMe || isTop3 ? 700 : 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}{entry.isMe ? ' (вы)' : ''}
        </div>
        <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '2px' }}>
          {rankEmoji} {rankLabel}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: isTop3 ? colors.fairyGold : colors.textPrimary, fontWeight: 700, fontSize: '13px' }}>
          {t.leaderboard.ties(entry.tiesTotal)}
        </div>
      </div>
    </div>
  )
}

function BaseRow({
  entry, rightTop, rightBottom, hideRankDay, hideDayInSub,
}: {
  entry: LeaderboardEntryDTO
  rightTop: React.ReactNode
  rightBottom: React.ReactNode
  hideRankDay?: boolean
  hideDayInSub?: boolean
}) {
  const t = useT()
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
            {rankEmoji} {rankLabel}{!hideDayInSub ? ` · ${t.leaderboard.days(entry.currentDay)}` : ''}
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

function Caption({ description, totalPlayers, totalAllPlayers }: { description: string; totalPlayers?: number; totalAllPlayers?: number }) {
  const t = useT()
  const displayCount = totalAllPlayers ?? totalPlayers
  return (
    <div style={{ textAlign: 'center', marginBottom: spacing.md }}>
      <div style={{ color: colors.fairyGold, fontSize: '12px', fontWeight: 600, opacity: 0.85 }}>{description}</div>
      {displayCount !== undefined && (
        <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '2px' }}>{t.leaderboard.badge(displayCount)}</div>
      )}
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
  const t = useT()
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
        {t.leaderboard.yourPlace(myPosition, total)}
      </div>
      <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>{hint}</div>
    </div>
  )
}
