import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { colors, spacing, typography } from '@/theme'
import { useT } from '@/i18n'

/**
 * Приветственные экраны при первом запуске. Три слайда:
 *   1. «Ярмарка» — SVG сцена ярмарочной площади с куполами и парящими монетами
 *   2. «7 хозяев — 7 испытаний» — стенд с семью фигурками-архетипами
 *   3. «Правила» — раскрытая летописная книга с печатью и пером
 *
 * Каждый слайд — самостоятельная сцена со своим градиентом и анимациями,
 * чтобы первое впечатление от игры было ярким.
 */

type SlideKey = 'fair' | 'trials' | 'rules'

const SLIDE_BACKGROUNDS: Record<SlideKey, string> = {
  fair:   'radial-gradient(ellipse at 50% 30%, rgba(255,184,0,0.18) 0%, transparent 60%), linear-gradient(180deg, #1A0F40 0%, #0D1735 100%)',
  trials: 'radial-gradient(ellipse at 50% 40%, rgba(192,96,255,0.18) 0%, transparent 60%), linear-gradient(180deg, #1A1245 0%, #0D0A2A 100%)',
  rules:  'radial-gradient(ellipse at 50% 35%, rgba(255,184,0,0.14) 0%, transparent 60%), linear-gradient(180deg, #150A28 0%, #0A0518 100%)',
}

export function OnboardingTutorial({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [idx, setIdx] = useState(0)
  const slides = t.onboarding.slides
  const slide = slides[idx]
  const isLast = idx === slides.length - 1
  const slideKey: SlideKey = idx === 0 ? 'fair' : idx === 1 ? 'trials' : 'rules'

  const next = () => isLast ? onClose() : setIdx(idx + 1)
  const back = () => idx > 0 && setIdx(idx - 1)

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: SLIDE_BACKGROUNDS[slideKey],
        transition: 'background 0.4s ease',
        display: 'flex', flexDirection: 'column',
        padding: spacing.lg,
        paddingTop: `calc(${spacing.lg} + env(safe-area-inset-top))`,
        paddingBottom: `calc(72px + ${spacing.md} + env(safe-area-inset-bottom))`,
        overflowY: 'auto',
      }}
    >
      {/* Парящие искры на заднике — общий слой */}
      <FloatingSparkles />

      {/* Прогресс */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, minHeight: 28 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {slides.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === idx ? 24 : 8, height: 4, borderRadius: 2,
                background: i === idx ? colors.fairyGold
                  : i < idx ? `${colors.fairyGold}80`
                  : 'rgba(255,255,255,0.18)',
                transition: 'all 0.3s',
                boxShadow: i === idx ? `0 0 10px ${colors.fairyGold}88` : 'none',
              }}
            />
          ))}
        </div>
        <span style={{ color: colors.textMuted, fontSize: 12 }}>
          {idx + 1} / {slides.length}
        </span>
      </div>

      {/* Слайд */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            style={{ textAlign: 'center', maxWidth: 460, margin: '0 auto', width: '100%' }}
          >
            {/* Иллюстрация */}
            <div style={{ marginBottom: spacing.lg, display: 'flex', justifyContent: 'center' }}>
              {slideKey === 'fair'   && <FairScene />}
              {slideKey === 'trials' && <TrialsScene />}
              {slideKey === 'rules'  && <RulesScene />}
            </div>

            {/* Заголовок с золотым свечением */}
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ delay: 0.15, duration: 0.4 }}
              style={{
                color: colors.fairyGold,
                fontFamily: typography.headingFontFamily,
                fontSize: 28, fontWeight: 800,
                marginBottom: spacing.sm,
                lineHeight: 1.1,
                textShadow: `0 0 24px ${colors.fairyGold}80, 0 4px 12px rgba(0,0,0,0.6)`,
                letterSpacing: '0.02em',
              }}
            >
              {slide.title}
            </motion.div>

            {/* Описание */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
              style={{
                color: colors.textPrimary, fontSize: 15, lineHeight: 1.65,
                padding: `0 ${spacing.sm}`,
                marginBottom: slide.accent ? spacing.md : 0,
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}
            >
              {slide.body}
            </motion.div>

            {/* Акцент-плашка */}
            {slide.accent && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                style={{
                  display: 'inline-block',
                  padding: `${spacing.sm} ${spacing.md}`,
                  background: `linear-gradient(135deg, ${colors.fairyGold}25, ${colors.fairyGold}10)`,
                  border: `1px solid ${colors.fairyGold}80`,
                  borderRadius: 12,
                  color: colors.fairyGold,
                  fontSize: 13, fontWeight: 600,
                  boxShadow: `0 0 24px ${colors.fairyGold}33`,
                }}
              >
                {slide.accent}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Кнопки */}
      <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.xl, position: 'relative' }}>
        {idx > 0 && (
          <button
            onClick={back}
            style={{
              flex: 1, padding: spacing.md,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 14,
              color: colors.textSecondary,
              fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← {t.common.back}
          </button>
        )}
        <motion.button
          onClick={next}
          whileTap={{ scale: 0.97 }}
          animate={isLast ? { boxShadow: [
            `0 0 0 0 ${colors.fairyGold}88`,
            `0 0 0 12px ${colors.fairyGold}00`,
          ] } : {}}
          transition={isLast ? { duration: 1.6, repeat: Infinity, ease: 'easeOut' } : {}}
          style={{
            flex: idx > 0 ? 2 : 1, padding: `${spacing.md}`,
            background: `linear-gradient(135deg, ${colors.fairyGold}, #FFCB45)`,
            border: 'none', borderRadius: 14,
            color: colors.nightBlue,
            fontSize: 16, fontWeight: 800,
            cursor: 'pointer',
            boxShadow: `0 6px 24px ${colors.fairyGold}55`,
            letterSpacing: '0.02em',
          }}
        >
          {isLast ? `🚀 ${t.onboarding.startBtn}` : `${t.onboarding.nextBtn} →`}
        </motion.button>
      </div>
    </motion.div>
  )
}

// ─── Сцены слайдов ─────────────────────────────────────────────────────────

/** Слайд 1: ярмарочная площадь с куполами, монетами и купцом */
function FairScene() {
  return (
    <svg viewBox="0 0 320 220" width="100%" height="220" style={{ maxWidth: 360, display: 'block' }}>
      <defs>
        <linearGradient id="dome1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD580" />
          <stop offset="100%" stopColor="#A06010" />
        </linearGradient>
        <linearGradient id="dome2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFB060" />
          <stop offset="100%" stopColor="#7D2030" />
        </linearGradient>
        <radialGradient id="sun1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE9A0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFE9A0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Закатное солнце */}
      <circle cx="160" cy="90" r="60" fill="url(#sun1)">
        <animate attributeName="opacity" values="0.7;1;0.7" dur="4s" repeatCount="indefinite" />
      </circle>
      <circle cx="160" cy="90" r="22" fill="#FFE9A0" opacity="0.95" />

      {/* Купола трёх храмов-теремов */}
      <g>
        {/* левый */}
        <rect x="28" y="130" width="38" height="60" fill="#3D2A05" />
        <path d="M 28 130 L 47 90 L 66 130 Z" fill="url(#dome1)" stroke="#5A0808" strokeWidth="1.5" />
        <line x1="47" y1="80" x2="47" y2="90" stroke="#FFE9A0" strokeWidth="2" />
        <circle cx="47" cy="76" r="3" fill="#FFE9A0" />
        <rect x="38" y="160" width="6" height="14" fill="#FFE9A0" />
        <rect x="50" y="160" width="6" height="14" fill="#FFE9A0" />

        {/* центральный — большой */}
        <rect x="120" y="120" width="80" height="70" fill="#3D2A05" />
        <path d="M 120 120 L 160 60 L 200 120 Z" fill="url(#dome2)" stroke="#5A0808" strokeWidth="2" />
        <line x1="160" y1="50" x2="160" y2="60" stroke="#FFE9A0" strokeWidth="2.5" />
        <circle cx="160" cy="46" r="4" fill="#FFE9A0">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="2.5s" repeatCount="indefinite" />
        </circle>
        {/* окна-арочки */}
        <path d="M 132 160 Q 132 152 138 152 Q 144 152 144 160 L 144 175 L 132 175 Z" fill="#FFE090" opacity="0.85">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
        </path>
        <path d="M 154 160 Q 154 152 160 152 Q 166 152 166 160 L 166 175 L 154 175 Z" fill="#FFE090" opacity="0.85" />
        <path d="M 176 160 Q 176 152 182 152 Q 188 152 188 160 L 188 175 L 176 175 Z" fill="#FFE090" opacity="0.85">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="2.7s" repeatCount="indefinite" />
        </path>

        {/* правый */}
        <rect x="254" y="130" width="38" height="60" fill="#3D2A05" />
        <path d="M 254 130 L 273 90 L 292 130 Z" fill="url(#dome1)" stroke="#5A0808" strokeWidth="1.5" />
        <line x1="273" y1="80" x2="273" y2="90" stroke="#FFE9A0" strokeWidth="2" />
        <circle cx="273" cy="76" r="3" fill="#FFE9A0" />
        <rect x="264" y="160" width="6" height="14" fill="#FFE9A0" />
        <rect x="276" y="160" width="6" height="14" fill="#FFE9A0" />
      </g>

      {/* Земля */}
      <rect x="0" y="190" width="320" height="30" fill="#2A1808" />

      {/* Парящие монетки */}
      {[
        { cx: 50,  cy: 70,  r: 7, dur: 3.0 },
        { cx: 95,  cy: 50,  r: 5, dur: 2.6 },
        { cx: 230, cy: 60,  r: 6, dur: 3.4 },
        { cx: 280, cy: 50,  r: 5, dur: 2.8 },
        { cx: 75,  cy: 110, r: 4, dur: 3.6 },
        { cx: 245, cy: 105, r: 4, dur: 3.2 },
      ].map((c, i) => (
        <g key={i}>
          <circle cx={c.cx} cy={c.cy} r={c.r} fill="#FFB800" stroke="#5A2A05" strokeWidth="1">
            <animate attributeName="cy" values={`${c.cy};${c.cy - 14};${c.cy}`} dur={`${c.dur}s`} repeatCount="indefinite" />
          </circle>
          <circle cx={c.cx} cy={c.cy} r={c.r * 0.65} fill="#FFE090">
            <animate attributeName="cy" values={`${c.cy};${c.cy - 14};${c.cy}`} dur={`${c.dur}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
    </svg>
  )
}

/** Слайд 2: 7 архетипов в виде стенда */
function TrialsScene() {
  // 7 архетипов: BURATINO 🪆 · BOYARIN 👑 · KOLOBOK 🥖 · KOSCHEI 💀 · ZOLUSHKA 👠 · BABA_YAGA 🧹 · IVAN_DURAK 🃏
  const archetypes: Array<{ emoji: string; tint: string; label: string }> = [
    { emoji: '🪆', tint: '#C03030', label: 'Буратино' },
    { emoji: '👑', tint: '#FFB800', label: 'Царь' },
    { emoji: '🥖', tint: '#E9842B', label: 'Колобок' },
    { emoji: '💀', tint: '#80C0FF', label: 'Кощей' },
    { emoji: '👠', tint: '#C080FF', label: 'Золушка' },
    { emoji: '🧙‍♀️', tint: '#90E060', label: 'Яга' },
    { emoji: '🃏', tint: '#FF8060', label: 'Иван' },
  ]
  // Размер карточки фиксированный — flex-wrap сам разнесёт 7 штук на 2 ряда
  // (4 + 3, второй ряд центрируется через justify-content). Все одинаковые.
  const cardSize = 76
  return (
    <div style={{
      width: '100%', maxWidth: 380, margin: '0 auto',
      display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
    }}>
      {archetypes.map((a, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.6, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.05 * i, type: 'spring', damping: 18, stiffness: 220 }}
          style={{
            width: cardSize, height: cardSize,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(145deg, ${a.tint}20, ${a.tint}05)`,
            border: `1.5px solid ${a.tint}88`,
            borderRadius: 14,
            boxShadow: `0 4px 18px ${a.tint}44, inset 0 0 12px ${a.tint}22`,
            flexShrink: 0,
          }}
        >
          <motion.div
            animate={{ y: [0, -3, 0], rotate: [-2, 2, -2] }}
            transition={{ duration: 3 + (i % 3) * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
            style={{ fontSize: 32, lineHeight: 1, marginBottom: 4 }}
          >
            {a.emoji}
          </motion.div>
          <div style={{ color: a.tint, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>
            {a.label}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/** Слайд 3: раскрытая летописная книга с печатью */
function RulesScene() {
  return (
    <svg viewBox="0 0 320 220" width="100%" height="220" style={{ maxWidth: 360, display: 'block' }}>
      <defs>
        <linearGradient id="page1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5E4C7" />
          <stop offset="100%" stopColor="#D8C19A" />
        </linearGradient>
        <radialGradient id="sealGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF8060" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#FF8060" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Тень книги */}
      <ellipse cx="160" cy="200" rx="130" ry="8" fill="#000" opacity="0.4" />

      {/* Книга — две страницы под углом */}
      <g>
        {/* Левая страница */}
        <path d="M 30 50 Q 50 40 158 60 L 158 188 Q 50 168 30 178 Z" fill="url(#page1)" stroke="#8C6230" strokeWidth="1.5" />
        {/* Правая страница */}
        <path d="M 290 50 Q 270 40 162 60 L 162 188 Q 270 168 290 178 Z" fill="url(#page1)" stroke="#8C6230" strokeWidth="1.5" />
        {/* Центральная складка */}
        <line x1="160" y1="60" x2="160" y2="188" stroke="#8C6230" strokeWidth="2" />
      </g>

      {/* Текст на левой странице — линии */}
      {[78, 92, 106, 120, 134, 148, 162].map((y, i) => (
        <line key={`l-${i}`} x1="44" y1={y} x2={i % 3 === 2 ? '120' : '150'} y2={y - 1}
              stroke="#5A3A10" strokeWidth="1.5" opacity={0.7 - i * 0.05} />
      ))}

      {/* На правой странице — символическая печать */}
      <circle cx="220" cy="120" r="34" fill="url(#sealGlow)">
        <animate attributeName="opacity" values="0.7;1;0.7" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="220" cy="120" r="28" fill="#C03030" stroke="#5A0808" strokeWidth="2" />
      <circle cx="220" cy="120" r="22" fill="none" stroke="#FFE9A0" strokeWidth="1" />
      <text x="220" y="127" fontSize="22" fontFamily="Georgia, serif" fontWeight="900" textAnchor="middle" fill="#FFE9A0">
        П
      </text>

      {/* Подпись 18+ */}
      <g transform="translate(220, 175)">
        <rect x="-22" y="-9" width="44" height="18" rx="3" fill="#0D1735" stroke="#FFB800" strokeWidth="1.5" />
        <text x="0" y="4" fontSize="11" fontFamily="Georgia, serif" fontWeight="800" textAnchor="middle" fill="#FFB800">
          18+
        </text>
      </g>

      {/* Перо */}
      <g transform="translate(60, 30) rotate(-15)">
        <line x1="0" y1="0" x2="0" y2="60" stroke="#3D2A05" strokeWidth="2" />
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={i} x1="0" y1={5 + i * 6} x2="-8" y2={3 + i * 6} stroke="#3D2A05" strokeWidth="1.2" />
        ))}
        <path d="M 0 60 L -3 70 L 3 70 Z" fill="#3D2A05" />
      </g>
    </svg>
  )
}

/** Парящие искры по всему экрану — общий слой для всех слайдов */
function FloatingSparkles() {
  const positions = [
    { x: 8, y: 15, dur: 4 },
    { x: 92, y: 18, dur: 3.4 },
    { x: 18, y: 70, dur: 3.8 },
    { x: 88, y: 72, dur: 4.2 },
    { x: 50, y: 8, dur: 3.0 },
    { x: 30, y: 55, dur: 4.6 },
    { x: 70, y: 50, dur: 3.6 },
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {positions.map((p, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0, 0.7, 0], y: [0, -16, 0], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            left: `${p.x}%`, top: `${p.y}%`,
            width: 6, height: 6, borderRadius: '50%',
            background: '#FFE090',
            boxShadow: `0 0 14px ${colors.fairyGold}`,
          }}
        />
      ))}
    </div>
  )
}
