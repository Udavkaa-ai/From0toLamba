import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ScreenBackground } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider, SkeletonCard } from '@/components/FairyCard'
import { api, type ProjectDTO, type PostMortemDTO } from '@/api/client'
import { colors, spacing } from '@/theme'

const ARCHETYPE_DISPLAY: Record<string, { name: string; emoji: string; desc: string }> = {
  BURATINO:   { name: 'Буратино',   emoji: '🪆', desc: 'Наивный лжец — верил своим выдумкам' },
  BOYARIN:    { name: 'Боярин',     emoji: '👘', desc: 'Пышно-официальный, ссылался на «людей при дворе»' },
  KOLOBOK:    { name: 'Колобок',    emoji: '🫓', desc: 'Бодрый хвастун, укатывался от неудобных вопросов' },
  KOSCHEI:    { name: 'Кощей',     emoji: '💀', desc: 'Холодный и уверенный, говорил цифрами как приговорами' },
  ZOLUSHKA:   { name: 'Золушка',   emoji: '👠', desc: 'Давила на жалость и создавала дедлайны' },
  BABA_YAGA:  { name: 'Баба-яга',  emoji: '🧙', desc: 'Отвечала загадками, скрывала всё за туманом' },
  IVAN_DURAK: { name: 'Иван-дурак',emoji: '🤡', desc: 'Открыто говорил о провалах — и снова проваливался' },
}

const FATE_DISPLAY: Record<string, { label: string; color: string }> = {
  INSTANT_SCAM: { label: '💀 Сбежал с деньгами',   color: colors.danger },
  SLOW_DRAIN:   { label: '🌫️ Тихо угас',             color: '#E8A060' },
  HONEST_FAIL:  { label: '😔 Честный провал',         color: colors.textMuted },
  SURVIVOR:     { label: '⚓ Выжил — дело передано', color: colors.success },
  UNICORN:      { label: '🦄 Взлетел — выкуплен',    color: colors.fairyGold },
}

const LIE_TOPIC_LABEL: Record<string, string> = {
  PATRON_COUNT:       '👥 Вкладчики',
  DAILY_PROFIT:       '💰 Доход',
  PAYOUT_DATE:        '📅 Выплаты',
  GUILD_SIZE:         '🏗️ Артель',
  ELDER_BLESSING:     '📜 Проверка',
  NOBLE_BACKING:      '🏰 Покровители',
  WITHDRAWAL_LIMITS:  '🔒 Вывод',
}

const TYPE_LABEL: Record<string, string> = {
  CARD_GAME: '🃏 Азартная игра',
  TREASURE_HUNT: '🗺️ Поиск клада',
  POTION_BREW: '🧪 Зелейное дело',
  GUILD_SCHEME: '⚙️ Артель',
  HONEST_TRADE: '🤝 Честная торговля',
}

type ClosedProject = ProjectDTO & { postMortem: PostMortemDTO | null }

export function RegistryPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: api.projects.getPortfolio,
  })

  const closed: ClosedProject[] = (data?.closed ?? [])
    .filter(p => p.investedAmountRubles > 0)
    .sort((a, b) => {
      if (!a.postMortem && !b.postMortem) return 0
      if (!a.postMortem) return 1
      if (!b.postMortem) return -1
      return b.postMortem.daysActive - a.postMortem.daysActive
    })

  const totalInvested = closed.reduce((s, p) => s + (p.postMortem?.investedAmount ?? 0), 0)
  const totalReturned = closed.reduce((s, p) => s + (p.postMortem?.returnedAmount ?? 0), 0)
  const overallPnl = totalInvested > 0 ? ((totalReturned - totalInvested) / totalInvested) * 100 : 0

  return (
    <ScreenBackground>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.xl }}>
          <button
            onClick={() => navigate('/portfolio')}
            style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '20px', padding: '0 8px 0 0' }}
          >
            ←
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ color: colors.fairyGold, fontSize: '20px', fontWeight: 700 }}>✦ Летопись ✦</div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '2px' }}>
              Архив закрытых дел
            </div>
          </div>
          <div style={{ width: '36px' }} />
        </div>

        {/* Summary card */}
        {closed.length > 0 && (
          <FairyCard style={{ marginBottom: spacing.xl, textAlign: 'center' }}>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginBottom: spacing.sm }}>
              {closed.length} завершённых дел
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div>
                <div style={{ color: colors.textMuted, fontSize: '10px' }}>Вложено всего</div>
                <div style={{ color: colors.textSecondary, fontWeight: 700 }}>{totalInvested.toFixed(0)} ₽</div>
              </div>
              <div>
                <div style={{ color: colors.textMuted, fontSize: '10px' }}>Получено</div>
                <div style={{ color: colors.textSecondary, fontWeight: 700 }}>{totalReturned.toFixed(0)} ₽</div>
              </div>
              <div>
                <div style={{ color: colors.textMuted, fontSize: '10px' }}>Итог</div>
                <div style={{ color: overallPnl >= 0 ? colors.success : colors.danger, fontWeight: 700 }}>
                  {overallPnl >= 0 ? '+' : ''}{overallPnl.toFixed(1)}%
                </div>
              </div>
            </div>
          </FairyCard>
        )}

        {isLoading && [1, 2, 3].map(i => <SkeletonCard key={i} lines={4} />)}

        {!isLoading && closed.length === 0 && (
          <FairyCard style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: spacing.sm }}>📖</div>
            <div style={{ color: colors.textSecondary }}>Летопись пуста</div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
              Войди в дело и выйди или дождись его конца
            </div>
          </FairyCard>
        )}

        {closed.map((project, i) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <RegistryCard project={project} postMortem={project.postMortem} />
          </motion.div>
        ))}
      </div>
    </ScreenBackground>
  )
}

function RegistryCard({ project, postMortem }: { project: ClosedProject; postMortem: PostMortemDTO | null }) {
  const [expanded, setExpanded] = useState(false)

  const archetype = postMortem ? ARCHETYPE_DISPLAY[postMortem.revealedArchetype] : null
  const fate = postMortem ? FATE_DISPLAY[postMortem.fate] : null
  const profit = postMortem ? postMortem.profitPercent : 0
  const isProfit = profit >= 0

  return (
    <FairyCard
      onClick={() => setExpanded(!expanded)}
      style={{ marginBottom: spacing.md, cursor: 'pointer' }}
    >
      {/* Banner */}
      {project.bannerImageUrl && (
        <img
          src={project.bannerImageUrl}
          alt={project.name}
          style={{
            width: '100%', aspectRatio: '2 / 1', objectFit: 'cover',
            borderRadius: '8px', marginBottom: spacing.md, display: 'block',
          }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: colors.textSecondary, fontWeight: 700, fontSize: '14px' }}>
            {project.name}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>
            {TYPE_LABEL[project.type] ?? project.type}
          </div>
          {fate && (
            <div style={{ color: fate.color, fontSize: '11px', marginTop: '3px' }}>
              {fate.label}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ color: isProfit ? colors.success : colors.danger, fontWeight: 700, fontSize: '14px' }}>
            {isProfit ? '+' : ''}{profit.toFixed(1)}%
          </div>
          {archetype && (
            <div style={{ color: colors.fairyGold, fontSize: '12px', marginTop: '2px' }}>
              {archetype.emoji} {archetype.name}
            </div>
          )}
        </div>
      </div>

      {/* Expand indicator */}
      <div style={{ textAlign: 'center', color: colors.textMuted, fontSize: '10px', marginTop: spacing.sm }}>
        {expanded ? '▲ свернуть' : '▼ читать летопись'}
      </div>

      <AnimatePresence>
        {expanded && postMortem && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <OrnamentDivider />

            {/* Archetype reveal */}
            {archetype && (
              <div style={{
                background: `${colors.fairyGold}10`,
                border: `1px solid ${colors.fairyGold}30`,
                borderRadius: '8px',
                padding: `${spacing.sm} ${spacing.md}`,
                marginBottom: spacing.md,
              }}>
                <div style={{ color: colors.fairyGold, fontSize: '13px', fontWeight: 700 }}>
                  {archetype.emoji} {archetype.name}
                </div>
                <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>
                  {archetype.desc}
                </div>
              </div>
            )}

            {/* PostMortem analysis */}
            <div style={{ color: colors.textSecondary, fontSize: '12px', lineHeight: 1.6, marginBottom: spacing.md }}>
              {postMortem.analysis}
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { label: 'Вложено', value: `${postMortem.investedAmount.toFixed(0)} ₽` },
                { label: 'Получено', value: `${postMortem.returnedAmount.toFixed(0)} ₽` },
                { label: 'Дней', value: String(postMortem.daysActive) },
                { label: 'Чуйка', value: postMortem.intuitionDelta !== 0 ? `${postMortem.intuitionDelta > 0 ? '+' : ''}${postMortem.intuitionDelta}` : '—', color: postMortem.intuitionDelta > 0 ? colors.success : postMortem.intuitionDelta < 0 ? colors.danger : colors.textMuted },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ color: colors.textMuted, fontSize: '9px' }}>{s.label}</div>
                  <div style={{ color: s.color ?? colors.textSecondary, fontSize: '12px', fontWeight: 600 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Lie topics */}
            {postMortem.lieTopics.length > 0 && (
              <div style={{ marginTop: spacing.md }}>
                <div style={{ color: colors.textMuted, fontSize: '10px', marginBottom: '4px' }}>
                  🎭 Темы лжи хозяина:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {postMortem.lieTopics.map(t => (
                    <span key={t} style={{
                      background: `${colors.danger}20`,
                      border: `1px solid ${colors.danger}30`,
                      borderRadius: '4px',
                      padding: '2px 6px',
                      color: colors.danger,
                      fontSize: '10px',
                    }}>
                      {LIE_TOPIC_LABEL[t] ?? t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Closure reason */}
            {project.closureReason && (
              <div style={{ marginTop: spacing.md, color: colors.textMuted, fontSize: '11px', fontStyle: 'italic' }}>
                «{project.closureReason}»
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </FairyCard>
  )
}
