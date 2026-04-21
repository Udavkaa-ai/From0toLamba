// Цвета — перенос из Android-темы
export const colors = {
  // Основные
  fairyGold: '#FFB800',
  enchantedPurple: '#2A1960',
  nightBlue: '#0D1735',

  // Фон
  bgDeep: '#060412',
  bgMid: '#0A0818',

  // Текст
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.45)',

  // Акценты
  success: '#4CAF50',
  danger: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',

  // Карточки
  cardGradientTop: 'rgba(42, 25, 96, 0.88)',  // enchantedPurple 88%
  cardGradientBottom: 'rgba(13, 23, 53, 0.95)', // nightBlue 95%
  cardBorder: 'rgba(255, 184, 0, 0.2)',

  // Оверлеи
  overlayDark: 'rgba(6, 4, 18, 0.85)',
  overlayLight: 'rgba(255, 184, 0, 0.08)',
} as const

export const gradients = {
  screen: `linear-gradient(180deg, rgba(6,4,18,0.85) 0%, rgba(10,8,24,0.75) 50%, rgba(6,4,18,0.94) 100%)`,
  card: `linear-gradient(145deg, ${colors.cardGradientTop} 0%, ${colors.cardGradientBottom} 100%)`,
  goldAccent: `linear-gradient(90deg, transparent, ${colors.fairyGold}40, transparent)`,
  rankUp: `linear-gradient(135deg, ${colors.enchantedPurple}, ${colors.nightBlue})`,
} as const
