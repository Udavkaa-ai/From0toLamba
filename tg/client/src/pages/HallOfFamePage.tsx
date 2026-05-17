import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ScreenBackground, PAGE_BG } from '@/components/ScreenBackground'
import { FairyCard, SkeletonCard } from '@/components/FairyCard'
import { PageTitle, PageSubtitle } from '@/components/PageTitle'
import { api } from '@/api/client'
import { colors, spacing, ctaButton } from '@/theme'

// ───────────────────────────────────────────────────────────
// Зал славы 1 сезона: финальный топ-100 по каждой категории
// (Злато / Связи / Достижения / Сваты), замороженный командой
// /snapshot_season на сервере. История доступна навсегда.
// ───────────────────────────────────────────────────────────

type Category = 'WEALTH' | 'TIES' | 'ACHIEVEMENTS' | 'REFERRALS'

const CATEGORY_LABELS: Record<Category, { label: string; emoji: string; valueLabel: string }> = {
  WEALTH:       { label: 'Злато',       emoji: '💰', valueLabel: 'г'  },
  TIES:         { label: 'Связи',       emoji: '⚡', valueLabel: 'lv' },
  ACHIEVEMENTS: { label: 'Достижения',  emoji: '🏆', valueLabel: 'оч' },
  REFERRALS:    { label: 'Сваты',       emoji: '🤝', valueLabel: 'чел' },
}

export function HallOfFamePage() {
  const navigate = useNavigate()
  const params = useParams<{ seasonNumber?: string }>()
  const seasonNumber = parseInt(params.seasonNumber ?? '1', 10)
  const [tab, setTab] = useState<Category>('WEALTH')

  const { data, isLoading, error } = useQuery({
    queryKey: ['seasonArchive', seasonNumber],
    queryFn: () => api.seasonArchive.get(seasonNumber),
    staleTime: 5 * 60_000, // архив не меняется — кэшируем агрессивно
  })

  return (
    <ScreenBackground bgImage={PAGE_BG.leaderboard}>
      <div style={{ padding: spacing.lg, paddingBottom: 100 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.textPrimary,
            fontSize: 14,
            cursor: 'pointer',
            marginBottom: spacing.sm,
            padding: '4px 0',
          }}
        >
          ← Назад
        </button>

        <PageTitle>🏛 Зал славы</PageTitle>
        <PageSubtitle>Сезон {seasonNumber} · финальный топ-100</PageSubtitle>

        {isLoading && <SkeletonCard lines={6} />}
        {error && (
          <FairyCard>
            <div style={{ color: colors.textPrimary, fontSize: 14, padding: spacing.md, textAlign: 'center' }}>
              Зал славы сезона {seasonNumber} ещё не открыт.
            </div>
          </FairyCard>
        )}

        {data && (
          <FairyCard>
            {/* Табы категорий */}
            <div style={{ display: 'flex', gap: 6, marginBottom: spacing.md, flexWrap: 'wrap' }}>
              {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => {
                const active = tab === cat
                const cfg = CATEGORY_LABELS[cat]
                const hasData = !!data.categories[cat]
                return (
                  <button
                    key={cat}
                    onClick={() => setTab(cat)}
                    disabled={!hasData}
                    style={{
                      flex: '1 1 calc(50% - 3px)',
                      padding: '8px 6px',
                      background: active ? `${colors.fairyGold}28` : 'rgba(0,0,0,0.18)',
                      border: `1px solid ${active ? colors.fairyGold : 'rgba(0,0,0,0.18)'}`,
                      borderRadius: 8,
                      color: active ? colors.fairyGold : colors.textSecondary,
                      fontSize: 12, fontWeight: active ? 800 : 600,
                      cursor: hasData ? 'pointer' : 'not-allowed',
                      opacity: hasData ? 1 : 0.4,
                    }}
                  >
                    {cfg.emoji} {cfg.label}
                  </button>
                )
              })}
            </div>

            <CategoryList category={tab} archive={data.categories[tab]} />
          </FairyCard>
        )}

        <div style={{
          marginTop: spacing.md,
          color: colors.textMuted, fontSize: 11, textAlign: 'center',
          lineHeight: 1.5,
        }}>
          История заморожена и сохраняется навсегда.<br/>
          Текущий рейтинг — на вкладке «Сегодня».
        </div>
      </div>
    </ScreenBackground>
  )
}

function CategoryList({ category, archive }: {
  category: Category
  archive: { entries: any[]; totalPlayers: number; capturedAt: string } | undefined
}) {
  if (!archive) {
    return (
      <div style={{ color: colors.textMuted, fontSize: 12, padding: spacing.md, textAlign: 'center' }}>
        Данных по этой категории нет.
      </div>
    )
  }

  const valueOf = (e: any): { display: string; suffix: string } => {
    switch (category) {
      case 'WEALTH':
        // Math.floor — totalWealth в архиве может прийти с дробной частью
        // (старые снимки писали balance + Σ currentValueRubles без округления).
        return { display: Math.floor(e.totalWealth ?? 0).toLocaleString('ru'), suffix: 'г' }
      case 'TIES':
        return { display: String(Math.floor(e.tiesTotal ?? 0)), suffix: '' }
      case 'ACHIEVEMENTS':
        return { display: String(Math.floor(e.achievementScore ?? 0)), suffix: 'оч' }
      case 'REFERRALS':
        return { display: String(Math.floor(e.referralCount ?? 0)), suffix: 'чел' }
    }
  }

  return (
    <>
      <div style={{ color: colors.textMuted, fontSize: 11, marginBottom: spacing.sm }}>
        Всего игроков в категории: {archive.totalPlayers}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {archive.entries.map((entry, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
          const displayName = entry.username ? `@${entry.username}` : entry.firstName
          const { display, suffix } = valueOf(entry)
          const isTopThree = i < 3
          return (
            <div
              key={`${entry.userId}-${i}`}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing.sm,
                padding: '8px 10px',
                background: isTopThree ? `${colors.fairyGold}14` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isTopThree ? `${colors.fairyGold}55` : 'transparent'}`,
                borderRadius: 10,
              }}
            >
              <span style={{ width: 30, fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                {medal}
              </span>
              <span style={{
                flex: 1,
                color: colors.textPrimary,
                fontSize: 13, fontWeight: isTopThree ? 700 : 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {displayName}
              </span>
              <span style={{
                padding: '2px 8px',
                background: 'rgba(20,10,2,0.55)',
                borderRadius: 8,
                color: colors.fairyGold, fontWeight: 800, fontSize: 13,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}>
                {display}{suffix && ' '}{suffix}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}
