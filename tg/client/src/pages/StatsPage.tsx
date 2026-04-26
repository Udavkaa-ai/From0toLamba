import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ScreenBackground, PAGE_BG } from '@/components/ScreenBackground'
import { FairyCard } from '@/components/FairyCard'
import { PageTitle } from '@/components/PageTitle'
import { CountUp } from '@/components/CountUp'
import { api } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing, typography } from '@/theme'
import { evaluateAchievements, CATEGORY_LABELS, type EvaluatedAchievement } from '@/game/achievements'
import { loreFor } from '@/game/lore'
import { ChannelTasksBlock } from '@/components/ChannelTasksBlock'

const RANK_DISPLAY: Record<string, string> = {
  NEWBIE: 'Скоморох', AMBASSADOR: 'Купец', ANALYST: 'Мудрец', SHARK: 'Боярин', LAMBO_SENSEI: 'Князь',
}

const RANK_NEXT_HINT: Record<string, string> = {
  NEWBIE: '100 ₽ и чуйка 10 → Купец',
  AMBASSADOR: '1 000 ₽ и чуйка 50 → Мудрец',
  ANALYST: '3 000 ₽ и чуйка 100 → Боярин',
  SHARK: '10 000 ₽ и чуйка 300 → Князь',
  LAMBO_SENSEI: 'Ты достиг вершины! 👑',
}

type ChartScale = 30 | 90 | 999

export function StatsPage() {
  const gameState = useGameStore(s => s.gameState)
  const [chartScale, setChartScale] = useState<ChartScale>(30)

  useQuery({
    queryKey: ['gameState'],
    queryFn: async () => {
      const data = await api.game.getState()
      useGameStore.getState().setGameState(data)
      return data
    },
  })

  if (!gameState) return null

  const activeValue = gameState.activeProjects.reduce((s, p) => s + p.currentValueRubles, 0)
  const received = gameState.totalReturned + activeValue
  const roi = gameState.totalInvested > 0
    ? ((received - gameState.totalInvested) / gameState.totalInvested * 100)
    : 0

  const fullChart = gameState.balanceHistory.map((b, i) => ({
    day: i + 1,
    balance: Math.round(b),
    invested: Math.round(gameState.investedHistory[i] ?? 0),
  }))
  const chartData = chartScale === 999 ? fullChart : fullChart.slice(-chartScale)

  return (
    <ScreenBackground bgImage={PAGE_BG.stats}>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
          <PageTitle>Успехи</PageTitle>
        </div>

        {/* Ранг */}
        <FairyCard accent style={{ marginBottom: spacing.lg, textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: spacing.sm }}>
            {gameState.investorRank === 'LAMBO_SENSEI' ? '👑' :
             gameState.investorRank === 'SHARK' ? '🧥' :
             gameState.investorRank === 'ANALYST' ? '📖' :
             gameState.investorRank === 'AMBASSADOR' ? '🛒' : '🎪'}
          </div>
          <div style={{
            color: colors.fairyGold,
            fontFamily: typography.headingFontFamily,
            fontSize: '24px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textShadow: `0 0 16px ${colors.fairyGold}40`,
          }}>
            {RANK_DISPLAY[gameState.investorRank] ?? gameState.investorRank}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: spacing.sm }}>
            {RANK_NEXT_HINT[gameState.investorRank]}
          </div>
        </FairyCard>

        {/* Финансы — единая тройка как на Главной */}
        <FairyCard style={{ marginBottom: spacing.lg }}>
          <div style={{ color: colors.textMuted, fontSize: '11px', textAlign: 'center', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Денежная летопись
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <Stat label="Вложено" value={`${gameState.totalInvested.toFixed(0)} ₽`} />
            <Stat label="Получено" value={`${received.toFixed(0)} ₽`} />
            <Stat
              label="Итог"
              value={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`}
              valueColor={roi >= 0 ? colors.success : colors.danger}
            />
          </div>
          <div style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.cardBorder}`, display: 'flex', justifyContent: 'space-around' }}>
            <Stat label="Свободные рубли" value={`${gameState.balance.toFixed(0)} ₽`} small />
            <Stat label="Всего злата" value={`${(gameState.balance + activeValue).toFixed(0)} ₽`} small />
          </div>
        </FairyCard>

        {/* Игровые показатели */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm, marginBottom: spacing.lg }}>
          {[
            { label: 'Дней в игре', value: String(gameState.currentDay) },
            { label: 'Завершено дел', value: String(gameState.closedProjectsCount) },
            { label: 'Чуйка', value: String(gameState.intuitionScore) },
            {
              label: 'Точность чуйки',
              value: gameState.intuitionAccuracy === null
                ? '—'
                : Math.round(gameState.intuitionAccuracy * 100) + '%',
            },
          ].map(({ label, value }) => (
            <FairyCard key={label} padding={spacing.md} style={{ textAlign: 'center' }}>
              <div style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '4px' }}>{label}</div>
              <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '18px', fontVariantNumeric: 'tabular-nums' }}>
                <CountUp value={parseFloat(value) || 0} format={() => value} duration={400} />
              </div>
            </FairyCard>
          ))}
        </div>

        {/* График баланса с переключателем масштаба */}
        {fullChart.length > 1 && (
          <FairyCard style={{ marginBottom: spacing.lg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <div style={{ color: colors.fairyGold, fontSize: '13px', fontWeight: 600 }}>
                Ведомость баланса
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {([
                  { v: 30 as ChartScale, label: '30 дн.' },
                  { v: 90 as ChartScale, label: '90 дн.' },
                  { v: 999 as ChartScale, label: 'Всё' },
                ]).map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => setChartScale(opt.v)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 600,
                      border: `1px solid ${chartScale === opt.v ? colors.fairyGold : colors.cardBorder}`,
                      background: chartScale === opt.v ? `${colors.fairyGold}20` : 'transparent',
                      color: chartScale === opt.v ? colors.fairyGold : colors.textMuted,
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barSize={chartData.length > 60 ? 3 : 8} barCategoryGap={2}>
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

        {/* Награды за подписку */}
        <ChannelTasksBlock />

        {/* Подвиги */}
        <AchievementsSection />
      </div>
    </ScreenBackground>
  )
}

function Stat({ label, value, valueColor, small }: { label: string; value: string; valueColor?: string; small?: boolean }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '2px' }}>{label}</div>
      <div style={{
        color: valueColor ?? colors.textPrimary,
        fontWeight: 700,
        fontSize: small ? '13px' : '16px',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
    </div>
  )
}

function AchievementsSection() {
  const gameState = useGameStore(s => s.gameState)
  const [opened, setOpened] = useState<EvaluatedAchievement | null>(null)
  if (!gameState) return null

  const items = evaluateAchievements(gameState)
  const unlocked = items.filter(a => a.unlocked)

  // Группируем по категориям, заблокированные внутри категории — в конец
  const categories = [...new Set(items.map(a => a.category))]

  return (
    <div style={{ marginTop: spacing.xl }}>
      <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '15px', marginBottom: spacing.sm, textAlign: 'center' }}>
        🏆 Подвиги — {unlocked.length} из {items.length}
      </div>
      {categories.map(cat => {
        const inCat = items.filter(a => a.category === cat)
        return (
          <div key={cat} style={{ marginBottom: spacing.md }}>
            <div style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 600, marginBottom: '6px', marginLeft: '4px' }}>
              {CATEGORY_LABELS[cat]}
            </div>
            <div style={{ display: 'grid', gap: '6px' }}>
              {inCat.map(a => (
                <button
                  key={a.id}
                  onClick={() => setOpened(a)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: a.unlocked ? `${colors.fairyGold}15` : 'rgba(10,8,24,0.5)',
                    border: `1px solid ${a.unlocked ? colors.fairyGold + '55' : colors.cardBorder}`,
                    borderRadius: '10px',
                    opacity: a.unlocked ? 1 : 0.7,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    width: '100%',
                  }}
                >
                  <div style={{
                    fontSize: '24px',
                    width: '32px',
                    textAlign: 'center',
                    filter: a.unlocked ? 'none' : 'grayscale(100%)',
                  }}>
                    {a.unlocked ? a.emoji : '🔒'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: a.unlocked ? colors.fairyGold : colors.textSecondary,
                      fontWeight: 600,
                      fontSize: '13px',
                    }}>
                      {a.name}
                    </div>
                    <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '1px' }}>
                      {a.description}
                    </div>
                    {!a.unlocked && a.progress && a.progress.target > 1 && (
                      <div style={{ marginTop: '4px' }}>
                        <div style={{
                          height: '4px',
                          background: 'rgba(255,255,255,0.08)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${Math.min(100, (a.progress.current / a.progress.target) * 100)}%`,
                            height: '100%',
                            background: colors.fairyGold,
                            opacity: 0.6,
                          }} />
                        </div>
                        <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '2px' }}>
                          {a.progress.current} / {a.progress.target}
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      <AnimatePresence>
        {opened && <AchievementDetailModal achievement={opened} onClose={() => setOpened(null)} />}
      </AnimatePresence>
    </div>
  )
}

function AchievementDetailModal({
  achievement, onClose,
}: { achievement: EvaluatedAchievement; onClose: () => void }) {
  const lore = achievement.revealTopic
    ? loreFor(achievement.revealTopic.kind, achievement.revealTopic.id)
    : null
  const showLore = achievement.unlocked && lore !== null

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 230,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '500px',
          background: colors.nightBlue,
          borderRadius: '20px 20px 0 0',
          border: `1px solid ${colors.cardBorder}`,
          padding: `${spacing.xl} ${spacing.lg}`,
          // BottomNav ~60px по высоте — иначе кнопка «Закрыть» уйдёт под неё
          paddingBottom: `calc(72px + ${spacing.md} + env(safe-area-inset-bottom))`,
          maxHeight: '85dvh',
          overflowY: 'auto',
        }}
      >
        {/* Шапка */}
        <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
          <div style={{ fontSize: '52px', marginBottom: '4px' }}>
            {achievement.unlocked ? achievement.emoji : '🔒'}
          </div>
          <div style={{ color: colors.fairyGold, fontSize: '18px', fontWeight: 700 }}>
            {achievement.name}
          </div>
          {achievement.unlocked && (
            <div style={{ color: colors.success, fontSize: '12px', marginTop: '4px' }}>
              ✓ Совершено
            </div>
          )}
        </div>

        {/* Если подвиг ещё не взят — показываем только условие */}
        {!achievement.unlocked && (
          <div style={{
            padding: spacing.md,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '10px',
          }}>
            <div style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Как совершить
            </div>
            <div style={{ color: colors.textPrimary, fontSize: '14px', lineHeight: 1.5 }}>
              {achievement.description}
            </div>
            {achievement.progress && achievement.progress.target > 1 && (
              <div style={{ marginTop: spacing.sm }}>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, (achievement.progress.current / achievement.progress.target) * 100)}%`,
                    height: '100%', background: colors.fairyGold, opacity: 0.7,
                  }} />
                </div>
                <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '4px', textAlign: 'right' }}>
                  {achievement.progress.current} / {achievement.progress.target}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Если это справочный подвиг — раскрываем описание породы/личины/судьбы */}
        {showLore && lore && (
          <div>
            <div style={{
              padding: spacing.md,
              background: `${colors.fairyGold}10`,
              border: `1px solid ${colors.fairyGold}40`,
              borderRadius: '10px',
              marginBottom: spacing.sm,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: '4px' }}>
                <span style={{ fontSize: '22px' }}>{lore.emoji}</span>
                <div>
                  <div style={{ color: colors.fairyGold, fontSize: '15px', fontWeight: 700 }}>{lore.name}</div>
                  <div style={{ color: colors.textMuted, fontSize: '11px' }}>{lore.title}</div>
                </div>
              </div>
              <div style={{ color: colors.textSecondary, fontSize: '13px', lineHeight: 1.6, marginTop: spacing.sm }}>
                {lore.description}
              </div>
            </div>

            {lore.hints && lore.hints.length > 0 && (
              <div style={{
                padding: spacing.md,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: '10px',
              }}>
                <div style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Приметы
                </div>
                {lore.hints.map((h, i) => (
                  <div key={i} style={{ color: colors.textPrimary, fontSize: '12px', lineHeight: 1.5, marginTop: i === 0 ? 0 : '4px' }}>
                    ✦ {h}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Обычный разблокированный подвиг без справки */}
        {achievement.unlocked && !showLore && (
          <div style={{ color: colors.textSecondary, fontSize: '14px', lineHeight: 1.5, textAlign: 'center' }}>
            {achievement.description}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: spacing.lg,
            padding: spacing.md,
            background: `${colors.enchantedPurple}`,
            border: `1px solid ${colors.fairyGold}40`,
            borderRadius: '12px',
            color: colors.fairyGold,
            fontSize: '14px', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Закрыть
        </button>
      </motion.div>
    </motion.div>
  )
}
