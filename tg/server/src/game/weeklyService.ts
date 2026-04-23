import { prisma } from '../db/prisma'

/** Начало «ярмарочной недели» — понедельник 00:00 МСК (UTC+3) */
export function getCurrentWeekStart(now: Date = new Date()): Date {
  // Текущее московское время = UTC + 3 часа
  const mskMs = now.getTime() + 3 * 60 * 60 * 1000
  const msk = new Date(mskMs)
  // getUTCDay() на сдвинутом времени = день недели в МСК
  const dayOfWeek = msk.getUTCDay()          // 0 = Sun, 1 = Mon ...
  const daysSinceMonday = (dayOfWeek + 6) % 7 // Mon → 0, Sun → 6
  const mondayMsk = Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() - daysSinceMonday, 0, 0, 0)
  // mondayMsk — это полночь МСК, в UTC это −3ч
  return new Date(mondayMsk - 3 * 60 * 60 * 1000)
}

/**
 * Берёт снимок состояния игрока на начало текущей недели.
 * Если snapshot устарел (новая неделя началась) — обновляет в БД и возвращает новое значение.
 * Если snapshot никогда не ставился — инициализирует текущим состоянием.
 */
export async function ensureWeekStartSnapshot(userId: number, currentWealth: number): Promise<number> {
  const state = await prisma.gameState.findUnique({
    where: { userId },
    select: { weekStartWealth: true, weekStartAt: true },
  })
  if (!state) return currentWealth

  const weekStart = getCurrentWeekStart()
  const snapshotStale = !state.weekStartAt || state.weekStartAt < weekStart

  if (snapshotStale) {
    await prisma.gameState.update({
      where: { userId },
      data: { weekStartWealth: currentWealth, weekStartAt: weekStart },
    })
    return currentWealth
  }
  return state.weekStartWealth
}
