import { Bot, webhookCallback, InlineKeyboard } from 'grammy'
import { prisma } from '../db/prisma'
import { generateOnboardingProject } from '../game/GenerateProjectService'

const STARS_TIMER_SKIP = 10
const STARS_AMA_UNLOCK = 10
const STARS_EXTRA_SLOT = 10
const STARS_MINIGAME_BYPASS = 10

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

export async function createMinigameBypassInvoice(userId: number, payload: string): Promise<string> {
  return getBot().api.createInvoiceLink(
    'Вложить, минуя испытание',
    'Пропустить проверку чуйки и вложиться в дело несмотря на проигрыш в мини-игре',
    payload,
    '',
    'XTR',
    [{ label: 'Пропуск проверки', amount: STARS_MINIGAME_BYPASS }],
  )
}

function setupHandlers(bot: Bot) {
  bot.command('start', async (ctx) => {
    const appUrl = process.env.MINI_APP_URL ?? ''
    const name = ctx.from?.first_name ?? 'купец'
    const payload = (ctx.match ?? '').trim()
    const telegramId = ctx.from ? String(ctx.from.id) : null

    // Любой /start создаёт запись User — иначе при /broadcast мы не знаем
    // про тех, кто запустил бота, но не зашёл в Mini App. Раньше User
    // создавался только при ref_X / utm_X payload — остальные оставались
    // невидимыми для рассылок.
    if (telegramId) {
      try {
        await prisma.user.upsert({
          where: { telegramId },
          create: {
            telegramId,
            firstName: ctx.from!.first_name ?? 'купец',
            lastName: ctx.from!.last_name,
            username: ctx.from!.username,
            // gameState создаётся ОБЯЗАТЕЛЬНО, иначе /api/game при первом
            // открытии Mini App встретит User без GameState (попадёт в
            // update-ветку upsert'а) и упадёт на `gameState!`.
            gameState: { create: { balance: 0 } },
            ...(/^ref_\d+$/.test(payload) ? { pendingReferralParam: payload } : {}),
            ...(/^utm_/.test(payload)     ? { utmSource: payload }           : {}),
          },
          update: {
            // Обновляем профильные поля на свежие, но НЕ перетираем
            // utmSource (первый вход — приоритет) и referralBonusGranted.
            firstName: ctx.from!.first_name ?? 'купец',
            lastName: ctx.from!.last_name,
            username: ctx.from!.username,
            ...(/^ref_\d+$/.test(payload) ? { pendingReferralParam: payload } : {}),
          },
        })
      } catch (err) {
        console.error('[Bot] /start upsert failed:', err)
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
      const featureFromPayload =
        payload.startsWith('ts:') ? 'timer_skip' :
        payload.startsWith('au:') ? 'ama_unlock' :
        payload.startsWith('es:') ? 'extra_slot' :
        payload.startsWith('mb:') ? 'minigame_bypass' : 'unknown'
      console.log(`[Payment] logged userId=${user.id} feature=${featureFromPayload}`)
    } catch (err) {
      console.error('[Payment] Error processing successful_payment:', err)
    }
  })

  const ADMIN_TELEGRAM_ID = 424553547
  // Маркер сброса — ключ к запуску. Каждый новый сезон = новый маркер,
  // чтобы /resetall можно было повторить при смене сезона. Меняем
  // NEW_SEASON_NUMBER env-var на 2/3/... перед каждым сезонным сбросом.
  const newSeasonNumber = parseInt(process.env.NEW_SEASON_NUMBER ?? '2', 10)
  const RESET_MARKER_TELEGRAM_ID = `system:reset_marker_s${newSeasonNumber}`

  // In-memory guard — отбивает повторные вызовы в этом же процессе ДО
  // того как мы успеем атомарно вставить marker в БД. Раньше длинный
  // цикл реcetа (>10 сек для большой базы) не успевал создать marker,
  // и Telegram-ретрай / двойной тап / второй инстанс запускали параллельный
  // сброс — игроки получали по 2-3 onboarding-проекта.
  let resetallInProgress = false

  bot.command('resetall', async (ctx) => {
    if (ctx.from?.id !== ADMIN_TELEGRAM_ID) return

    if (resetallInProgress) {
      await ctx.reply('⚠️ Сброс уже идёт. Подожди ✅-уведомление.')
      return
    }

    // АТОМАРНО берём marker как блокировку: первый caller вставит,
    // конкурирующие получат P2002 (unique violation) → бейлим. Это
    // гарантирует одну попытку даже если повторные команды прилетят
    // в момент когда in-memory флаг ещё не выставлен (например, второй
    // инстанс на Railway во время редеплоя).
    try {
      await prisma.user.create({
        data: { telegramId: RESET_MARKER_TELEGRAM_ID, firstName: 'system' },
      })
    } catch {
      await ctx.reply(`⚠️ Сброс для сезона ${newSeasonNumber} уже выполнен (или сейчас выполняется). Повторный запуск заблокирован. Чтобы запустить новый сезон — подними NEW_SEASON_NUMBER в Railway env.`)
      return
    }

    resetallInProgress = true
    await ctx.reply(`🔄 Запускаю глобальный сброс (старт сезона ${newSeasonNumber})...`)

    // Heavy work — в фоне. Handler выходит МОМЕНТАЛЬНО → webhook
    // отвечает Telegram'у 200 → ретраи не приходят. Иначе при 3000+
    // юзерах цикл занимает >20 сек, Telegram не дожидается ответа и
    // ретраит каждые ~30 сек — одна команда даёт 5-10 параллельных
    // запусков. Атомарный marker всё равно отбивает дубли на уровне
    // БД, но лучше не нагружать.
    void (async () => {
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
              balance: 50, // STARTING_GIFT
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

        await ctx.reply(`✅ Сброс завершён. Обработано игроков: ${count}.`)
      } catch (err) {
        console.error('[resetall] Error:', err)
        // Marker уже создан, но что-то пошло не так. Удалим, чтобы можно
        // было перезапустить (иначе залочено навсегда).
        await prisma.user.delete({ where: { telegramId: RESET_MARKER_TELEGRAM_ID } }).catch(() => {})
        await ctx.reply('❌ Ошибка при сбросе. Маркер снят, можно запустить заново. Проверь логи.').catch(() => {})
      } finally {
        resetallInProgress = false
      }
    })()
  })

  // /snapshot_season <N> — снять финальный топ-100 каждого рейтинга в
  // SeasonArchive для последующего «Зала славы». Команда идемпотентна:
  // повторный вызов перезапишет архив того же сезона. Использовать
  // ДО /resetall (иначе данные уже стёрты).
  bot.command('snapshot_season', async (ctx) => {
    if (ctx.from?.id !== ADMIN_TELEGRAM_ID) return
    const arg = (ctx.message?.text ?? '').replace(/^\/snapshot_season(@\w+)?\s*/, '').trim()
    const seasonNumber = parseInt(arg, 10)
    if (!Number.isFinite(seasonNumber) || seasonNumber <= 0) {
      await ctx.reply('Использование: /snapshot_season <N>, например /snapshot_season 1')
      return
    }
    await ctx.reply(`📸 Снимаю топ-100 для сезона ${seasonNumber}...`)
    try {
      const { captureSeasonSnapshot } = await import('../game/seasonArchive')
      const counts = await captureSeasonSnapshot(seasonNumber)
      const lines = Object.entries(counts).map(([k, v]) => `${k}: ${v}`)
      await ctx.reply(`✅ Сезон ${seasonNumber} заархивирован.\n\n${lines.join('\n')}`)
    } catch (err: any) {
      console.error('[snapshot_season] Error:', err)
      await ctx.reply(`❌ Ошибка: ${err?.message ?? 'unknown'}`)
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

  // /broadcastall <текст> — расширенная версия /broadcast: шлёт ВСЕМ
  // юзерам с telegramId (включая тех, кто только /start нажал и не зашёл
  // в Mini App). Использует тот же broadcastActive флаг — параллельно
  // с /broadcast не запустится.
  bot.command('broadcastall', async (ctx) => {
    if (ctx.from?.id !== ADMIN_TELEGRAM_ID) return

    if (broadcastActive) {
      await ctx.reply('⚠️ Рассылка уже идёт. /broadcaststop, потом запусти снова.')
      return
    }

    const text = (ctx.match ?? '').trim()
    if (!text) {
      await ctx.reply('Использование: /broadcastall <текст>. Шлёт всем юзерам с telegramId (включая не онбордженных).')
      return
    }

    broadcastActive = true
    broadcastCancelled = false
    await ctx.reply('📡 Запускаю рассылку (всем юзерам в БД)...')

    // Длинный цикл — в фоне, чтобы хендлер выходил мгновенно и Telegram
    // не ретраил webhook (см. 4.5.8). Тяжёлая часть отвязана от ctx.
    void (async () => {
      try {
        const users = await prisma.user.findMany({
          where: { NOT: { telegramId: { startsWith: 'system:' } } },
          select: { telegramId: true },
        })

        const appUrl = process.env.MINI_APP_URL ?? ''
        const keyboard = appUrl ? new InlineKeyboard().webApp('🏪 Открыть ярмарку', appUrl) : undefined

        let sent = 0, failed = 0
        for (const user of users) {
          if (broadcastCancelled) break
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
        const tag = broadcastCancelled ? '🛑 Остановлена' : '✅ Завершена'
        await bot.api.sendMessage(
          String(ADMIN_TELEGRAM_ID),
          `${tag} рассылка-all. Доставлено: ${sent}, ошибок: ${failed}, всего в DB: ${users.length}.`,
        )
      } catch (err) {
        console.error('[broadcastall] Error:', err)
        broadcastActive = false
        await bot.api.sendMessage(String(ADMIN_TELEGRAM_ID), '❌ Ошибка при рассылке-all. Проверь логи.').catch(() => {})
      }
    })()
  })

  // /sponsor — управление VIP-кампаниями (только для админа).
  // Поддерживает: add, list, remove <id>, toggle <id>.
  //
  // /sponsor add — мастер в JSON: ответом ожидается одно сообщение с
  //   валидным JSON-объектом со всеми полями кампании. Пример:
  //     {"channelName":"@MyChan","channelUrl":"https://t.me/MyChan",
  //      "promocode":"ZOLOTO","scenarioTitle":"Воеводская награда",
  //      "scenarioBody":"...","developerName":"Воевода Михайло",
  //      "archetype":"BOYARIN","type":"HONEST_TRADE","durationDays":14,
  //      "bannerImageUrl":null,"weight":10}
  bot.command('sponsor', async (ctx) => {
    if (ctx.from?.id !== ADMIN_TELEGRAM_ID) return
    const text = (ctx.message?.text ?? '').replace(/^\/sponsor(@\w+)?\s*/, '').trim()
    const [sub, ...rest] = text.split(/\s+/)

    if (!sub || sub === 'help') {
      await ctx.reply(
        'Управление VIP-кампаниями:\n' +
        '/sponsor list — список всех\n' +
        '/sponsor add <JSON> — создать (см. /sponsor template)\n' +
        '/sponsor remove <id> — удалить\n' +
        '/sponsor toggle <id> — вкл/выкл\n' +
        '/sponsor template — пример JSON\n' +
        '/sponsor seedall — засеять все 7 партнёрских кампаний разом',
      )
      return
    }

    // /sponsor seedall — одной командой завести 7 партнёрских кампаний,
    // соответствующих channelTasksConfig.ts. Идемпотентно: пропускает
    // уже существующие (по promocode), добавляет недостающие. Промокоды
    // — заглушки, владелец канала может их перебить через /sponsor list +
    // /sponsor remove + /sponsor add со своим кодом.
    if (sub === 'seedall') {
      const seeds = [
        {
          channelName: '@vknyazi_izgryazi', channelUrl: 'https://t.me/vknyazi_izgryazi',
          promocode: 'VKNYAZI', scenarioTitle: 'Княжеская грамота палаты',
          scenarioBody: 'Государев казначей Дормидонт собирает гроши на снаряжение торгового обоза. Дело княжеской руки — золото вернётся утроенным к Покрову, печать государя порукой.',
          developerName: 'Казначей Дормидонт', archetype: 'BOYARIN', type: 'HONEST_TRADE',
          bannerImageUrl: '/banners/SPONSOR_VKNYAZI_IZGRYAZI.webp',
        },
        {
          channelName: '@ssignet_ring', channelUrl: 'https://t.me/ssignet_ring',
          promocode: 'PERSTEN', scenarioTitle: 'Драгоценная печатка боярского рода',
          scenarioBody: 'Мастер Игнат скупает редкие перстни-печатки старинных боярских родов. Кто положит гроши — получит долю с перепродажи столичным коллекционерам, втрое к малой Пасхе.',
          developerName: 'Ювелир Игнат', archetype: 'BOYARIN', type: 'TREASURE_HUNT',
          bannerImageUrl: '/banners/SPONSOR_SSIGNET_RING.webp',
        },
        {
          channelName: '@clicermania', channelUrl: 'https://t.me/clicermania',
          promocode: 'KLIK', scenarioTitle: 'Заморская карта удачи',
          scenarioBody: 'Девица Кликерманка завезла из дальних земель невиданную игру — за две недели общая казна играет втрое. Кто гроши положит — войдёт в гильдию и получит свою долю.',
          developerName: 'Девица Кликерманка', archetype: 'ZOLUSHKA', type: 'CARD_GAME',
          bannerImageUrl: '/banners/SPONSOR_CLICERMANIA.webp',
        },
        {
          channelName: '@cryptomaxbablo', channelUrl: 'https://t.me/cryptomaxbablo',
          promocode: 'LEV', scenarioTitle: 'Львиная доля из боярской палаты',
          scenarioBody: 'Боярин Лев Златогривый собирает гроши под княжескую гильдию. Через две недели — три к одному, поручительство палаты Государевой. Печать боярская — клятва купеческая.',
          developerName: 'Боярин Лев Златогривый', archetype: 'BOYARIN', type: 'GUILD_SCHEME',
          bannerImageUrl: '/banners/SPONSOR_CRYPTOMAXBABLO.webp',
        },
        {
          channelName: '@Game_Gain', channelUrl: 'https://t.me/Game_Gain',
          promocode: 'MECH', scenarioTitle: 'Меч-кладенец из закромов',
          scenarioBody: 'Кузнец Богдан Молотов отыскал в старых закромах меч-кладенец с письменами. Гильдия столичных собирателей сулит за две недели тройной выкуп. Печать кузнечного цеха порукой.',
          developerName: 'Кузнец Богдан Молотов', archetype: 'KOSCHEI', type: 'TREASURE_HUNT',
          bannerImageUrl: '/banners/SPONSOR_GAME_GAIN.webp',
        },
        {
          channelName: '@o_my_gift', channelUrl: 'https://t.me/o_my_gift',
          promocode: 'PODAROK', scenarioTitle: 'Щедрая ярмарка подарков',
          scenarioBody: 'Купец-щедрилов Тимофей открыл лавку подарков и шкатулок. Через две недели — троекратный выкуп всей лавки заморскими гостями. Кто гроши положит — войдёт в долю.',
          developerName: 'Купец Тимофей Щедрилов', archetype: 'KOLOBOK', type: 'HONEST_TRADE',
          bannerImageUrl: '/banners/SPONSOR_O_MY_GIFT.webp',
        },
        {
          channelName: '@krypto_mechta', channelUrl: 'https://t.me/krypto_mechta',
          promocode: 'MONETA', scenarioTitle: 'Котёл волшебных монет',
          scenarioBody: 'Бабка-чародейка Ясна варит зелье на золотых монетах. Через две недели — троекратный приплод. Печать ведунская порукой, обмана в варе нет.',
          developerName: 'Бабка-чародейка Ясна', archetype: 'BABA_YAGA', type: 'POTION_BREW',
          bannerImageUrl: '/banners/SPONSOR_KRYPTO_MECHTA.webp',
        },
      ]

      let created = 0
      let skipped = 0
      const lines: string[] = []
      for (const s of seeds) {
        const exists = await prisma.sponsorCampaign.findFirst({
          where: { promocode: s.promocode },
        })
        if (exists) { skipped++; lines.push(`⚪ ${s.channelName} (уже есть)`); continue }
        const c = await prisma.sponsorCampaign.create({
          data: {
            channelName: s.channelName,
            channelUrl: s.channelUrl,
            promocode: s.promocode,
            scenarioTitle: s.scenarioTitle,
            scenarioBody: s.scenarioBody,
            developerName: s.developerName,
            archetype: s.archetype,
            type: s.type,
            durationDays: 14,
            bannerImageUrl: s.bannerImageUrl,
            weight: 10,
            active: true,
          },
        })
        created++
        lines.push(`🟢 ${s.channelName} → код <b>${c.promocode}</b>`)
      }
      await ctx.reply(
        `Засеяно: ${created}, пропущено: ${skipped} (из ${seeds.length})\n\n` + lines.join('\n'),
        { parse_mode: 'HTML' },
      )
      return
    }

    if (sub === 'template') {
      await ctx.reply(
        '/sponsor add ' + JSON.stringify({
          channelName: '@MyChannel',
          channelUrl: 'https://t.me/MyChannel',
          promocode: 'ZOLOTO',
          scenarioTitle: 'Воеводская награда',
          scenarioBody: 'Воевода Михайло собирает гроши на снаряжение войска. Доход тройной — отблагодарит без обмана.',
          developerName: 'Воевода Михайло',
          archetype: 'BOYARIN',
          type: 'HONEST_TRADE',
          durationDays: 14,
          bannerImageUrl: null,
          weight: 10,
        }),
      )
      return
    }

    if (sub === 'list') {
      const all = await prisma.sponsorCampaign.findMany({ orderBy: { createdAt: 'desc' } })
      if (all.length === 0) { await ctx.reply('Пусто.'); return }
      const lines = all.map(c =>
        `${c.active ? '🟢' : '⚫️'} <code>${c.id.slice(0, 8)}</code> · ${c.channelName} · «${c.scenarioTitle}» · код <b>${c.promocode}</b> · ${c.durationDays}д · вес ${c.weight}`,
      )
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
      return
    }

    if (sub === 'remove') {
      const idPrefix = rest[0]
      if (!idPrefix) { await ctx.reply('Использование: /sponsor remove <id>'); return }
      const c = await prisma.sponsorCampaign.findFirst({ where: { id: { startsWith: idPrefix } } })
      if (!c) { await ctx.reply('Не найдено.'); return }
      await prisma.sponsorCampaign.delete({ where: { id: c.id } })
      await ctx.reply(`Удалено: ${c.scenarioTitle} (${c.channelName}).`)
      return
    }

    if (sub === 'toggle') {
      const idPrefix = rest[0]
      if (!idPrefix) { await ctx.reply('Использование: /sponsor toggle <id>'); return }
      const c = await prisma.sponsorCampaign.findFirst({ where: { id: { startsWith: idPrefix } } })
      if (!c) { await ctx.reply('Не найдено.'); return }
      const updated = await prisma.sponsorCampaign.update({
        where: { id: c.id }, data: { active: !c.active },
      })
      await ctx.reply(`${updated.active ? '🟢 Активна' : '⚫️ Выключена'}: ${c.scenarioTitle}.`)
      return
    }

    if (sub === 'add') {
      const jsonStr = text.replace(/^add\s+/, '').trim()
      if (!jsonStr) { await ctx.reply('Использование: /sponsor add <JSON>. Шаблон: /sponsor template'); return }
      try {
        const data = JSON.parse(jsonStr)
        const required = ['channelName', 'channelUrl', 'promocode', 'scenarioTitle', 'scenarioBody', 'developerName', 'archetype', 'type']
        for (const f of required) {
          if (!data[f]) { await ctx.reply(`Не хватает поля: ${f}`); return }
        }
        const created = await prisma.sponsorCampaign.create({
          data: {
            channelName: String(data.channelName),
            channelUrl: String(data.channelUrl),
            promocode: String(data.promocode),
            scenarioTitle: String(data.scenarioTitle),
            scenarioBody: String(data.scenarioBody),
            developerName: String(data.developerName),
            archetype: String(data.archetype),
            type: String(data.type),
            durationDays: Number(data.durationDays ?? 14),
            bannerImageUrl: data.bannerImageUrl ?? null,
            weight: Number(data.weight ?? 10),
            active: true,
          },
        })
        await ctx.reply(`🟢 Создано: ${created.scenarioTitle}\nID: <code>${created.id}</code>\nКод: <b>${created.promocode}</b>`, { parse_mode: 'HTML' })
      } catch (e: any) {
        await ctx.reply(`Ошибка: ${e?.message ?? 'parse error'}`)
      }
      return
    }

    await ctx.reply('Неизвестная команда. /sponsor help')
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
  // ВАЖНО: timeoutMilliseconds=10s + onTimeout='return' заставляет grammy
  // отвечать Telegram'у 200 МГНОВЕННО, даже если handler ещё крутится.
  // Без этого длинные команды (/resetall на 3000+ юзеров — 20+ сек)
  // не успевают ответить, Telegram ретраит webhook каждые ~30 сек, и
  // одна команда превращается в 5-10 параллельных запусков. См. кейс
  // когда /resetall выдал 8 «запускаю» и 3 «Сброс завершён».
  return webhookCallback(bot, 'fastify', {
    timeoutMilliseconds: 10_000,
    onTimeout: 'return',
  })
}
