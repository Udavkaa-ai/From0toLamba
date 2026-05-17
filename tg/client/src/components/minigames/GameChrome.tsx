import { CSSProperties, ReactNode } from 'react'
import { colors, gradients, spacing, ctaButton } from '@/theme'

/** Шапка мини-игры — резная деревянная плашка с таймером, счётчиком, жизнями.
 *  Заменяет 3 дивиатура «title / hint / score row» во всех 6 играх.
 *
 *  Конструкция:
 *    [Заголовок · countdown]    — крупно, по центру, золотой
 *    [подсказка / правила]      — мелко, муть, по центру
 *    [score chip · lives · timer trough] — опционально, ряд снизу
 */
export interface GameHeaderProps {
  /** Главный заголовок строки: «Память Кощея · 20 сек» */
  title: ReactNode
  /** Подсказка-описание под заголовком */
  hint?: ReactNode
  /** Время заканчивается — окрашиваем заголовок и трогать в красный */
  urgent?: boolean
  /** Чип-счётчик слева (например, «Счёт: 12») */
  scoreChip?: ReactNode
  /** Жизни справа — массив true/false, true = живая */
  lives?: boolean[]
  /** Произвольный узел справа — заменяет lives, если задан */
  rightSlot?: ReactNode
  /** Прогресс таймера: 0..1, если задан — показываем «жёлоб»-полоску */
  timerProgress?: number | null
}

export function GameHeader({ title, hint, urgent, scoreChip, lives, rightSlot, timerProgress }: GameHeaderProps) {
  const titleColor = urgent ? colors.danger : colors.fairyGold
  return (
    <div style={{
      background: gradients.wood,
      borderRadius: '12px',
      border: `1.5px solid ${colors.woodRim}`,
      boxShadow: 'inset 0 1px 0 rgba(255,200,100,0.18), inset 0 -1px 0 rgba(0,0,0,0.35), 0 3px 14px rgba(0,0,0,0.55)',
      padding: `${spacing.sm} ${spacing.md}`,
      marginBottom: spacing.sm,
    }}>
      <div style={{
        textAlign: 'center', color: titleColor,
        fontWeight: 700, fontSize: '17px',
        fontFamily: "'Cinzel', 'Marcellus', serif",
        textShadow: urgent ? 'none' : `0 0 14px ${colors.fairyGold}40`,
        letterSpacing: '0.02em',
      }}>
        {title}
      </div>
      {hint && (
        <div style={{
          color: 'rgba(248,228,178,0.85)', fontSize: '12px', textAlign: 'center',
          marginTop: 4, lineHeight: 1.4,
        }}>
          {hint}
        </div>
      )}
      {(scoreChip || lives || rightSlot || timerProgress != null) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: spacing.sm, marginTop: spacing.sm,
        }}>
          <div style={{ minWidth: 60, display: 'flex', justifyContent: 'flex-start' }}>
            {scoreChip ?? null}
          </div>
          {timerProgress != null && (
            <div style={{ flex: 1, maxWidth: 200 }}>
              <Trough progress={timerProgress} urgent={urgent} />
            </div>
          )}
          <div style={{ minWidth: 60, display: 'flex', justifyContent: 'flex-end' }}>
            {rightSlot ?? (lives && <Lives values={lives} />) ?? null}
          </div>
        </div>
      )}
    </div>
  )
}

/** Чип-счётчик в стиле «Найдено: 5/8» — тёмный фон, золотая обводка. */
export function ScoreChip({ children, tone = 'gold' }: {
  children: ReactNode
  tone?: 'gold' | 'success' | 'danger'
}) {
  const toneColor = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : colors.fairyGold
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 12px', borderRadius: 20,
      fontFamily: "'Cinzel', 'Marcellus', serif",
      fontWeight: 700, fontSize: '13px',
      background: 'rgba(0,0,0,0.35)',
      border: `1px solid ${toneColor}55`,
      color: toneColor,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {children}
    </span>
  )
}

/** Полоска жёлоба для таймера — углубление с золотой/красной заливкой. */
function Trough({ progress, urgent }: { progress: number; urgent?: boolean }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100
  const fill = urgent
    ? `linear-gradient(90deg, #C04040, ${colors.sealRedBright})`
    : `linear-gradient(90deg, ${colors.fairyGoldDim}, ${colors.fairyGold}, ${colors.fairyGoldBright})`
  return (
    <div style={{
      height: 10, borderRadius: 5, overflow: 'hidden',
      background: 'rgba(0,0,0,0.45)',
      border: '1px solid rgba(0,0,0,0.35)',
      boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.45)',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: 5,
        background: fill,
        boxShadow: urgent ? '0 0 10px rgba(208,80,80,0.5)' : `0 0 10px ${colors.fairyGold}55`,
        transition: 'width 0.3s linear',
      }} />
    </div>
  )
}

/** Ряд сердечек-жизней. true = жив, false = погасло. */
function Lives({ values }: { values: boolean[] }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {values.map((alive, i) => (
        <span key={i} style={{
          fontSize: 14, lineHeight: 1,
          opacity: alive ? 1 : 0.22,
          filter: alive ? 'drop-shadow(0 0 4px rgba(208,80,80,0.6))' : 'grayscale(1)',
        }}>
          {alive ? '❤' : '🤍'}
        </span>
      ))}
    </div>
  )
}

/** Золотая 3D-кнопка «Принять испытание» — главное CTA в интро и результате.
 *  Использует унифицированный ctaButton.lg + лёгкое расширение под полный
 *  width и небольшой text-shadow для серьёзности. */
export const goldBtnStyle: CSSProperties = {
  ...ctaButton.lg,
  width: '100%',
  padding: `${spacing.md} ${spacing.lg}`,
  fontSize: '15px',
  letterSpacing: '0.04em',
  textShadow: '0 1px 0 rgba(255,255,255,0.25)',
}

/** Деревянная 3D-кнопка — вторичная (Свернуть / Передумать / Ещё раз). */
export const woodBtnStyle: CSSProperties = {
  width: '100%',
  padding: `${spacing.md} ${spacing.lg}`,
  background: gradients.woodBtn,
  border: 'none',
  borderTop: `1px solid ${colors.fairyGold}30`,
  borderBottom: `3px solid ${colors.woodBg}`,
  borderRadius: 8,
  color: colors.fairyGoldBright,
  fontFamily: "'Cinzel', 'Marcellus', serif",
  fontWeight: 700,
  fontSize: '14px',
  letterSpacing: '0.04em',
  cursor: 'pointer',
  boxShadow: `0 4px 0 ${colors.woodBg}, 0 7px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,200,100,0.14)`,
  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
}

/** Свиток-карточка — пергаментный фон с тёплым бликом и тёмной обводкой.
 *  Можно добавить самоцветы по углам через children внутри. */
export function Scroll({
  children, gem, style,
}: {
  children: ReactNode
  /** Цвет самоцветов в верхних углах (опционально) */
  gem?: 'emerald' | 'ruby' | 'sapphire' | 'amethyst' | 'gold' | null
  style?: CSSProperties
}) {
  return (
    <div style={{
      position: 'relative',
      background: gradients.scroll,
      border: `1.5px solid ${colors.parchmentEdge}`,
      borderRadius: 12,
      padding: spacing.md,
      color: colors.parchmentInk,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 3px 14px rgba(0,0,0,0.3)',
      ...style,
    }}>
      {gem && (
        <>
          <GemCorner color={gem} pos="tl" />
          <GemCorner color={gem} pos="tr" />
        </>
      )}
      {children}
    </div>
  )
}

/** Самоцвет-ромб в углу свитка. */
export function GemCorner({ color, pos }: {
  color: 'emerald' | 'ruby' | 'sapphire' | 'amethyst' | 'gold'
  pos: 'tl' | 'tr' | 'bl' | 'br'
}) {
  const colorMap = {
    emerald:  { light: '#6EDA97', dark: '#1B5E3B', glow: colors.gemEmerald },
    ruby:     { light: '#E06060', dark: '#7A1515', glow: colors.gemRuby },
    sapphire: { light: '#4A80C8', dark: '#0F2E5A', glow: colors.gemSapphire },
    amethyst: { light: '#9A60DC', dark: '#3A1668', glow: colors.gemAmethyst },
    gold:     { light: '#FFD870', dark: '#8B6914', glow: colors.gemGold },
  }[color]
  const positionStyle: CSSProperties = {
    position: 'absolute',
    ...(pos === 'tl' ? { top: 6, left: 6 }
      : pos === 'tr' ? { top: 6, right: 6 }
      : pos === 'bl' ? { bottom: 6, left: 6 }
      : { bottom: 6, right: 6 }),
  }
  return (
    <span aria-hidden style={{
      ...positionStyle,
      width: 12, height: 12, borderRadius: 3,
      transform: 'rotate(45deg)',
      background: `radial-gradient(circle at 35% 30%, ${colorMap.light}, ${colorMap.dark})`,
      boxShadow: `0 0 6px ${colorMap.glow}88`,
    }} />
  )
}
