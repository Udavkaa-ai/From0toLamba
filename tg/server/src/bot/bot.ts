import { Bot, webhookCallback, InlineKeyboard } from 'grammy'
import { prisma } from '../db/prisma'
import { generateOnboardingProject } from '../game/GenerateProjectService'

const STARS_TIMER_SKIP = 10
const STARS_AMA_UNLOCK = 10
const STARS_EXTRA_SLOT = 10

let _bot: Bot | null = null
let broadcastActive = false
let broadcastCancelled = false

export function cancelBroadcast() {
  broadcastCancelled = true
}

export function getBot(): Bot {
  if (!_bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN не задан')
    _bot = new Bot(token)
    setupHandlers(_bot)
  }
  return _bot
}

export const bot = new Proxy({} as Bot, {
  get(_, prop) {
    return (getBot() as any)[prop]
  },
})

export async function createTimerSkipInvoice(userId: number, payload: string): Promise<string> {
  return getBot().api.createInvoiceLink(
    'Пропуск ожидания',
    'Снять 2-часовой кулдаун и сразу перейти к следующему дню',
    payload,
    '',
    'XTR',
    [{ label: 'Пропуск кулдауна', amount: STARS_TIMER_SKIP }],
  )
}

export async function createAmaUnlockInvoice(merchantName: string, userId: number, payload: string): Promise<string> {
  return getBot().api.createInvoiceLink(
    `Беседа с ${merchantName}`,
    'Открыть личную беседу с дельцом и задать до 10 вопросов',
    payload,
    '',
    'XTR',
    [{ label: 'Беседа с дельцом', amount: STARS_AMA_UNLOCK }],
  )
}

export async function createExtraSlotInvoice(userId: number, payload: string): Promise<string> {
  return getBot().api.createInvoiceLink(
    'Дополнительный слот для дела',
    'Открыть один слот сверх лимита 5 дел — для одного нового вложения',
    payload,
    '',
    'XTR',
    [{ label: 'Доп. слот', amount: STARS_EXTRA_SLOT }],
  )
}

function setupHandlers(bot: Bot) {
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

    if (telegramId && /^utm_/.test(payload)) {
      try {
        await prisma.user.upsert({
          where: { telegramId },
          create: {
            telegramId,
            firstName: ctx.from!.first_name ?? 'купец',
            lastName: ctx.from!.last_name,
            username: ctx.from!.username,
            utmSource: payload,
            gameState: { create: { balance: 0 } },
          },
          // Не перезаписываем если UTM уже записан (первый вход — приоритет)
          update: {},
        })
      } catch (err) {
        console.error('[Bot] Failed to store utmSource:', err)
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

  // Обязательный обработчик — Telegram требует ответа в течение 10 секунд
  bot.on('pre_checkout_query', async (ctx) => {
    await ctx.answerPreCheckoutQuery(true)
  })

  // Фиксируем успешную оплату и выдаём фичу
  bot.on('message:successful_payment', async (ctx) => {
    const payment = ctx.message?.successful_payment
    if (!payment) return

    const telegramId = ctx.from ? String(ctx.from.id) : null
    if (!telegramId) return

    const payload = payment.invoice_payload
    const chargeId = payment.telegram_payment_charge_id

    console.log(`[Payment] successful_payment tgId=${telegramId} payload=${payload} chargeId=${chargeId}`)

    try {
      const user = await prisma.user.findUnique({ where: { telegramId } })
      if (!user) return

      // Обновляем запись покупки — проставляем chargeId для возвратов
      await prisma.starPurchase.updateMany({
        where: { userId: user.id, payload },
        data: { telegramChargeId: chargeId },
      })

      // Фича активируется клиентом через /api/payments/activate после callback "paid".
      // Здесь только обновляем telegramChargeId для учёта и возможных возвратов.
      console.log(`[Payment] logged userId=${user.id} feature=${payload.startsWith('ts:') ? 'timer_skip' : 'ama_unlock'}`)
    } catch (err) {
      console.error('[Payment] Error processing successful_payment:', err)
    }
  })

  const ADMIN_TELEGRAM_ID = 424553547
  const RESET_MARKER_TELEGRAM_ID = 'system:reset_v1_may2025'

  bot.command('resetall', async (ctx) => {
    if (ctx.from?.id !== ADMIN_TELEGRAM_ID) return

    const marker = await prisma.user.findFirst({ where: { telegramId: RESET_MARKER_TELEGRAM_ID } })
    if (marker) {
      await ctx.reply('⚠️ Сброс уже был выполнён ранее. Повторный запуск заблокирован.')
      return
    }

    await ctx.reply('🔄 Запускаю глобальный сброс...')

    try {
      const users = await prisma.user.findMany({ include: { gameState: true } })
      let count = 0

      for (const user of users) {
        if (!user.gameState) continue
        if (user.telegramId.startsWith('system:')) continue

        const preferredModel = user.gameState.preferredModel ?? 'deepseek/deepseek-v4-flash'
        const preferredLanguage = user.gameState.preferredLanguage ?? 'ru'

        await prisma.project.deleteMany({ where: { userId: user.id } })
        await prisma.transaction.deleteMany({ where: { userId: user.id } })

        await prisma.user.update({
          where: { id: user.id },
          data: { pendingReferralParam: null, referralBonusGranted: false },
        })

        await prisma.gameState.update({
          where: { userId: user.id },
          data: {
            balance: 0,
            currentDay: 0,
            investorRank: 'NEWBIE',
            intuitionScore: 0,
            dayStreak: 0,
            isOnboardingComplete: false,
            totalInvested: 0,
            totalReturned: 0,
            balanceHistory: [],
            investedHistory: [],
            pendingRankUp: null,
            lastAdvancedAt: null,
            nextDayNotified: true,
            consecutiveAdvances: 0,
            weekStartWealth: 0,
            weekStartAt: null,
            preferredModel,
          },
        })

        generateOnboardingProject(user.id, preferredModel, preferredLanguage).catch(e =>
          console.error(`[resetall] userId=${user.id} onboarding error:`, e),
        )

        count++
      }

      // Маркер защищает от повторного запуска
      await prisma.user.create({
        data: { telegramId: RESET_MARKER_TELEGRAM_ID, firstName: 'system' },
      })

      await ctx.reply(`✅ Сброс завершён. Обработано игроков: ${count}.`)
    } catch (err) {
      console.error('[resetall] Error:', err)
      await ctx.reply('❌ Ошибка при сбросе. Проверьте логи.')
    }
  })

  // /broadcast <text> — рассылка всем игрокам, прошедшим онбординг
  bot.command('broadcast', async (ctx) => {
    if (ctx.from?.id !== ADMIN_TELEGRAM_ID) return

    if (broadcastActive) {
      await ctx.reply('⚠️ Рассылка уже идёт. Останови её командой /broadcaststop, потом запусти снова.')
      return
    }

    const text = (ctx.match ?? '').trim()
    if (!text) {
      await ctx.reply('Использование: /broadcast <текст сообщения>')
      return
    }

    broadcastActive = true
    broadcastCancelled = false

    await ctx.reply('📡 Запускаю рассылку...')

    const users = await prisma.user.findMany({
      where: { gameState: { isOnboardingComplete: true } },
      select: { telegramId: true },
    })

    const appUrl = process.env.MINI_APP_URL ?? ''
    const keyboard = appUrl ? new InlineKeyboard().webApp('🏪 Открыть ярмарку', appUrl) : undefined

    let sent = 0, failed = 0
    for (const user of users) {
      if (broadcastCancelled) break
      if (user.telegramId.startsWith('system:')) continue
      try {
        await bot.api.sendMessage(user.telegramId, text, {
          parse_mode: 'Markdown',
          ...(keyboard ? { reply_markup: keyboard } : {}),
        })
        sent++
      } catch {
        failed++
      }
      await new Promise(r => setTimeout(r, 50))
    }

    broadcastActive = false
    if (broadcastCancelled) {
      await bot.api.sendMessage(String(ADMIN_TELEGRAM_ID), `✅ Рассылка остановлена. Доставлено: ${sent}, ошибок: ${failed}.`)
    } else {
      await ctx.reply(`✅ Рассылка завершена. Доставлено: ${sent}, ошибок: ${failed}.`)
    }
  })

  // /broadcaststop — остановить текущую рассылку
  bot.command('broadcaststop', async (ctx) => {
    if (ctx.from?.id !== ADMIN_TELEGRAM_ID) return
    if (!broadcastActive) {
      await ctx.reply('Нет активной рассылки.')
      return
    }
    broadcastCancelled = true
    await ctx.reply('🛑 Останавливаю рассылку...')
  })

  // /stats — статистика активности и языков (только для админа)
  bot.command('stats', async (ctx) => {
    if (ctx.from?.id !== ADMIN_TELEGRAM_ID) return

    try {
      const now = new Date()

      // Московское время: UTC+3
      const mskOffset = 3 * 60 * 60 * 1000
      const mskNow = new Date(now.getTime() + mskOffset)
      const startOfDayMsk = new Date(Date.UTC(
        mskNow.getUTCFullYear(), mskNow.getUTCMonth(), mskNow.getUTCDate(),
      ) - mskOffset)
      const ago7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
      const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      type CountRow  = [{ cnt: bigint }]
      type KvRow     = Array<{ key: string; cnt: bigint }>

      const [
        [{ cnt: totalUsers }],
        [{ cnt: onboardedUsers }],
        [{ cnt: dauCount }],
        [{ cnt: wauCount }],
        [{ cnt: mauCount }],
        [{ cnt: newToday }],
        [{ cnt: new7d }],
        [{ cnt: engLangCount }],
        [{ cnt: ruLangCount }],
        rankGroups,
        utmGroups,
      ] = await Promise.all([
        prisma.$queryRaw<CountRow>`
          SELECT COUNT(*) AS cnt FROM "User"
          WHERE "telegramId" NOT LIKE 'system:%'`,

        prisma.$queryRaw<CountRow>`
          SELECT COUNT(*) AS cnt FROM "User" u
          JOIN "GameState" gs ON gs."userId" = u.id
          WHERE gs."isOnboardingComplete" = true`,

        prisma.$queryRaw<CountRow>`
          SELECT COUNT(*) AS cnt FROM "User"
          WHERE "updatedAt" >= ${startOfDayMsk}
            AND "telegramId" NOT LIKE 'system:%'`,

        prisma.$queryRaw<CountRow>`
          SELECT COUNT(*) AS cnt FROM "User"
          WHERE "updatedAt" >= ${ago7d}
            AND "telegramId" NOT LIKE 'system:%'`,

        prisma.$queryRaw<CountRow>`
          SELECT COUNT(*) AS cnt FROM "User"
          WHERE "updatedAt" >= ${ago30d}
            AND "telegramId" NOT LIKE 'system:%'`,

        prisma.$queryRaw<CountRow>`
          SELECT COUNT(*) AS cnt FROM "User"
          WHERE "createdAt" >= ${startOfDayMsk}
            AND "telegramId" NOT LIKE 'system:%'`,

        prisma.$queryRaw<CountRow>`
          SELECT COUNT(*) AS cnt FROM "User"
          WHERE "createdAt" >= ${ago7d}
            AND "telegramId" NOT LIKE 'system:%'`,

        prisma.$queryRaw<CountRow>`
          SELECT COUNT(*) AS cnt FROM "GameState"
          WHERE "preferredLanguage" = 'en'`,

        prisma.$queryRaw<CountRow>`
          SELECT COUNT(*) AS cnt FROM "GameState"
          WHERE "preferredLanguage" = 'ru' OR "preferredLanguage" IS NULL`,

        prisma.$queryRaw<KvRow>`
          SELECT "investorRank" AS key, COUNT(*) AS cnt
          FROM "GameState"
          GROUP BY "investorRank"
          ORDER BY cnt DESC`,

        prisma.$queryRaw<KvRow>`
          SELECT "utmSource" AS key, COUNT(*) AS cnt
          FROM "User"
          WHERE "utmSource" IS NOT NULL
            AND "telegramId" NOT LIKE 'system:%'
          GROUP BY "utmSource"
          ORDER BY cnt DESC`,
      ])

      const RANK_LABEL: Record<string, string> = {
        NEWBIE: 'Скоморох',
        AMBASSADOR: 'Купец',
        ANALYST: 'Мудрец',
        SHARK: 'Боярин',
        LAMBO_SENSEI: 'Князь',
      }

      const b = (s: string | number) => `<b>${s}</b>`

      const rankLines = rankGroups
        .map(r => `  ${RANK_LABEL[r.key] ?? r.key}: ${b(Number(r.cnt))}`)
        .join('\n') || '  нет данных'

      const utmLines = utmGroups.length > 0
        ? utmGroups.map(u => `  ${u.key}: ${b(Number(u.cnt))}`).join('\n')
        : '  нет данных'

      const dateStr = mskNow.toISOString().slice(0, 10)
      const timeStr = mskNow.toISOString().slice(11, 16) + ' МСК'

      const msg = [
        `📊 ${b('Статистика')} — ${dateStr} ${timeStr}`,
        ``,
        `👥 ${b('Активность')}`,
        `  DAU сегодня: ${b(Number(dauCount))}`,
        `  WAU 7 дней: ${b(Number(wauCount))}`,
        `  MAU 30 дней: ${b(Number(mauCount))}`,
        ``,
        `📈 ${b('Регистрации')}`,
        `  Сегодня: ${b(Number(newToday))}`,
        `  За 7 дней: ${b(Number(new7d))}`,
        `  Всего: ${b(Number(totalUsers))}`,
        `  Прошли онбординг: ${b(Number(onboardedUsers))}`,
        ``,
        `🌍 ${b('Язык интерфейса')}`,
        `  RU: ${b(Number(ruLangCount))}`,
        `  EN: ${b(Number(engLangCount))}`,
        ``,
        `👑 ${b('Чины')}`,
        rankLines,
        ``,
        `🔗 ${b('UTM-источники')}`,
        utmLines,
      ].join('\n')

      await ctx.reply(msg, { parse_mode: 'HTML' })
    } catch (err: any) {
      await ctx.reply(`❌ Ошибка в /stats: ${String(err?.message ?? err).slice(0, 500)}`)
    }
  })

  bot.on('message', async (ctx) => {
    const appUrl = process.env.MINI_APP_URL ?? ''
    const keyboard = new InlineKeyboard().webApp('🏪 Открыть ярмарку', appUrl)
    await ctx.reply('Открой ярмарку и начни торговать! 🛒', { reply_markup: keyboard })
  })
}

export function createWebhookHandler() {
  const bot = getBot()
  return webhookCallback(bot, 'fastify')
}
