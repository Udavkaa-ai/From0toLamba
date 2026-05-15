import { colors } from '@/theme'

const ARCHETYPE_GLYPH: Record<string, string> = {
  BURATINO:   '🪆',
  BOYARIN:    '👑',
  KOLOBOK:    '🤗',
  KOSCHEI:    '💀',
  ZOLUSHKA:   '👠',
  BABA_YAGA:  '🧙‍♀️',
  IVAN_DURAK: '🃏',
}

const ARCHETYPE_TINT: Record<string, string> = {
  BURATINO:   '#C03030',
  BOYARIN:    '#FFB800',
  KOLOBOK:    '#E9842B',
  KOSCHEI:    '#80C0FF',
  ZOLUSHKA:   '#C080FF',
  BABA_YAGA:  '#90E060',
  IVAN_DURAK: '#FF8060',
}

/**
 * Жетон-монета с эмодзи хозяина в центре. Используется для отображения
 * заработанных мини-жетонов на странице «Отношения» и в paywall'ах
 * (беседа / раскрытие дела).
 */
export function MerchantToken({ archetype, size = 32, withGlow = true }: {
  archetype: string
  size?: number
  withGlow?: boolean
}) {
  const tint = ARCHETYPE_TINT[archetype] ?? colors.fairyGold
  const glyph = ARCHETYPE_GLYPH[archetype] ?? '🪙'
  return (
    <div style={{
      width: size, height: size, position: 'relative',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg viewBox="0 0 32 32" width={size} height={size} style={{ display: 'block' }}>
        <defs>
          <radialGradient id={`coin-${archetype}-${size}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFE090" />
            <stop offset="55%" stopColor="#FFB800" />
            <stop offset="100%" stopColor="#8C6200" />
          </radialGradient>
        </defs>
        <circle cx="16" cy="16" r="14.5"
                fill={`url(#coin-${archetype}-${size})`}
                stroke={tint} strokeWidth="2" />
        <circle cx="16" cy="16" r="11.5"
                fill="none" stroke={`${tint}99`} strokeWidth="0.7"
                strokeDasharray="1.5 1.5" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.55, lineHeight: 1,
        filter: withGlow ? `drop-shadow(0 1px 2px rgba(0,0,0,0.4))` : 'none',
      }}>
        {glyph}
      </div>
    </div>
  )
}

export { ARCHETYPE_GLYPH, ARCHETYPE_TINT }
