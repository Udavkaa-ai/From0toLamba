import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ScreenBackground, PAGE_BG } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider } from '@/components/FairyCard'
import { PageTitle } from '@/components/PageTitle'
import { MerchantToken, ARCHETYPE_TINT } from '@/components/MerchantToken'
import { useGameStore } from '@/stores/gameStore'
import { MINIGAME_INFO } from '@/components/minigames/info'
import { colors, spacing , gradients } from '@/theme'

const ARCHETYPES = ['BURATINO', 'BOYARIN', 'KOLOBOK', 'KOSCHEI', 'ZOLUSHKA', 'BABA_YAGA', 'IVAN_DURAK'] as const
type Archetype = typeof ARCHETYPES[number]

const SHORT_NAME: Record<Archetype, string> = {
  BURATINO: 'Буратино',
  BOYARIN: 'Царь Горох',
  KOLOBOK: 'Колобок',
  KOSCHEI: 'Кощей',
  ZOLUSHKA: 'Золушка',
  BABA_YAGA: 'Баба Яга',
  IVAN_DURAK: 'Иван Дурак',
}

const ARCHETYPE_EMOJI: Record<Archetype, string> = {
  BURATINO: '🪆',
  BOYARIN: '👑',
  KOLOBOK: '🤗',
  KOSCHEI: '💀',
  ZOLUSHKA: '👠',
  BABA_YAGA: '🧙‍♀️',
  IVAN_DURAK: '🃏',
}

export function RelationshipsPage() {
  const navigate = useNavigate()
  const { gameState } = useGameStore()
  const [selected, setSelected] = useState<Archetype | null>(null)

  return (
    <ScreenBackground bgImage={PAGE_BG.stats}>
      <div style={{ padding: `${spacing.xxl} ${spacing.lg} 80px`, maxWidth: 500, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: `${colors.fairyGold}14`,
              border: `1px solid ${colors.fairyGold}35`,
              borderRadius: 10, padding: '6px 12px',
              color: colors.fairyGold, fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← Назад
          </button>
          <div style={{ flex: 1 }} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          <PageTitle>Отношения</PageTitle>
          <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
            Семеро хозяев и твои с ними дела
          </div>
        </div>

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
          marginBottom: spacing.lg,
        }}>
          {ARCHETYPES.map(arch => {
            const tokens = gameState?.archetypeTokens?.[arch]
            const balance = tokens?.balance ?? 0
            return (
              <motion.button
                key={arch}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelected(arch)}
                style={{
                  width: 96, height: 110,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 4,
                  padding: spacing.sm,
                  background: `linear-gradient(145deg, ${ARCHETYPE_TINT[arch]}25, ${ARCHETYPE_TINT[arch]}08)`,
                  border: `1.5px solid ${ARCHETYPE_TINT[arch]}88`,
                  borderRadius: 14,
                  boxShadow: `0 4px 16px ${ARCHETYPE_TINT[arch]}44`,
                  cursor: 'pointer',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: 32, lineHeight: 1 }}>{ARCHETYPE_EMOJI[arch]}</div>
                <div style={{
                  color: ARCHETYPE_TINT[arch], fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                }}>
                  {SHORT_NAME[arch]}
                </div>
                {balance > 0 && (
                  <div style={{
                    position: 'absolute', top: -6, right: -6,
                    display: 'flex', alignItems: 'center', gap: 2,
                    padding: '2px 6px',
                    background: colors.fairyGold,
                    color: colors.nightBlue,
                    borderRadius: 12, fontSize: 11, fontWeight: 800,
                    boxShadow: `0 0 0 2px ${colors.nightBlue}, 0 2px 8px ${colors.fairyGold}66`,
                  }}>
                    🪙 {balance}
                  </div>
                )}
              </motion.button>
            )
          })}
        </div>

        <FairyCard style={{ marginBottom: spacing.md }}>
          <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            🪙 Жетоны хозяев
          </div>
          <div style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.5 }}>
            🎁 За <b>первое знакомство</b> с каждым хозяином — подарок (1 жетон).<br />
            🎯 За каждые <b>10 сыгранных мини-игр</b> или <b>5 взятых дел</b> с одним хозяином —
            ещё по жетону. Тратится на бесплатную беседу или раскрытие подсказки по делу
            при провале мини-игры — вместо 10 ⭐.
          </div>
        </FairyCard>
      </div>

      {/* Лист с подробной статистикой по выбранному хозяину */}
      <AnimatePresence>
        {selected && (
          <RelationshipDetails
            archetype={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </ScreenBackground>
  )
}

function RelationshipDetails({ archetype, onClose }: { archetype: Archetype; onClose: () => void }) {
  const { gameState } = useGameStore()
  const tokens = gameState?.archetypeTokens?.[archetype]
  const stats = gameState?.minigameStats?.[archetype]
  const info = MINIGAME_INFO[archetype]
  const tint = ARCHETYPE_TINT[archetype]

  const games = tokens?.gamesPlayed ?? stats?.played ?? 0
  const deals = tokens?.dealsTaken ?? 0
  const earned = tokens?.earned ?? 0
  const spent = tokens?.spent ?? 0
  const balance = tokens?.balance ?? 0
  const welcomeBonus = tokens?.welcomeBonus ?? false

  const nextGameToToken = 10 - (games % 10)
  const nextDealToToken = 5 - (deals % 5)

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 240,
        background: 'rgba(6, 4, 18, 0.78)',
      }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          maxHeight: '88dvh', overflowY: 'auto',
          background: gradients.modal,
          borderTop: `2px solid ${tint}`,
          borderRadius: '20px 20px 0 0',
          // 80px доп.запас снизу — иначе нижняя навигация и чат-кнопка
          // (position:fixed FAB) перекрывают последний абзац листа
          padding: `${spacing.lg} ${spacing.lg} calc(80px + ${spacing.lg} + env(safe-area-inset-bottom))`,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md,
        }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>{ARCHETYPE_EMOJI[archetype]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: tint, fontSize: 22, fontWeight: 800 }}>
              {SHORT_NAME[archetype]}
            </div>
            <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {info?.name ?? 'Испытание хозяина'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: colors.textMuted,
              fontSize: 22, cursor: 'pointer', padding: 4,
            }}
          >✕</button>
        </div>

        {/* Жетоны — крупно */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing.md,
          padding: spacing.md,
          background: `linear-gradient(135deg, ${tint}22, ${tint}08)`,
          border: `1.5px solid ${tint}66`,
          borderRadius: 14,
          marginBottom: spacing.md,
        }}>
          <MerchantToken archetype={archetype} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ color: colors.fairyGold, fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>
              {balance} {balance === 1 ? 'жетон' : balance < 5 ? 'жетона' : 'жетонов'}
            </div>
            <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
              Заработано {earned} · потрачено {spent}
              {welcomeBonus && <span style={{ color: tint, marginLeft: 6 }}>· 🎁 подарок</span>}
            </div>
          </div>
        </div>

        {/* Статистика отношений */}
        <OrnamentDivider />
        <div style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 600, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Статистика
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm, marginBottom: spacing.md }}>
          <StatTile label="Сыграно игр" value={games} accent={tint} />
          <StatTile label="Взято дел" value={deals} accent={tint} />
          <StatTile label="Идеально" value={stats?.perfect ?? 0} accent={colors.success} />
          <StatTile label="Победа" value={stats?.won ?? 0} accent={colors.fairyGold} />
          <StatTile label="Провал" value={stats?.lost ?? 0} accent={colors.danger} />
          <StatTile label="Жетонов" value={earned} accent={tint} />
        </div>

        {/* Прогресс до следующего жетона */}
        <div style={{
          padding: spacing.md,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 12,
          marginBottom: spacing.md,
        }}>
          <div style={{ color: colors.fairyGold, fontSize: 12, fontWeight: 700, marginBottom: spacing.xs }}>
            До следующего жетона
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            <ProgressBar
              label={`Сыграй ещё ${nextGameToToken} ${nextGameToToken === 1 ? 'игру' : 'игр'}`}
              progress={(games % 10) / 10}
              accent={tint}
            />
            <ProgressBar
              label={`Возьми ещё ${nextDealToToken} ${nextDealToToken === 1 ? 'дело' : 'дел'}`}
              progress={(deals % 5) / 5}
              accent={tint}
            />
          </div>
        </div>

        <div style={{
          padding: spacing.md,
          background: 'rgba(255,255,255,0.03)',
          border: `1px dashed ${colors.fairyGold}55`,
          borderRadius: 12,
          color: colors.textSecondary,
          fontSize: 12, lineHeight: 1.5,
        }}>
          🪙 Жетон тратится при предложении этого хозяина: на бесплатную беседу
          (вместо 10 ⭐) или на раскрытие подсказки по делу при проигранной
          мини-игре. Тратится автоматически, если есть, при нажатии на «жетон» в paywall.
        </div>
      </motion.div>
    </motion.div>
  )
}

function StatTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${accent}55`,
      borderRadius: 10,
      textAlign: 'center',
    }}>
      <div style={{ color: accent, fontSize: 22, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>
        {label}
      </div>
    </div>
  )
}

function ProgressBar({ label, progress, accent }: { label: string; progress: number; accent: string }) {
  const p = Math.max(0, Math.min(1, progress))
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.textMuted, marginBottom: 3 }}>
        <span>{label}</span>
        <span>{Math.round(p * 100)}%</span>
      </div>
      <div style={{
        height: 6, background: 'rgba(255,255,255,0.08)',
        borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          width: `${p * 100}%`, height: '100%',
          background: accent,
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  )
}
