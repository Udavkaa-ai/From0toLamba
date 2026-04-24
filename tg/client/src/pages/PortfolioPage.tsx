import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ComposedChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { ScreenBackground } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider, SkeletonCard } from '@/components/FairyCard'
import { api, type ProjectDTO, type PostMortemDTO, type DailyUpdateDTO, type TransactionDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing } from '@/theme'

/** Конкретная подсказка для вывода: сумма в ₽, а не просто «25%». */
function withdrawalHint(project: ProjectDTO): string | null {
  switch (project.type) {
    case 'POTION_BREW':
    case 'GUILD_SCHEME': {
      // Лимит считается от investedAmountRubles, не от currentValue
      const maxRubles = project.investedAmountRubles * 0.25
      return `Макс. за раз: ${maxRubles.toFixed(0)} ₽ (25% от вложенных ${project.investedAmountRubles.toFixed(0)} ₽)`
    }
    case 'CARD_GAME':
    case 'TREASURE_HUNT':
      return 'Комиссия 25% с каждого вывода'
    case 'HONEST_TRADE':
      return 'Без ограничений и комиссий'
    default:
      return null
  }
}

export function PortfolioPage() {
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
    <ScreenBackground>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
          <div style={{ color: colors.fairyGold, fontSize: '20px', fontWeight: 700 }}>✦ Казна ✦</div>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
            Активные дела и история
          </div>
        </div>

        {isLoading && [1, 2].map(i => <SkeletonCard key={i} lines={5} />)}

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

        {/* Закрытые (только те, куда вкладывался) */}
        {data?.closed && data.closed.filter(p => p.investedAmountRubles > 0).length > 0 && (
          <section style={{ marginTop: spacing.xl }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <div style={{ color: colors.textMuted, fontSize: '13px', fontWeight: 600 }}>
                История
              </div>
              <button
                onClick={() => navigate('/registry')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: colors.fairyGold, fontSize: '12px',
                }}
              >
                Вся летопись →
              </button>
            </div>
            {data.closed.filter(p => p.investedAmountRubles > 0).slice(0, 3).map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <ClosedProjectCard project={p} postMortem={p.postMortem} />
              </motion.div>
            ))}
            {data.closed.filter(p => p.investedAmountRubles > 0).length > 3 && (
              <div
                onClick={() => navigate('/registry')}
                style={{
                  textAlign: 'center', color: colors.textMuted, fontSize: '12px',
                  padding: spacing.sm, cursor: 'pointer',
                }}
              >
                + ещё {data.closed.filter(p => p.investedAmountRubles > 0).length - 3} в летописи
              </div>
            )}
          </section>
        )}

        {/* Движение средств */}
        {transactions.length > 0 && (
          <section style={{ marginTop: spacing.xl }}>
            <div style={{ color: colors.textMuted, fontSize: '13px', fontWeight: 600, marginBottom: spacing.sm }}>
              Движение средств
            </div>
            {transactions.slice(0, 20).map(tx => (
              <TransactionRow key={tx.id} tx={tx} />
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

function MiniDualChart({ valueHistory, userCountHistory }: { valueHistory: number[]; userCountHistory: number[] }) {
  const len = Math.max(valueHistory.length, userCountHistory.length)
  if (len < 2) return null
  const data = Array.from({ length: len }, (_, i) => ({
    day: i + 1,
    val: valueHistory[i] ?? null,
    usr: userCountHistory[i] ?? null,
  }))
  const fmtK = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)

  return (
    <ResponsiveContainer width="100%" height={64}>
      <ComposedChart data={data} margin={{ top: 4, right: 30, bottom: 0, left: 0 }}>
        <XAxis dataKey="day" stroke="transparent" tick={{ fontSize: 8, fill: '#6B7A99' }} tickCount={3} interval="preserveStartEnd" />
        <YAxis yAxisId="left" stroke="transparent" tick={{ fontSize: 8, fill: '#FFB800' }} width={28} tickCount={2} tickFormatter={fmtK} />
        <YAxis yAxisId="right" orientation="right" stroke="transparent" tick={{ fontSize: 8, fill: '#4a9eff' }} width={28} tickCount={2} tickFormatter={fmtK} />
        <Tooltip
          contentStyle={{ background: '#0D1735', border: 'none', borderRadius: '6px', fontSize: '10px', color: '#C8C8FF' }}
          formatter={(val: number, name: string) => [name === 'val' ? `${val} ₽` : `${val} вкл.`, '']}
          labelFormatter={(l: number) => `День ${l}`}
        />
        <Line yAxisId="left" type="monotone" dataKey="val" stroke="#FFB800" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line yAxisId="right" type="monotone" dataKey="usr" stroke="#4a9eff" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function ActiveProjectCard({ project }: { project: ProjectDTO }) {
  const qc = useQueryClient()
  const { gameState } = useGameStore()
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

  const recentUpdates = (updates ?? []).slice(-3).reverse()

  const profit = project.investedAmountRubles > 0
    ? ((project.currentValueRubles - project.investedAmountRubles) / project.investedAmountRubles * 100)
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
      setShowAddInvest(false)
      setAddAmount('')
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      qc.invalidateQueries({ queryKey: ['gameState'] })
    },
    onError: () => portfolioHaptic?.notificationOccurred('error'),
  })

  const hasValueHistory = project.valueHistory.length > 1
  const hasUserCountHistory = project.userCountHistory.length > 1
  const hasDualHistory = hasValueHistory || hasUserCountHistory

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
      {hasDualHistory && (
        <>
          <OrnamentDivider />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ color: '#FFB800', fontSize: '9px' }}>₽ стоимость</span>
            <span style={{ color: '#4a9eff', fontSize: '9px' }}>👥 {project.currentUserCount} вкл.</span>
          </div>
          <MiniDualChart valueHistory={project.valueHistory} userCountHistory={project.userCountHistory} />
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
          <motion.button
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.1 }}
            onClick={() => { setShowAddInvest(!showAddInvest); setShowWithdraw(false) }}
            style={{
              flex: 1, padding: '8px', background: `${colors.fairyGold}15`,
              border: `1px solid ${colors.fairyGold}40`, borderRadius: '8px',
              color: colors.fairyGold, cursor: 'pointer', fontSize: '12px',
            }}
          >
            Довложить
          </motion.button>
        )}
        {!project.isWithdrawalLocked && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.1 }}
            onClick={() => { setShowWithdraw(!showWithdraw); setShowAddInvest(false) }}
            style={{
              flex: 1, padding: '8px', background: 'transparent',
              border: `1px solid ${colors.cardBorder}`, borderRadius: '8px',
              color: colors.textSecondary, cursor: 'pointer', fontSize: '12px',
            }}
          >
            Вывести часть
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.96, background: `${colors.danger}35` }}
          transition={{ duration: 0.1 }}
          onClick={() => { setConfirmExit(true); setShowWithdraw(false); setShowAddInvest(false) }}
          disabled={exitMutation.isPending || project.isWithdrawalLocked}
          style={{
            flex: 1, padding: '8px', background: `${colors.danger}20`,
            border: `1px solid ${colors.danger}40`, borderRadius: '8px',
            color: project.isWithdrawalLocked ? colors.textMuted : colors.danger,
            cursor: project.isWithdrawalLocked ? 'not-allowed' : 'pointer', fontSize: '12px',
          }}
        >
          Покинуть дело
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
                Покинуть дело? Вернётся <span style={{ color: colors.fairyGold, fontWeight: 700 }}>
                  {(project.currentValueRubles * (1 - (project.type === 'CARD_GAME' || project.type === 'TREASURE_HUNT' ? 0.25 : 0))).toFixed(0)} ₽
                </span> в казну.
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
                  Остаться
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
                  {exitMutation.isPending ? 'Выходим…' : 'Да, покинуть'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {withdrawalHint(project) && (
        <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '4px' }}>
          ℹ️ {withdrawalHint(project)}
        </div>
      )}

      {/* Add investment input */}
      <AnimatePresence>
        {showAddInvest && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginTop: spacing.md }}>
              <div style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '4px' }}>
                В казне: <span style={{ color: colors.fairyGold, fontWeight: 600 }}>{(gameState?.balance ?? 0).toFixed(0)} ₽</span>
                {' · '}мин. 5 ₽ · макс. 5 000 ₽
              </div>
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
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.1 }}
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
                В деле: <span style={{ color: colors.fairyGold, fontWeight: 600 }}>{project.currentValueRubles.toFixed(0)} ₽</span>
                {' · '}в казне: <span style={{ color: colors.fairyGold, fontWeight: 600 }}>{(gameState?.balance ?? 0).toFixed(0)} ₽</span>
              </div>
              {(project.type === 'POTION_BREW' || project.type === 'GUILD_SCHEME') && (
                <div style={{ color: colors.warning, fontSize: '11px', marginBottom: '4px' }}>
                  ⚠️ Макс. за раз: {(project.investedAmountRubles * 0.25).toFixed(0)} ₽ (25% от вложенных {project.investedAmountRubles.toFixed(0)} ₽)
                </div>
              )}
              {(project.type === 'CARD_GAME' || project.type === 'TREASURE_HUNT') && (
                <div style={{ color: colors.warning, fontSize: '11px', marginBottom: '4px' }}>
                  ⚠️ Комиссия 25% — получишь на руки 75% от введённой суммы
                </div>
              )}
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
              {Number(withdrawAmount) > 0 && (project.type === 'CARD_GAME' || project.type === 'TREASURE_HUNT') && (
                <div style={{ color: colors.success, fontSize: '12px', marginTop: '6px' }}>
                  💰 На руки: <span style={{ fontWeight: 700 }}>{(Number(withdrawAmount) * 0.75).toFixed(0)} ₽</span>
                  <span style={{ color: colors.textMuted, fontSize: '11px' }}>
                    {' '}(комиссия {(Number(withdrawAmount) * 0.25).toFixed(0)} ₽)
                  </span>
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
                  padding: '8px', background: `${colors.enchantedPurple}`,
                  border: `1px solid ${colors.fairyGold}40`, borderRadius: '8px',
                  color: colors.fairyGold, fontWeight: 600, cursor: 'pointer', fontSize: '13px',
                }}
              >
                Вывести
              </motion.button>
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

const TX_TYPE_ICON: Record<string, string> = {
  INVEST: '⬇️', ADD: '⬇️', WITHDRAW: '⬆️', EXIT: '🚪', RETURNED: '📬', REFERRAL_BONUS: '🤝',
}
const TX_TYPE_LABEL: Record<string, string> = {
  INVEST: 'Вложено', ADD: 'Довложено', WITHDRAW: 'Выведено', EXIT: 'Выход', RETURNED: 'Возврат', REFERRAL_BONUS: 'Сватовство',
}

function TransactionRow({ tx }: { tx: TransactionDTO }) {
  const isOut = tx.type === 'INVEST' || tx.type === 'ADD'
  const color = isOut ? '#E86060' : '#60C878'
  const sign = isOut ? '−' : '+'

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '7px 10px',
      marginBottom: '4px',
      background: 'rgba(42, 25, 96, 0.25)',
      border: `1px solid ${colors.cardBorder}`,
      borderRadius: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px' }}>{TX_TYPE_ICON[tx.type] ?? '•'}</span>
        <div>
          <div style={{ color: colors.textSecondary, fontSize: '12px' }}>
            {TX_TYPE_LABEL[tx.type] ?? tx.type}: {tx.projectName}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '10px' }}>День {tx.day}</div>
        </div>
      </div>
      <div style={{ color, fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
        {sign}{tx.amount.toFixed(0)} ₽
      </div>
    </div>
  )
}
