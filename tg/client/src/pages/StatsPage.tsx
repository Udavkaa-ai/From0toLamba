import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ScreenBackground } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider } from '@/components/FairyCard'
import { api } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing } from '@/theme'

const RANK_DISPLAY: Record<string, string> = {
  NEWBIE: 'Скоморох', AMBASSADOR: 'Купец', ANALYST: 'Мудрец', SHARK: 'Богатырь', LAMBO_SENSEI: 'Царь',
}

const RANK_NEXT_HINT: Record<string, string> = {
  NEWBIE: 'День 5 или 20 ₽ → Купец',
  AMBASSADOR: 'День 30, 300 ₽, чуйка 5 → Мудрец',
  ANALYST: 'День 50, 1 000 ₽, чуйка 10 → Богатырь',
  SHARK: 'День 777, 7 777 ₽, чуйка 20 → Царь',
  LAMBO_SENSEI: 'Ты достиг вершины! 👑',
}

export function StatsPage() {
  const gameState = useGameStore(s => s.gameState)

  useQuery({
    queryKey: ['gameState'],
    queryFn: async () => {
      const data = await api.game.getState()
      useGameStore.getState().setGameState(data)
      return data
    },
  })

  if (!gameState) return null

  const totalWealth = gameState.balance + gameState.activeProjects.reduce((s, p) => s + p.currentValueRubles, 0)
  const roi = gameState.totalInvested > 0
    ? ((gameState.totalReturned - gameState.totalInvested) / gameState.totalInvested * 100)
    : 0

  const chartData = gameState.balanceHistory.map((b, i) => ({
    day: i + 1,
    balance: Math.round(b),
    invested: Math.round(gameState.investedHistory[i] ?? 0),
  }))

  return (
    <ScreenBackground>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
          <div style={{ color: colors.fairyGold, fontSize: '20px', fontWeight: 700 }}>✦ Успехи ✦</div>
        </div>

        {/* Ранг */}
        <FairyCard style={{ marginBottom: spacing.lg, textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: spacing.sm }}>
            {gameState.investorRank === 'LAMBO_SENSEI' ? '👑' :
             gameState.investorRank === 'SHARK' ? '⚔️' :
             gameState.investorRank === 'ANALYST' ? '📖' :
             gameState.investorRank === 'AMBASSADOR' ? '🛒' : '🎪'}
          </div>
          <div style={{ color: colors.fairyGold, fontSize: '22px', fontWeight: 700 }}>
            {RANK_DISPLAY[gameState.investorRank] ?? gameState.investorRank}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: spacing.sm }}>
            {RANK_NEXT_HINT[gameState.investorRank]}
          </div>
        </FairyCard>

        {/* Основные метрики */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm, marginBottom: spacing.lg }}>
          {[
            { label: 'Дней в игре', value: gameState.currentDay },
            { label: 'Серия дней', value: gameState.dayStreak + ' 🔥' },
            { label: 'Злато купца', value: totalWealth.toFixed(0) + ' ₽' },
            { label: 'Чуйка 👁', value: gameState.intuitionScore },
            { label: 'Скамов выявил', value: gameState.scamsDetected + ' ✅' },
            { label: 'Скамов пропустил', value: gameState.scamsMissed + ' ❌' },
            { label: 'Вложено всего', value: gameState.totalInvested.toFixed(0) + ' ₽' },
            { label: 'Доходность', value: (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%' },
          ].map(({ label, value }) => (
            <FairyCard key={label} padding={spacing.md} style={{ textAlign: 'center' }}>
              <div style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '4px' }}>{label}</div>
              <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '16px' }}>{value}</div>
            </FairyCard>
          ))}
        </div>

        {/* График баланса */}
        {chartData.length > 1 && (
          <FairyCard style={{ marginBottom: spacing.lg }}>
            <div style={{ color: colors.fairyGold, fontSize: '13px', fontWeight: 600, marginBottom: spacing.md }}>
              Ведомость баланса
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barSize={8} barCategoryGap={2}>
                <XAxis dataKey="day" stroke={colors.textMuted} tick={{ fontSize: 10 }} />
                <YAxis stroke={colors.textMuted} tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} width={32} />
                <Tooltip
                  contentStyle={{ background: colors.nightBlue, border: `1px solid ${colors.cardBorder}`, borderRadius: '8px' }}
                  labelStyle={{ color: colors.textMuted, fontSize: '11px' }}
                  formatter={(v: number, name: string) => [`${v} ₽`, name === 'balance' ? 'Свободно' : 'Вложено']}
                  labelFormatter={(l: number) => `День ${l}`}
                />
                <Bar dataKey="balance" stackId="a" fill={colors.fairyGold} />
                <Bar dataKey="invested" stackId="a" fill="#5B3FC8" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '12px', height: '8px', background: colors.fairyGold, borderRadius: '2px' }} />
                <span style={{ color: colors.textMuted, fontSize: '10px' }}>Свободно</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '12px', height: '8px', background: '#5B3FC8', borderRadius: '2px' }} />
                <span style={{ color: colors.textMuted, fontSize: '10px' }}>Вложено</span>
              </div>
            </div>
          </FairyCard>
        )}
      </div>
    </ScreenBackground>
  )
}
