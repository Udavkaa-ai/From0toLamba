import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { colors, typography } from '@/theme'

interface CoinShowerOverlayProps {
  /** Сколько грошей упало в казну за день. Может быть отрицательным — тогда дождь монет идёт «вверх», как утечка. */
  delta: number
  /** Сколько секунд держать сцену. */
  durationSec?: number
  /** Колбэк по окончании. */
  onDone?: () => void
}

/**
 * Полноэкранный одноразовый «дождь монет» при переходе на следующий день.
 * Не блокирует тапы — pointerEvents: 'none'. Не управляет ни данными, ни состоянием.
 */
export function CoinShowerOverlay({ delta, durationSec = 2.0, onDone }: CoinShowerOverlayProps) {
  const isLoss = delta < 0
  // 18–24 монет, детерминированы один раз на жизнь компонента
  const coins = useMemo(() => {
    const count = Math.min(28, Math.max(14, Math.floor(Math.abs(delta) / 50) + 14))
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      leftPct: Math.random() * 92 + 4,         // 4–96%
      delay: Math.random() * (durationSec * 0.55),
      duration: 0.9 + Math.random() * 0.8,
      size: 16 + Math.random() * 18,
      rotEnd: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360),
      drift: (Math.random() - 0.5) * 80,
    }))
  }, [delta, durationSec])

  useEffect(() => {
    if (!onDone) return
    const id = setTimeout(onDone, durationSec * 1000 + 200)
    return () => clearTimeout(id)
  }, [onDone, durationSec])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 280,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {coins.map(c => (
        <motion.div
          key={c.id}
          initial={{
            top: isLoss ? '85vh' : '-12vh',
            left: `${c.leftPct}%`,
            x: 0,
            rotate: 0,
            opacity: 0,
          }}
          animate={{
            top: isLoss ? '-12vh' : '92vh',
            x: c.drift,
            rotate: c.rotEnd,
            opacity: [0, 1, 1, 0.7, 0],
          }}
          transition={{
            duration: c.duration,
            delay: c.delay,
            ease: isLoss ? 'easeIn' : [0.42, 0.0, 0.7, 1.0],
            opacity: { times: [0, 0.1, 0.6, 0.85, 1], duration: c.duration, delay: c.delay },
          }}
          style={{
            position: 'absolute',
            width: c.size, height: c.size,
            transform: 'translateX(-50%)',
            willChange: 'transform, top, opacity',
          }}
        >
          <Coin size={c.size} negative={isLoss} />
        </motion.div>
      ))}

      {/* Большая плашка с дельтой по центру */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.85 }}
        animate={{ opacity: [0, 1, 1, 0], y: [20, 0, -8, -32], scale: [0.85, 1, 1.05, 1.1] }}
        transition={{ duration: durationSec, times: [0, 0.18, 0.78, 1], ease: 'easeOut' }}
        style={{
          position: 'absolute',
          left: 0, right: 0, top: '38%',
          textAlign: 'center',
          fontFamily: typography.headingFontFamily,
          fontSize: 56, fontWeight: 900,
          color: isLoss ? colors.danger : colors.fairyGold,
          textShadow: isLoss
            ? '0 4px 18px rgba(255,80,80,0.55), 0 0 32px rgba(255,80,80,0.35)'
            : `0 4px 18px ${colors.fairyGold}99, 0 0 32px ${colors.fairyGold}66`,
          letterSpacing: '0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {isLoss ? '−' : '+'}{Math.abs(Math.floor(delta))} г
      </motion.div>
    </div>
  )
}

/** Простая монета — золотой круг с обводкой и буквой «г». */
function Coin({ size, negative }: { size: number; negative: boolean }) {
  const fill = negative ? '#A04040' : '#FFB800'
  const stroke = negative ? '#5A1010' : '#8C6200'
  const inner = negative ? '#7A2020' : '#FFCB45'
  const fontSize = size * 0.55
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} style={{ display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>
      <circle cx="16" cy="16" r="14" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <circle cx="16" cy="16" r="11" fill={inner} opacity="0.7" />
      <text
        x="16" y="22"
        fontSize={fontSize}
        fontWeight="900"
        fontFamily="Georgia, serif"
        textAnchor="middle"
        fill={stroke}
        style={{ pointerEvents: 'none' }}
      >
        г
      </text>
    </svg>
  )
}
