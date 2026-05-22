import { motion } from 'framer-motion'
import { colors, spacing } from '@/theme'
import { useT } from '@/i18n'

/**
 * Полноэкранный оверлей-плейсхолдер, который перекрывает интерфейс на время
 * перехода в следующий день. Маскирует зазор между ответом advance-day и
 * рефетчем инбокса/портфеля — без него игрок видел бы старые грамоты или
 * пустой инбокс на пару секунд.
 *
 * Сцена в духе сказочной русской ярмарки: царские палаты, матрёшка, грамота,
 * купец-странник в шляпе и волшебные искры.
 */
export function DayTransitionOverlay() {
  const t = useT()
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        // backdrop-filter:blur(6px) убран ради перфоманса на Android WebView,
        // alpha поднят с 0.92 до 0.97 чтобы фон под оверлеем не отвлекал.
        background: 'rgba(8, 4, 24, 0.97)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: spacing.lg, maxWidth: 320, padding: `0 ${spacing.lg}`,
      }}>
        {/* Сцена ярмарки */}
        <div style={{ position: 'relative', width: 240, height: 160 }}>
          {/* Царские палаты слева */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.05 }}
            style={{
              position: 'absolute',
              left: 6, top: 4,
              fontSize: 56,
              filter: `drop-shadow(0 4px 10px ${colors.fairyGold}50)`,
            }}
          >🏰</motion.div>

          {/* Матрёшка справа — слегка покачивается */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: [0, -5, 0], rotate: [-3, 3, -3], opacity: 1 }}
            transition={{
              y: { duration: 2.0, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
              opacity: { delay: 0.18 },
            }}
            style={{
              position: 'absolute',
              right: 10, top: 18,
              fontSize: 50,
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
            }}
          >🪆</motion.div>

          {/* Грамота — пляшет внизу-справа */}
          <motion.div
            initial={{ rotate: -8, opacity: 0 }}
            animate={{ rotate: [-8, 10, -8], opacity: 1 }}
            transition={{
              rotate: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
              opacity: { delay: 0.3 },
            }}
            style={{
              position: 'absolute',
              right: 28, bottom: 12,
              fontSize: 32,
            }}
          >📜</motion.div>

          {/* Самовар — у правого нижнего края */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.22 }}
            style={{
              position: 'absolute',
              left: 14, bottom: 6,
              fontSize: 28,
            }}
          >🫖</motion.div>

          {/* Купец-странник: идёт по ярмарке туда-сюда.
              🧙‍♂️ обычно смотрит ВЛЕВО на большинстве платформ, поэтому
              при движении ВПРАВО его надо отзеркалить (scaleX = -1), а при
              движении ВЛЕВО оставлять как есть. Прошлая версия делала
              наоборот — отсюда был эффект «ходит задом наперёд». */}
          <motion.div
            animate={{ x: [0, 130, 0], scaleX: [-1, -1, 1, 1, -1] }}
            transition={{
              x: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' },
              scaleX: { duration: 3.4, repeat: Infinity, times: [0, 0.45, 0.5, 0.95, 1] },
            }}
            style={{
              position: 'absolute',
              left: 50, bottom: 0,
              fontSize: 48,
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.7))',
            }}
          >🧙‍♂️</motion.div>

          {/* Сказочные искры по всей сцене */}
          {[0, 1, 2, 3].map(i => (
            <motion.div
              key={i}
              animate={{ y: [-2, -14, -2], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
              style={{
                position: 'absolute',
                left: 20 + i * 56,
                top: i % 2 === 0 ? -4 : 10,
                fontSize: 14,
                color: colors.fairyGold,
                opacity: 0.7,
              }}
            >✨</motion.div>
          ))}
        </div>

        {/* Пульсирующий заголовок */}
        <motion.div
          animate={{ opacity: [0.65, 1, 0.65] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            color: colors.fairyGold,
            fontWeight: 700,
            fontSize: 18,
            textAlign: 'center',
            letterSpacing: '0.02em',
          }}
        >
          {t.overlays.dawnTitle}
        </motion.div>

        {/* Подтекст */}
        <div style={{
          color: colors.textOnDarkMuted,
          fontSize: 13,
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          {t.overlays.dawnSubtitle}
        </div>
      </div>
    </motion.div>
  )
}
