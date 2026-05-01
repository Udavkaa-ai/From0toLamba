import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { colors, spacing } from '@/theme'
import { useT } from '@/i18n'

export function OnboardingTutorial({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [idx, setIdx] = useState(0)
  const slide = t.onboarding.slides[idx]
  const isLast = idx === t.onboarding.slides.length - 1

  const next = () => {
    if (isLast) onClose()
    else setIdx(idx + 1)
  }
  const back = () => idx > 0 && setIdx(idx - 1)

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(6, 4, 18, 0.92)',
        display: 'flex', flexDirection: 'column',
        padding: `${spacing.lg}`,
        paddingTop: `calc(${spacing.lg} + env(safe-area-inset-top))`,
        // Снизу — BottomNav (~60px на родительской странице) + safe-area
        paddingBottom: `calc(72px + ${spacing.md} + env(safe-area-inset-bottom))`,
        overflowY: 'auto',
      }}
    >
      {/* Прогресс N/N вместо кнопки «Пропустить» — тур непропускаемый */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spacing.md, minHeight: '28px' }}>
        <span style={{ color: colors.textMuted, fontSize: '12px', padding: '4px 8px' }}>
          {idx + 1} / {t.onboarding.slides.length}
        </span>
      </div>

      {/* Прогресс-точки */}
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: spacing.xl }}>
        {t.onboarding.slides.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === idx ? '24px' : '8px',
              height: '4px',
              borderRadius: '2px',
              background: i === idx
                ? colors.fairyGold
                : i < idx ? `${colors.fairyGold}80` : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>

      {/* Слайд */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
            style={{ textAlign: 'center', maxWidth: '440px', margin: '0 auto' }}
          >
            <div style={{ fontSize: '72px', marginBottom: spacing.lg }}>
              {slide.emoji}
            </div>
            <div style={{
              color: colors.fairyGold, fontSize: '24px', fontWeight: 800,
              marginBottom: spacing.md, lineHeight: 1.2,
            }}>
              {slide.title}
            </div>
            <div style={{
              color: colors.textPrimary, fontSize: '15px', lineHeight: 1.6,
              marginBottom: slide.accent ? spacing.lg : 0,
            }}>
              {slide.body}
            </div>
            {slide.accent && (
              <div style={{
                display: 'inline-block',
                padding: `${spacing.sm} ${spacing.md}`,
                background: `${colors.fairyGold}18`,
                border: `1px solid ${colors.fairyGold}55`,
                borderRadius: '10px',
                color: colors.fairyGold,
                fontSize: '13px',
                fontWeight: 600,
              }}>
                {slide.accent}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Кнопки */}
      <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.xl }}>
        {idx > 0 && (
          <button
            onClick={back}
            style={{
              flex: 1, padding: spacing.md,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: '12px',
              color: colors.textSecondary,
              fontSize: '14px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← {t.common.back}
          </button>
        )}
        <button
          onClick={next}
          style={{
            flex: 2, padding: spacing.md,
            background: colors.fairyGold,
            border: 'none',
            borderRadius: '12px',
            color: colors.nightBlue,
            fontSize: '15px', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {isLast ? t.onboarding.startBtn : `${t.onboarding.nextBtn} →`}
        </button>
      </div>
    </motion.div>
  )
}
