import type { GameStateDTO } from '@/api/client'

export interface Achievement {
  id: string
  name: string       // старорусское имя подвига
  description: string
  emoji: string
  category: 'wealth' | 'charter' | 'deals' | 'social' | 'rank' | 'bestiary'
  /** Если возвращает true — подвиг совершён */
  check: (ctx: AchievementContext) => boolean
  /** Прогресс до цели — для отображения шкалы */
  progress?: (ctx: AchievementContext) => { current: number; target: number }
  /** Подвиги «зверинца» — по тапу открывают справку о породе/личине/судьбе */
  revealTopic?: { kind: 'type' | 'archetype' | 'fate'; id: string }
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
    description: 'Накопил 100 г в казне',
    emoji: '💰',
    category: 'wealth',
    check: ({ totalWealth }) => totalWealth >= 100,
    progress: ({ totalWealth }) => ({ current: Math.min(Math.floor(totalWealth), 100), target: 100 }),
  },
  {
    id: 'gold_coin',
    name: 'Золотой червонец',
    description: 'Накопил 1 000 г',
    emoji: '🪙',
    category: 'wealth',
    check: ({ totalWealth }) => totalWealth >= 1000,
    progress: ({ totalWealth }) => ({ current: Math.min(Math.floor(totalWealth), 1000), target: 1000 }),
  },
  {
    id: 'rich_chest',
    name: 'Кованый сундук',
    description: 'Накопил 5 000 г',
    emoji: '📦',
    category: 'wealth',
    check: ({ totalWealth }) => totalWealth >= 5000,
    progress: ({ totalWealth }) => ({ current: Math.min(Math.floor(totalWealth), 5000), target: 5000 }),
  },
  {
    id: 'vast_treasure',
    name: 'Несметные богатства',
    description: 'Накопил 10 000 г',
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
    id: 'narodny_ataman',
    name: 'Народный атаман',
    description: 'Привёл 20 купцов',
    emoji: '🎖️',
    category: 'social',
    check: ({ gameState }) => gameState.referralCount >= 20,
    progress: ({ gameState }) => ({ current: Math.min(gameState.referralCount, 20), target: 20 }),
  },

  // ─── Беседы с дельцами ──────────────────────────────────────────────────
  {
    id: 'first_chat',
    name: 'Первая беседа',
    description: 'Поговорил с одним дельцом',
    emoji: '💬',
    category: 'social',
    check: ({ gameState }) => gameState.amaSessionsStarted >= 1,
    progress: ({ gameState }) => ({ current: Math.min(gameState.amaSessionsStarted, 1), target: 1 }),
  },
  {
    id: 'five_chats',
    name: 'Знакомец на ярмарке',
    description: 'Побеседовал с пятью разными дельцами',
    emoji: '🗣',
    category: 'social',
    check: ({ gameState }) => gameState.amaSessionsStarted >= 5,
    progress: ({ gameState }) => ({ current: Math.min(gameState.amaSessionsStarted, 5), target: 5 }),
  },
  {
    id: 'ten_chats',
    name: 'Завсегдатай кабака',
    description: 'Побеседовал с десятью разными дельцами',
    emoji: '🍻',
    category: 'social',
    check: ({ gameState }) => gameState.amaSessionsStarted >= 10,
    progress: ({ gameState }) => ({ current: Math.min(gameState.amaSessionsStarted, 10), target: 10 }),
  },
  {
    id: 'all_ten_questions',
    name: 'Расспросил по чести',
    description: 'Задал все 10 вопросов в одной беседе',
    emoji: '📜',
    category: 'social',
    check: ({ gameState }) => gameState.amaSessionsCompleted >= 1,
    progress: ({ gameState }) => ({ current: Math.min(gameState.amaSessionsCompleted, 1), target: 1 }),
  },

  // ─── Зверинец: породы дел ───────────────────────────────────────────────
  {
    id: 'seen_card_game',
    name: 'Картёжный стол',
    description: 'Закрой дело с породой «Азартная игра»',
    emoji: '🎴',
    category: 'bestiary',
    revealTopic: { kind: 'type', id: 'CARD_GAME' },
    check: ({ gameState }) => gameState.seenTypes.includes('CARD_GAME'),
  },
  {
    id: 'seen_treasure_hunt',
    name: 'Тропой кладоискателя',
    description: 'Закрой дело с породой «Поиск клада»',
    emoji: '🗺️',
    category: 'bestiary',
    revealTopic: { kind: 'type', id: 'TREASURE_HUNT' },
    check: ({ gameState }) => gameState.seenTypes.includes('TREASURE_HUNT'),
  },
  {
    id: 'seen_potion_brew',
    name: 'Котёл зельевара',
    description: 'Закрой дело с породой «Зелейное дело»',
    emoji: '🧪',
    category: 'bestiary',
    revealTopic: { kind: 'type', id: 'POTION_BREW' },
    check: ({ gameState }) => gameState.seenTypes.includes('POTION_BREW'),
  },
  {
    id: 'seen_guild_scheme',
    name: 'Артельный подмастерье',
    description: 'Закрой дело с породой «Артель»',
    emoji: '⚙️',
    category: 'bestiary',
    revealTopic: { kind: 'type', id: 'GUILD_SCHEME' },
    check: ({ gameState }) => gameState.seenTypes.includes('GUILD_SCHEME'),
  },
  {
    id: 'seen_honest_trade',
    name: 'Ряды ярмарочные',
    description: 'Закрой дело с породой «Честная торговля»',
    emoji: '🤝',
    category: 'bestiary',
    revealTopic: { kind: 'type', id: 'HONEST_TRADE' },
    check: ({ gameState }) => gameState.seenTypes.includes('HONEST_TRADE'),
  },

  // ─── Зверинец: личины хозяев ────────────────────────────────────────────
  {
    id: 'seen_buratino',
    name: 'Золотой ключик',
    description: 'Распознай Буратино — закрой его дело',
    emoji: '🤥',
    category: 'bestiary',
    revealTopic: { kind: 'archetype', id: 'BURATINO' },
    check: ({ gameState }) => gameState.seenArchetypes.includes('BURATINO'),
  },
  {
    id: 'seen_boyarin',
    name: 'Царь-Горошина',
    description: 'Столкнись с царём Горохом',
    emoji: '👑',
    category: 'bestiary',
    revealTopic: { kind: 'archetype', id: 'BOYARIN' },
    check: ({ gameState }) => gameState.seenArchetypes.includes('BOYARIN'),
  },
  {
    id: 'seen_kolobok',
    name: 'Ох, румяный бок',
    description: 'Встреть Колобка и узнай его присказки',
    emoji: '🥮',
    category: 'bestiary',
    revealTopic: { kind: 'archetype', id: 'KOLOBOK' },
    check: ({ gameState }) => gameState.seenArchetypes.includes('KOLOBOK'),
  },
  {
    id: 'seen_koschei',
    name: 'Ледяной счёт',
    description: 'Закрой дело Кощея — самый опасный хозяин',
    emoji: '💀',
    category: 'bestiary',
    revealTopic: { kind: 'archetype', id: 'KOSCHEI' },
    check: ({ gameState }) => gameState.seenArchetypes.includes('KOSCHEI'),
  },
  {
    id: 'seen_zolushka',
    name: 'Хрустальная туфелька',
    description: 'Повстречай Золушку на ярмарке',
    emoji: '👠',
    category: 'bestiary',
    revealTopic: { kind: 'archetype', id: 'ZOLUSHKA' },
    check: ({ gameState }) => gameState.seenArchetypes.includes('ZOLUSHKA'),
  },
  {
    id: 'seen_baba_yaga',
    name: 'Избушка на опушке',
    description: 'Загляни в дела Бабы-яги',
    emoji: '🏚️',
    category: 'bestiary',
    revealTopic: { kind: 'archetype', id: 'BABA_YAGA' },
    check: ({ gameState }) => gameState.seenArchetypes.includes('BABA_YAGA'),
  },
  {
    id: 'seen_ivan_durak',
    name: 'По щучьему велению',
    description: 'Послушай Ивана-дурака — он честнее всех',
    emoji: '🙃',
    category: 'bestiary',
    revealTopic: { kind: 'archetype', id: 'IVAN_DURAK' },
    check: ({ gameState }) => gameState.seenArchetypes.includes('IVAN_DURAK'),
  },

  // ─── Зверинец: судьбы дел ───────────────────────────────────────────────
  {
    id: 'seen_instant_scam',
    name: 'Укус вора',
    description: 'Переживи внезапное бегство хозяина с казной',
    emoji: '💀',
    category: 'bestiary',
    revealTopic: { kind: 'fate', id: 'INSTANT_SCAM' },
    check: ({ gameState }) => gameState.seenFates.includes('INSTANT_SCAM'),
  },
  {
    id: 'seen_slow_drain',
    name: 'Тихий закат',
    description: 'Увидь как дело медленно истлевает',
    emoji: '🌫️',
    category: 'bestiary',
    revealTopic: { kind: 'fate', id: 'SLOW_DRAIN' },
    check: ({ gameState }) => gameState.seenFates.includes('SLOW_DRAIN'),
  },
  {
    id: 'seen_honest_fail',
    name: 'Без удачи, но с честью',
    description: 'Столкнись с честным провалом',
    emoji: '😔',
    category: 'bestiary',
    revealTopic: { kind: 'fate', id: 'HONEST_FAIL' },
    check: ({ gameState }) => gameState.seenFates.includes('HONEST_FAIL'),
  },
  {
    id: 'seen_survivor',
    name: 'Крепкий якорь',
    description: 'Доведи дело-долгожителя до достойного закрытия',
    emoji: '⚓',
    category: 'bestiary',
    revealTopic: { kind: 'fate', id: 'SURVIVOR' },
    check: ({ gameState }) => gameState.seenFates.includes('SURVIVOR'),
  },
  {
    id: 'seen_unicorn',
    name: 'Поймал Жар-птицу за хвост',
    description: 'Застань редчайшее дело, которое приумножает гроши в разы',
    emoji: '🔥',
    category: 'bestiary',
    revealTopic: { kind: 'fate', id: 'UNICORN' },
    check: ({ gameState }) => gameState.seenFates.includes('UNICORN'),
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
  revealTopic?: { kind: 'type' | 'archetype' | 'fate'; id: string }
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
    revealTopic: a.revealTopic,
  }))
}

export const CATEGORY_LABELS: Record<Achievement['category'], string> = {
  charter:   '📜 Грамоты',
  deals:     '⚖️ Дела',
  wealth:    '💰 Достаток',
  rank:      '🏆 Чин',
  social:    '🤝 Сватовство',
  bestiary:  '🗂️ Купеческая справа',
}
