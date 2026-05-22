import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ScreenBackground, PAGE_BG } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider } from '@/components/FairyCard'
import { PageTitle, PageSubtitle } from '@/components/PageTitle'
import { MerchantToken, ARCHETYPE_TINT } from '@/components/MerchantToken'
import { useGameStore } from '@/stores/gameStore'
import { getMiniGameInfo } from '@/components/minigames/info'
import { colors, spacing , gradients } from '@/theme'
import { getTheme } from '@/theme/colors'
import { useT } from '@/i18n'

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

function avatarUrl(arch: Archetype): string {
  const slug = arch.toLowerCase()
  const suffix = getTheme() === 'fairy' ? '_LIGHT' : ''
  return `/avatars/${slug}${suffix}.webp`
}

/**
 * Круглая аватарка хозяина. Источник — /avatars/<slug>(_LIGHT).webp.
 * Пока файла нет (или не сгенерили) — onError откатывает к эмодзи,
 * страница не ломается.
 */
function ArchetypeAvatar({ archetype, size }: { archetype: Archetype; size: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <div style={{ fontSize: Math.round(size * 0.7), lineHeight: 1 }}>{ARCHETYPE_EMOJI[archetype]}</div>
  }
  return (
    <img
      src={avatarUrl(archetype)}
      alt=""
      onError={() => setFailed(true)}
      style={{
        width: size, height: size, borderRadius: '50%',
        objectFit: 'cover', display: 'block',
        // Лёгкая золотая обводка как в эталонной плитке.
        boxShadow: `inset 0 0 0 2px ${colors.fairyGold}55`,
      }}
    />
  )
}

export function RelationshipsPage() {
  const t = useT()
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
            {t.relations.back}
          </button>
          <div style={{ flex: 1 }} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          <PageTitle>{t.relations.title}</PageTitle>
          <PageSubtitle>{t.relations.subtitle}</PageSubtitle>
          {/* Сумма уровней Завязок по всем дельцам — это показатель «насколько ты
              врос в ярмарку». Большое число = много дел с разными хозяевами. */}
          {(gameState?.tiesTotal ?? 0) > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 8,
              padding: '4px 12px',
              background: `${colors.fairyGold}22`,
              border: `1px solid ${colors.fairyGold}66`,
              borderRadius: 20,
              color: colors.fairyGold,
              fontSize: 12, fontWeight: 700,
              boxShadow: `inset 0 1px 0 ${colors.cardHighlight}`,
            }}>
              ⚡ Связи: {gameState?.tiesTotal}
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
          marginBottom: spacing.lg,
        }}>
          {ARCHETYPES.map(arch => {
            const tokens = gameState?.archetypeTokens?.[arch]
            const balance = tokens?.balance ?? 0
            const tieLevel = gameState?.tieLevels?.[arch] ?? 0
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
                  // Непрозрачная плашка из theme-aware карточки + цветной кант
                  // и свечение по архетипу. Раньше bg был полупрозрачный tint
                  // → плитки сливались с фоном.
                  background: gradients.card,
                  border: `1.5px solid ${ARCHETYPE_TINT[arch]}`,
                  borderRadius: 14,
                  boxShadow: `0 4px 14px ${ARCHETYPE_TINT[arch]}55, inset 0 1px 0 ${colors.cardHighlight}`,
                  cursor: 'pointer',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <ArchetypeAvatar archetype={arch} size={56} />
                <div style={{
                  color: ARCHETYPE_TINT[arch], fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
                  // Тень нужна потому что цвет лейбла = тинт архетипа, который
                  // совпадает с цветом канта/свечения плитки → без тени
                  // надписи сливаются (Боярин, Кощей, Баба-Яга, Иван).
                  textShadow: '0 0 4px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.9)',
                }}>
                  {SHORT_NAME[arch]}
                </div>
                {/* Бейдж уровня Завязок (1..10) + балансовый счётчик жетонов */}
                {tieLevel > 0 && (
                  <div style={{
                    position: 'absolute', top: -6, right: -6,
                    minWidth: 22, height: 22,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 6px',
                    background: tieLevel >= 10 ? colors.success : colors.fairyGold,
                    color: colors.nightBlue,
                    borderRadius: 11, fontSize: 12, fontWeight: 900,
                    boxShadow: `0 0 0 2px ${colors.nightBlue}, 0 2px 8px ${colors.fairyGold}66`,
                  }}>
                    {tieLevel}
                  </div>
                )}
                {balance > 0 && (
                  <div style={{
                    position: 'absolute', bottom: -6, right: -6,
                    display: 'flex', alignItems: 'center', gap: 2,
                    padding: '1px 5px',
                    background: colors.nightBlue,
                    color: colors.fairyGold,
                    borderRadius: 10, fontSize: 9, fontWeight: 700,
                    boxShadow: `0 0 0 1.5px ${colors.fairyGold}55`,
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
            {t.relations.tokensTitle}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.5 }}>
            {t.relations.tokensFirstMeet}<br />
            {t.relations.tokensRegular}
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
  const t = useT()
  const { gameState } = useGameStore()
  const tokens = gameState?.archetypeTokens?.[archetype]
  const stats = gameState?.minigameStats?.[archetype]
  const info = getMiniGameInfo(archetype, t)
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
          maxHeight: '88dvh',
          // overflow убран с внешней плашки — теперь скроллится только
          // внутренний контейнер, X-кнопка остаётся прибитой к шапке.
          background: gradients.modal,
          borderTop: `2px solid ${tint}`,
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Закрепляющийся X в правом-верхнем углу плашки */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 14, zIndex: 5,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            border: `1px solid ${tint}88`,
            color: colors.modalText,
            fontSize: 18, fontWeight: 700,
            cursor: 'pointer', padding: 0, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>

        <div style={{
          overflowY: 'auto',
          // 80px доп.запас снизу — иначе нижняя навигация и чат-кнопка
          // (position:fixed FAB) перекрывают последний абзац листа
          padding: `${spacing.lg} ${spacing.lg} calc(80px + ${spacing.lg} + env(safe-area-inset-bottom))`,
        }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md,
          paddingRight: 44,  // не наезжать на X-кнопку
        }}>
          <ArchetypeAvatar archetype={archetype} size={72} />
          <div style={{ flex: 1 }}>
            <div style={{ color: tint, fontSize: 22, fontWeight: 800 }}>
              {SHORT_NAME[archetype]}
            </div>
            <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {info?.name ?? 'Испытание хозяина'}
            </div>
          </div>
        </div>

        {/* Жетоны — крупно */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing.md,
          padding: spacing.md,
          background: gradients.card,
          border: `1.5px solid ${tint}`,
          borderRadius: 14,
          marginBottom: spacing.md,
          boxShadow: `inset 0 1px 0 ${colors.cardHighlight}, 0 2px 10px rgba(0,0,0,0.35)`,
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

        {/* Завязки — уровень отношения и бонус доходности */}
        <TiesLevelCard archetype={archetype} tint={tint} earned={earned} />

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
          background: gradients.card,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 12,
          marginBottom: spacing.md,
          boxShadow: `inset 0 1px 0 ${colors.cardHighlight}`,
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
          background: gradients.card,
          border: `1px dashed ${colors.fairyGold}88`,
          borderRadius: 12,
          color: colors.textSecondary,
          fontSize: 12, lineHeight: 1.5,
          boxShadow: `inset 0 1px 0 ${colors.cardHighlight}`,
        }}>
          {t.relations.tokenSpendHint}
        </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Карточка «Завязки» — уровень отношения с архетипом + бонус доходности.
 * Уровень = жизненное число полученных жетонов (0..maxLevel из gameState).
 * Бонус = level × bonusPerLevel/день к доходности дел этого архетипа.
 */
function TiesLevelCard({ archetype, tint, earned }: { archetype: Archetype; tint: string; earned: number }) {
  const { gameState } = useGameStore()
  const maxLevel = gameState?.tiesMaxLevel ?? 10
  const bonusPerLevel = gameState?.tiesBonusPerLevel ?? 0.01
  const level = gameState?.tieLevels?.[archetype] ?? 0
  const bonusPct = Math.round(level * bonusPerLevel * 100)
  const isMaxed = level >= maxLevel
  const progress = isMaxed ? 1 : (level + (Math.min(earned, level + 1) - level)) / maxLevel
  return (
    <div style={{
      padding: spacing.md,
      background: gradients.card,
      border: `1.5px solid ${tint}`,
      borderRadius: 14,
      marginBottom: spacing.md,
      boxShadow: `inset 0 1px 0 ${colors.cardHighlight}, 0 2px 10px rgba(0,0,0,0.35)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ color: tint, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Завязки
        </div>
        <div style={{
          color: isMaxed ? colors.success : colors.fairyGold,
          fontSize: 18, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
        }}>
          {level}<span style={{ fontSize: 11, opacity: 0.65, marginLeft: 4 }}>/ {maxLevel}</span>
        </div>
      </div>
      <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600 }}>
        {bonusPct > 0
          ? <>Дела с этим хозяином приносят <span style={{ color: colors.success, fontWeight: 800 }}>+{bonusPct}%</span> в день</>
          : <>Заведи связь — каждый уровень даёт <span style={{ color: colors.success, fontWeight: 800 }}>+1%</span> в день</>}
      </div>
      <div style={{
        marginTop: 8, height: 8, borderRadius: 4,
        background: 'rgba(0,0,0,0.3)', border: `1px solid ${colors.cardBorder}`,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(100, (level / maxLevel) * 100)}%`,
          height: '100%',
          background: isMaxed
            ? `linear-gradient(90deg, ${colors.success}, ${colors.fairyGold})`
            : `linear-gradient(90deg, ${tint}, ${colors.fairyGold})`,
          transition: 'width 0.3s',
        }} />
      </div>
      {isMaxed && (
        <div style={{ color: colors.success, fontSize: 11, marginTop: 6, fontWeight: 700, textAlign: 'center' }}>
          ✦ Максимум — отношения закалены
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: gradients.card,
      border: `1.5px solid ${accent}`,
      borderRadius: 10,
      textAlign: 'center',
      boxShadow: `inset 0 1px 0 ${colors.cardHighlight}, 0 2px 6px rgba(0,0,0,0.25)`,
    }}>
      <div style={{ color: accent, fontSize: 22, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2, fontWeight: 600 }}>
        {label}
      </div>
    </div>
  )
}

function ProgressBar({ label, progress, accent }: { label: string; progress: number; accent: string }) {
  const p = Math.max(0, Math.min(1, progress))
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.textSecondary, marginBottom: 3, fontWeight: 600 }}>
        <span>{label}</span>
        <span>{Math.round(p * 100)}%</span>
      </div>
      <div style={{
        height: 7, background: 'rgba(0,0,0,0.4)',
        borderRadius: 3, overflow: 'hidden',
        border: `1px solid ${colors.cardBorder}`,
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
