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
          // backdrop-filter:blur(10px) убран — самый дорогой эффект на
          // Android WebView, плюс под ним крутятся анимированные drop-shadow
          // токены. Alpha поднят с 0.92 до 0.97 для непрозрачности.
          background: 'rgba(6, 4, 18, 0.97)',
          overflow: 'hidden',
        }}
      >
        {/* Радиальное золотое сияние от центра — статичное, без вращения.
            Раньше тут крутился 160vmin conic-gradient с 24 секторами и
            mask-image на radial-gradient. На Android WebView эта пара
            (большой conic + mask) — самая тяжёлая GPU-операция в игре.
            Поскольку оверлей висит до тапа, при каждом resume Mini App
            это снова заводилось и давало мерцание. Радиал-градиент даёт
            тот же визуальный «сияние из центра» бесплатно. */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.85, scale: 1 }}
          transition={{ opacity: { duration: 0.5 }, scale: { duration: 0.6 } }}
          style={{
            position: 'absolute',
            width: '160vmin',
            height: '160vmin',
            background: `radial-gradient(circle, ${accent}55 0%, ${accent}22 25%, transparent 55%)`,
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
