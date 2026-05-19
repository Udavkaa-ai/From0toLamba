import { useState, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ComposedChart, AreaChart, Area, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { ScreenBackground, PAGE_BG } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider, SkeletonCard } from '@/components/FairyCard'
import { PageTitle, PageSubtitle } from '@/components/PageTitle'
import { LockIcon } from '@/components/icons'
import { api, type ProjectDTO, type PostMortemDTO, type DailyUpdateDTO, type TransactionDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing, typography, gradients, ctaButton, bigNumber } from '@/theme'
import { CountUp } from '@/components/CountUp'
import { useT } from '@/i18n'

/** Конкретная подсказка для вывода: сумма в г, а не просто «25%». */
function withdrawalHint(project: ProjectDTO, t: ReturnType<typeof useT>): string | null {
  switch (project.type) {
    case 'POTION_BREW':
    case 'GUILD_SCHEME': {
      const maxRubles = Math.floor(project.currentValueRubles * 0.25)
      return t.portfolio.withdrawLimit25(maxRubles)
    }
    case 'CARD_GAME':
    case 'TREASURE_HUNT':
      return t.portfolio.withdrawFeeCard
    case 'HONEST_TRADE':
      return t.portfolio.withdrawFeeNone
    default:
      return null
  }
}

export function PortfolioPage() {
  const t = useT()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: api.projects.getPortfolio,
    refetchInterval: 15_000,
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: api.projects.getTransactions,
    refetchInterval: 30_000,
  })

  return (
    <ScreenBackground bgImage={PAGE_BG.portfolio}>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
          <PageTitle>{t.portfolio.title}</PageTitle>
          <PageSubtitle>{t.portfolio.subtitle}</PageSubtitle>
        </div>

        {isLoading && [1, 2].map(i => <SkeletonCard key={i} lines={5} />)}

        {/* Активные */}
        {data?.active && data.active.length > 0 && (
          <section>
            <div style={{
              color: colors.fairyGold, fontSize: '13px', fontWeight: 700, marginBottom: spacing.sm,
              textShadow: '0 1px 4px rgba(0,0,0,0.65), 0 0 8px rgba(0,0,0,0.4)',
            }}>
              {t.portfolio.tabActive}
            </div>
            {data.active.map((p, i) => (
              <div
                key={p.id}
                {...(i === 0 ? { 'data-tour': 'portfolio-project' } : {})}
              >
                <ActiveProjectCard project={p} tourFirst={i === 0} />
              </div>
            ))}
          </section>
        )}

        {data?.active?.length === 0 && !isLoading && (
          <FairyCard style={{ textAlign: 'center', marginBottom: spacing.lg }}>
            <div style={{ fontSize: '32px', marginBottom: spacing.sm }}>🏚️</div>
            <div style={{ color: colors.textSecondary }}>{t.portfolio.empty}</div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
              {t.portfolio.emptyHint}
            </div>
          </FairyCard>
        )}

        {/* Закрытые (только те, куда вкладывался) */}
        {data?.closed && data.closed.filter(p => p.investedAmountRubles > 0).length > 0 && (
          <section style={{ marginTop: spacing.xl }}>
            <div style={{ color: colors.textMuted, fontSize: '13px', fontWeight: 600, marginBottom: spacing.sm }}>
              {t.portfolio.tabHistory}
            </div>
            {data.closed.filter(p => p.investedAmountRubles > 0).slice(0, 3).map((p) => (
              <div key={p.id}>
                <ClosedProjectCard project={p} postMortem={p.postMortem} />
              </div>
            ))}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/registry')}
              style={{
                ...ctaButton.lg,
                width: '100%', marginTop: spacing.sm,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>📜</span>
              <span>{t.registry.title}</span>
              {data.closed.filter(p => p.investedAmountRubles > 0).length > 3 && (
                <span style={{ fontSize: '11px', opacity: 0.7, fontWeight: 400 }}>
                  (+{data.closed.filter(p => p.investedAmountRubles > 0).length - 3} ещё)
                </span>
              )}
            </motion.button>
          </section>
        )}

        {/* Движение средств — свёрнуто по умолчанию */}
        <TransactionSection transactions={transactions} />
      </div>
    </ScreenBackground>
  )
}

function NewsItem({ update }: { update: DailyUpdateDTO }) {
  const t = useT()
  const [expanded, setExpanded] = useState(false)

  // Случайное событие имеет приоритет в подсветке: красный/зелёный/серый ромб.
  // Иначе — обычный сигнал по payoutStatus / userCountDelta.
  let signal = '⚪'
  let signalColor: string = colors.textMuted
  if (update.eventKind === 'NEGATIVE') { signal = '◆'; signalColor = colors.danger }
  else if (update.eventKind === 'POSITIVE') { signal = '◆'; signalColor = colors.success }
  else if (update.eventKind === 'NEUTRAL') { signal = '◇'; signalColor = colors.fairyGold }
  else if (update.payoutStatus === 'BOOSTED' || update.userCountDelta > 5) { signal = '●'; signalColor = colors.success }
  else if (update.payoutStatus === 'DELAYED' || update.userCountDelta < -5) { signal = '●'; signalColor = colors.danger }

  const isEvent = !!update.eventKind
  const eventBorder = update.eventKind === 'NEGATIVE'
    ? `${colors.danger}50`
    : update.eventKind === 'POSITIVE'
      ? `${colors.success}50`
      : update.eventKind === 'NEUTRAL'
        ? `${colors.fairyGold}40`
        : colors.cardBorder

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '6px 8px',
        borderRadius: '6px',
        background: isEvent ? 'rgba(42, 25, 96, 0.5)' : 'rgba(42, 25, 96, 0.3)',
        marginBottom: '4px',
        cursor: 'pointer',
        border: `1px solid ${eventBorder}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '12px', color: signalColor, lineHeight: 1 }}>{signal}</span>
        <span style={{
          color: isEvent ? colors.textPrimary : colors.textSecondary,
          fontWeight: isEvent ? 600 : 400,
          fontSize: '11px', flex: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {update.title}
        </span>
        {update.redFlags.length > 0 && (
          <span style={{ color: colors.warning, fontSize: '10px', flexShrink: 0 }}>
            {t.portfolio.redFlags(update.redFlags.length)}
          </span>
        )}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: '6px', color: colors.textMuted, fontSize: '11px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
              {update.body}
            </div>
            {update.redFlags.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                {update.redFlags.map((flag, i) => (
                  <div key={i} style={{ color: colors.warning, fontSize: '10px' }}>⚠️ {flag}</div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MiniValueChart({ valueHistory, userCountHistory, userCount, invested }: {
  valueHistory: number[]
  userCountHistory: number[]
  userCount: number
  invested: number
}) {
  const t = useT()
  const uid = useId()
  if (valueHistory.length < 2) return null
  const len = Math.max(valueHistory.length, userCountHistory.length)
  const data = Array.from({ length: len }, (_, i) => ({
    i,
    val: valueHistory[i] ?? null,
    users: userCountHistory[i] ?? null,
  }))
  const last = valueHistory[valueHistory.length - 1]
  const color = last > invested ? '#50C878' : last < invested * 0.98 ? '#E34234' : '#FFB800'
  const gradId = `vg-${uid.replace(/:/g, '')}`

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={{ color: '#aaa', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.portfolio.chartTitle}</span>
        <span style={{ color: '#4a9eff', fontSize: '9px' }}>👥 {userCount} {t.common.investors}</span>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <ComposedChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis yAxisId="val" hide domain={['auto', 'auto']} />
          <YAxis yAxisId="users" hide orientation="right" domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#0D1735', border: 'none', borderRadius: '6px', fontSize: '10px', color: '#C8C8FF' }}
            formatter={(v: number, name: string) => name === 'val' ? [`${Math.floor(v)} ${t.common.currency}`, t.portfolio.valueLabel] : [`${v} чел.`, 'Вкладчики']}
            labelFormatter={(l: number) => `${t.common.day} ${l + 1}`}
          />
          <Area yAxisId="val" type="monotone" dataKey="val" stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
          <Line yAxisId="users" type="monotone" dataKey="users" stroke="#4a9eff" strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </>
  )
}

function ActiveProjectCard({ project, tourFirst }: { project: ProjectDTO; tourFirst?: boolean }) {
  const t = useT()
  const qc = useQueryClient()
  const { gameState, updateBalance } = useGameStore()
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showAddInvest, setShowAddInvest] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [addAmount, setAddAmount] = useState('')
  const [confirmExit, setConfirmExit] = useState(false)

  const { data: updates } = useQuery({
    queryKey: ['updates', project.id],
    queryFn: () => api.projects.getUpdates(project.id),
    refetchInterval: 30_000,
  })

  // Сервер возвращает orderBy { day: 'desc' } — новейшие в начале массива.
  // Берём 3 свежайшие; внутри блока показываем сверху самую свежую.
  const recentUpdates = (updates ?? []).slice(0, 3)

  // Честный profit% — со знаменателем = всё-вложенное за всё время. Иначе
  // после частичных выводов `investedAmountRubles` (текущий принципал)
  // уменьшается, и формула искажает реальность. См. ProjectDTO.totalInvestedRubles.
  const totalInvested = project.totalInvestedRubles ?? project.investedAmountRubles
  const profit = totalInvested > 0
    ? ((project.currentValueRubles + (project.totalWithdrawnRubles ?? 0) - totalInvested) / totalInvested * 100)
    : 0

  const portfolioHaptic = (window as any).Telegram?.WebApp?.HapticFeedback

  const exitMutation = useMutation({
    mutationFn: () => api.invest.exit(project.id),
    onSuccess: () => {
      portfolioHaptic?.notificationOccurred('success')
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      qc.invalidateQueries({ queryKey: ['gameState'] })
    },
    onError: () => portfolioHaptic?.notificationOccurred('error'),
  })

  const withdrawMutation = useMutation({
    mutationFn: () => api.invest.withdraw(project.id, Number(withdrawAmount)),
    onSuccess: () => {
      portfolioHaptic?.notificationOccurred('success')
      setShowWithdraw(false)
      setWithdrawAmount('')
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      qc.invalidateQueries({ queryKey: ['gameState'] })
    },
    onError: () => portfolioHaptic?.notificationOccurred('error'),
  })

  const addInvestMutation = useMutation({
    mutationFn: () => api.invest.addInvestment(project.id, Number(addAmount)),
    onSuccess: () => {
      portfolioHaptic?.notificationOccurred('success')
      updateBalance(-Number(addAmount))
      setShowAddInvest(false)
      setAddAmount('')
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      qc.invalidateQueries({ queryKey: ['gameState'] })
    },
    onError: () => portfolioHaptic?.notificationOccurred('error'),
  })

  const hasValueHistory = project.valueHistory.length > 1

  return (
    <FairyCard style={{ marginBottom: spacing.md }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: colors.fairyGold, fontWeight: 700 }}>{project.name}</div>
          <div style={{ color: colors.textMuted, fontSize: '11px' }}>{project.developerName} · {project.daysSinceJoined} {t.common.days}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: colors.textMuted, fontSize: '10px', letterSpacing: '0.02em' }}>
            {t.portfolio.investedIn} {Math.floor(totalInvested)} {t.common.currency}
          </div>
          <div style={{ ...bigNumber(22), marginTop: '2px' }}>
            <CountUp value={project.currentValueRubles} /> {t.common.currency}
          </div>
          <div style={{ color: profit >= 0 ? colors.success : colors.danger, fontSize: '12px', fontWeight: 600 }}>
            {profit >= 0 ? '+' : ''}{profit.toFixed(1)}%
          </div>
        </div>
      </div>

      {project.isWithdrawalLocked && (
        <div style={{ marginTop: spacing.sm, color: colors.warning, fontSize: '12px', padding: '4px 8px', background: `${colors.warning}15`, borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <LockIcon size={14} /> {t.home.activeCardLocked}
        </div>
      )}

      {/* Mini chart */}
      {hasValueHistory && (
        <>
          <OrnamentDivider />
          <MiniValueChart valueHistory={project.valueHistory} userCountHistory={project.userCountHistory} userCount={project.currentUserCount} invested={project.investedAmountRubles} />
        </>
      )}

      {/* News section */}
      {recentUpdates.length > 0 && (
        <>
          <OrnamentDivider />
          <div style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>
            {t.portfolio.newsTitle}
          </div>
          {recentUpdates.map(u => (
            <NewsItem key={u.id} update={u} />
          ))}
        </>
      )}

      <OrnamentDivider />

      {/* Action buttons */}
      <div data-tour={tourFirst ? 'portfolio-actions' : undefined} style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
        {!project.isWithdrawalLocked && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.1 }}
            onClick={() => { setShowAddInvest(!showAddInvest); setShowWithdraw(false) }}
            style={{ ...ctaButton.md, flex: 1 }}
          >
            {t.portfolio.addBtn}
          </motion.button>
        )}
        {!project.isWithdrawalLocked && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.1 }}
            onClick={() => { setShowWithdraw(!showWithdraw); setShowAddInvest(false) }}
            style={{
              flex: 1, padding: '9px 8px',
              background: 'rgba(255,255,255,0.5)',
              border: `1.5px solid ${colors.cardBorder}`, borderRadius: '10px',
              color: colors.textPrimary, cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            }}
          >
            {t.portfolio.withdrawBtn}
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.96 }}
          transition={{ duration: 0.1 }}
          onClick={() => { setConfirmExit(true); setShowWithdraw(false); setShowAddInvest(false) }}
          disabled={exitMutation.isPending || project.isWithdrawalLocked}
          style={{
            flex: 1, padding: '9px 8px',
            background: `linear-gradient(180deg, #C44A3F 0%, #8A2620 100%)`,
            border: `1px solid #6A1A14`, borderRadius: '10px',
            color: project.isWithdrawalLocked ? colors.textMuted : '#FFFFFF',
            cursor: project.isWithdrawalLocked ? 'not-allowed' : 'pointer',
            fontSize: '12px', fontWeight: 700,
            boxShadow: `0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,200,200,0.3)`,
            opacity: project.isWithdrawalLocked ? 0.45 : 1,
          }}
        >
          {t.portfolio.exitBtn}
        </motion.button>
      </div>

      {/* Подтверждение выхода из дела — чтобы не нажать случайно */}
      <AnimatePresence>
        {confirmExit && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: spacing.md,
              padding: spacing.md,
              background: `${colors.danger}10`,
              border: `1px solid ${colors.danger}50`,
              borderRadius: '10px',
            }}>
              <div style={{ color: colors.textPrimary, fontSize: '13px', marginBottom: spacing.sm }}>
                {t.portfolio.exitConfirm(
                  Math.floor(project.currentValueRubles * (1 - (project.type === 'CARD_GAME' || project.type === 'TREASURE_HUNT' ? 0.25 : 0)))
                )}
              </div>
              <div style={{ display: 'flex', gap: spacing.sm }}>
                <button
                  onClick={() => setConfirmExit(false)}
                  style={{
                    flex: 1, padding: '8px',
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${colors.cardBorder}`, borderRadius: '8px',
                    color: colors.textSecondary, fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={() => { exitMutation.mutate(); setConfirmExit(false) }}
                  disabled={exitMutation.isPending}
                  style={{
                    flex: 1, padding: '8px',
                    background: colors.danger, border: 'none', borderRadius: '8px',
                    color: '#fff', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer',
                    opacity: exitMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {exitMutation.isPending ? t.common.loading : t.portfolio.exitBtn}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {withdrawalHint(project, t) && (
        <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '4px' }}>
          ℹ️ {withdrawalHint(project, t)}
        </div>
      )}

      {/* Add investment input */}
      <AnimatePresence>
        {showAddInvest && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginTop: spacing.md }}>
              <div style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '4px' }}>
                {t.portfolio.addBalance(Math.floor(gameState?.balance ?? 0))}
              </div>
              <input
                type="number"
                value={addAmount}
                onChange={e => setAddAmount(e.target.value)}
                placeholder={t.portfolio.addBtn}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(42, 25, 96, 0.4)', border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '8px', padding: '8px', color: colors.textPrimary,
                  fontSize: '14px', outline: 'none',
                }}
              />
              {addInvestMutation.isError && (
                <div style={{ color: colors.danger, fontSize: '11px', marginTop: '4px' }}>
                  {(addInvestMutation.error as Error).message}
                </div>
              )}
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.1 }}
                onClick={() => addInvestMutation.mutate()}
                disabled={!addAmount || addInvestMutation.isPending}
                style={{
                  width: '100%', marginTop: spacing.sm,
                  padding: '9px', background: gradients.cta,
                  border: `1px solid ${colors.ctaBorder}`, borderRadius: '10px',
                  color: colors.ctaText, fontWeight: 700, cursor: 'pointer', fontSize: '13px',
                  boxShadow: `0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,235,170,0.4)`,
                }}
              >
                {addInvestMutation.isPending ? t.common.loading : t.portfolio.confirmAdd}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdraw input */}
      <AnimatePresence>
        {showWithdraw && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginTop: spacing.md }}>
              <div style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '4px' }}>
                {t.portfolio.withdrawValue(Math.floor(project.currentValueRubles), Math.floor(gameState?.balance ?? 0))}
              </div>
              {(project.type === 'POTION_BREW' || project.type === 'GUILD_SCHEME') && (
                <div style={{ color: colors.warning, fontSize: '11px', marginBottom: '4px' }}>
                  ⚠️ {t.portfolio.withdrawLimit25(Math.floor(project.currentValueRubles * 0.25))}
                </div>
              )}
              {(project.type === 'CARD_GAME' || project.type === 'TREASURE_HUNT') && (
                <div style={{ color: colors.warning, fontSize: '11px', marginBottom: '4px' }}>
                  {t.portfolio.withdrawFeeHint}
                </div>
              )}
              <input
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder={t.portfolio.withdrawBtn}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(42, 25, 96, 0.4)', border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '8px', padding: '8px', color: colors.textPrimary,
                  fontSize: '14px', outline: 'none',
                }}
              />
              {Number(withdrawAmount) > 0 && (project.type === 'CARD_GAME' || project.type === 'TREASURE_HUNT') && (
                <div style={{ color: colors.success, fontSize: '12px', marginTop: '6px' }}>
                  {t.portfolio.withdrawPayout(Math.floor(Number(withdrawAmount) * 0.75), Math.floor(Number(withdrawAmount) * 0.25))}
                </div>
              )}
              {withdrawMutation.isError && (
                <div style={{ color: colors.danger, fontSize: '11px', marginTop: '4px' }}>
                  {(withdrawMutation.error as Error).message}
                </div>
              )}
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.1 }}
                onClick={() => withdrawMutation.mutate()}
                disabled={!withdrawAmount || withdrawMutation.isPending}
                style={{
                  width: '100%', marginTop: spacing.sm,
                  padding: '9px', background: gradients.cta,
                  border: `1px solid ${colors.ctaBorder}`, borderRadius: '10px',
                  color: colors.ctaText, fontWeight: 700, cursor: 'pointer', fontSize: '13px',
                  boxShadow: `0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,235,170,0.4)`,
                }}
              >
                {t.portfolio.confirmWithdraw}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FairyCard>
  )
}

function ClosedProjectCard({ project, postMortem }: { project: ProjectDTO; postMortem: PostMortemDTO | null }) {
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const profit = postMortem ? postMortem.profitPercent : 0

  return (
    <FairyCard
      onClick={() => setExpanded(!expanded)}
      style={{ marginBottom: spacing.sm, opacity: 0.75, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: colors.textSecondary, fontWeight: 600, fontSize: '13px' }}>{project.name}</div>
          {postMortem && (
            <div style={{ color: colors.textMuted, fontSize: '11px' }}>
              {t.portfolio.fates[postMortem.fate as keyof typeof t.portfolio.fates] ?? t.fates[postMortem.fate as keyof typeof t.fates] ?? postMortem.fate}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: profit >= 0 ? colors.success : colors.danger, fontSize: '12px', fontWeight: 600 }}>
            {profit >= 0 ? '+' : ''}{profit.toFixed(1)}%
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && postMortem && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <OrnamentDivider />
            <div style={{ color: colors.fairyGold, fontSize: '12px', marginBottom: '4px' }}>
              {t.archetypes[postMortem.revealedArchetype as keyof typeof t.archetypes] ?? postMortem.revealedArchetype}
            </div>
            <div style={{ color: colors.textSecondary, fontSize: '12px', lineHeight: 1.5 }}>
              {postMortem.analysis}
            </div>
            <div style={{ display: 'flex', gap: spacing.xl, marginTop: spacing.md }}>
              <div>
                <div style={{ color: colors.textMuted, fontSize: '10px' }}>{t.portfolio.investedIn}</div>
                <div style={{ color: colors.textSecondary, fontSize: '12px' }}>{Math.floor(postMortem.investedAmount)} {t.common.currency}</div>
              </div>
              <div>
                <div style={{ color: colors.textMuted, fontSize: '10px' }}>{t.registry.returned}</div>
                <div style={{ color: colors.textSecondary, fontSize: '12px' }}>{Math.floor(postMortem.returnedAmount)} {t.common.currency}</div>
              </div>
              <div>
                <div style={{ color: colors.textMuted, fontSize: '10px' }}>{t.common.days}</div>
                <div style={{ color: colors.textSecondary, fontSize: '12px' }}>{postMortem.daysActive}</div>
              </div>
              {/* «Чуйка» с версии 4 убрана из игры — поле intuitionDelta не показываем */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FairyCard>
  )
}

const TX_TYPE_ICON: Record<string, string> = {
  INVEST: '⬇️', ADD: '⬇️', WITHDRAW: '⬆️', EXIT: '🚪', RETURNED: '📬', REFERRAL_BONUS: '🤝', GIFT: '🎁',
}

function TransactionSection({ transactions }: { transactions: TransactionDTO[] }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  if (transactions.length === 0) return null
  return (
    <section style={{ marginTop: spacing.xl }}>
      {/* CTA-стиль как у кнопки Летописи — единый паттерн через ctaButton.lg */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(v => !v)}
        style={{
          ...ctaButton.lg,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: open ? spacing.sm : 0,
        }}
      >
        <span style={{ fontSize: 18 }}>💰</span>
        <span>{t.portfolio.tabFlow}</span>
        <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>
          ({transactions.length})
        </span>
        <span style={{ marginLeft: 4, fontSize: 16, lineHeight: 1 }}>{open ? '−' : '+'}</span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            {transactions.slice(0, 20).map(tx => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function TransactionRow({ tx }: { tx: TransactionDTO }) {
  const t = useT()
  const isOut = tx.type === 'INVEST' || tx.type === 'ADD'
  const color = isOut ? '#E34234' : '#2E8B57'
  const sign = isOut ? '−' : '+'
  const label = t.portfolio.txTypes[tx.type as keyof typeof t.portfolio.txTypes] ?? tx.type

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 10px',
      marginBottom: '4px',
      // Раньше: rgba(42,25,96,0.25) — полупрозрачное → на ярких bg-картинках
      // строки сливались с фоном. Теперь — непрозрачный пергамент карточки.
      background: gradients.card,
      border: `1px solid ${colors.cardBorder}`,
      borderRadius: '8px',
      boxShadow: `inset 0 1px 0 ${colors.cardHighlight}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px' }}>{TX_TYPE_ICON[tx.type] ?? '•'}</span>
        <div>
          <div style={{ color: colors.textPrimary, fontSize: '12px', fontWeight: 600 }}>
            {label}: {tx.projectName}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: '10px' }}>{t.common.day} {tx.day}</div>
        </div>
      </div>
      <div style={{ color, fontWeight: 800, fontSize: '13px', flexShrink: 0 }}>
        {sign}{Math.floor(tx.amount)} {t.common.currency}
      </div>
    </div>
  )
}
