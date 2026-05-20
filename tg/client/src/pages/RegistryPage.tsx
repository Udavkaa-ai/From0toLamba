import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ScreenBackground, PAGE_BG } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider, SkeletonCard } from '@/components/FairyCard'
import { PageTitle, PageSubtitle } from '@/components/PageTitle'
import { api, type ProjectDTO, type PostMortemDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing } from '@/theme'
import { useT } from '@/i18n'

// Emoji and desc are not in i18n — kept locally
const ARCHETYPE_META: Record<string, { emoji: string; desc: string }> = {
  BURATINO:   { emoji: '🪆', desc: 'Наивный лжец — верил своим выдумкам' },
  BOYARIN:    { emoji: '👘', desc: 'Пышно-официальный, ссылался на «людей при дворе»' },
  KOLOBOK:    { emoji: '🫓', desc: 'Бодрый хвастун, укатывался от неудобных вопросов' },
  KOSCHEI:    { emoji: '💀', desc: 'Холодный и уверенный, говорил цифрами как приговорами' },
  ZOLUSHKA:   { emoji: '👠', desc: 'Давила на жалость и создавала дедлайны' },
  BABA_YAGA:  { emoji: '🧙', desc: 'Отвечала загадками, скрывала всё за туманом' },
  IVAN_DURAK: { emoji: '🤡', desc: 'Открыто говорил о провалах — и снова проваливался' },
}

// Colors are not in i18n — kept locally
const FATE_COLOR: Record<string, string> = {
  INSTANT_SCAM: colors.danger,
  SLOW_DRAIN:   '#E8A060',
  HONEST_FAIL:  colors.textMuted,
  SURVIVOR:     colors.success,
  UNICORN:      colors.fairyGold,
}

type ClosedProject = ProjectDTO & { postMortem: PostMortemDTO | null }

export function RegistryPage() {
  const navigate = useNavigate()
  const { gameState } = useGameStore()
  const t = useT()
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
    const rank = gameState ? ((t.ranks as unknown as Record<string, string>)[gameState.investorRank] ?? gameState.investorRank) : ''
    const dealsCount = gameState?.dealsCount ?? 0
    const wealth = gameState
      ? gameState.balance + gameState.activeProjects.reduce((s, p) => s + p.currentValueRubles, 0)
      : 0
    const pnlStr = `${overallPnl >= 0 ? '+' : ''}${overallPnl.toFixed(1)}`

    const shareText = rank
      ? t.registry.shareText(rank, dealsCount, Math.floor(wealth), closed.length, parseFloat(pnlStr))
      : `${Math.floor(wealth)} г · ${closed.length} дел · ${pnlStr}%`

    const appUrl = gameState?.userId
      ? `https://t.me/vknyazi_bot?startapp=ref_${gameState.userId}`
      : 'https://t.me/vknyazi_bot'
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(appUrl)}&text=${encodeURIComponent(shareText)}`
    const tg = (window as any).Telegram?.WebApp
    if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl)
    else window.open(shareUrl, '_blank')
  }

  return (
    <ScreenBackground bgImage={PAGE_BG.registry}>
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
            {t.common.back}
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <PageTitle>{t.registry.title}</PageTitle>
            <PageSubtitle>{t.registry.subtitle}</PageSubtitle>
          </div>
          <div style={{ width: '76px' }} />
        </div>

        {/* Summary card */}
        {closed.length > 0 && (
          <FairyCard style={{ marginBottom: spacing.md, textAlign: 'center' }}>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginBottom: spacing.sm }}>
              {t.registry.dealsCount(closed.length)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div>
                <div style={{ color: colors.textMuted, fontSize: '10px' }}>{t.registry.invested}</div>
                <div style={{ color: colors.textSecondary, fontWeight: 700 }}>{Math.floor(totalInvested)} г</div>
              </div>
              <div>
                <div style={{ color: colors.textMuted, fontSize: '10px' }}>{t.registry.returned}</div>
                <div style={{ color: colors.textSecondary, fontWeight: 700 }}>{Math.floor(totalReturned)} г</div>
              </div>
              <div>
                <div style={{ color: colors.textMuted, fontSize: '10px' }}>{t.registry.roi}</div>
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
            {t.registry.shareBtn}
          </motion.button>
        )}

        {isLoading && [1, 2, 3].map(i => <SkeletonCard key={i} lines={4} />)}

        {!isLoading && closed.length === 0 && (
          <FairyCard style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: spacing.sm }}>📖</div>
            <div style={{ color: colors.textSecondary }}>{t.registry.empty}</div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
              {t.registry.emptyHint}
            </div>
          </FairyCard>
        )}

        {closed.map((project) => (
          <div key={project.id}>
            <RegistryCard project={project} postMortem={project.postMortem} />
          </div>
        ))}
      </div>
    </ScreenBackground>
  )
}

function RegistryCard({ project, postMortem }: { project: ClosedProject; postMortem: PostMortemDTO | null }) {
  const [expanded, setExpanded] = useState(false)
  const t = useT()

  const archetypeMeta = postMortem ? ARCHETYPE_META[postMortem.revealedArchetype] : null
  const archetypeName = postMortem ? (t.archetypes[postMortem.revealedArchetype as keyof typeof t.archetypes] ?? postMortem.revealedArchetype) : null
  const archetype = archetypeMeta && archetypeName ? { ...archetypeMeta, name: archetypeName } : null
  const fateColor = postMortem ? (FATE_COLOR[postMortem.fate] ?? colors.textMuted) : null
  const fateLabel = postMortem ? (t.fates[postMortem.fate as keyof typeof t.fates] ?? postMortem.fate) : null
  const fate = fateColor && fateLabel ? { color: fateColor, label: fateLabel } : null
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
            width: '100%', aspectRatio: '16 / 9', objectFit: 'cover',
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
            {t.projectTypes[project.type as keyof typeof t.projectTypes] ?? project.type}
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
        {expanded ? t.registry.collapse : t.registry.expand}
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
                { label: t.registry.invested, value: `${Math.floor(postMortem.investedAmount)} ${t.common.currency}` },
                { label: t.registry.returned, value: `${Math.floor(postMortem.returnedAmount)} ${t.common.currency}` },
                { label: t.common.days, value: String(postMortem.daysActive) },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ color: colors.textMuted, fontSize: '9px' }}>{s.label}</div>
                  <div style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Lie topics */}
            {postMortem.lieTopics.length > 0 && (
              <div style={{ marginTop: spacing.md }}>
                <div style={{ color: colors.textMuted, fontSize: '10px', marginBottom: '4px' }}>
                  {t.registry.lieLabelPrefix}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {postMortem.lieTopics.map(topic => (
                    <span key={topic} style={{
                      background: `${colors.danger}20`,
                      border: `1px solid ${colors.danger}30`,
                      borderRadius: '4px',
                      padding: '2px 6px',
                      color: colors.danger,
                      fontSize: '10px',
                    }}>
                      {t.registry.lieTopics[topic as keyof typeof t.registry.lieTopics] ?? topic}
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
