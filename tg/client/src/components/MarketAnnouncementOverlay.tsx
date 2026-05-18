import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { useT } from '@/i18n'
import { colors, spacing } from '@/theme'

const CHANNEL_URL = 'https://t.me/vknyazi_izgryazi'

// Лучики сияния вокруг заголовка — статичные SVG-линии без анимации.
// Раньше каждая из 12 линий имела свою motion.line с opacity-keyframes и
// бесконечным повтором. На Android WebView эти 12 параллельных rAF плюс
// прочие infinite-анимации в overlay'е давали тяжёлое подтормаживание
// при появлении модалки. Картинка визуально та же.
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
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#FFB800"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity={0.55}
          />
        )
      })}
    </svg>
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
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: '100%', maxWidth: '400px' }}
      >
        {/* Раньше была conic-gradient вращающаяся рамка + 6 motion.div
            искр + scale на замке + opacity на заголовке — всё infinite.
            На слабых WebView суммарная нагрузка приводила к мерцанию и
            подтормаживанию overlay'а на входе. Заменено на статичную
            золотую рамку — визуальный акцент сохраняется. */}
        <div style={{
          position: 'relative',
          background: `linear-gradient(160deg, #1a0e40 0%, ${colors.nightBlue} 60%, #0a1025 100%)`,
          borderRadius: '20px',
          border: `2px solid ${colors.fairyGold}`,
          overflow: 'hidden',
          boxShadow: `0 20px 60px rgba(0,0,0,0.7), 0 0 32px ${colors.fairyGold}55`,
        }}>
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
              <div style={{ fontSize: '48px', position: 'relative', zIndex: 1, lineHeight: '80px' }}>
                🏰
              </div>
            </div>

            <div style={{
              fontSize: '22px', fontWeight: 900,
              background: `linear-gradient(135deg, #fff5c0, ${colors.fairyGold}, #b8860b)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '4px',
            }}>
              {t.marketAnnouncement.title}
            </div>

            <div style={{ color: `${colors.fairyGold}99`, fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {t.marketAnnouncement.subtitle}
            </div>
          </div>

          {/* Тело */}
          <div style={{ padding: `${spacing.lg} ${spacing.xl}` }}>
            <div style={{
              color: colors.textOnDarkSecond,
              fontSize: '14px',
              lineHeight: 1.65,
              textAlign: 'center',
              marginBottom: spacing.lg,
            }}>
              {t.marketAnnouncement.body}
            </div>

            {/* Кнопка перехода — главная */}
            <button
              onClick={openAndClaim}
              disabled={visiting}
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
            </button>

            {/* Кнопка закрыть */}
            <button
              onClick={handleClose}
              style={{
                width: '100%',
                padding: spacing.sm,
                background: 'transparent',
                border: 'none',
                color: colors.textOnDarkMuted,
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
