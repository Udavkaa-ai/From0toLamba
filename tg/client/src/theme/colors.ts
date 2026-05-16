// Палитра «Из грязи в князи» — расширенная семантическая система.
// Базовая тройка (fairyGold / enchantedPurple / nightBlue) — наследие Android-темы.
// Дополнения: редкости рангов, сказочные семантические, атмосферные оттенки.
export const colors = {
  // ── Основные ────────────────────────────────────────────────────────────
  fairyGold: '#FFB800',
  fairyGoldBright: '#FFD24A',  // ярче — для glow, hover, важных акцентов
  fairyGoldDim: '#B88200',     // тусклее — для disabled и фоновых обводок
  enchantedPurple: '#2A1960',
  enchantedPurpleBright: '#4A2BA0',
  enchantedPurpleDim: '#1E0E48',
  nightBlue: '#0D1735',

  // ── Фон ─────────────────────────────────────────────────────────────────
  bgDeep: '#060412',
  bgMid: '#0A0818',

  // ── Текст ───────────────────────────────────────────────────────────────
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.45)',
  textOnGold: '#1A0F00',  // тёмный для контраста на золотых кнопках

  // ── Семантические (переоттенены в сказочную сторону) ─────────────────────
  success: '#50C878',   // изумруд — прибыль, успешный сабмит, верный ответ
  successDim: '#2F7A4A',
  danger: '#E34234',    // киноварь — потеря, скам-разоблачение, ошибка
  dangerDim: '#8A2620',
  warning: '#FFA72E',   // янтарь — кулдаун, предупреждение
  info: '#7A8DFF',      // индиго — нейтральная инфа

  // ── Редкости купеческих чинов ────────────────────────────────────────────
  rankBronze: '#CD7F32',     // Скоморох (NEWBIE)
  rankSilver: '#C8D0DA',     // Купец (AMBASSADOR)
  rankGold: '#FFB800',       // Мудрец (ANALYST) — = fairyGold
  rankPlatinum: '#E5E4E2',   // Боярин (SHARK)
  rankRuby: '#E0115F',       // Князь (LAMBO_SENSEI)

  // ── Атмосферные акценты ──────────────────────────────────────────────────
  parchment: '#F4E4BC',         // пергамент — фон свитков
  parchmentDim: '#C9B988',
  ember: '#FF6B35',             // тлеющий уголь — низ AmaPage
  candleLight: '#FFC857',       // свет свечи — мерцание на CharterPage
  mist: 'rgba(180,200,220,0.12)', // туман — поверх HomePage

  // ── Карточки (премиальный многослойный стиль) ────────────────────────────
  cardGradientTop: 'rgba(58, 32, 110, 0.88)',     // тёплый фиолет, верх
  cardGradientMid: 'rgba(34, 16, 70, 0.92)',      // глубокий plum, середина
  cardGradientBottom: 'rgba(15, 18, 42, 0.96)',   // dark navy, низ
  cardBorder: 'rgba(255, 184, 0, 0.12)',          // hairline gold — еле заметна
  cardBorderBright: 'rgba(255, 184, 0, 0.35)',    // для активных/hover
  cardHighlight: 'rgba(255, 255, 255, 0.06)',     // inset top — стеклянный блик
  cardShade: 'rgba(0, 0, 0, 0.35)',               // inset bottom — глубина

  // ── Оверлеи ─────────────────────────────────────────────────────────────
  overlayDark: 'rgba(6, 4, 18, 0.85)',
  overlayLight: 'rgba(255, 184, 0, 0.08)',

  // ── Сказочно-русская палитра (Mini Games, Charter, Inbox) ───────────────
  // Пергамент — для свитков-карточек
  parchmentLight: '#F2DFB4',
  parchmentMid:   '#E8D5A8',
  parchmentDark:  '#D9C28A',
  parchmentEdge:  '#C8B07A',
  parchmentInk:   '#2D1A0A',    // тёмная сепия — текст по пергаменту

  // Резное дерево — для рамок, кнопок, нав-бара
  woodRim:   '#A06830',   // светлый кант рамки
  woodHi:    '#8B5A2B',   // bronze highlight
  woodMid:   '#4A2E14',
  woodDeep:  '#2D1A0A',
  woodDark:  '#1E1008',
  woodBg:    '#100804',   // глубокий чёрно-коричневый фон

  // Восковая печать — для важных индикаторов, danger-кнопок
  sealRed:       '#8B2D2D',
  sealRedBright: '#B0353D',
  sealCrimson:   '#D94040',  // блик на печати

  // Самоцветы — углы свитков, маркеры архетипов
  gemEmerald:  '#2E8B57',
  gemRuby:     '#9B2030',
  gemSapphire: '#1F4E8C',
  gemAmethyst: '#5C2E8A',
  gemGold:     '#D4A017',
} as const

export const gradients = {
  screen: `linear-gradient(180deg, rgba(6,4,18,0.85) 0%, rgba(10,8,24,0.75) 50%, rgba(6,4,18,0.94) 100%)`,
  card: `linear-gradient(155deg, ${colors.cardGradientTop} 0%, ${colors.cardGradientMid} 50%, ${colors.cardGradientBottom} 100%)`,
  goldAccent: `linear-gradient(90deg, transparent, ${colors.fairyGold}40, transparent)`,
  goldShine: `linear-gradient(135deg, ${colors.fairyGoldDim}, ${colors.fairyGoldBright}, ${colors.fairyGoldDim})`,
  rankUp: `linear-gradient(135deg, ${colors.enchantedPurple}, ${colors.nightBlue})`,
  emerald: `linear-gradient(135deg, ${colors.successDim}, ${colors.success})`,
  ruby: `linear-gradient(135deg, ${colors.dangerDim}, ${colors.rankRuby})`,
  parchment: `linear-gradient(180deg, ${colors.parchment}, ${colors.parchmentDim})`,
  // Резное дерево — фон для шапки мини-игр, нав-баров
  wood: `repeating-linear-gradient(89deg, transparent 0, transparent 3px, rgba(0,0,0,.05) 3px, rgba(0,0,0,.05) 4px), linear-gradient(180deg, ${colors.woodMid} 0%, ${colors.woodDeep} 100%)`,
  // Свиток-пергамент с тёплым бликом
  scroll: `radial-gradient(ellipse at 22% 18%, rgba(255,255,255,.22) 0%, transparent 55%), linear-gradient(155deg, ${colors.parchmentLight} 0%, ${colors.parchmentMid} 55%, ${colors.parchmentDark} 100%)`,
  // Золото — для кнопок «Принять испытание»
  goldBtn: `linear-gradient(180deg, #FFD660 0%, #FFB800 55%, #C08000 100%)`,
  // Дерево — для вторичных кнопок
  woodBtn: `linear-gradient(180deg, ${colors.woodHi} 0%, ${colors.woodMid} 55%, ${colors.woodDeep} 100%)`,
} as const

export const shadows = {
  card: '0 4px 16px rgba(0, 0, 0, 0.4)',
  goldGlow: `0 0 20px ${colors.fairyGold}40, 0 0 40px ${colors.fairyGold}20`,
  goldGlowStrong: `0 0 30px ${colors.fairyGoldBright}80, 0 0 60px ${colors.fairyGold}40`,
  emberGlow: `0 0 20px ${colors.ember}60, 0 0 40px ${colors.ember}30`,
  candleGlow: `0 0 16px ${colors.candleLight}80, 0 0 32px ${colors.candleLight}40`,
} as const

/** Цвет редкости по InvestorRank */
export const RANK_COLOR: Record<string, string> = {
  NEWBIE: colors.rankBronze,
  AMBASSADOR: colors.rankSilver,
  ANALYST: colors.rankGold,
  SHARK: colors.rankPlatinum,
  LAMBO_SENSEI: colors.rankRuby,
}
