import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ScreenBackground, PAGE_BG } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider, SkeletonCard } from '@/components/FairyCard'
import { PageTitle } from '@/components/PageTitle'
import { api, type ProjectDTO } from '@/api/client'
import { colors, spacing, gradients } from '@/theme'
import { useT } from '@/i18n'

export function InboxPage() {
  const navigate = useNavigate()
  const t = useT()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: api.projects.getInbox,
    refetchInterval: 15_000,
  })

  return (
    <ScreenBackground bgImage={PAGE_BG.inbox}>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
          <PageTitle>{t.inbox.title}</PageTitle>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
            {t.inbox.subtitle}
          </div>
        </div>

        {isLoading && [1, 2, 3].map(i => <SkeletonCard key={i} lines={4} />)}

        {!isLoading && projects.length === 0 && (
          <FairyCard style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: spacing.md }}>📭</div>
            <div style={{ color: colors.textSecondary }}>{t.inbox.empty}</div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
              {t.inbox.emptyHint}
            </div>
          </FairyCard>
        )}

        {projects.map((p, i) => (
          <motion.div
            key={p.id}
            {...(i === 0 ? { 'data-tour': 'first-project' } : {})}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            transition={{ delay: i * 0.07, duration: 0.1 }}
          >
            <InboxCard project={p} onClick={() => navigate(`/charter/${p.id}`)} tourAttr={i === 0} />
          </motion.div>
        ))}
      </div>
    </ScreenBackground>
  )
}

function InboxCard({ project, onClick, tourAttr }: { project: ProjectDTO; onClick: () => void; tourAttr?: boolean }) {
  const t = useT()
  const typeLabel = t.inbox.types

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
            {(typeLabel as Record<string, string>)[project.type] ?? project.type}
          </div>
        </div>
      </div>

      <OrnamentDivider />

      <div style={{ color: colors.textSecondary, fontSize: '12px', lineHeight: 1.5 }}>
        {project.description.slice(0, 120)}...
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing.md }}>
        <div style={{ color: colors.textMuted, fontSize: '11px' }}>
          {t.inbox.developer} {project.developerName}
        </div>
        <div style={{ color: colors.textMuted, fontSize: '11px' }}>
          {t.inbox.investors} {project.currentUserCount.toLocaleString('ru')} {t.inbox.investorsSuffix}
        </div>
      </div>

      <div style={{
        marginTop: spacing.md,
        padding: `${spacing.sm} ${spacing.md}`,
        background: gradients.goldBtn,
        border: `1px solid ${colors.fairyGoldDim}`,
        borderRadius: '10px',
        color: colors.textOnGold,
        fontSize: '13px',
        textAlign: 'center',
        fontWeight: 700,
        boxShadow: `0 3px 10px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,235,170,0.55)`,
      }}
        {...(tourAttr ? { 'data-tour': 'charter-btn' } : {})}
      >
        {t.inbox.studyBtn}
      </div>
    </FairyCard>
  )
}
