import axios from 'axios'
import { getLang } from '@/stores/langStore'

// Получаем initData из Telegram WebApp
function getTelegramInitData(): string {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData
  }
  // Fallback для dev-режима
  return import.meta.env.DEV ? 'dev' : ''
}

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Автоматически прокидываем initData и язык в каждый запрос
apiClient.interceptors.request.use(config => {
  config.headers['X-Telegram-Init-Data'] = getTelegramInitData()
  config.headers['X-Lang'] = getLang()
  return config
})

apiClient.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error ?? err.message
    return Promise.reject(new Error(msg))
  },
)

// ─── Типы ──────────────────────────────────────────────────────────────────

export interface ProjectDTO {
  id: string
  name: string
  type: string
  personaArchetype: string
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
  totalWithdrawnRubles: number
  daysSinceJoined: number
  isWithdrawalLocked: boolean
  closureReason: string | null
  bannerImageUrl: string | null
  currentUserCount: number
  userCountHistory: number[]
  apyHistory: number[]
  valueHistory: number[]
}

export interface DailyUpdateDTO {
  id: number
  day: number
  title: string
  body: string
  redFlags: string[]
  payoutStatus: string
  userCountDelta: number
  /** Случайное событие — null если обычная весть. */
  eventKind?: 'NEGATIVE' | 'POSITIVE' | 'NEUTRAL' | null
}

export interface PostMortemDTO {
  revealedArchetype: string
  fate: string
  lieTopics: string[]
  analysis: string
  investedAmount: number
  returnedAmount: number
  profitPercent: number
  daysActive: number
  intuitionDelta: number
}

export interface TransactionDTO {
  id: number
  projectId: string | null
  projectName: string
  type: string  // INVEST | ADD | WITHDRAW | EXIT | RETURNED
  amount: number
  day: number
  createdAt: string
}

export interface GameStateDTO {
  balance: number
  currentDay: number
  investorRank: string
  nickname: string | null
  intuitionScore: number              // legacy: с версии 4 не растёт
  intuitionAccuracy: number | null    // legacy: с версии 4 не используется в UI
  chartersSubmitted: number
  closedProjectsCount: number
  dealsCount: number                  // число взятых дел — основа ранга
  /** Статистика мини-игр по архетипам: «сколько раз играл с этим дельцом, как закончил».
   *  Ключ — personaArchetype (BURATINO, KOSCHEI и т.д.). errorCount: 0 = perfect, 1 = won, ≥2 = lost. */
  minigameStats: Record<string, { played: number; perfect: number; won: number; lost: number }>
  /** Жетоны хозяев — мини-валюта по архетипам. earned = заработано (10 игр или
   *  5 дел = +1 жетон), spent = потрачено, balance = доступно. Пусто для
   *  архетипов, с которыми игрок ещё не сталкивался. */
  archetypeTokens: Record<string, { earned: number; spent: number; balance: number; gamesPlayed: number; dealsTaken: number }>
  dayStreak: number
  isOnboardingComplete: boolean
  totalInvested: number
  totalReturned: number
  balanceHistory: number[]
  investedHistory: number[]
  pendingRankUp: string | null
  preferredModel: string
  preferredLanguage: string
  lastAdvancedAt: string | null
  advanceCooldownMs: number
  consecutiveAdvances: number
  maxConsecutiveAdvances: number
  referralCount: number
  weekStartWealth: number
  userId: number
  extraSlotsBalance: number
  activeProjects: ProjectDTO[]
  inboxProjects: ProjectDTO[]
  // Увиденные породы/личины/судьбы — чтобы подвиги знали, какие справки
  // уже открыты. Массив строк из enum'ов сервера.
  seenTypes: string[]
  seenArchetypes: string[]
  seenFates: string[]
  // С каким числом дельцов начал беседу (для подвигов «социальные»)
  amaSessionsStarted: number
  // Сколько бесед довёл до конца — задал все 10 вопросов
  amaSessionsCompleted: number
  pendingMarketAnnouncement: boolean
}

export interface ChannelTaskDTO {
  id: string
  channelTitle: string
  channelLink: string
  description: string
  rewardRubles: number
  claimed: boolean
}

export interface LeaderboardEntryDTO {
  userId: number
  firstName: string
  username: string | null
  investorRank: string
  currentDay: number
  intuitionScore: number
  totalWealth: number
  isMe: boolean
  position: number
}

export interface LeaderboardDTO {
  entries: LeaderboardEntryDTO[]
  myPosition: number | null
  totalPlayers: number
  totalAllPlayers?: number
}

export interface WeeklyLeaderboardEntryDTO extends LeaderboardEntryDTO {
  weekDelta: number
}

export interface WeeklyLeaderboardDTO {
  entries: WeeklyLeaderboardEntryDTO[]
  myPosition: number | null
  totalPlayers: number
  weekStart: string
}

export interface ReferralLeaderboardEntryDTO {
  userId: number
  firstName: string
  username: string | null
  investorRank: string
  referralCount: number
  isMe: boolean
  position: number
}

export interface ReferralLeaderboardDTO {
  entries: ReferralLeaderboardEntryDTO[]
  myPosition: number | null
  totalPlayers: number
}

export interface AchievementLeaderboardEntryDTO extends LeaderboardEntryDTO {
  achievementScore: number
  closedProjectsCount: number
  chartersSubmitted: number
}

export interface AchievementLeaderboardDTO {
  entries: AchievementLeaderboardEntryDTO[]
  myPosition: number | null
  totalPlayers: number
}

export interface MyReferralEntryDTO {
  userId: number
  firstName: string
  username: string | null
  bonusGranted: boolean
  intuitionScore: number
  currentDay: number
}

export interface MyReferralsDTO {
  referrals: MyReferralEntryDTO[]
  threshold: number
}

export interface ClosureSummaryDTO {
  id: string
  name: string
  developerName: string
  fate: string
  personaArchetype: string
  investedAmount: number
  returnedAmount: number
  profitPercent: number
  daysActive: number
  closureReason: string
  bannerImageUrl: string | null
  forcedByMafia: boolean
}

export interface AdvanceDayResultDTO {
  success: boolean
  newRank: string | null
  closures: ClosureSummaryDTO[]
}

/** Ответ на /invest/:id — содержит сдвиг судьбы за идеальную игру (если был). */
export interface InvestResponse {
  success: boolean
  luckShift: { from: string; to: string } | null
}

/** Запись лидерборда на вкладке «Сегодня» — рейтинг по богатству. */
export interface TodayLeaderEntry {
  telegramId: string
  firstName: string
  username: string | null
  nickname: string | null
  rank: string
  wealth: number
}
/** Ответ /api/today — стрик + ежедневная награда + топ-10 по богатству */
export interface TodayDTO {
  loginStreak: number
  todayReward: number
  milestoneBonus: number
  alreadyClaimed: boolean
  nextMilestone: { day: number; bonus: number; daysLeft: number } | null
  leaderboard: {
    top: TodayLeaderEntry[]
    myPosition: number | null
    totalPlayers: number
  }
}
export interface TodayClaimDTO {
  success: boolean
  reward: number
  milestoneBonus: number
  loginStreak: number
  newBalance: number
}

export interface AmaSessionDTO {
  sessionId: string
  questionCount: number
  isComplete: boolean
  isIntuitionEvaluated: boolean
  selectedLieTopics: string[]
  intuitionDelta: number
  developerName: string | null
  messages: Array<{ role: string; content: string; createdAt: string }>
}

export type CharterDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

export interface CharterResultDTO {
  selectedIndices: number[]
  truePositives: number[]
  falsePositives: number[]
  falseNegatives: number[]
  delta: number                       // legacy, всегда 0 с версии 4
  errorCount: number                  // FP + FN — ключ для рендера результата
  perfectInsight: string | null       // только при сабмите (0 ошибок); на reload — null
}

export interface CharterSubmitDTO extends CharterResultDTO {
  forgedIndices: number[]
}

export interface CharterDTO {
  sessionId: string
  gridSeed: string
  gridSize: number
  difficulty: CharterDifficulty
  timeLimitSeconds: number
  forgedIndices: number[]
  isSubmitted: boolean
  project: ProjectDTO
  result?: CharterResultDTO
}

// ─── API методы ────────────────────────────────────────────────────────────

export const api = {
  announcement: {
    dismiss: () => apiClient.post<{ rewardGranted: boolean; balance: number }>('/announcement/market', { action: 'dismiss' }).then(r => r.data),
    claim: () => apiClient.post<{ rewardGranted: boolean; balance: number }>('/announcement/market', { action: 'claim' }).then(r => r.data),
  },
  game: {
    getState: () => apiClient.get<GameStateDTO>('/game').then(r => r.data),
    advanceDay: () => apiClient.post<AdvanceDayResultDTO>('/game/advance-day').then(r => r.data),
    advanceDaySkip: () => apiClient.post<AdvanceDayResultDTO>('/game/advance-day-skip').then(r => r.data),
    clearRankUp: () => apiClient.post('/game/clear-rank-up').then(r => r.data),
    completeOnboarding: () => apiClient.post('/game/complete-onboarding').then(r => r.data),
    getSettings: () => apiClient.get<{ preferredModel: string }>('/game/settings').then(r => r.data),
    updateSettings: (data: { preferredModel?: string; preferredLanguage?: string }) => apiClient.post<{ success: boolean }>('/game/settings', data).then(r => r.data),
    resetGame: () => apiClient.post('/game/reset').then(r => r.data),
  },

  projects: {
    getInbox: () => apiClient.get<ProjectDTO[]>('/projects/inbox').then(r => r.data),
    getPortfolio: () => apiClient.get<{ active: ProjectDTO[]; closed: (ProjectDTO & { postMortem: PostMortemDTO | null })[] }>('/projects/portfolio').then(r => r.data),
    getUpdates: (id: string) => apiClient.get<DailyUpdateDTO[]>(`/projects/${id}/updates`).then(r => r.data),
    skip: (id: string) => apiClient.post(`/projects/${id}/skip`).then(r => r.data),
    getTransactions: () => apiClient.get<TransactionDTO[]>('/projects/transactions').then(r => r.data),
  },

  ama: {
    start: (projectId: string) => apiClient.post<{ sessionId: string; firstMessage: string }>(`/ama/${projectId}/start`).then(r => r.data),
    getSession: (projectId: string) => apiClient.get<AmaSessionDTO>(`/ama/${projectId}`).then(r => r.data),
    sendMessage: (projectId: string, message: string) =>
      apiClient.post<{ reply: string; questionCount: number; isSessionComplete: boolean }>(`/ama/${projectId}/message`, { message }).then(r => r.data),
  },

  charter: {
    start: (projectId: string) => apiClient.post<CharterDTO>(`/charter/${projectId}/start`).then(r => r.data),
    get: (projectId: string) => apiClient.get<CharterDTO>(`/charter/${projectId}`).then(r => r.data),
    begin: (projectId: string) => apiClient.post<{ success: boolean }>(`/charter/${projectId}/begin`).then(r => r.data),
    submit: (projectId: string, selectedIndices: number[]) =>
      apiClient.post<CharterSubmitDTO>(`/charter/${projectId}/submit`, { selectedIndices }).then(r => r.data),
    submitMiniGame: (projectId: string, errorCount: number) =>
      apiClient.post<{ errorCount: number; perfectInsight: string | null }>(`/charter/${projectId}/submit-minigame`, { errorCount }).then(r => r.data),
  },

  leaderboard: {
    get: () => apiClient.get<LeaderboardDTO>('/leaderboard').then(r => r.data),
    getWeek: () => apiClient.get<WeeklyLeaderboardDTO>('/leaderboard/week').then(r => r.data),
    getReferrals: () => apiClient.get<ReferralLeaderboardDTO>('/leaderboard/referrals').then(r => r.data),
    getByIntuition: () => apiClient.get<LeaderboardDTO>('/leaderboard/intuition').then(r => r.data),
    getByDays: () => apiClient.get<LeaderboardDTO>('/leaderboard/days').then(r => r.data),
    getByAchievements: () => apiClient.get<AchievementLeaderboardDTO>('/leaderboard/achievements').then(r => r.data),
  },

  referrals: {
    getMy: () => apiClient.get<MyReferralsDTO>('/referrals/my').then(r => r.data),
  },

  today: {
    get: () => apiClient.get<TodayDTO>('/today').then(r => r.data),
    claim: () => apiClient.post<TodayClaimDTO>('/today/claim').then(r => r.data),
  },

  /** Списать жетон хозяина за фичу (вместо Stars) — для ama_unlock и minigame_bypass */
  spendToken: (feature: 'ama_unlock' | 'minigame_bypass', projectId: string) =>
    apiClient.post<{ success: boolean; perfectInsight?: string | null }>(
      '/payments/spend-token', { feature, projectId },
    ).then(r => r.data),

  invest: {
    invest: (projectId: string, amount: number, extraSlot?: 'groshy' | 'stars') =>
      apiClient.post<InvestResponse>(`/invest/${projectId}`, { amount, ...(extraSlot ? { extraSlot } : {}) }).then(r => r.data),
    addInvestment: (projectId: string, amount: number) => apiClient.post(`/invest/${projectId}/add`, { amount }).then(r => r.data),
    withdraw: (projectId: string, amount: number) => apiClient.post(`/invest/${projectId}/withdraw`, { amount }).then(r => r.data),
    exit: (projectId: string) => apiClient.post(`/invest/${projectId}/exit`).then(r => r.data),
  },

  tasks: {
    getChannels: () => apiClient.get<ChannelTaskDTO[]>('/tasks/channels').then(r => r.data),
    claimChannel: (taskId: string) =>
      apiClient.post<{ success: boolean; rewardRubles: number }>(`/tasks/channels/${taskId}/claim`).then(r => r.data),
  },

  payments: {
    createInvoice: (
      feature: 'timer_skip' | 'ama_unlock' | 'extra_slot' | 'minigame_bypass',
      projectId?: string,
      merchantName?: string,
    ) =>
      apiClient.post<{ invoiceLink: string | null }>('/payments/invoice', { feature, projectId, merchantName }).then(r => r.data),
    activateTimerSkip: () =>
      apiClient.post<AdvanceDayResultDTO>('/payments/activate', { feature: 'timer_skip' }).then(r => r.data),
    activateAmaUnlock: (projectId: string) =>
      apiClient.post<{ success: boolean }>('/payments/activate', { feature: 'ama_unlock', projectId }).then(r => r.data),
    activateExtraSlot: () =>
      apiClient.post<{ success: boolean }>('/payments/activate', { feature: 'extra_slot' }).then(r => r.data),
    activateMinigameBypass: (projectId: string) =>
      apiClient.post<{ success: boolean; perfectInsight: string | null }>('/payments/activate', { feature: 'minigame_bypass', projectId }).then(r => r.data),
  },

  chat: {
    getMessages: (since?: number) =>
      apiClient.get<ChatMessageDTO[]>('/chat/messages', { params: since ? { since } : undefined }).then(r => r.data),
    sendMessage: (text: string, replyToId?: number) =>
      apiClient.post<ChatMessageDTO>('/chat/message', { text, replyToId }).then(r => r.data),
    deleteMessage: (id: number) =>
      apiClient.delete(`/chat/message/${id}`).then(r => r.data),
    translate: (text: string, targetLang: 'ru' | 'en') =>
      apiClient.post<{ translation: string }>('/chat/translate', { text, targetLang }).then(r => r.data),
  },

  user: {
    setNickname: (nickname: string | null) =>
      apiClient.patch<{ nickname: string | null }>('/user/nickname', { nickname }).then(r => r.data),
  },
}

export interface ChatMessageDTO {
  id: number
  userId: number
  displayName: string
  investorRank: string
  text: string
  replyToId: number | null
  replyToText: string | null
  replyToDisplayName: string | null
  createdAt: string
}
