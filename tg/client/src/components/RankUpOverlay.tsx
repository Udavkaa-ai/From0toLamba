import { motion, AnimatePresence } from 'framer-motion'
import { colors } from '@/theme'
import { api } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'

const RANK_DISPLAY: Record<string, string> = {
  NEWBIE: 'Скоморох',
  AMBASSADOR: 'Купец',
  ANALYST: 'Мудрец',
  SHARK: 'Боярин',
  LAMBO_SENSEI: 'Князь',
}

const RANK_EMOJI: Record<string, string> = {
  NEWBIE: '🎪',
  AMBASSADOR: '🛒',
  ANALYST: '📖',
  SHARK: '🧥',
  LAMBO_SENSEI: '👑',
}

interface RankUpOverlayProps {
  rank: string
}

export function RankUpOverlay({ rank }: RankUpOverlayProps) {
  const clearPendingRankUp = useGameStore(s => s.clearPendingRankUp)

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
          background: 'rgba(6, 4, 18, 0.9)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <motion.div
          initial={{ scale: 0.5, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          style={{
            textAlign: 'center',
            padding: '32px 24px',
          }}
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
            transition={{ duration: 0.8, delay: 0.3 }}
            style={{ fontSize: '72px', marginBottom: '16px' }}
          >
            {RANK_EMOJI[rank] ?? '🏆'}
          </motion.div>
          <div style={{ color: colors.fairyGold, fontSize: '13px', marginBottom: '8px', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Новый купеческий чин
          </div>
          <div style={{ color: '#fff', fontSize: '32px', fontWeight: 700, marginBottom: '24px' }}>
            {RANK_DISPLAY[rank] ?? rank}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
            Нажми, чтобы продолжить
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
