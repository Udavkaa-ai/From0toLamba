import { motion, AnimatePresence } from 'framer-motion'
import { colors, typography, RANK_COLOR } from '@/theme'
import { api } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { useT } from '@/i18n'
import { CrownIcon } from './icons'

interface RankUpOverlayProps {
  rank: string
}

export function RankUpOverlay({ rank }: RankUpOverlayProps) {
  const t = useT()
  const clearPendingRankUp = useGameStore(s => s.clearPendingRankUp)
  const accent = RANK_COLOR[rank] ?? colors.fairyGold

  const dismiss = async () => {
    clearPendingRankUp()
    await api.game.clearRankUp().catch(() => {})
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={dismiss}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(6, 4, 18, 0.92)',
          backdropFilter: 'blur(10px)',
          overflow: 'hidden',
        }}
      >
        {/* Лучи от центра — через CSS conic-gradient */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
          animate={{ opacity: 0.6, scale: 1, rotate: 360 }}
          transition={{ opacity: { duration: 0.5 }, scale: { duration: 0.6 }, rotate: { duration: 36, repeat: Infinity, ease: 'linear' } }}
          style={{
            position: 'absolute',
            width: '160vmin',
            height: '160vmin',
            background: `conic-gradient(from 0deg, transparent 0deg 8deg, ${accent}30 8deg 12deg, transparent 12deg 30deg, ${accent}20 30deg 32deg, transparent 32deg 60deg, ${accent}30 60deg 64deg, transparent 64deg 90deg, ${accent}20 90deg 92deg, transparent 92deg 120deg, ${accent}30 120deg 124deg, transparent 124deg 150deg, ${accent}20 150deg 152deg, transparent 152deg 180deg, ${accent}30 180deg 184deg, transparent 184deg 210deg, ${accent}20 210deg 212deg, transparent 212deg 240deg, ${accent}30 240deg 244deg, transparent 244deg 270deg, ${accent}20 270deg 272deg, transparent 272deg 300deg, ${accent}30 300deg 304deg, transparent 304deg 330deg, ${accent}20 330deg 332deg, transparent 332deg 360deg)`,
            maskImage: 'radial-gradient(circle, black 20%, transparent 65%)',
            WebkitMaskImage: 'radial-gradient(circle, black 20%, transparent 65%)',
          }}
        />

        <motion.div
          initial={{ scale: 0.5, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          style={{
            textAlign: 'center',
            padding: '32px 24px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <motion.div
            animate={{
              rotate: [0, -8, 8, -4, 4, 0],
              filter: [
                `drop-shadow(0 0 0 ${accent}00)`,
                `drop-shadow(0 0 24px ${accent})`,
                `drop-shadow(0 0 16px ${accent}cc)`,
              ],
            }}
            transition={{ duration: 1.2, delay: 0.3 }}
            style={{ marginBottom: '20px', display: 'inline-block', color: accent }}
          >
            <CrownIcon size={88} />
          </motion.div>

          <div style={{
            color: accent,
            fontSize: '12px',
            marginBottom: '10px',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            {t.rankup.title}
          </div>

          <div style={{
            color: '#fff',
            fontFamily: typography.headingFontFamily,
            fontSize: '36px',
            fontWeight: 700,
            marginBottom: '24px',
            letterSpacing: '0.05em',
            textShadow: `0 0 24px ${accent}, 0 0 48px ${accent}80`,
          }}>
            {t.ranks[rank as keyof typeof t.ranks] as string ?? rank}
          </div>

          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
            {t.rankup.hint}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
