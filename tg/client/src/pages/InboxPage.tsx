import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ScreenBackground, PAGE_BG } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider, SkeletonCard } from '@/components/FairyCard'
import { PageTitle } from '@/components/PageTitle'
import { VipArrivalOverlay, getSeenVipIds, markVipSeen } from '@/components/VipArrivalOverlay'
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

  // VIP-оверлей при первом появлении спонсорского дела (для каждого projectId
  // один раз, дальше localStorage его помнит). Показываем самое свежее
  // непросмотренное VIP-дело в инбоксе.
  const [vipShow, setVipShow] = useState<ProjectDTO | null>(null)
  useEffect(() => {
    if (vipShow) return // уже показываем
    const seen = getSeenVipIds()
    const unseenVip = projects.find(p => p.isSponsor && !seen.has(p.id))
    if (unseenVip) setVipShow(unseenVip)
  }, [projects, vipShow])

  const closeVip = () => {
    if (vipShow) markVipSeen(vipShow.id)
    setVipShow(null)
  }

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

        {/* VIP-дела всегда сверху — отдельный порядок (sponsorship), потом обычные */}
        {[...projects].sort((a, b) => {
          if (a.isSponsor !== b.isSponsor) return a.isSponsor ? -1 : 1
          return 0
        }).map((p, i) => (
          <motion.div
            key={p.id}
            {...(i === 0 ? { 'data-tour': 'first-project' } : {})}
            initial={p.isSponsor
              ? { opacity: 0, scale: 0.8, y: -20 }
              : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            whileTap={{ scale: 0.97 }}
            transition={p.isSponsor
              ? { type: 'spring', damping: 14, stiffness: 200, delay: i * 0.07 }
              : { delay: i * 0.07, duration: 0.1 }}
          >
            <InboxCard project={p} onClick={() => navigate(`/charter/${p.id}`)} tourAttr={i === 0} />
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {vipShow && (
          <VipArrivalOverlay
            key={vipShow.id}
            project={vipShow}
            onClose={closeVip}
            onOpenDeal={() => {
              const id = vipShow.id
              closeVip()
              navigate(`/charter/${id}`)
            }}
          />
        )}
      </AnimatePresence>
    </ScreenBackground>
  )
}

function InboxCard({ project, onClick, tourAttr }: { project: ProjectDTO; onClick: () => void; tourAttr?: boolean }) {
  const t = useT()
  const typeLabel = t.inbox.types
  const isVip = project.isSponsor

  return (
    <div style={{ position: 'relative', marginBottom: spacing.md }}>
      {/* VIP-обводка снаружи карточки + бесконечное золотое пульсирование */}
      {isVip && (
        <div aria-hidden className="vip-glow" style={{
          position: 'absolute', inset: -3, borderRadius: 18,
          background: 'linear-gradient(135deg, #FFD24A 0%, #FFB800 50%, #B07400 100%)',
          zIndex: 0,
        }} />
      )}
      <FairyCard onClick={onClick} style={{
        cursor: 'pointer',
        position: 'relative', zIndex: 1,
        ...(isVip ? { border: `2px solid #FFE090` } : {}),
      }}>
        {isVip && (
          <div style={{
            position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
            padding: '2px 14px',
            background: 'linear-gradient(135deg, #FFD24A, #FFB800)',
            color: '#3A2010', fontWeight: 800, fontSize: '11px',
            letterSpacing: '0.15em',
            borderRadius: 8,
            boxShadow: '0 3px 10px rgba(0,0,0,0.45)',
            zIndex: 2,
            fontFamily: "'Cinzel', 'Marcellus', serif",
            whiteSpace: 'nowrap',
          }}>
            ✦ ЗОЛОТАЯ ГРАМОТА ✦
          </div>
        )}
        {project.bannerImageUrl && (
          <img
            src={project.bannerImageUrl}
            alt={project.name}
            style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: '8px', marginBottom: spacing.md, display: 'block', marginTop: isVip ? 8 : 0 }}
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
          {isVip && (
            <div style={{
              padding: '4px 8px',
              background: 'rgba(80,200,120,0.18)',
              border: `1px solid ${colors.success}`,
              borderRadius: 6,
              color: colors.success,
              fontWeight: 800, fontSize: '11px',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}>
              +200% за 14 дн
            </div>
          )}
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
          {isVip ? '🔑 Сказать заветное слово' : t.inbox.studyBtn}
        </div>
      </FairyCard>
    </div>
  )
}
