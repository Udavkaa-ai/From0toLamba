import cron from 'node-cron'
import { prisma } from '../db/prisma'
import { advanceDay } from '../game/AdvanceDayService'

/**
 * Ежедневный job — запускается в 09:00 МСК (UTC+3, т.е. 06:00 UTC)
 * Проходит по всем пользователям, которые залогинились за последние 30 дней
 */
export function startDailyScheduler() {
  cron.schedule('0 6 * * *', async () => {
    console.log('[Scheduler] Starting daily advance...')

    const activeUsers = await prisma.gameState.findMany({
      where: {
        updatedAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
      },
      select: { userId: true },
    })

    console.log(`[Scheduler] Advancing ${activeUsers.length} users`)

    for (const { userId } of activeUsers) {
      try {
        await advanceDay(userId)
      } catch (err: any) {
        if (err.message !== 'ADVANCE_TOO_SOON') {
          console.error(`[Scheduler] Failed to advance day for user ${userId}:`, err)
        }
      }
    }

    console.log('[Scheduler] Daily advance complete')
  })

  console.log('[Scheduler] Daily job scheduled at 09:00 MSK')
}
