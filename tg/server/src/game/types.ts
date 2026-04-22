// Доменные типы — полный перенос из Android-приложения

export enum ProjectType {
  CARD_GAME = 'CARD_GAME',
  TREASURE_HUNT = 'TREASURE_HUNT',
  POTION_BREW = 'POTION_BREW',
  GUILD_SCHEME = 'GUILD_SCHEME',
  HONEST_TRADE = 'HONEST_TRADE',
}

export enum ProjectFate {
  INSTANT_SCAM = 'INSTANT_SCAM',   // 30% — бежит с деньгами на 1–3 день
  SLOW_DRAIN = 'SLOW_DRAIN',       // 25% — держится 1–3 недели, тихо исчезает
  HONEST_FAIL = 'HONEST_FAIL',     // 15% — честно старался, не взлетело
  SURVIVOR = 'SURVIVOR',           // 20% — долгожитель, стабильный доход
  UNICORN = 'UNICORN',             // 10% — взлетел: слава и иксы
}

export enum PersonaArchetype {
  BURATINO = 'BURATINO',     // Наивный лжец, верит своим выдумкам
  BOYARIN = 'BOYARIN',       // Пышно-официальный, ссылается на великих партнёров
  KOLOBOK = 'KOLOBOK',       // Хвастун-оптимист, укатывается от вопросов
  KOSCHEI = 'KOSCHEI',       // Холодный и уверенный, говорит цифрами
  ZOLUSHKA = 'ZOLUSHKA',     // Давит на жалость и мечты
  BABA_YAGA = 'BABA_YAGA',   // Отвечает загадками, технически подкована
  IVAN_DURAK = 'IVAN_DURAK', // Открыт про прошлые провалы
}

export enum LieTopic {
  PATRON_COUNT = 'PATRON_COUNT',           // Количество вкладчиков 👥
  DAILY_PROFIT = 'DAILY_PROFIT',           // Ежедневный доход 💰
  PAYOUT_DATE = 'PAYOUT_DATE',             // Дата выплат 📅
  GUILD_SIZE = 'GUILD_SIZE',               // Размер артели 🏗️
  ELDER_BLESSING = 'ELDER_BLESSING',       // Проверка старейшин 📜
  NOBLE_BACKING = 'NOBLE_BACKING',         // Покровители 🏰
  WITHDRAWAL_LIMITS = 'WITHDRAWAL_LIMITS', // Ограничения на вывод 🔒
}

export enum InvestorRank {
  NEWBIE = 'NEWBIE',             // Скоморох — старт
  AMBASSADOR = 'AMBASSADOR',     // Купец — день 5+ ИЛИ баланс 20+
  ANALYST = 'ANALYST',           // Мудрец — день 30+, баланс 300+, чуйка 5+
  SHARK = 'SHARK',               // Богатырь — день 50+, баланс 1000+, чуйка 10+
  LAMBO_SENSEI = 'LAMBO_SENSEI', // Царь — день 777+, баланс 7777+, чуйка 20+
}

export const RANK_DISPLAY: Record<InvestorRank, string> = {
  [InvestorRank.NEWBIE]: 'Скоморох',
  [InvestorRank.AMBASSADOR]: 'Купец',
  [InvestorRank.ANALYST]: 'Мудрец',
  [InvestorRank.SHARK]: 'Богатырь',
  [InvestorRank.LAMBO_SENSEI]: 'Царь',
}

export const LIE_TOPIC_EMOJI: Record<LieTopic, string> = {
  [LieTopic.PATRON_COUNT]: '👥',
  [LieTopic.DAILY_PROFIT]: '💰',
  [LieTopic.PAYOUT_DATE]: '📅',
  [LieTopic.GUILD_SIZE]: '🏗️',
  [LieTopic.ELDER_BLESSING]: '📜',
  [LieTopic.NOBLE_BACKING]: '🏰',
  [LieTopic.WITHDRAWAL_LIMITS]: '🔒',
}

export const LIE_TOPIC_LABEL: Record<LieTopic, string> = {
  [LieTopic.PATRON_COUNT]: 'Вкладчики',
  [LieTopic.DAILY_PROFIT]: 'Доход',
  [LieTopic.PAYOUT_DATE]: 'Выплаты',
  [LieTopic.GUILD_SIZE]: 'Артель',
  [LieTopic.ELDER_BLESSING]: 'Проверка',
  [LieTopic.NOBLE_BACKING]: 'Покровители',
  [LieTopic.WITHDRAWAL_LIMITS]: 'Вывод',
}

export const PERSONA_LABEL: Record<PersonaArchetype, string> = {
  [PersonaArchetype.BURATINO]:   'Буратино',
  [PersonaArchetype.BOYARIN]:    'Боярин',
  [PersonaArchetype.KOLOBOK]:    'Колобок',
  [PersonaArchetype.KOSCHEI]:    'Кощей',
  [PersonaArchetype.ZOLUSHKA]:   'Золушка',
  [PersonaArchetype.BABA_YAGA]:  'Баба-яга',
  [PersonaArchetype.IVAN_DURAK]: 'Иван-дурак',
}

export const FATE_LABEL: Record<ProjectFate, string> = {
  [ProjectFate.INSTANT_SCAM]: 'Сбежал с деньгами',
  [ProjectFate.SLOW_DRAIN]:   'Тихо угас',
  [ProjectFate.HONEST_FAIL]:  'Честный провал',
  [ProjectFate.SURVIVOR]:     'Выжил',
  [ProjectFate.UNICORN]:      'Взлетел',
}

/** Правила вывода по типу дела */
export const WITHDRAWAL_RULES: Record<ProjectType, { maxPercent: number | null; feePercent: number }> = {
  [ProjectType.POTION_BREW]: { maxPercent: 0.25, feePercent: 0 },
  [ProjectType.GUILD_SCHEME]: { maxPercent: 0.25, feePercent: 0 },
  [ProjectType.CARD_GAME]: { maxPercent: null, feePercent: 0.25 },
  [ProjectType.TREASURE_HUNT]: { maxPercent: null, feePercent: 0.25 },
  [ProjectType.HONEST_TRADE]: { maxPercent: null, feePercent: 0 },
}

/** Доходность по судьбе (в день от вложенного, умножается на 10 для game-time) */
export const FATE_CONFIG: Record<ProjectFate, {
  daysRange: [number, number]
  dailyYieldRange: [number, number]
  lossRange: [number, number]
  weight: number
}> = {
  [ProjectFate.INSTANT_SCAM]: {
    daysRange: [1, 3],
    dailyYieldRange: [0.002, 0.008],
    lossRange: [0.8, 1.0],
    weight: 30,
  },
  [ProjectFate.SLOW_DRAIN]: {
    daysRange: [7, 21],
    dailyYieldRange: [0.003, 0.015],
    lossRange: [0.3, 0.7],
    weight: 25,
  },
  [ProjectFate.HONEST_FAIL]: {
    daysRange: [14, 30],
    dailyYieldRange: [0.001, 0.005],
    lossRange: [0.1, 0.4],
    weight: 15,
  },
  [ProjectFate.SURVIVOR]: {
    daysRange: [15, 30],
    dailyYieldRange: [0.003, 0.015],
    lossRange: [0, 0],
    weight: 20,
  },
  [ProjectFate.UNICORN]: {
    daysRange: [20, 30],
    dailyYieldRange: [0.02, 0.1],
    lossRange: [0, 0],
    weight: 10,
  },
}

/** Публичное DTO проекта — СКРЫТЫЕ поля удалены */
export interface ProjectPublicDTO {
  id: string
  name: string
  type: ProjectType
  isInbox: boolean
  isActive: boolean
  isClosed: boolean
  developerName: string
  developerAvatarSeed: string
  claimedName: string
  claimedAPY: number
  claimedUserCount: number
  claimedTeamSize: number
  description: string
  roadmap: string[]
  investedAmountRubles: number
  currentValueRubles: number
  daysSinceJoined: number
  isWithdrawalLocked: boolean
  closureReason: string | null
  bannerImageUrl: string | null
  currentUserCount: number
  userCountHistory: number[]
  apyHistory: number[]
  valueHistory: number[]
}

