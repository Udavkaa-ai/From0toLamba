import cron from 'node-cron'
import { InlineKeyboard } from 'grammy'
import { prisma } from '../db/prisma'
import { advanceDay, ADVANCE_COOLDOWN_MS } from '../game/AdvanceDayService'
import { getBot } from '../bot/bot'

/**
 * Cron-задачи сервера:
 *   1) Раз в 5 минут — рассылка уведомлений «новый день доступен» по telegramId
 *   2) Раз в сутки в 09:00 МСК — авто-advance для всех залогинившихся за 30 дней
 */
export function startDailyScheduler() {
  // ─── Уведомления о доступности нового дня ────────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    const cutoff = new Date(Date.now() - ADVANCE_COOLDOWN_MS)
    const ready = await prisma.gameState.findMany({
      where: {
        nextDayNotified: false,
        lastAdvancedAt: { lte: cutoff },
        isOnboardingComplete: true,
      },
      include: { user: { select: { telegramId: true } } },
    })

    if (ready.length === 0) return

    const miniAppUrl = process.env.MINI_APP_URL ?? ''
    const bot = getBot()
    for (const gs of ready) {
      try {
        const keyboard = miniAppUrl
          ? new InlineKeyboard().webApp('🌅 Открыть ярмарку', miniAppUrl)
          : undefined
        await bot.api.sendMessage(
          gs.user.telegramId,
          '🌅 Новый день настал, купец! Дела ждут — загляни на ярмарку.',
          keyboard ? { reply_markup: keyboard } : {},
        )
      } catch (err: any) {
        // Игрок мог заблокировать бота — это не ошибка приложения, просто гасим
        if (!String(err?.description ?? '').includes('blocked')) {
          console.error(`[NextDayNotifier] sendMessage failed for ${gs.user.telegramId}:`, err)
        }
      } finally {
        await prisma.gameState.update({
          where: { userId: gs.userId },
          data: { nextDayNotified: true },
        })
      }
    }
  })

  // ─── Ежедневный авто-advance в 09:00 МСК (06:00 UTC) ─────────────────────
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
        // Авто-advance тоже уважает кулдаун (если игрок крутил день недавно — не повторяем)
        await advanceDay(userId)
      } catch (err: any) {
        if (err.message !== 'ADVANCE_TOO_SOON') {
          console.error(`[Scheduler] Failed to advance day for user ${userId}:`, err)
        }
      }
    }

    console.log('[Scheduler] Daily advance complete')
  })

  console.log('[Scheduler] Cron jobs scheduled (next-day notifier every 5min + daily auto-advance 09:00 MSK)')
}
