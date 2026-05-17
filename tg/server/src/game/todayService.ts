import { prisma } from '../db/prisma'

/**
 * Дневные серии «вкладка Сегодня».
 *
 * Логика:
 *   - Каждый игровой день в МСК. Дата в формате YYYY-MM-DD.
 *   - Если lastSeenDay = сегодня → ничего не делаем (уже отметился).
 *   - Если lastSeenDay = вчера → loginStreak += 1.
 *   - Иначе (пропуск дня или первый вход) → loginStreak = 1.
 *
 * Награда за claim:
 *   base = 10 + min(streak, 10) * 5  // капается на 60 г при streak ≥ 10
 *   milestone бонусы (один раз за достижение):
 *     streak === 3   → +50 г
 *     streak === 7   → +150 г
 *     streak === 14  → +400 г
 *     streak === 30  → +1 000 г
 *     streak === 60  → +2 500 г
 *     streak === 100 → +10 000 г
 */

export interface TodayState {
  loginStreak: number
  /** Награда, доступная сегодня (если ещё не забрана) */
  todayReward: number
  /** Бонус за достижение milestone (входит в todayReward) */
  milestoneBonus: number
  /** Уже получал сегодня? */
  alreadyClaimed: boolean
  /** Список milestone и сколько до следующего */
  nextMilestone: { day: number; bonus: number; daysLeft: number } | null
}

export interface ClaimResult {
  reward: number
  milestoneBonus: number
  loginStreak: number
  newBalance: number
}

const MILESTONES: Array<{ day: number; bonus: number }> = [
  { day: 3,  bonus: 50 },
  { day: 5,  bonus: 70 },
  { day: 7,  bonus: 100 },
  { day: 10, bonus: 150 },
  { day: 15, bonus: 300 },
  { day: 20, bonus: 500 },
  { day: 30, bonus: 1000 },
]

/** Сегодняшняя дата в МСК (UTC+3) в формате YYYY-MM-DD */
function todayMSK(): string {
  const now = new Date()
  const msk = new Date(now.getTime() + 3 * 3600 * 1000)
  return msk.toISOString().slice(0, 10)
}

/** Вчерашняя дата в МСК */
function yesterdayMSK(today: string): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function baseReward(streak: number): number {
  return 10 + Math.min(streak, 10) * 5
}

function milestoneFor(streak: number): number {
  return MILESTONES.find(m => m.day === streak)?.bonus ?? 0
}

function nextMilestoneAfter(streak: number): { day: number; bonus: number; daysLeft: number } | null {
  const next = MILESTONES.find(m => m.day > streak)
  if (!next) return null
  return { day: next.day, bonus: next.bonus, daysLeft: next.day - streak }
}

/**
 * Обновить серию при заходе на вкладку «Сегодня».
 * Идемпотентно: повторный вызов в тот же день ничего не меняет.
 */
export async function touchLoginStreak(userId: number): Promise<void> {
  const today = todayMSK()
  const gs = await prisma.gameState.findUniqueOrThrow({ where: { userId } })
  if (gs.lastSeenDay === today) return  // уже отмечались сегодня
  const yesterday = yesterdayMSK(today)
  const newStreak = gs.lastSeenDay === yesterday ? gs.loginStreak + 1 : 1
  await prisma.gameState.update({
    where: { userId },
    data: { loginStreak: newStreak, lastSeenDay: today },
  })
}

/** Текущее состояние «Сегодня» — для GET-запроса. */
export async function getTodayState(userId: number): Promise<TodayState> {
  const today = todayMSK()
  const gs = await prisma.gameState.findUniqueOrThrow({ where: { userId } })
  const streak = gs.loginStreak
  const alreadyClaimed = gs.lastDailyClaim === today
  const milestoneBonus = milestoneFor(streak)
  const todayReward = alreadyClaimed ? 0 : baseReward(streak) + milestoneBonus
  return {
    loginStreak: streak,
    todayReward,
    milestoneBonus,
    alreadyClaimed,
    nextMilestone: nextMilestoneAfter(streak),
  }
}

/** Забрать ежедневную награду — атомарно: проверяем, ещё не брал, начисляем. */
export async function claimDaily(userId: number): Promise<ClaimResult> {
  const today = todayMSK()
  const gs = await prisma.gameState.findUniqueOrThrow({ where: { userId } })
  if (gs.lastDailyClaim === today) throw new Error('ALREADY_CLAIMED')
  const streak = gs.loginStreak
  const milestoneBonus = milestoneFor(streak)
  const reward = baseReward(streak) + milestoneBonus
  const updated = await prisma.gameState.update({
    where: { userId },
    data: {
      balance: { increment: reward },
      lastDailyClaim: today,
    },
  })
  await prisma.transaction.create({
    data: {
      userId,
      projectId: 'daily-streak',
      projectName: 'Дневной ритуал',
      type: 'RETURNED',
      amount: reward,
      day: gs.currentDay,
    },
  })
  return {
    reward,
    milestoneBonus,
    loginStreak: streak,
    newBalance: updated.balance,
  }
}
