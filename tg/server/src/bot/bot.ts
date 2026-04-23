import { Bot, webhookCallback, InlineKeyboard } from 'grammy'
import { prisma } from '../db/prisma'

// Бот инициализируется лениво — при первом обращении
let _bot: Bot | null = null

export function getBot(): Bot {
  if (!_bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN не задан')
    _bot = new Bot(token)
    setupHandlers(_bot)
  }
  return _bot
}

// Экспортируем геттер как прокси для удобства импорта
export const bot = new Proxy({} as Bot, {
  get(_, prop) {
    return (getBot() as any)[prop]
  },
})

function setupHandlers(bot: Bot) {
  // /start — приветствие + кнопка открыть Mini App.
  // Если пришёл с payload-ом вида `ref_<userId>` (через ссылку приглашения
  // t.me/bot?start=ref_<userId>) — сохраняем его в pendingReferralParam,
  // чтобы /api/game потом привязал реферала и выдал обоим бонус.
  bot.command('start', async (ctx) => {
    const appUrl = process.env.MINI_APP_URL ?? ''
    const name = ctx.from?.first_name ?? 'купец'
    const payload = (ctx.match ?? '').trim()
    const telegramId = ctx.from ? String(ctx.from.id) : null

    if (telegramId && /^ref_\d+$/.test(payload)) {
      try {
        await prisma.user.upsert({
          where: { telegramId },
          create: {
            telegramId,
            firstName: ctx.from!.first_name ?? 'купец',
            lastName: ctx.from!.last_name,
            username: ctx.from!.username,
            pendingReferralParam: payload,
            gameState: { create: { balance: 0 } },
          },
          update: { pendingReferralParam: payload },
        })
      } catch (err) {
        console.error('[Bot] Failed to store pendingReferralParam:', err)
      }
    }

    const keyboard = new InlineKeyboard().webApp('🏪 Открыть ярмарку', appUrl)

    await ctx.reply(
      `Здравствуй, ${name}! 👋\n\n` +
      `Добро пожаловать в *Из грязи в князи* — симулятор купца-инвестора в сказочной Руси.\n\n` +
      `Вкладывай рубли в дела, разбирай купеческие грамоты и учись отличать честных от жуликов. ` +
      `Начни с нуля — и дорасти до Князя! 👑`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      },
    )
  })

  // /help
  bot.command('help', async (ctx) => {
    const appUrl = process.env.MINI_APP_URL ?? ''
    const keyboard = new InlineKeyboard().webApp('🏪 Открыть ярмарку', appUrl)

    await ctx.reply(
      `*Как играть:*\n\n` +
      `1. Каждый день приходят новые *входящие грамоты* — предложения от хозяев дел\n` +
      `2. Открой беседу (AMA) и задай до 10 вопросов хозяину\n` +
      `3. Угадай, врёт ли он (Чуйка 👁)\n` +
      `4. Реши: вложить рубли или пропустить\n` +
      `5. Следи за делами в *Казне* и выводи прибыль вовремя\n\n` +
      `Начинаешь с 0 ₽ — первые рубли за онбординг-беседу! 🎁`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      },
    )
  })

  // Неизвестные команды
  bot.on('message', async (ctx) => {
    const appUrl = process.env.MINI_APP_URL ?? ''
    const keyboard = new InlineKeyboard().webApp('🏪 Открыть ярмарку', appUrl)
    await ctx.reply('Открой ярмарку и начни торговать! 🛒', { reply_markup: keyboard })
  })
}

/**
 * Webhook handler для Fastify
 * Используется в production — вешается на POST /bot/webhook
 */
export function createWebhookHandler() {
  const bot = getBot()
  return webhookCallback(bot, 'fastify')
}
