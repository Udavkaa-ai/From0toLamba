import axios from 'axios'

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

// Автоматически прокидываем initData в каждый запрос
apiClient.interceptors.request.use(config => {
  config.headers['X-Telegram-Init-Data'] = getTelegramInitData()
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

export interface DailyUpdateDTO {
  id: number
  day: number
  title: string
  body: string
  redFlags: string[]
  payoutStatus: string
  userCountDelta: number
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
  intuitionScore: number
  intuitionAccuracy: number | null  // 0..1 или null если грамот не было
  chartersSubmitted: number
  closedProjectsCount: number
  dayStreak: number
  isOnboardingComplete: boolean
  totalInvested: number
  totalReturned: number
  balanceHistory: number[]
  investedHistory: number[]
  pendingRankUp: string | null
  preferredModel: string
  lastAdvancedAt: string | null
  advanceCooldownMs: number
  consecutiveAdvances: number
  maxConsecutiveAdvances: number
  referralCount: number
  weekStartWealth: number
  userId: number
  activeProjects: ProjectDTO[]
  inboxProjects: ProjectDTO[]
  // Увиденные породы/личины/судьбы — чтобы подвиги знали, какие справки
  // уже открыты. Массив строк из enum'ов сервера.
  seenTypes: string[]
  seenArchetypes: string[]
  seenFates: string[]
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

export interface AmaSessionDTO {
  sessionId: string
  questionCount: number
  isComplete: boolean
  isIntuitionEvaluated: boolean
  selectedLieTopics: string[]
  intuitionDelta: number
  messages: Array<{ role: string; content: string; createdAt: string }>
}

export type CharterDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

export interface CharterResultDTO {
  selectedIndices: number[]
  truePositives: number[]
  falsePositives: number[]
  falseNegatives: number[]
  delta: number
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
  game: {
    getState: () => apiClient.get<GameStateDTO>('/game').then(r => r.data),
    advanceDay: () => apiClient.post('/game/advance-day').then(r => r.data),
    advanceDaySkip: () => apiClient.post('/game/advance-day-skip').then(r => r.data),
    clearRankUp: () => apiClient.post('/game/clear-rank-up').then(r => r.data),
    completeOnboarding: () => apiClient.post('/game/complete-onboarding').then(r => r.data),
    getSettings: () => apiClient.get<{ preferredModel: string }>('/game/settings').then(r => r.data),
    updateSettings: (preferredModel: string) => apiClient.post<{ success: boolean; preferredModel: string }>('/game/settings', { preferredModel }).then(r => r.data),
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
    evaluateIntuition: (projectId: string, selectedTopics: string[]) =>
      apiClient.post(`/ama/${projectId}/evaluate-intuition`, { selectedTopics }).then(r => r.data),
  },

  charter: {
    start: (projectId: string) => apiClient.post<CharterDTO>(`/charter/${projectId}/start`).then(r => r.data),
    get: (projectId: string) => apiClient.get<CharterDTO>(`/charter/${projectId}`).then(r => r.data),
    submit: (projectId: string, selectedIndices: number[]) =>
      apiClient.post<CharterSubmitDTO>(`/charter/${projectId}/submit`, { selectedIndices }).then(r => r.data),
  },

  leaderboard: {
    get: () => apiClient.get<LeaderboardDTO>('/leaderboard').then(r => r.data),
    getWeek: () => apiClient.get<WeeklyLeaderboardDTO>('/leaderboard/week').then(r => r.data),
    getReferrals: () => apiClient.get<ReferralLeaderboardDTO>('/leaderboard/referrals').then(r => r.data),
  },

  invest: {
    invest: (projectId: string, amount: number) => apiClient.post(`/invest/${projectId}`, { amount }).then(r => r.data),
    addInvestment: (projectId: string, amount: number) => apiClient.post(`/invest/${projectId}/add`, { amount }).then(r => r.data),
    withdraw: (projectId: string, amount: number) => apiClient.post(`/invest/${projectId}/withdraw`, { amount }).then(r => r.data),
    exit: (projectId: string) => apiClient.post(`/invest/${projectId}/exit`).then(r => r.data),
  },

  tasks: {
    getChannels: () => apiClient.get<ChannelTaskDTO[]>('/tasks/channels').then(r => r.data),
    claimChannel: (taskId: string) =>
      apiClient.post<{ success: boolean; rewardRubles: number }>(`/tasks/channels/${taskId}/claim`).then(r => r.data),
  },
}
