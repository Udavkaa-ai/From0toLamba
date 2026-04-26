import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ScreenBackground } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider, SkeletonCard } from '@/components/FairyCard'
import { PageTitle } from '@/components/PageTitle'
import { api, type ProjectDTO } from '@/api/client'
import { colors, spacing } from '@/theme'

export function InboxPage() {
  const navigate = useNavigate()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: api.projects.getInbox,
    refetchInterval: 15_000,
  })

  return (
    <ScreenBackground>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
          <PageTitle>Входящие грамоты</PageTitle>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
            Новые предложения от хозяев дел
          </div>
        </div>

        {isLoading && [1, 2, 3].map(i => <SkeletonCard key={i} lines={4} />)}

        {!isLoading && projects.length === 0 && (
          <FairyCard style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: spacing.md }}>📭</div>
            <div style={{ color: colors.textSecondary }}>Новых предложений нет</div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
              Они появятся после следующего дня
            </div>
          </FairyCard>
        )}

        {projects.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            transition={{ delay: i * 0.07, duration: 0.1 }}
          >
            <InboxCard project={p} onClick={() => navigate(`/charter/${p.id}`)} />
          </motion.div>
        ))}
      </div>
    </ScreenBackground>
  )
}

function InboxCard({ project, onClick }: { project: ProjectDTO; onClick: () => void }) {
  const typeLabel: Record<string, string> = {
    CARD_GAME: '🃏 Азартная игра',
    TREASURE_HUNT: '🗺️ Поиск клада',
    POTION_BREW: '🧪 Зелейное дело',
    GUILD_SCHEME: '⚙️ Артель',
    HONEST_TRADE: '🤝 Честная торговля',
  }

  return (
    <FairyCard onClick={onClick} style={{ marginBottom: spacing.md, cursor: 'pointer' }}>
      {project.bannerImageUrl && (
        <img
          src={project.bannerImageUrl}
          alt={project.name}
          style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: '8px', marginBottom: spacing.md, display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '15px' }}>{project.name}</div>
          <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>
            {typeLabel[project.type] ?? project.type}
          </div>
        </div>
        <div style={{
          background: `${colors.fairyGold}20`,
          border: `1px solid ${colors.fairyGold}40`,
          borderRadius: '8px',
          padding: '4px 8px',
          color: colors.fairyGold,
          fontSize: '12px',
          fontWeight: 700,
        }}>
          {project.claimedAPY}% посул
        </div>
      </div>

      <OrnamentDivider />

      <div style={{ color: colors.textSecondary, fontSize: '12px', lineHeight: 1.5 }}>
        {project.description.slice(0, 120)}...
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing.md }}>
        <div style={{ color: colors.textMuted, fontSize: '11px' }}>
          👤 {project.developerName}
        </div>
        <div style={{ color: colors.textMuted, fontSize: '11px' }}>
          👥 {project.claimedUserCount.toLocaleString('ru')} вкладчиков
        </div>
      </div>

      <div style={{
        marginTop: spacing.md,
        padding: `${spacing.sm} ${spacing.md}`,
        background: `${colors.fairyGold}10`,
        borderRadius: '8px',
        color: colors.fairyGold,
        fontSize: '13px',
        textAlign: 'center',
        fontWeight: 600,
      }}>
        Изучить грамоту →
      </div>
    </FairyCard>
  )
}
