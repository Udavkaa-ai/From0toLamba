import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/stores/gameStore'
import { colors, gradients, spacing } from '@/theme'
import { useT } from '@/i18n'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

/**
 * «Следующая неделя» — глобальная плавающая кнопка-FAB.
 *
 * Видна на всех вкладках кроме CharterPage / AmaPage / RegistryPage
 * (там скрыт и нижний нав-бар). Компактный кружок ⌀48 с эмодзи 🔁;
 * по первому тапу раскрывается в pill с надписью «Следующая неделя»,
 * по второму — диспатчит CustomEvent('advance-day'). HomePage слушает
 * это событие и крутит advanceMutation через свои существующие связи
 * (overlay'и итогов дня, MoneyShower, навигация и т.д.). На остальных
 * вкладках событие триггерит навигацию на /, где HomePage отработает
 * advance уже там.
 *
 * Cooldown / skip-payment диспатчатся через CustomEvent('request-skip-payment').
 */
export function NextWeekFab() {
  const location = useLocation()
  const navigate = useNavigate()
  const t = useT()
  const gameState = useGameStore(s => s.gameState)

  const [expanded, setExpanded] = useState(false)
  const [now, setNow] = useState(Date.now())

  // Тикер раз в секунду для live-обновления countdown'а в locked-pill
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Авто-сворачивание через 4 сек, если игрок не тапнул второй раз
  useEffect(() => {
    if (!expanded) return
    const id = setTimeout(() => setExpanded(false), 4000)
    return () => clearTimeout(id)
  }, [expanded])

  // Скрытие на полноэкранных страницах (как у BottomNav)
  const hidden = location.pathname.startsWith('/ama/') ||
    location.pathname.startsWith('/charter/') ||
    location.pathname === '/registry'
  if (hidden || !gameState) return null

  const lastMs = gameState.lastAdvancedAt ? new Date(gameState.lastAdvancedAt).getTime() : 0
  const cooldownMs = gameState.advanceCooldownMs ?? 2 * 60 * 60 * 1000
  const remainingFreePresses = Math.max(0, (gameState.maxConsecutiveAdvances ?? 7) - (gameState.consecutiveAdvances ?? 0))
  const remainingMs = Math.max(0, lastMs + cooldownMs - now)
  const isLocked = remainingFreePresses === 0 && remainingMs > 0

  const handleTap = () => {
    haptic?.impactOccurred('light')
    if (!expanded) {
      setExpanded(true)
      return
    }
    // Второй тап — действие
    if (isLocked) {
      window.dispatchEvent(new CustomEvent('request-skip-payment'))
      return
    }
    // На главной — триггерим advance через event; на других вкладках —
    // сначала уходим на главную, чтобы overlay'и итогов дня отрисовались.
    if (location.pathname === '/') {
      window.dispatchEvent(new CustomEvent('advance-day'))
    } else {
      navigate('/')
      // Подождать рендер HomePage, потом триггер
      setTimeout(() => window.dispatchEvent(new CustomEvent('advance-day')), 200)
    }
    setExpanded(false)
  }

  // ─── Стили ────────────────────────────────────────────────────────────────
  const baseStyle = {
    position: 'fixed' as const,
    right: '14px',
    bottom: 'calc(72px + env(safe-area-inset-bottom))',
    zIndex: 150,
    height: 48,
    background: isLocked ? 'rgba(13,23,53,0.92)' : gradients.cta,
    border: `2px solid ${isLocked ? `${colors.fairyGold}40` : '#5A3818'}`,
    color: isLocked ? colors.fairyGold : colors.ctaText,
    fontWeight: 700,
    cursor: 'pointer',
    // Внешнее тёмное «кольцо» делает золотую кнопку видимой на ярком
    // осеннем фоне (иначе золото-на-золотом тонет).
    boxShadow: isLocked
      ? '0 4px 14px rgba(0,0,0,0.45)'
      : `0 4px 18px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.3), 0 0 14px ${colors.fairyGold}55`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden' as const,
    whiteSpace: 'nowrap' as const,
  }

  const label = isLocked
    ? `⏳ ${formatRemaining(remainingMs)}`
    : `🔁 ${t.home.nextDay}`

  return (
    <motion.button
      onClick={handleTap}
      whileTap={{ scale: 0.94 }}
      animate={{
        width: expanded ? 200 : 48,
        borderRadius: 24,
      }}
      transition={{ type: 'spring', damping: 22, stiffness: 280 }}
      style={baseStyle}
    >
      <AnimatePresence mode="wait" initial={false}>
        {expanded ? (
          <motion.span
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, delay: 0.08 }}
            style={{ fontSize: 14, padding: '0 18px' }}
          >
            {label}
          </motion.span>
        ) : (
          <motion.span
            key="collapsed"
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 90 }}
            transition={{ duration: 0.2 }}
            style={{ fontSize: 22, lineHeight: 1 }}
          >
            🔁
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}ч ${m}м`
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`
  return `${s}с`
}
// silence unused import in case spacing trims
void spacing
