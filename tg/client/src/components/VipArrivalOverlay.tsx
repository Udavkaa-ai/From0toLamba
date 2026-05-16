import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { playSound } from '@/sounds'
import type { ProjectDTO } from '@/api/client'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

/**
 * «Вот это удача!» — полноэкранный оверлей при первом появлении VIP-дела
 * в инбоксе. Показывается один раз для каждого projectId (запоминается в
 * localStorage). Авто-закрывается через 4 секунды или по тапу.
 *
 * Слои анимации:
 *   1. Радиальный backdrop (центр золотой, края тёмные)
 *   2. Конусные лучи из центра (медленное вращение через CSS-animation)
 *   3. ~28 эмодзи-конфетти разлетаются из центра наружу
 *   4. Корона + бейдж «✦ VIP ✦» (spring-выпрыгивание)
 *   5. «ВОТ ЭТО УДАЧА!» — крупный серифный текст с непрерывной вибрацией
 *   6. Превью карточки дела (имя, хозяин, бейдж +200%)
 *   7. Кнопка «Посмотреть грамоту →»
 */
export function VipArrivalOverlay({
  project, onClose, onOpenDeal,
}: {
  project: ProjectDTO
  onClose: () => void
  onOpenDeal: () => void
}) {
  // Конфетти-частицы: набор детерминированных позиций по seed projectId
  const sparkles = useMemo(() => {
    const out: Array<{ x: number; y: number; delay: number; emoji: string; size: number; rot: number }> = []
    const emojis = ['✨', '⭐', '💫', '🌟', '✦', '🪙', '👑', '💰']
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2 + Math.random() * 0.3
      const dist = 35 + Math.random() * 60   // vmin от центра
      out.push({
        x: 50 + Math.cos(angle) * dist,
        y: 50 + Math.sin(angle) * dist,
        delay: Math.random() * 0.6,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        size: 16 + Math.random() * 20,
        rot: (Math.random() - 0.5) * 720,
      })
    }
    return out
  }, [project.id])

  useEffect(() => {
    haptic?.notificationOccurred('success')
    playSound('rankup')
    // Дополнительный «звон» через 0.4с — двойной удар по слуху
    const sndId = setTimeout(() => playSound('win'), 400)
    // Авто-закрытие через 4с (можно тапнуть раньше)
    const closeId = setTimeout(onClose, 4200)
    return () => { clearTimeout(sndId); clearTimeout(closeId) }
  }, [project.id, onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background:
          'radial-gradient(circle at center, rgba(255,184,0,0.32) 0%, rgba(122,82,18,0.55) 30%, rgba(0,0,0,0.94) 75%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 14, padding: 24,
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Вращающиеся лучи из центра (conic-gradient секторами) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%', top: '50%',
          width: '180vmax', height: '180vmax',
          background:
            'conic-gradient(from 0deg, rgba(255,200,80,0.2) 0deg, transparent 14deg, rgba(255,200,80,0.2) 28deg, transparent 42deg, rgba(255,200,80,0.2) 56deg, transparent 70deg, rgba(255,200,80,0.2) 84deg, transparent 98deg, rgba(255,200,80,0.2) 112deg, transparent 126deg, rgba(255,200,80,0.2) 140deg, transparent 154deg, rgba(255,200,80,0.2) 168deg, transparent 182deg, rgba(255,200,80,0.2) 196deg, transparent 210deg, rgba(255,200,80,0.2) 224deg, transparent 238deg, rgba(255,200,80,0.2) 252deg, transparent 266deg, rgba(255,200,80,0.2) 280deg, transparent 294deg, rgba(255,200,80,0.2) 308deg, transparent 322deg, rgba(255,200,80,0.2) 336deg, transparent 350deg, rgba(255,200,80,0.2) 360deg)',
          animation: 'vipRayspin 24s linear infinite',
          transformOrigin: 'center',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          opacity: 0.7,
          mixBlendMode: 'screen',
        }}
      />

      {/* Конфетти-эмодзи (разлет из центра наружу) */}
      {sparkles.map((s, i) => (
        <motion.div
          key={i}
          aria-hidden
          initial={{ left: '50vw', top: '50vh', opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            left: `${s.x}vw`, top: `${s.y}vh`,
            opacity: [0, 1, 1, 0],
            scale: [0, 1.2, 1, 0.6],
            rotate: s.rot,
          }}
          transition={{ duration: 2.6, delay: s.delay, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            fontSize: s.size, lineHeight: 1,
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            filter: 'drop-shadow(0 0 8px rgba(255,200,80,0.6))',
          }}
        >
          {s.emoji}
        </motion.div>
      ))}

      {/* ВЕРХ: корона + бейдж «✦ VIP ✦» */}
      <motion.div
        initial={{ scale: 0, rotate: -25, y: -30 }}
        animate={{ scale: 1, rotate: 0, y: 0 }}
        transition={{ type: 'spring', damping: 10, stiffness: 140, delay: 0.1 }}
        style={{ textAlign: 'center', position: 'relative' }}
      >
        <div style={{ fontSize: 84, lineHeight: 1, filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.7))' }}>👑</div>
        <div style={{
          marginTop: -8, padding: '4px 18px',
          display: 'inline-block',
          background: 'linear-gradient(135deg, #FFD24A, #FFB800, #B07400)',
          color: '#3A2010',
          fontFamily: "'Cinzel', 'Marcellus', serif",
          fontWeight: 800, fontSize: 13,
          letterSpacing: '0.2em',
          borderRadius: 10,
          boxShadow: '0 5px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.4)',
          whiteSpace: 'nowrap',
        }}>
          ✦ ЗОЛОТАЯ ГРАМОТА ✦
        </div>
      </motion.div>

      {/* ГЛАВНЫЙ ТЕКСТ */}
      <motion.div
        initial={{ y: -30, opacity: 0, scale: 0.8 }}
        animate={{
          y: 0, opacity: 1, scale: 1,
        }}
        transition={{ type: 'spring', damping: 12, stiffness: 180, delay: 0.3 }}
        style={{
          color: '#FFD660',
          fontFamily: "'Cinzel', 'Marcellus', serif",
          fontSize: 'clamp(28px, 8vw, 44px)',
          fontWeight: 800,
          letterSpacing: '0.04em',
          textAlign: 'center',
          textShadow:
            '0 0 24px #FFB800, 0 0 60px rgba(255,184,0,0.6), 0 4px 14px rgba(0,0,0,0.85)',
          textTransform: 'uppercase',
        }}
      >
        <motion.span
          animate={{ scale: [1, 1.05, 1, 1.05, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ display: 'inline-block' }}
        >
          Вот это удача!
        </motion.span>
      </motion.div>

      {/* ПОДЗАГОЛОВОК */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        style={{
          color: 'rgba(255,235,178,0.9)',
          fontSize: 14,
          textAlign: 'center',
          maxWidth: 320,
          textShadow: '0 2px 8px rgba(0,0,0,0.85)',
        }}
      >
        Пришла <b style={{ color: '#FFD660' }}>золотая грамота</b> — без испытания, по заветному слову с канала хозяина
      </motion.div>

      {/* ПРЕВЬЮ ДЕЛА */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.75 }}
        style={{
          padding: '14px 20px',
          background: 'rgba(20,12,6,0.92)',
          border: '2px solid #FFB800',
          borderRadius: 14,
          minWidth: 260,
          maxWidth: 360,
          textAlign: 'center',
          boxShadow: '0 0 30px rgba(255,184,0,0.45), 0 8px 24px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{
          color: '#FFD660', fontWeight: 700, fontSize: 16,
          fontFamily: "'Cinzel', 'Marcellus', serif",
          letterSpacing: '0.02em',
        }}>
          {project.name}
        </div>
        <div style={{ color: 'rgba(255,235,178,0.7)', fontSize: 12, marginTop: 2 }}>
          {project.developerName}
        </div>
        <div style={{
          color: '#50C878', fontWeight: 800, fontSize: 22, marginTop: 8,
          fontVariantNumeric: 'tabular-nums',
          textShadow: '0 0 12px rgba(80,200,120,0.6)',
        }}>
          +200% за 14 дней
        </div>
      </motion.div>

      {/* CTA */}
      <motion.button
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.0, type: 'spring', damping: 14 }}
        whileTap={{ scale: 0.95 }}
        onClick={e => { e.stopPropagation(); onOpenDeal() }}
        style={{
          marginTop: 6,
          padding: '14px 28px',
          background: 'linear-gradient(180deg, #FFD660 0%, #FFB800 55%, #B07400 100%)',
          color: '#3A2010',
          border: 'none',
          borderTop: '1.5px solid rgba(255,255,255,0.5)',
          borderBottom: '4px solid #7A5000',
          borderRadius: 10,
          fontFamily: "'Cinzel', 'Marcellus', serif",
          fontWeight: 800, fontSize: 16,
          letterSpacing: '0.06em',
          cursor: 'pointer',
          boxShadow: '0 6px 0 #5A3800, 0 10px 28px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.5)',
          textShadow: '0 1px 0 rgba(255,255,255,0.3)',
          textTransform: 'uppercase',
        }}
      >
        🔑 Открыть грамоту
      </motion.button>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.55 }}
        transition={{ delay: 1.4 }}
        style={{
          color: 'rgba(255,235,178,0.7)',
          fontSize: 11,
          marginTop: 4,
          textShadow: '0 2px 6px rgba(0,0,0,0.8)',
        }}
      >
        тапни в любом месте, чтобы продолжить
      </motion.div>
    </motion.div>
  )
}

const VIP_SEEN_KEY = 'vip_seen_v1'

/** Прочитать список projectId, для которых уже показали оверлей */
export function getSeenVipIds(): Set<string> {
  try {
    const raw = localStorage.getItem(VIP_SEEN_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch { return new Set() }
}

/** Запомнить что VIP оверлей был показан */
export function markVipSeen(projectId: string): void {
  try {
    const seen = getSeenVipIds()
    seen.add(projectId)
    // Храним только последние 100 чтобы localStorage не пух
    const arr = Array.from(seen).slice(-100)
    localStorage.setItem(VIP_SEEN_KEY, JSON.stringify(arr))
  } catch { /* noop */ }
}
