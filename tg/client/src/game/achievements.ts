import type { GameStateDTO } from '@/api/client'

export interface Achievement {
  id: string
  name: string       // старорусское имя подвига
  description: string
  emoji: string
  category: 'wealth' | 'charter' | 'deals' | 'social' | 'rank'
  /** Если возвращает true — подвиг совершён */
  check: (ctx: AchievementContext) => boolean
  /** Прогресс до цели — для отображения шкалы */
  progress?: (ctx: AchievementContext) => { current: number; target: number }
}

export interface AchievementContext {
  gameState: GameStateDTO
  totalWealth: number
}

const totalWealthFrom = (gs: GameStateDTO) =>
  gs.balance + gs.activeProjects.reduce((s, p) => s + p.currentValueRubles, 0)

/** 17 подвигов в сказочно-купеческом стиле, по возрастанию сложности в каждой категории */
export const ACHIEVEMENTS: Achievement[] = [
  // ─── Грамоты / чуйка ─────────────────────────────────────────────────────
  {
    id: 'first_scroll',
    name: 'Первая грамота',
    description: 'Разобрал свою первую купеческую грамоту',
    emoji: '📜',
    category: 'charter',
    check: ({ gameState }) => gameState.chartersSubmitted >= 1,
    progress: ({ gameState }) => ({ current: Math.min(gameState.chartersSubmitted, 1), target: 1 }),
  },
  {
    id: 'ten_scrolls',
    name: 'Бывалый грамотей',
    description: 'Разобрал 10 грамот',
    emoji: '📚',
    category: 'charter',
    check: ({ gameState }) => gameState.chartersSubmitted >= 10,
    progress: ({ gameState }) => ({ current: Math.min(gameState.chartersSubmitted, 10), target: 10 }),
  },
  {
    id: 'fifty_scrolls',
    name: 'Книжник-летописец',
    description: 'Разобрал 50 грамот',
    emoji: '📖',
    category: 'charter',
    check: ({ gameState }) => gameState.chartersSubmitted >= 50,
    progress: ({ gameState }) => ({ current: Math.min(gameState.chartersSubmitted, 50), target: 50 }),
  },
  {
    id: 'sharp_eye',
    name: 'Купеческий глаз',
    description: 'Точность чуйки 80% после 10+ грамот',
    emoji: '👁',
    category: 'charter',
    check: ({ gameState }) =>
      gameState.chartersSubmitted >= 10 && (gameState.intuitionAccuracy ?? 0) >= 0.8,
  },
  {
    id: 'hawk_eye',
    name: 'Ястребиный взор',
    description: 'Точность чуйки 95% после 20+ грамот',
    emoji: '🦅',
    category: 'charter',
    check: ({ gameState }) =>
      gameState.chartersSubmitted >= 20 && (gameState.intuitionAccuracy ?? 0) >= 0.95,
  },

  // ─── Дела ───────────────────────────────────────────────────────────────
  {
    id: 'first_deal',
    name: 'Первый барыш',
    description: 'Закрыл первое дело',
    emoji: '🪙',
    category: 'deals',
    check: ({ gameState }) => gameState.closedProjectsCount >= 1,
    progress: ({ gameState }) => ({ current: Math.min(gameState.closedProjectsCount, 1), target: 1 }),
  },
  {
    id: 'five_deals',
    name: 'Оборотистый купец',
    description: 'Закрыл 5 дел с вложением',
    emoji: '⚖️',
    category: 'deals',
    check: ({ gameState }) => gameState.closedProjectsCount >= 5,
    progress: ({ gameState }) => ({ current: Math.min(gameState.closedProjectsCount, 5), target: 5 }),
  },
  {
    id: 'twenty_deals',
    name: 'Бывалый торговец',
    description: 'Закрыл 20 дел',
    emoji: '🏪',
    category: 'deals',
    check: ({ gameState }) => gameState.closedProjectsCount >= 20,
    progress: ({ gameState }) => ({ current: Math.min(gameState.closedProjectsCount, 20), target: 20 }),
  },

  // ─── Достаток ───────────────────────────────────────────────────────────
  {
    id: 'copper_coin',
    name: 'Медная мошна',
    description: 'Накопил 100 ₽ в казне',
    emoji: '💰',
    category: 'wealth',
    check: ({ totalWealth }) => totalWealth >= 100,
    progress: ({ totalWealth }) => ({ current: Math.min(Math.floor(totalWealth), 100), target: 100 }),
  },
  {
    id: 'gold_coin',
    name: 'Золотой червонец',
    description: 'Накопил 1 000 ₽',
    emoji: '🪙',
    category: 'wealth',
    check: ({ totalWealth }) => totalWealth >= 1000,
    progress: ({ totalWealth }) => ({ current: Math.min(Math.floor(totalWealth), 1000), target: 1000 }),
  },
  {
    id: 'rich_chest',
    name: 'Кованый сундук',
    description: 'Накопил 5 000 ₽',
    emoji: '📦',
    category: 'wealth',
    check: ({ totalWealth }) => totalWealth >= 5000,
    progress: ({ totalWealth }) => ({ current: Math.min(Math.floor(totalWealth), 5000), target: 5000 }),
  },
  {
    id: 'vast_treasure',
    name: 'Несметные богатства',
    description: 'Накопил 10 000 ₽',
    emoji: '💎',
    category: 'wealth',
    check: ({ totalWealth }) => totalWealth >= 10000,
    progress: ({ totalWealth }) => ({ current: Math.min(Math.floor(totalWealth), 10000), target: 10000 }),
  },

  // ─── Ранги ──────────────────────────────────────────────────────────────
  {
    id: 'rank_kupec',
    name: 'В купцы вышел',
    description: 'Достиг чина Купца',
    emoji: '🛒',
    category: 'rank',
    check: ({ gameState }) => ['AMBASSADOR', 'ANALYST', 'SHARK', 'LAMBO_SENSEI'].includes(gameState.investorRank),
  },
  {
    id: 'rank_mudrec',
    name: 'Мудрость обрёл',
    description: 'Достиг чина Мудреца',
    emoji: '📖',
    category: 'rank',
    check: ({ gameState }) => ['ANALYST', 'SHARK', 'LAMBO_SENSEI'].includes(gameState.investorRank),
  },
  {
    id: 'rank_boyarin',
    name: 'Боярская шуба',
    description: 'Достиг чина Боярина',
    emoji: '🧥',
    category: 'rank',
    check: ({ gameState }) => ['SHARK', 'LAMBO_SENSEI'].includes(gameState.investorRank),
  },
  {
    id: 'rank_knyaz',
    name: 'Княжий венец',
    description: 'Взошёл на княжеский престол',
    emoji: '👑',
    category: 'rank',
    check: ({ gameState }) => gameState.investorRank === 'LAMBO_SENSEI',
  },

  // ─── Серия / постоянство ────────────────────────────────────────────────
  {
    id: 'streak_week',
    name: 'Семидневная ярмарка',
    description: 'Серия 7 дней подряд',
    emoji: '🔥',
    category: 'rank',
    check: ({ gameState }) => gameState.dayStreak >= 7,
    progress: ({ gameState }) => ({ current: Math.min(gameState.dayStreak, 7), target: 7 }),
  },
  {
    id: 'streak_month',
    name: 'Лунный оборот',
    description: 'Серия 30 дней подряд',
    emoji: '🌙',
    category: 'rank',
    check: ({ gameState }) => gameState.dayStreak >= 30,
    progress: ({ gameState }) => ({ current: Math.min(gameState.dayStreak, 30), target: 30 }),
  },

  // ─── Сватовство (рефералы) ──────────────────────────────────────────────
  {
    id: 'first_referral',
    name: 'Первый сват',
    description: 'Зазвал на ярмарку первого купца',
    emoji: '🤝',
    category: 'social',
    check: ({ gameState }) => gameState.referralCount >= 1,
    progress: ({ gameState }) => ({ current: Math.min(gameState.referralCount, 1), target: 1 }),
  },
  {
    id: 'artel_starshoy',
    name: 'Старшой артели',
    description: 'Привёл 5 купцов',
    emoji: '👥',
    category: 'social',
    check: ({ gameState }) => gameState.referralCount >= 5,
    progress: ({ gameState }) => ({ current: Math.min(gameState.referralCount, 5), target: 5 }),
  },
  {
    id: 'narodny_atamaн',
    name: 'Народный атаман',
    description: 'Привёл 20 купцов',
    emoji: '🎖️',
    category: 'social',
    check: ({ gameState }) => gameState.referralCount >= 20,
    progress: ({ gameState }) => ({ current: Math.min(gameState.referralCount, 20), target: 20 }),
  },
]

export interface EvaluatedAchievement {
  id: string
  name: string
  description: string
  emoji: string
  category: Achievement['category']
  unlocked: boolean
  progress?: { current: number; target: number }
}

export function evaluateAchievements(gameState: GameStateDTO): EvaluatedAchievement[] {
  const ctx: AchievementContext = { gameState, totalWealth: totalWealthFrom(gameState) }
  return ACHIEVEMENTS.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    emoji: a.emoji,
    category: a.category,
    unlocked: a.check(ctx),
    progress: a.progress?.(ctx),
  }))
}

export const CATEGORY_LABELS: Record<Achievement['category'], string> = {
  charter: '📜 Грамоты',
  deals:   '⚖️ Дела',
  wealth:  '💰 Достаток',
  rank:    '🏆 Чин',
  social:  '🤝 Сватовство',
}
