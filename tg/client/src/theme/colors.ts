// Палитра «Из грязи в князи» — две темы.
//
//   classic — наследие Android: глубокий фиолет (EnchantedPurple) + золото.
//             Технологичный, премиальный, «магия в полночь».
//   fairy   — резное дерево + пергамент + восковая печать.
//             Русско-сказочный: «Билибин + Союзмультфильм».
//
// Тема выбирается ОДИН РАЗ при загрузке страницы (localStorage). При смене
// темы — перезагрузка, чтобы все компоненты подхватили новые токены.
//
// Что отличается между темами: ТОЛЬКО фон экрана, фон карточки, обводки,
// inset-блики. Золото, типы рангов, чины, успех/опасность, мини-игровые
// токены (пергамент/дерево/печать/самоцветы) — общие.

const THEME_KEY = 'ui_theme_v1'
export type ThemeName = 'classic' | 'fairy'

const themes = {
  classic: {
    bgDeep: '#060412',
    bgMid:  '#0A0818',
    cardGradientTop:    'rgba(58, 32, 110, 0.88)',
    cardGradientMid:    'rgba(34, 16, 70, 0.92)',
    cardGradientBottom: 'rgba(15, 18, 42, 0.96)',
    cardBorder:       'rgba(255, 184, 0, 0.12)',
    cardBorderBright: 'rgba(255, 184, 0, 0.35)',
    cardHighlight:    'rgba(255, 255, 255, 0.06)',
    cardShade:        'rgba(0, 0, 0, 0.35)',
    overlayDark:      'rgba(6, 4, 18, 0.85)',
    overlayLight:     'rgba(255, 184, 0, 0.08)',
    cardRadius: '18px',
    cardBorderWidth: '1px',
    screenGradient:
      `linear-gradient(180deg, rgba(6,4,18,0.85) 0%, rgba(10,8,24,0.75) 50%, rgba(6,4,18,0.94) 100%)`,
    cardSurface: '',  // карточка использует cardGradient* напрямую через gradients.card
    cardSurfacePrefix: '',  // префикс перед градиентом (для волокон дерева в fairy)
    cardGradientAngle: '155deg',
    // Текст: классический белый поверх тёмного фиолетового фона
    textPrimary:   '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.7)',
    textMuted:     'rgba(255,255,255,0.45)',
    // Главная CTA («Следующий день», чат-кнопка): фиолет→ночной синий
    ctaGradient: `linear-gradient(135deg, #2A1960, #0D1735)`,
    ctaBorder:   'rgba(255,184,0,0.55)',
    // Нав-бар низа: глубокий тёмно-фиолетовый с золотым кантом
    navBarBg:     'rgba(10, 8, 24, 0.96)',
    navBarBorder: 'rgba(255, 184, 0, 0.18)',
  },
  fairy: {
    // Сказочно-русская: ярмарка в золотое полуденное время.
    // Фон — тёплое медовое дерево с золотым ореолом сверху.
    // Карточки — золотой дуб, светлее фона, чтобы «выпрыгивали».
    bgDeep: '#5A3818',   // медовое дерево внизу
    bgMid:  '#6E461E',   // золотистый дуб в середине
    // Карточка — пергамент с золотым кантом и резной деревянной рамой.
    // Светлая поверхность, текст — тёмная сепия (см. textPrimary ниже).
    cardGradientTop:    'rgba(245, 230, 195, 0.99)',  // светлый пергамент сверху
    cardGradientMid:    'rgba(232, 213, 168, 1.0)',   // основной пергамент
    cardGradientBottom: 'rgba(217, 194, 138, 1.0)',   // плотный пергамент снизу
    cardBorder:       'rgba(120, 76, 36, 0.85)',     // тёмная деревянная рамка
    cardBorderBright: 'rgba(212, 160, 60, 1.0)',     // золотой кант для активных
    cardHighlight:    'rgba(255, 250, 230, 0.7)',    // мягкий бумажный блик сверху
    cardShade:        'rgba(120, 80, 40, 0.25)',
    overlayDark:      'rgba(48, 26, 10, 0.85)',
    overlayLight:     'rgba(255, 184, 0, 0.14)',
    cardRadius: '14px',
    cardBorderWidth: '1.5px',
    // Светлый медовый фон с большим золотым ореолом сверху + тонкие волокна
    screenGradient:
      `repeating-linear-gradient(89deg, transparent 0, transparent 3px, rgba(0,0,0,0.045) 3px, rgba(0,0,0,0.045) 4px), radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,200,90,0.30) 0%, transparent 60%), linear-gradient(180deg, rgba(132,84,38,1.0) 0%, rgba(108,68,30,1.0) 45%, rgba(82,52,24,1.0) 100%)`,
    cardSurface: '',
    // На пергаменте — мягкий радиальный блик («тёплая бумага под рукой»),
    // не «волокна дерева». Текстура задаётся через prefix перед градиентом.
    cardSurfacePrefix:
      `radial-gradient(ellipse at 22% 18%, rgba(255,255,255,0.5) 0%, transparent 55%), `,
    cardGradientAngle: '155deg',
    // Текст: тёмная сепия на пергаменте — главный жирный, средний, выцветший
    textPrimary:   '#2D1A0A',
    textSecondary: 'rgba(45,26,10,0.78)',
    textMuted:     'rgba(45,26,10,0.55)',
    // CTA в сказочной — золото с тёмной сепией для текста на нём
    ctaGradient: `linear-gradient(180deg, #FFD660 0%, #FFB800 55%, #B07400 100%)`,
    ctaBorder:   'rgba(120, 76, 36, 0.9)',
    // Нав-бар — резное тёмное дерево с золотым кантом сверху
    navBarBg:     `repeating-linear-gradient(89deg, transparent 0, transparent 3px, rgba(0,0,0,.06) 3px, rgba(0,0,0,.06) 4px), linear-gradient(180deg, #4A2E14 0%, #2D1A0A 100%)`,
    navBarBorder: 'rgba(212, 160, 60, 0.7)',
  },
} as const

function readActiveTheme(): ThemeName {
  if (typeof window === 'undefined') return 'classic'
  const v = window.localStorage?.getItem(THEME_KEY)
  return v === 'fairy' ? 'fairy' : 'classic'
}

const activeName: ThemeName = readActiveTheme()
const active = themes[activeName]

export function getTheme(): ThemeName { return activeName }

/** Сменить тему. Перезагружает страницу, чтобы все импорты подхватили новую палитру. */
export function setTheme(name: ThemeName): void {
  try {
    window.localStorage?.setItem(THEME_KEY, name)
  } catch { /* noop */ }
  window.location.reload()
}

export const colors = {
  // ── Основные ────────────────────────────────────────────────────────────
  fairyGold: '#FFB800',
  fairyGoldBright: '#FFD24A',
  fairyGoldDim: '#B88200',
  enchantedPurple: '#2A1960',
  enchantedPurpleBright: '#4A2BA0',
  enchantedPurpleDim: '#1E0E48',
  nightBlue: '#0D1735',

  // ── Фон (зависит от темы) ──────────────────────────────────────────────
  bgDeep: active.bgDeep,
  bgMid: active.bgMid,

  // ── Текст (theme-aware: белый на тёмном / тёмная сепия на пергаменте) ──
  textPrimary:   active.textPrimary,
  textSecondary: active.textSecondary,
  textMuted:     active.textMuted,
  textOnGold:    '#1A0F00',  // тёмный для золотых кнопок (общий)

  // Светлый текст для тёмных поверхностей (нав-бар, модалки, оверлеи,
  // канвас мини-игр). Всегда белый/полупрозрачный белый — не зависит от темы.
  textOnDark:        '#FFFFFF',
  textOnDarkSecond:  'rgba(255,255,255,0.7)',
  textOnDarkMuted:   'rgba(255,255,255,0.45)',

  // ── Семантические ─────────────────────────────────────────────────────
  success: '#50C878',
  successDim: '#2F7A4A',
  danger: '#E34234',
  dangerDim: '#8A2620',
  warning: '#FFA72E',
  info: '#7A8DFF',

  // ── Редкости купеческих чинов ────────────────────────────────────────────
  rankBronze: '#CD7F32',
  rankSilver: '#C8D0DA',
  rankGold: '#FFB800',
  rankPlatinum: '#E5E4E2',
  rankRuby: '#E0115F',

  // ── Атмосферные акценты ──────────────────────────────────────────────────
  parchment: '#F4E4BC',
  parchmentDim: '#C9B988',
  ember: '#FF6B35',
  candleLight: '#FFC857',
  mist: 'rgba(180,200,220,0.12)',

  // ── Карточки (зависят от темы) ──────────────────────────────────────────
  cardGradientTop:    active.cardGradientTop,
  cardGradientMid:    active.cardGradientMid,
  cardGradientBottom: active.cardGradientBottom,
  cardBorder:         active.cardBorder,
  cardBorderBright:   active.cardBorderBright,
  cardHighlight:      active.cardHighlight,
  cardShade:          active.cardShade,

  // ── Оверлеи (зависят от темы) ───────────────────────────────────────────
  overlayDark:  active.overlayDark,
  overlayLight: active.overlayLight,

  // ── Сказочно-русская палитра (общая для обеих тем) ─────────────────────
  // Пергамент — для свитков-карточек
  parchmentLight: '#F2DFB4',
  parchmentMid:   '#E8D5A8',
  parchmentDark:  '#D9C28A',
  parchmentEdge:  '#C8B07A',
  parchmentInk:   '#2D1A0A',

  // Резное дерево — для рамок, кнопок, нав-бара
  woodRim:   '#A06830',
  woodHi:    '#8B5A2B',
  woodMid:   '#4A2E14',
  woodDeep:  '#2D1A0A',
  woodDark:  '#1E1008',
  woodBg:    '#100804',

  // Восковая печать
  sealRed:       '#8B2D2D',
  sealRedBright: '#B0353D',
  sealCrimson:   '#D94040',

  // Самоцветы
  gemEmerald:  '#2E8B57',
  gemRuby:     '#9B2030',
  gemSapphire: '#1F4E8C',
  gemAmethyst: '#5C2E8A',
  gemGold:     '#D4A017',

  // ── Геометрия карточки (для FairyCard, чтобы темам различался ободок) ──
  cardRadius: active.cardRadius,
  cardBorderWidth: active.cardBorderWidth,

  // ── CTA + нав-бар (theme-aware) ─────────────────────────────────────────
  ctaBorder:    active.ctaBorder,
  navBarBg:     active.navBarBg,
  navBarBorder: active.navBarBorder,
  // Цвет текста для CTA-кнопок (золото в fairy → тёмная сепия; фиолет в classic → светлое золото)
  ctaText:      activeName === 'fairy' ? '#3A2010' : '#FFB800',
} as const

export const gradients = {
  screen: active.screenGradient,
  card: `${active.cardSurfacePrefix}linear-gradient(${active.cardGradientAngle}, ${active.cardGradientTop} 0%, ${active.cardGradientMid} ${activeName === 'fairy' ? '55%' : '50%'}, ${active.cardGradientBottom} 100%)`,
  goldAccent: `linear-gradient(90deg, transparent, ${colors.fairyGold}40, transparent)`,
  goldShine: `linear-gradient(135deg, ${colors.fairyGoldDim}, ${colors.fairyGoldBright}, ${colors.fairyGoldDim})`,
  rankUp: `linear-gradient(135deg, ${colors.enchantedPurple}, ${colors.nightBlue})`,
  emerald: `linear-gradient(135deg, ${colors.successDim}, ${colors.success})`,
  ruby: `linear-gradient(135deg, ${colors.dangerDim}, ${colors.rankRuby})`,
  parchment: `linear-gradient(180deg, ${colors.parchment}, ${colors.parchmentDim})`,
  // Резное дерево — фон для шапки мини-игр, нав-баров (общий для обеих тем)
  wood: `repeating-linear-gradient(89deg, transparent 0, transparent 3px, rgba(0,0,0,.05) 3px, rgba(0,0,0,.05) 4px), linear-gradient(180deg, ${colors.woodMid} 0%, ${colors.woodDeep} 100%)`,
  // Свиток-пергамент с тёплым бликом (общий)
  scroll: `radial-gradient(ellipse at 22% 18%, rgba(255,255,255,.22) 0%, transparent 55%), linear-gradient(155deg, ${colors.parchmentLight} 0%, ${colors.parchmentMid} 55%, ${colors.parchmentDark} 100%)`,
  goldBtn: `linear-gradient(180deg, #FFD660 0%, #FFB800 55%, #C08000 100%)`,
  woodBtn: `linear-gradient(180deg, ${colors.woodHi} 0%, ${colors.woodMid} 55%, ${colors.woodDeep} 100%)`,
  // Theme-aware CTA градиент (Следующий день, чат-кнопка, активные акции)
  cta: active.ctaGradient,
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
