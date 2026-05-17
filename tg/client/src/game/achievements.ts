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

// ── Помощник: статистика игры с конкретным архетипом ──────────────────────
const mg = (gs: GameStateDTO, archetype: string) =>
  gs.minigameStats?.[archetype] ?? { played: 0, perfect: 0, won: 0, lost: 0 }
const mgPerfectAll = (gs: GameStateDTO, archetypes: string[]) =>
  archetypes.every(a => mg(gs, a).perfect >= 1)
const mgWonOrPerfect = (s: { perfect: number; won: number }) => s.perfect + s.won

/** Подвиги в сказочно-купеческом стиле, по возрастанию сложности в каждой категории */
export const ACHIEVEMENTS: Achievement[] = [
  // ─── Испытания: общая прогрессия ────────────────────────────────────────
  {
    id: 'first_scroll',
    name: 'Первое испытание',
    description: 'Прошёл первое испытание у любого хозяина',
    emoji: '📜',
    category: 'charter',
    check: ({ gameState }) => gameState.chartersSubmitted >= 1,
    progress: ({ gameState }) => ({ current: Math.min(gameState.chartersSubmitted, 1), target: 1 }),
  },
  {
    id: 'ten_scrolls',
    name: 'Бывалый игрок',
    description: 'Прошёл 10 испытаний',
    emoji: '📚',
    category: 'charter',
    check: ({ gameState }) => gameState.chartersSubmitted >= 10,
    progress: ({ gameState }) => ({ current: Math.min(gameState.chartersSubmitted, 10), target: 10 }),
  },
  {
    id: 'fifty_scrolls',
    name: 'Знаток испытаний',
    description: 'Прошёл 50 испытаний',
    emoji: '📖',
    category: 'charter',
    check: ({ gameState }) => gameState.chartersSubmitted >= 50,
    progress: ({ gameState }) => ({ current: Math.min(gameState.chartersSubmitted, 50), target: 50 }),
  },

  // ─── Семь архетипов: «Магистр» (3 идеала) и «Знаток» (5 побед) ──────────
  // Боярин — Купеческая грамота
  {
    id: 'master_boyarin',
    name: 'Магистр печатей',
    description: '3 идеальных разбора Купеческой грамоты Царя Гороха',
    emoji: '🟡',
    category: 'charter',
    check: ({ gameState }) => mg(gameState, 'BOYARIN').perfect >= 3,
    progress: ({ gameState }) => ({ current: Math.min(mg(gameState, 'BOYARIN').perfect, 3), target: 3 }),
  },
  {
    id: 'expert_boyarin',
    name: 'Знаток печатей',
    description: '5 успешных проходов Купеческой грамоты (с идеалом или с ошибкой)',
    emoji: '📜',
    category: 'charter',
    check: ({ gameState }) => mgWonOrPerfect(mg(gameState, 'BOYARIN')) >= 5,
    progress: ({ gameState }) => ({ current: Math.min(mgWonOrPerfect(mg(gameState, 'BOYARIN')), 5), target: 5 }),
  },

  // Буратино — Золотой ключик
  {
    id: 'master_buratino',
    name: 'Магистр ключика',
    description: '3 идеальных Золотых ключика у Буратино',
    emoji: '🗝️',
    category: 'charter',
    check: ({ gameState }) => mg(gameState, 'BURATINO').perfect >= 3,
    progress: ({ gameState }) => ({ current: Math.min(mg(gameState, 'BURATINO').perfect, 3), target: 3 }),
  },
  {
    id: 'expert_buratino',
    name: 'Знаток ключика',
    description: '5 успешных проходов Золотого ключика',
    emoji: '🔑',
    category: 'charter',
    check: ({ gameState }) => mgWonOrPerfect(mg(gameState, 'BURATINO')) >= 5,
    progress: ({ gameState }) => ({ current: Math.min(mgWonOrPerfect(mg(gameState, 'BURATINO')), 5), target: 5 }),
  },

  // Кощей — Память
  {
    id: 'master_koschei',
    name: 'Магистр памяти',
    description: '3 идеальных прохождения Памяти Кощея',
    emoji: '🧠',
    category: 'charter',
    check: ({ gameState }) => mg(gameState, 'KOSCHEI').perfect >= 3,
    progress: ({ gameState }) => ({ current: Math.min(mg(gameState, 'KOSCHEI').perfect, 3), target: 3 }),
  },
  {
    id: 'expert_koschei',
    name: 'Знаток памяти',
    description: '5 успешных проходов Памяти Кощея',
    emoji: '💀',
    category: 'charter',
    check: ({ gameState }) => mgWonOrPerfect(mg(gameState, 'KOSCHEI')) >= 5,
    progress: ({ gameState }) => ({ current: Math.min(mgWonOrPerfect(mg(gameState, 'KOSCHEI')), 5), target: 5 }),
  },

  // Колобок — Норы
  {
    id: 'master_kolobok',
    name: 'Магистр нор',
    description: '3 идеальных раунда «Нора-нора-нора» у Колобка',
    emoji: '🎯',
    category: 'charter',
    check: ({ gameState }) => mg(gameState, 'KOLOBOK').perfect >= 3,
    progress: ({ gameState }) => ({ current: Math.min(mg(gameState, 'KOLOBOK').perfect, 3), target: 3 }),
  },
  {
    id: 'expert_kolobok',
    name: 'Знаток нор',
    description: '5 успешных проходов «Нора-нора-нора»',
    emoji: '🥮',
    category: 'charter',
    check: ({ gameState }) => mgWonOrPerfect(mg(gameState, 'KOLOBOK')) >= 5,
    progress: ({ gameState }) => ({ current: Math.min(mgWonOrPerfect(mg(gameState, 'KOLOBOK')), 5), target: 5 }),
  },

  // Золушка — Монеты
  {
    id: 'master_zolushka',
    name: 'Магистр монет',
    description: '3 идеальных «Золушкиных счастья»',
    emoji: '✨',
    category: 'charter',
    check: ({ gameState }) => mg(gameState, 'ZOLUSHKA').perfect >= 3,
    progress: ({ gameState }) => ({ current: Math.min(mg(gameState, 'ZOLUSHKA').perfect, 3), target: 3 }),
  },
  {
    id: 'expert_zolushka',
    name: 'Знаток монет',
    description: '5 успешных проходов Золушкиного счастья',
    emoji: '👠',
    category: 'charter',
    check: ({ gameState }) => mgWonOrPerfect(mg(gameState, 'ZOLUSHKA')) >= 5,
    progress: ({ gameState }) => ({ current: Math.min(mgWonOrPerfect(mg(gameState, 'ZOLUSHKA')), 5), target: 5 }),
  },

  // Баба Яга — Котёл
  {
    id: 'master_baba_yaga',
    name: 'Магистр котла',
    description: '3 идеальных прохождения Котла Бабы Яги',
    emoji: '🧪',
    category: 'charter',
    check: ({ gameState }) => mg(gameState, 'BABA_YAGA').perfect >= 3,
    progress: ({ gameState }) => ({ current: Math.min(mg(gameState, 'BABA_YAGA').perfect, 3), target: 3 }),
  },
  {
    id: 'expert_baba_yaga',
    name: 'Знаток котла',
    description: '5 успешных проходов Котла Бабы Яги',
    emoji: '🏚️',
    category: 'charter',
    check: ({ gameState }) => mgWonOrPerfect(mg(gameState, 'BABA_YAGA')) >= 5,
    progress: ({ gameState }) => ({ current: Math.min(mgWonOrPerfect(mg(gameState, 'BABA_YAGA')), 5), target: 5 }),
  },

  // Иван-Дурак — Карты
  {
    id: 'master_ivan_durak',
    name: 'Магистр карт',
    description: '3 идеальных прохождения Переводного дурака',
    emoji: '🃏',
    category: 'charter',
    check: ({ gameState }) => mg(gameState, 'IVAN_DURAK').perfect >= 3,
    progress: ({ gameState }) => ({ current: Math.min(mg(gameState, 'IVAN_DURAK').perfect, 3), target: 3 }),
  },
  {
    id: 'expert_ivan_durak',
    name: 'Знаток карт',
    description: '5 успешных проходов Переводного дурака',
    emoji: '🙃',
    category: 'charter',
    check: ({ gameState }) => mgWonOrPerfect(mg(gameState, 'IVAN_DURAK')) >= 5,
    progress: ({ gameState }) => ({ current: Math.min(mgWonOrPerfect(mg(gameState, 'IVAN_DURAK')), 5), target: 5 }),
  },

  // Кросс-игровой подвиг
  {
    id: 'seven_skills',
    name: 'Семь умений',
    description: 'Прошёл идеально хотя бы по одной игре каждого из 7 хозяев',
    emoji: '🌟',
    category: 'charter',
    check: ({ gameState }) =>
      mgPerfectAll(gameState, ['BOYARIN', 'BURATINO', 'KOSCHEI', 'KOLOBOK', 'ZOLUSHKA', 'BABA_YAGA', 'IVAN_DURAK']),
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
