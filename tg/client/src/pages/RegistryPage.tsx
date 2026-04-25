import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ScreenBackground } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider, SkeletonCard } from '@/components/FairyCard'
import { api, type ProjectDTO, type PostMortemDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing } from '@/theme'

const RANK_LABEL: Record<string, string> = {
  NEWBIE: 'Скоморох', AMBASSADOR: 'Купец', ANALYST: 'Мудрец', SHARK: 'Боярин', LAMBO_SENSEI: 'Князь',
}

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
  const { gameState } = useGameStore()
  const { data, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: api.projects.getPortfolio,
  })

  // Сервер отдаёт до 10 последних закрытых дел, в которые игрок вкладывался.
  // Истёкшие/пропущенные грамоты в Летопись не попадают.
  const closed: ClosedProject[] = data?.closed ?? []

  const totalInvested = closed.reduce((s, p) => s + (p.postMortem?.investedAmount ?? 0), 0)
  const totalReturned = closed.reduce((s, p) => s + (p.postMortem?.returnedAmount ?? 0), 0)
  const overallPnl = totalInvested > 0 ? ((totalReturned - totalInvested) / totalInvested) * 100 : 0

  const handleShare = () => {
    const rank = gameState ? (RANK_LABEL[gameState.investorRank] ?? gameState.investorRank) : null
    const wealth = gameState
      ? gameState.balance + gameState.activeProjects.reduce((s, p) => s + p.currentValueRubles, 0)
      : 0

    const lines = [
      '📜 Моя Летопись в «Из грязи в князи»:',
      rank ? `Чин: ${rank} · чуйка ${gameState?.intuitionScore ?? 0}` : null,
      `Состояние: ${wealth.toFixed(0)} ₽`,
      closed.length > 0
        ? `Закрытых дел: ${closed.length} · итог ${overallPnl >= 0 ? '+' : ''}${overallPnl.toFixed(1)}%`
        : null,
      '',
      'Попробуй отличить купца от жулика — @vknyazi_bot',
    ].filter(Boolean).join('\n')

    const appUrl = 'https://t.me/vknyazi_bot'
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(appUrl)}&text=${encodeURIComponent(lines)}`
    const tg = (window as any).Telegram?.WebApp
    if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl)
    else window.open(shareUrl, '_blank')
  }

  return (
    <ScreenBackground>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.xl }}>
          <button
            onClick={() => navigate('/portfolio')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: `${colors.fairyGold}15`,
              border: `1px solid ${colors.fairyGold}40`,
              borderRadius: '10px',
              color: colors.fairyGold,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              padding: '8px 12px',
            }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>←</span>
            Назад
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ color: colors.fairyGold, fontSize: '20px', fontWeight: 700 }}>✦ Летопись ✦</div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '2px' }}>
              Архив закрытых дел
            </div>
          </div>
          <div style={{ width: '76px' }} />
        </div>

        {/* Summary card */}
        {closed.length > 0 && (
          <FairyCard style={{ marginBottom: spacing.md, textAlign: 'center' }}>
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

        {/* Share button */}
        {closed.length > 0 && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.1 }}
            onClick={handleShare}
            style={{
              width: '100%',
              marginBottom: spacing.xl,
              padding: `${spacing.md} ${spacing.lg}`,
              background: `${colors.fairyGold}18`,
              border: `1px solid ${colors.fairyGold}55`,
              borderRadius: '12px',
              color: colors.fairyGold,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '16px' }}>📤</span>
            Поделиться Летописью
          </motion.button>
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
            width: '100%', aspectRatio: '1 / 1', objectFit: 'cover',
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
