import cron from 'node-cron'
import { InlineKeyboard } from 'grammy'
import { prisma } from '../db/prisma'
import { ADVANCE_COOLDOWN_MS } from '../game/AdvanceDayService'
import { getBot } from '../bot/bot'

/**
 * Cron-задачи сервера.
 *
 * Сейчас остался ОДИН job — рассылка уведомлений «новый день доступен» по
 * telegramId раз в 5 минут. Это бесплатный Telegram-API трафик, не AI.
 *
 * Ежедневный авто-advance в 09:00 МСК был УДАЛЁН (см. коммит 4.6.19). Он
 * жёг 6000+ AI-запросов и 5М токенов в день за счёт того что каждое утро
 * для каждого «активного за 30 дней» юзера крутил полный advance-day
 * (генерация новых проектов через AI + AI-вести по каждому активному
 * делу). При 5-7 реальных игроках это была чистая трата денег на зомби.
 *
 * Новая логика: ВСЕ advance-day только по ручному нажатию «Следующий
 * день» в Mini App. Кто играет — тот и платит за свой AI. Никаких
 * фоновых генераций.
 *
 * Если в будущем понадобится снова включить — см. git log этого файла.
 */
export function startDailyScheduler() {
  // ─── Уведомления о доступности нового дня ────────────────────────────────
  // Раз в 5 минут проверяем кто закончил 2-часовой кулдаун и не получал
  // напоминание — шлём «🌅 Новый день настал». Без AI, только Telegram API.
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

  console.log('[Scheduler] Cron jobs scheduled (next-day notifier every 5min, NO auto-advance)')
}
