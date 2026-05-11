import { motion } from 'framer-motion'
import { colors, spacing } from '@/theme'

/**
 * Полноэкранный оверлей-плейсхолдер, который перекрывает интерфейс на время
 * перехода в следующий день. Маскирует зазор между ответом advance-day и
 * рефетчем инбокса/портфеля — без него игрок видел бы старые грамоты или
 * пустой инбокс на пару секунд.
 *
 * Анимация: купец гуляет туда-сюда по ярмарке, вокруг — палатка, мешок монет
 * и пляшущая грамота.
 */
export function DayTransitionOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(8, 4, 24, 0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: spacing.lg, maxWidth: 320, padding: `0 ${spacing.lg}`,
      }}>
        {/* Сцена */}
        <div style={{ position: 'relative', width: 240, height: 140 }}>
          {/* Палатка */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.05 }}
            style={{
              position: 'absolute',
              left: 8, top: 6,
              fontSize: 48,
              filter: `drop-shadow(0 4px 8px ${colors.fairyGold}40)`,
            }}
          >🏪</motion.div>

          {/* Мешок монет */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: [0, -6, 0], opacity: 1 }}
            transition={{ y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }, opacity: { delay: 0.2 } }}
            style={{
              position: 'absolute',
              right: 12, top: 24,
              fontSize: 38,
            }}
          >💰</motion.div>

          {/* Грамота — слегка качается */}
          <motion.div
            initial={{ rotate: -8, opacity: 0 }}
            animate={{ rotate: [-8, 8, -8], opacity: 1 }}
            transition={{ rotate: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }, opacity: { delay: 0.3 } }}
            style={{
              position: 'absolute',
              right: 26, bottom: 10,
              fontSize: 30,
            }}
          >📜</motion.div>

          {/* Купец, идущий слева-направо */}
          <motion.div
            animate={{ x: [0, 130, 0], scaleX: [1, 1, -1, -1, 1] }}
            transition={{
              x: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
              scaleX: { duration: 3.2, repeat: Infinity, times: [0, 0.45, 0.5, 0.95, 1] },
            }}
            style={{
              position: 'absolute',
              left: 40, bottom: 0,
              fontSize: 46,
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))',
            }}
          >🚶‍♂️</motion.div>

          {/* Маленькие звёздочки-пылинки */}
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={{ y: [-2, -10, -2], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
              style={{
                position: 'absolute',
                left: 30 + i * 70, top: -4 + i * 12,
                fontSize: 14, color: colors.fairyGold,
                opacity: 0.6,
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
          Ходишь по ярмарке…
        </motion.div>

        {/* Подтекст */}
        <div style={{
          color: colors.textMuted,
          fontSize: 13,
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          Купцы зазывают, гроши шуршат — ищешь, куда вложиться сегодня.
        </div>
      </div>
    </motion.div>
  )
}
