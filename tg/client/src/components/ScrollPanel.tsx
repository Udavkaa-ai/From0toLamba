import { CSSProperties, ReactNode } from 'react'
import { colors } from '@/theme'

type GemColor = 'emerald' | 'ruby' | 'sapphire' | 'amethyst' | 'gold' | null

/** Пергаментный «грамота»-блок для длинного текста. Тёплый бежевый фон
 *  с радиальным бликом, тёмная сепия для текста, опциональные самоцветы
 *  по углам. Под него ложится любая «весть с ярмарки», описание дела,
 *  длинный совет. Если нужен заголовок — он передаётся как title. */
export function ScrollPanel({
  children, title, gem, style, padding,
}: {
  children: ReactNode
  title?: ReactNode
  /** Цвет самоцветов в верхних углах (опционально). По делу/событию: ruby/emerald/gold. */
  gem?: GemColor
  style?: CSSProperties
  /** Кастомный padding (по умолчанию 12px 18px) */
  padding?: string
}) {
  return (
    <div style={{
      position: 'relative',
      padding: padding ?? '12px 18px',
      background: 'radial-gradient(ellipse at 22% 18%, rgba(255,255,255,0.22) 0%, transparent 55%), linear-gradient(155deg, #F2DFB4 0%, #E8D5A8 55%, #D9C28A 100%)',
      border: `1.5px solid ${colors.parchmentEdge}`,
      borderRadius: 12,
      color: colors.parchmentInk,
      fontSize: 13,
      lineHeight: 1.55,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 3px 14px rgba(0,0,0,0.3)',
      ...style,
    }}>
      {gem && (
        <>
          <GemCorner color={gem} pos="tl" />
          <GemCorner color={gem} pos="tr" />
        </>
      )}
      {title && (
        <div style={{
          color: '#7A4A0A', fontWeight: 700, fontSize: 13,
          fontFamily: "'Cinzel', 'Marcellus', serif",
          letterSpacing: '0.03em',
          marginBottom: 6,
          paddingRight: gem ? 22 : 0, // отступ под самоцвет
        }}>
          {title}
        </div>
      )}
      <div>{children}</div>
    </div>
  )
}

function GemCorner({ color, pos }: {
  color: Exclude<GemColor, null>
  pos: 'tl' | 'tr'
}) {
  const colorMap = {
    emerald:  { light: '#6EDA97', dark: '#1B5E3B', glow: colors.gemEmerald },
    ruby:     { light: '#E06060', dark: '#7A1515', glow: colors.gemRuby },
    sapphire: { light: '#4A80C8', dark: '#0F2E5A', glow: colors.gemSapphire },
    amethyst: { light: '#9A60DC', dark: '#3A1668', glow: colors.gemAmethyst },
    gold:     { light: '#FFD870', dark: '#8B6914', glow: colors.gemGold },
  }[color]
  return (
    <span aria-hidden style={{
      position: 'absolute',
      top: 6,
      ...(pos === 'tl' ? { left: 6 } : { right: 6 }),
      width: 10, height: 10, borderRadius: 3,
      transform: 'rotate(45deg)',
      background: `radial-gradient(circle at 35% 30%, ${colorMap.light}, ${colorMap.dark})`,
      boxShadow: `0 0 6px ${colorMap.glow}88`,
    }} />
  )
}
