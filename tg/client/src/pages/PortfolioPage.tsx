import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { ScreenBackground } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider } from '@/components/FairyCard'
import { api, type ProjectDTO, type PostMortemDTO, type DailyUpdateDTO } from '@/api/client'
import { colors, spacing } from '@/theme'

const WITHDRAWAL_INFO: Record<string, string> = {
  POTION_BREW: 'Макс. 25% за раз',
  GUILD_SCHEME: 'Макс. 25% за раз',
  CARD_GAME: 'Комиссия 25%',
  TREASURE_HUNT: 'Комиссия 25%',
  HONEST_TRADE: 'Без ограничений',
}

export function PortfolioPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: api.projects.getPortfolio,
    refetchInterval: 15_000,
  })

  return (
    <ScreenBackground>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
          <div style={{ color: colors.fairyGold, fontSize: '20px', fontWeight: 700 }}>✦ Казна ✦</div>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
            Активные дела и история
          </div>
        </div>

        {isLoading && (
          <div style={{ textAlign: 'center', color: colors.textMuted, padding: '40px' }}>
            Считаем злато...
          </div>
        )}

        {/* Активные */}
        {data?.active && data.active.length > 0 && (
          <section>
            <div style={{ color: colors.fairyGold, fontSize: '13px', fontWeight: 600, marginBottom: spacing.sm }}>
              Активные дела
            </div>
            {data.active.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <ActiveProjectCard project={p} />
              </motion.div>
            ))}
          </section>
        )}

        {data?.active?.length === 0 && !isLoading && (
          <FairyCard style={{ textAlign: 'center', marginBottom: spacing.lg }}>
            <div style={{ fontSize: '32px', marginBottom: spacing.sm }}>🏚️</div>
            <div style={{ color: colors.textSecondary }}>Нет активных дел</div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
              Загляни во входящие грамоты
            </div>
          </FairyCard>
        )}

        {/* Закрытые */}
        {data?.closed && data.closed.length > 0 && (
          <section style={{ marginTop: spacing.xl }}>
            <div style={{ color: colors.textMuted, fontSize: '13px', fontWeight: 600, marginBottom: spacing.sm }}>
              История
            </div>
            {data.closed.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <ClosedProjectCard project={p} postMortem={p.postMortem} />
              </motion.div>
            ))}
          </section>
        )}
      </div>
    </ScreenBackground>
  )
}

function NewsItem({ update }: { update: DailyUpdateDTO }) {
  const [expanded, setExpanded] = useState(false)

  let signal = '⚪'
  if (update.payoutStatus === 'BOOSTED' || update.userCountDelta > 5) signal = '🟢'
  else if (update.payoutStatus === 'DELAYED' || update.userCountDelta < -5) signal = '🔴'

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '6px 8px',
        borderRadius: '6px',
        background: 'rgba(42, 25, 96, 0.3)',
        marginBottom: '4px',
        cursor: 'pointer',
        border: `1px solid ${colors.cardBorder}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '12px' }}>{signal}</span>
        <span style={{
          color: colors.textSecondary, fontSize: '11px', flex: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {update.title}
        </span>
        {update.redFlags.length > 0 && (
          <span style={{ color: colors.warning, fontSize: '10px', flexShrink: 0 }}>
            ⚠️ {update.redFlags.length} сигн.
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
            <div style={{ marginTop: '6px', color: colors.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
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

function MiniChart({ data, color, label }: { data: number[]; color: string; label?: string }) {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <div style={{ flex: 1 }}>
      {label && (
        <div style={{ color: colors.textMuted, fontSize: '10px', marginBottom: '2px' }}>{label}</div>
      )}
      <ResponsiveContainer width="100%" height={50}>
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Tooltip
            contentStyle={{ background: '#0D1735', border: 'none', borderRadius: '6px', fontSize: '10px', color: colors.textPrimary }}
            formatter={(val: number) => [val, '']}
            labelFormatter={() => ''}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ActiveProjectCard({ project }: { project: ProjectDTO }) {
  const qc = useQueryClient()
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showAddInvest, setShowAddInvest] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [addAmount, setAddAmount] = useState('')

  const { data: updates } = useQuery({
    queryKey: ['updates', project.id],
    queryFn: () => api.projects.getUpdates(project.id),
    refetchInterval: 30_000,
  })

  const recentUpdates = (updates ?? []).slice(-3).reverse()

  const profit = project.investedAmountRubles > 0
    ? ((project.currentValueRubles - project.investedAmountRubles) / project.investedAmountRubles * 100)
    : 0

  const exitMutation = useMutation({
    mutationFn: () => api.invest.exit(project.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      qc.invalidateQueries({ queryKey: ['gameState'] })
    },
  })

  const withdrawMutation = useMutation({
    mutationFn: () => api.invest.withdraw(project.id, Number(withdrawAmount)),
    onSuccess: () => {
      setShowWithdraw(false)
      setWithdrawAmount('')
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      qc.invalidateQueries({ queryKey: ['gameState'] })
    },
  })

  const addInvestMutation = useMutation({
    mutationFn: () => api.invest.addInvestment(project.id, Number(addAmount)),
    onSuccess: () => {
      setShowAddInvest(false)
      setAddAmount('')
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      qc.invalidateQueries({ queryKey: ['gameState'] })
    },
  })

  const hasValueHistory = project.valueHistory.length > 1
  const hasUserCountHistory = project.userCountHistory.length > 1

  return (
    <FairyCard style={{ marginBottom: spacing.md }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: colors.fairyGold, fontWeight: 700 }}>{project.name}</div>
          <div style={{ color: colors.textMuted, fontSize: '11px' }}>{project.developerName} · {project.daysSinceJoined} дн.</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: colors.textPrimary, fontWeight: 700 }}>{project.currentValueRubles.toFixed(0)} ₽</div>
          <div style={{ color: profit >= 0 ? colors.success : colors.danger, fontSize: '12px' }}>
            {profit >= 0 ? '+' : ''}{profit.toFixed(1)}%
          </div>
        </div>
      </div>

      {project.isWithdrawalLocked && (
        <div style={{ marginTop: spacing.sm, color: colors.warning, fontSize: '12px', padding: '4px 8px', background: `${colors.warning}15`, borderRadius: '6px' }}>
          🔒 Вывод заблокирован хозяином
        </div>
      )}

      {/* Mini charts */}
      {(hasValueHistory || hasUserCountHistory) && (
        <>
          <OrnamentDivider />
          <div style={{ display: 'flex', gap: spacing.md }}>
            {hasValueHistory && (
              <MiniChart
                data={project.valueHistory}
                color={colors.fairyGold}
                label="💰 стоимость"
              />
            )}
            {hasUserCountHistory && (
              <MiniChart
                data={project.userCountHistory}
                color="#4a9eff"
                label={`👥 вкладчиков: ${project.currentUserCount}`}
              />
            )}
          </div>
        </>
      )}

      {/* News section */}
      {recentUpdates.length > 0 && (
        <>
          <OrnamentDivider />
          <div style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>
            Вести
          </div>
          {recentUpdates.map(u => (
            <NewsItem key={u.id} update={u} />
          ))}
        </>
      )}

      <OrnamentDivider />

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
        {!project.isWithdrawalLocked && (
          <button
            onClick={() => { setShowAddInvest(!showAddInvest); setShowWithdraw(false) }}
            style={{
              flex: 1, padding: '8px', background: `${colors.fairyGold}15`,
              border: `1px solid ${colors.fairyGold}40`, borderRadius: '8px',
              color: colors.fairyGold, cursor: 'pointer', fontSize: '12px',
            }}
          >
            Довложить
          </button>
        )}
        {!project.isWithdrawalLocked && (
          <button
            onClick={() => { setShowWithdraw(!showWithdraw); setShowAddInvest(false) }}
            style={{
              flex: 1, padding: '8px', background: 'transparent',
              border: `1px solid ${colors.cardBorder}`, borderRadius: '8px',
              color: colors.textSecondary, cursor: 'pointer', fontSize: '12px',
            }}
          >
            Вывести часть
          </button>
        )}
        <button
          onClick={() => exitMutation.mutate()}
          disabled={exitMutation.isPending || project.isWithdrawalLocked}
          style={{
            flex: 1, padding: '8px', background: `${colors.danger}20`,
            border: `1px solid ${colors.danger}40`, borderRadius: '8px',
            color: project.isWithdrawalLocked ? colors.textMuted : colors.danger,
            cursor: project.isWithdrawalLocked ? 'not-allowed' : 'pointer', fontSize: '12px',
          }}
        >
          Покинуть дело
        </button>
      </div>

      {WITHDRAWAL_INFO[project.type] && (
        <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '4px' }}>
          ℹ️ {WITHDRAWAL_INFO[project.type]}
        </div>
      )}

      {/* Add investment input */}
      <AnimatePresence>
        {showAddInvest && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginTop: spacing.md }}>
              <input
                type="number"
                value={addAmount}
                onChange={e => setAddAmount(e.target.value)}
                placeholder="Сумма довложения"
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
              <button
                onClick={() => addInvestMutation.mutate()}
                disabled={!addAmount || addInvestMutation.isPending}
                style={{
                  width: '100%', marginTop: spacing.sm,
                  padding: '8px', background: `${colors.enchantedPurple}`,
                  border: `1px solid ${colors.fairyGold}40`, borderRadius: '8px',
                  color: colors.fairyGold, fontWeight: 600, cursor: 'pointer', fontSize: '13px',
                }}
              >
                {addInvestMutation.isPending ? 'Вкладываем...' : 'Довложить'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdraw input */}
      <AnimatePresence>
        {showWithdraw && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginTop: spacing.md }}>
              <input
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder="Сумма"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(42, 25, 96, 0.4)', border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '8px', padding: '8px', color: colors.textPrimary,
                  fontSize: '14px', outline: 'none',
                }}
              />
              {withdrawMutation.isError && (
                <div style={{ color: colors.danger, fontSize: '11px', marginTop: '4px' }}>
                  {(withdrawMutation.error as Error).message}
                </div>
              )}
              <button
                onClick={() => withdrawMutation.mutate()}
                disabled={!withdrawAmount || withdrawMutation.isPending}
                style={{
                  width: '100%', marginTop: spacing.sm,
                  padding: '8px', background: `${colors.enchantedPurple}`,
                  border: `1px solid ${colors.fairyGold}40`, borderRadius: '8px',
                  color: colors.fairyGold, fontWeight: 600, cursor: 'pointer', fontSize: '13px',
                }}
              >
                Вывести
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FairyCard>
  )
}

const ARCHETYPE_DISPLAY: Record<string, string> = {
  BURATINO: 'Буратино', BOYARIN: 'Боярин', KOLOBOK: 'Колобок',
  KOSCHEI: 'Кощей', ZOLUSHKA: 'Золушка', BABA_YAGA: 'Баба-яга', IVAN_DURAK: 'Иван-дурак',
}

const FATE_DISPLAY: Record<string, string> = {
  INSTANT_SCAM: '💀 Сбежал с деньгами', SLOW_DRAIN: '🌫️ Тихо угас', HONEST_FAIL: '😔 Честный провал',
  SURVIVOR: '⚓ Выжил', UNICORN: '🦄 Взлетел',
}

function ClosedProjectCard({ project, postMortem }: { project: ProjectDTO; postMortem: PostMortemDTO | null }) {
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
              {FATE_DISPLAY[postMortem.fate] ?? postMortem.fate}
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
              Архетип: {ARCHETYPE_DISPLAY[postMortem.revealedArchetype] ?? postMortem.revealedArchetype}
            </div>
            <div style={{ color: colors.textSecondary, fontSize: '12px', lineHeight: 1.5 }}>
              {postMortem.analysis}
            </div>
            <div style={{ display: 'flex', gap: spacing.xl, marginTop: spacing.md }}>
              <div>
                <div style={{ color: colors.textMuted, fontSize: '10px' }}>Вложено</div>
                <div style={{ color: colors.textSecondary, fontSize: '12px' }}>{postMortem.investedAmount.toFixed(0)} ₽</div>
              </div>
              <div>
                <div style={{ color: colors.textMuted, fontSize: '10px' }}>Получено</div>
                <div style={{ color: colors.textSecondary, fontSize: '12px' }}>{postMortem.returnedAmount.toFixed(0)} ₽</div>
              </div>
              <div>
                <div style={{ color: colors.textMuted, fontSize: '10px' }}>Дней</div>
                <div style={{ color: colors.textSecondary, fontSize: '12px' }}>{postMortem.daysActive}</div>
              </div>
              {postMortem.intuitionDelta !== 0 && (
                <div>
                  <div style={{ color: colors.textMuted, fontSize: '10px' }}>Чуйка</div>
                  <div style={{ color: postMortem.intuitionDelta > 0 ? colors.success : colors.danger, fontSize: '12px' }}>
                    {postMortem.intuitionDelta > 0 ? '+' : ''}{postMortem.intuitionDelta}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FairyCard>
  )
}
