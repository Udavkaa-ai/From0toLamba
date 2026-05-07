import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { useT } from '@/i18n'
import { colors, spacing } from '@/theme'

const CHANNEL_URL = 'https://t.me/vknyazi_izgryazi'

// Лучики сияния вокруг заголовка
function Rays() {
  return (
    <svg
      style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}
      width="200" height="200" viewBox="0 0 200 200"
    >
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 * Math.PI) / 180
        const x1 = 100 + Math.cos(angle) * 52
        const y1 = 100 + Math.sin(angle) * 52
        const x2 = 100 + Math.cos(angle) * 85
        const y2 = 100 + Math.sin(angle) * 85
        return (
          <motion.line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#FFB800"
            strokeWidth="1.5"
            strokeLinecap="round"
            initial={{ opacity: 0.2 }}
            animate={{ opacity: [0.2, 0.9, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        )
      })}
    </svg>
  )
}

// Плавающие искры
function Sparks() {
  const positions = [
    { top: '12%', left: '8%' }, { top: '18%', right: '10%' },
    { top: '60%', left: '5%' }, { bottom: '20%', right: '8%' },
    { top: '40%', right: '4%' }, { bottom: '32%', left: '6%' },
  ]
  return (
    <>
      {positions.map((pos, i) => (
        <motion.div
          key={i}
          style={{ position: 'absolute', ...pos, fontSize: '14px', pointerEvents: 'none' }}
          animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
        >
          ✦
        </motion.div>
      ))}
    </>
  )
}

export function MarketAnnouncementOverlay({ onClose }: { onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const updateBalance = useGameStore(s => s.updateBalance)
  const [visiting, setVisiting] = useState(false)
  const [done, setDone] = useState(false)

  const openAndClaim = async () => {
    if (visiting) return
    setVisiting(true)
    try {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink(CHANNEL_URL)
      } else {
        window.open(CHANNEL_URL, '_blank')
      }
      const result = await api.announcement.claim()
      if (result.rewardGranted) {
        updateBalance(100)
        qc.invalidateQueries({ queryKey: ['gameState'] })
      }
      setDone(true)
    } catch {
      setVisiting(false)
    }
  }

  const handleClose = async () => {
    if (!done) {
      try { await api.announcement.dismiss() } catch { /* ignore */ }
    }
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 270,
        background: 'rgba(6, 4, 18, 0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: spacing.lg,
      }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.85, y: 30, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: '100%', maxWidth: '400px' }}
      >
        {/* Пульсирующая рамка-сияние */}
        <motion.div
          style={{
            position: 'absolute', inset: '-3px',
            borderRadius: '22px',
            background: `conic-gradient(from 0deg, ${colors.fairyGold}, #fff8dc, ${colors.fairyGold}, #b8860b, ${colors.fairyGold})`,
            opacity: 0.7,
          }}
          animate={{ rotate: 360, opacity: [0.5, 0.9, 0.5] }}
          transition={{ rotate: { duration: 6, repeat: Infinity, ease: 'linear' }, opacity: { duration: 2, repeat: Infinity } }}
        />

        <div style={{
          position: 'relative',
          background: `linear-gradient(160deg, #1a0e40 0%, ${colors.nightBlue} 60%, #0a1025 100%)`,
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: `0 20px 60px rgba(0,0,0,0.7), 0 0 40px ${colors.fairyGold}30`,
        }}>
          <Sparks />

          {/* Верхний декоративный блок */}
          <div style={{
            background: `linear-gradient(180deg, ${colors.fairyGold}18 0%, transparent 100%)`,
            borderBottom: `1px solid ${colors.fairyGold}30`,
            padding: `${spacing.xl} ${spacing.xl} ${spacing.lg}`,
            textAlign: 'center',
          }}>
            {/* Иконка с лучами */}
            <div style={{ position: 'relative', display: 'inline-block', width: '80px', height: '80px', marginBottom: spacing.md }}>
              <Rays />
              <motion.div
                style={{ fontSize: '48px', position: 'relative', zIndex: 1, lineHeight: '80px' }}
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                🏰
              </motion.div>
            </div>

            <motion.div
              style={{
                fontSize: '22px', fontWeight: 900,
                background: `linear-gradient(135deg, #fff5c0, ${colors.fairyGold}, #b8860b)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '4px',
              }}
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {t.marketAnnouncement.title}
            </motion.div>

            <div style={{ color: `${colors.fairyGold}99`, fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {t.marketAnnouncement.subtitle}
            </div>
          </div>

          {/* Тело */}
          <div style={{ padding: `${spacing.lg} ${spacing.xl}` }}>
            <div style={{
              color: colors.textSecondary,
              fontSize: '14px',
              lineHeight: 1.65,
              textAlign: 'center',
              marginBottom: spacing.lg,
            }}>
              {t.marketAnnouncement.body}
            </div>

            {/* Кнопка перехода — главная */}
            <motion.button
              onClick={openAndClaim}
              disabled={visiting}
              whileTap={{ scale: 0.96 }}
              style={{
                width: '100%',
                padding: `${spacing.md} ${spacing.lg}`,
                background: done
                  ? `${colors.fairyGold}22`
                  : `linear-gradient(135deg, ${colors.fairyGold}, #b8860b)`,
                border: done ? `1px solid ${colors.fairyGold}55` : 'none',
                borderRadius: '14px',
                color: done ? colors.fairyGold : colors.nightBlue,
                fontSize: '15px', fontWeight: 800,
                cursor: visiting ? 'default' : 'pointer',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                marginBottom: spacing.sm,
                boxShadow: done ? 'none' : `0 4px 20px ${colors.fairyGold}40`,
              }}
            >
              {done ? '✓ Посещено' : (
                <>
                  <span>{t.marketAnnouncement.visitBtn}</span>
                  <span style={{ opacity: 0.7, fontSize: '12px', fontWeight: 400 }}>
                    {t.marketAnnouncement.reward}
                  </span>
                </>
              )}
            </motion.button>

            {/* Кнопка закрыть */}
            <button
              onClick={handleClose}
              style={{
                width: '100%',
                padding: spacing.sm,
                background: 'transparent',
                border: 'none',
                color: colors.textMuted,
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t.marketAnnouncement.closeBtn}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
