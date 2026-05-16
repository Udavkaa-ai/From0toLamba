import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { evaluateAchievements, type EvaluatedAchievement } from '@/game/achievements'
import { loreFor } from '@/game/lore'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing , gradients } from '@/theme'
import { useT } from '@/i18n'

const LS_KEY = 'seenAchievements'

function loadSeen(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveSeen(seen: Set<string>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LS_KEY, JSON.stringify([...seen]))
}

/**
 * Показывает красивое поздравление, когда игрок только что разблокировал
 * новый подвиг. Очередь — если сразу открылось несколько подвигов, показываем
 * по одному.
 *
 * Первый запуск: если в localStorage пусто, помечаем все уже открытые
 * подвиги как увиденные (чтобы не сыпать десятью модалками подряд
 * на историческом игроке).
 */
export function AchievementUnlockedOverlay() {
  const gameState = useGameStore(s => s.gameState)
  const [queue, setQueue] = useState<EvaluatedAchievement[]>([])

  useEffect(() => {
    if (!gameState) return
    const all = evaluateAchievements(gameState)
    const unlocked = all.filter(a => a.unlocked)
    const seen = loadSeen()

    // Историческая миграция: первый запуск — ничего не показываем, но
    // фиксируем текущее состояние, иначе сыпется десяток модалок подряд.
    if (seen.size === 0 && unlocked.length > 0) {
      unlocked.forEach(a => seen.add(a.id))
      saveSeen(seen)
      return
    }

    const fresh = unlocked.filter(a => !seen.has(a.id))
    if (fresh.length > 0) setQueue(prev => [...prev, ...fresh.filter(f => !prev.find(p => p.id === f.id))])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.chartersSubmitted, gameState?.closedProjectsCount, gameState?.balance,
    gameState?.intuitionScore, gameState?.investorRank, gameState?.dayStreak,
    gameState?.referralCount, gameState?.seenTypes?.length, gameState?.seenArchetypes?.length,
    gameState?.seenFates?.length])

  const current = queue[0]

  const dismiss = () => {
    if (!current) return
    const seen = loadSeen()
    seen.add(current.id)
    saveSeen(seen)
    setQueue(q => q.slice(1))
  }

  return (
    <AnimatePresence>
      {current && <UnlockedBanner key={current.id} achievement={current} onClose={dismiss} />}
    </AnimatePresence>
  )
}

function shareAchievement(achievement: EvaluatedAchievement, shareText: string, userId?: number) {
  const botLink = userId
    ? `https://t.me/vknyazi_bot?startapp=ref_${userId}`
    : 'https://t.me/vknyazi_bot'
  const text = `${achievement.emoji} ${shareText}`
  const url = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(text)}`
  if (typeof window !== 'undefined') {
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url)
    } else {
      window.open(url, '_blank')
    }
  }
}

function UnlockedBanner({
  achievement, onClose,
}: { achievement: EvaluatedAchievement; onClose: () => void }) {
  const userId = useGameStore(s => s.gameState?.userId)
  const t = useT()
  const lore = achievement.revealTopic
    ? loreFor(achievement.revealTopic.kind, achievement.revealTopic.id)
    : null
  const loreLang = lore && achievement.revealTopic
    ? (
        achievement.revealTopic.kind === 'type' ? t.lore.types[achievement.revealTopic.id] :
        achievement.revealTopic.kind === 'archetype' ? t.lore.archetypes[achievement.revealTopic.id] :
        t.lore.fates[achievement.revealTopic.id]
      ) ?? null
    : null

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 280,
        background: 'rgba(6, 4, 18, 0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: spacing.lg,
      }}
    >
      <motion.div
        initial={{ scale: 0.7, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 260 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '420px',
          background: gradients.modal,
          border: `1px solid ${colors.fairyGold}80`,
          borderRadius: '16px',
          padding: spacing.xl,
          boxShadow: `0 16px 48px rgba(0,0,0,0.6), 0 0 40px ${colors.fairyGold}30`,
          maxHeight: '85dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
          <div style={{ color: colors.fairyGold, fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
            {t.stats.achievementUnlocked}
          </div>
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: 'spring', damping: 10, stiffness: 160 }}
            style={{ fontSize: '72px', marginBottom: '4px' }}
          >
            {achievement.emoji}
          </motion.div>
          <div style={{ color: colors.fairyGold, fontSize: '22px', fontWeight: 800 }}>
            {(t.achievements.items[achievement.id]?.name ?? achievement.name)}
          </div>
          <div style={{ color: colors.textOnDarkSecond, fontSize: '13px', marginTop: '4px' }}>
            {(t.achievements.items[achievement.id]?.description ?? achievement.description)}
          </div>
        </div>

        {lore && (
          <div style={{
            padding: spacing.md,
            background: `${colors.fairyGold}10`,
            border: `1px solid ${colors.fairyGold}40`,
            borderRadius: '10px',
            marginBottom: spacing.md,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: '6px' }}>
              <span style={{ fontSize: '22px' }}>{lore.emoji}</span>
              <div>
                <div style={{ color: colors.fairyGold, fontSize: '14px', fontWeight: 700 }}>{loreLang?.name ?? lore.name}</div>
                <div style={{ color: colors.textOnDarkMuted, fontSize: '11px' }}>{loreLang?.title ?? lore.title}</div>
              </div>
            </div>
            <div style={{ color: colors.textOnDarkSecond, fontSize: '12px', lineHeight: 1.55 }}>
              {loreLang?.description ?? lore.description}
            </div>
            {lore.hints && lore.hints.length > 0 && (
              <div style={{ marginTop: spacing.sm, paddingTop: spacing.sm, borderTop: `1px solid ${colors.fairyGold}20` }}>
                {(loreLang?.hints ?? lore.hints).map((h, i) => (
                  <div key={i} style={{ color: colors.textOnDark, fontSize: '11px', lineHeight: 1.5, marginTop: i === 0 ? 0 : '3px' }}>
                    ✦ {h}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => shareAchievement(achievement, t.stats.achievementShareText(t.achievements.items[achievement.id]?.name ?? achievement.name, t.achievements.items[achievement.id]?.description ?? achievement.description), userId)}
            style={{
              flex: 1,
              padding: spacing.md,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${colors.fairyGold}50`,
              borderRadius: '12px',
              color: colors.fairyGold,
              fontSize: '14px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.stats.achievementShare}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: spacing.md,
              background: colors.fairyGold,
              border: 'none',
              borderRadius: '12px',
              color: colors.nightBlue,
              fontSize: '14px', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t.stats.achievementToDeals}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
