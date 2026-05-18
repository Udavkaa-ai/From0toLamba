import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/prisma'
import { telegramAuthHook } from '../../middleware/telegramAuth'
import { advanceDay, ADVANCE_COOLDOWN_MS, MAX_CONSECUTIVE_ADVANCES } from '../../game/AdvanceDayService'
import { tryAttachReferrer, countReferrals, REFERRAL_DEALS_THRESHOLD } from '../../game/referralService'
import { ensureWeekStartSnapshot } from '../../game/weeklyService'
import { generateOnboardingProject } from '../../game/GenerateProjectService'
import { toPublicDTO, getCumulativeInvestedMap } from '../../game/projectUtils'
import { computeArchetypeTokens } from '../../game/tokenService'
import { computeTieLevels, totalTies, MAX_TIE_LEVEL, TIE_BONUS_PER_LEVEL, tieLevelFromEarned } from '../../game/tiesService'
import { getArchivedLeaderboard, findMyPositionInArchive } from '../../game/seasonArchive'

export async function gameRoutes(app: FastifyInstance) {

  // GET /api/game — возвращает GameState + активные проекты
  app.get('/api/game', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser

    // Upsert пользователя. Новые игроки получают сразу 50 грошей —
    // «Подарок от Хозяина Ярмарки». Раньше было 10 на старте + ещё 50 при
    // complete-onboarding (двойная отдача и без явной причины); теперь
    // приветственная сумма выдаётся одной транзакцией сразу при создании
    // GameState (см. ниже после upsert'а).
    const STARTING_GIFT = 50
    const user = await prisma.user.upsert({
      where: { telegramId: String(tgUser.id) },
      create: {
        telegramId: String(tgUser.id),
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
        gameState: {
          create: { balance: STARTING_GIFT },
        },
      },
      update: {
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
      },
      include: { gameState: true },
    })

    let gameState = user.gameState!

    // Транзакция-«подарок» — создаём один раз для каждого нового игрока.
    // Признак новизны: ещё ни одной транзакции в БД у этого юзера.
    const txCount = await prisma.transaction.count({ where: { userId: user.id } })
    if (txCount === 0) {
      await prisma.transaction.create({
        data: {
          userId: user.id,
          projectId: null,
          projectName: 'Подарок от Хозяина Ярмарки',
          type: 'GIFT',
          amount: STARTING_GIFT,
          day: gameState.currentDay,
        },
      }).catch(err => console.error('[starting-gift] tx insert failed:', err))
    }

    // Сохраняем UTM-источник при первом входе через партнёрскую ссылку
    if (!user.utmSource && request.telegramStartParam?.startsWith('utm_')) {
      await prisma.user.update({
        where: { id: user.id },
        data: { utmSource: request.telegramStartParam },
      })
    }

    // Мигрируем устаревшие ID модели Gemini
    const oldGeminiIds = ['google/gemini-2.5-flash-preview', 'google/gemini-2.5-flash-preview-05-20']
    if (oldGeminiIds.includes(gameState.preferredModel)) {
      await prisma.gameState.update({
        where: { userId: user.id },
        data: { preferredModel: 'google/gemini-3.1-flash-lite-preview' },
      })
      gameState = { ...gameState, preferredModel: 'google/gemini-3.1-flash-lite-preview' }
    }

    // Пользователи на старых/неподдерживаемых моделях — переводим на DeepSeek
    // v4 Flash (новый дефолт, работает стабильно в отличие от free-моделей)
    const oldToV4Flash = [
      'deepseek/deepseek-chat-v3-0324',
      'google/gemma-4-26b-a4b-it:free',
      'qwen/qwen3-next-80b-a3b-instruct:free',
    ]
    if (oldToV4Flash.includes(gameState.preferredModel)) {
      await prisma.gameState.update({
        where: { userId: user.id },
        data: { preferredModel: 'deepseek/deepseek-v4-flash' },
      })
      gameState = { ...gameState, preferredModel: 'deepseek/deepseek-v4-flash' }
    }

    // Запускаем онбординг если не начат
    if (!gameState.isOnboardingComplete) {
      const inboxCount = await prisma.project.count({ where: { userId: user.id, isInbox: true } })
      if (inboxCount === 0) {
        generateOnboardingProject(user.id, gameState.preferredModel, gameState.preferredLanguage ?? 'ru').catch(console.error)
      }
    }

    // Засеиваем предзагруженные дела, если их ещё нет — чтобы первый advance-day
    // уже был мгновенным, а не ждал AI 25+ секунд
    const preloadedCount = await prisma.project.count({ where: { userId: user.id, isPreloaded: true } })
    if (preloadedCount === 0) {
      const { generateProject } = await import('../../game/GenerateProjectService')
      for (let i = 0; i < 2; i++) {
        generateProject(user.id, undefined, gameState.preferredModel, { preloaded: true }, gameState.preferredLanguage ?? 'ru')
          .catch(err => console.error('[preload seed]', err))
      }
    }

    // Реферальная программа: пробуем привязать реферала.
    // Источник payload: initData.start_param (если Mini App открыли через
    // t.me/bot?startapp=ref_X — основной путь, требует Main Mini App в BotFather)
    // ИЛИ user.pendingReferralParam (legacy — если бот сохранил из /start ref_X).
    const refPayload = request.telegramStartParam ?? user.pendingReferralParam ?? null
    if (refPayload) {
      console.log(`[Referral] user=${user.id} (tg=${tgUser.id}) payload=${refPayload} src=${request.telegramStartParam ? 'startParam' : 'pending'}`)
    }
    const refResult = await tryAttachReferrer(user.id, refPayload)
    if (refResult.attached) {
      console.log(`[Referral] attached user=${user.id} referrerId=${refResult.referrerId} (bonus pending чуйка≥10)`)
      if (user.pendingReferralParam) {
        await prisma.user.update({ where: { id: user.id }, data: { pendingReferralParam: null } })
      }
    } else if (refPayload) {
      console.log(`[Referral] NOT attached (already attached or self-ref) user=${user.id}`)
    }

    const [activeProjects, inboxProjects, closedProjectsCount, charterSessions, referralCount, amaSessionsStarted, amaSessionsCompleted, minigameSessions] = await Promise.all([
      prisma.project.findMany({ where: { userId: user.id, isActive: true }, orderBy: { createdAt: 'desc' } }),
      prisma.project.findMany({ where: { userId: user.id, isInbox: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.project.count({ where: { userId: user.id, isClosed: true, investedAmountRubles: { gt: 0 } } }),
      prisma.amaSession.findMany({
        where: { userId: user.id, charterSubmittedAt: { not: null } },
        select: { forgedIndices: true, charterSelectedIndices: true },
      }),
      countReferrals(user.id),
      // Беседы, где игрок реально написал хотя бы одно сообщение
      prisma.amaSession.count({ where: { userId: user.id, messages: { some: { role: 'user' } } } }),
      // В скольких беседах дошёл до конца (10 вопросов задано)
      prisma.amaSession.count({ where: { userId: user.id, isComplete: true } }),
      // Все сабмиченные мини-игры с архетипом — для статистики «сыграно с дельцом»
      prisma.amaSession.findMany({
        where: { userId: user.id, charterSubmittedAt: { not: null } },
        select: { intuitionDelta: true, project: { select: { personaArchetype: true } } },
      }),
    ])

    // Догенерим имена для дел, которые застряли с плейсхолдером
    // (бывает если первый AI-вызов упал — плейсхолдер сохранился в БД)
    const { enrichPlaceholderProject } = await import('../../game/GenerateProjectService')
    for (const p of inboxProjects) {
      if (p.name === 'Тайное дело') {
        enrichPlaceholderProject(p.id, gameState.preferredModel, gameState.preferredLanguage ?? 'ru').catch(console.error)
      }
    }

    const currentWealth = gameState.balance + activeProjects.reduce((s, p) => s + p.currentValueRubles, 0)
    const weekStartWealth = await ensureWeekStartSnapshot(user.id, currentWealth)

    // Кумулятивно вложено по каждому активному делу — для честного profit%
    // на карточках в HomePage/Portfolio. inboxProjects сюда не нужны (там нет
    // транзакций ещё). См. partialWithdraw — investedAmountRubles теперь
    // означает «текущий принципал», не суммарное.
    const cumulativeInvestedMap = await getCumulativeInvestedMap(activeProjects.map(p => p.id))

    // Точность чуйки по всем разобранным грамотам: TP / (TP + FP + FN)
    let tp = 0, fp = 0, fn = 0
    for (const s of charterSessions) {
      const forged = new Set(s.forgedIndices)
      const picked = new Set(s.charterSelectedIndices)
      for (const i of picked) (forged.has(i) ? tp++ : fp++)
      for (const i of forged) if (!picked.has(i)) fn++
    }
    const evaluatedTotal = tp + fp + fn
    const intuitionAccuracy = evaluatedTotal > 0 ? tp / evaluatedTotal : null

    // Увиденные породы/личины/судьбы — по закрытым делам с разбором.
    // Нужно для подвигов, открывающих справочник.
    const postMortems = await prisma.postMortem.findMany({
      where: { userId: user.id },
      select: { revealedArchetype: true, fate: true, project: { select: { type: true } } },
    })
    const seenTypes = Array.from(new Set(postMortems.map(p => p.project.type)))
    const seenArchetypes = Array.from(new Set(postMortems.map(p => p.revealedArchetype)))
    const seenFates = Array.from(new Set(postMortems.map(p => p.fate)))

    // Число «взятых дел» — основа для ранга с версии 4
    const dealsCount = await prisma.project.count({
      where: { userId: user.id, investedAmountRubles: { gt: 0 } },
    })

    // Статистика по мини-играм: сгруппирована по архетипу хозяина.
    //   intuitionDelta хранит errorCount: 0 = идеал, 1 = победа, ≥2 = поражение.
    //   На BOYARIN intuitionDelta — это FP+FN (по той же шкале).
    const minigameStats: Record<string, { played: number; perfect: number; won: number; lost: number }> = {}
    for (const s of minigameSessions as Array<{ intuitionDelta: number; project: { personaArchetype: string } }>) {
      const arch = s.project.personaArchetype
      if (!minigameStats[arch]) minigameStats[arch] = { played: 0, perfect: 0, won: 0, lost: 0 }
      minigameStats[arch].played += 1
      const err = s.intuitionDelta
      if (err === 0)      minigameStats[arch].perfect += 1
      else if (err === 1) minigameStats[arch].won += 1
      else                minigameStats[arch].lost += 1
    }

    // Жетоны хозяев — внутриигровая мини-валюта по архетипам
    const archetypeTokens = await computeArchetypeTokens(user.id)

    // «Завязки» — уровни отношений (0..10) производные от lifetime earned-жетонов.
    // Каждый уровень даёт +TIE_BONUS_PER_LEVEL/день к доходности дел этого
    // архетипа. См. tiesService.ts.
    const tieLevels: Record<string, number> = {}
    for (const [arch, info] of Object.entries(archetypeTokens)) {
      tieLevels[arch] = tieLevelFromEarned(info.earned)
    }
    const tiesTotal = totalTies(tieLevels)

    return {
      balance: gameState.balance,
      currentDay: gameState.currentDay,
      investorRank: gameState.investorRank,
      nickname: user.nickname ?? null,
      intuitionScore: gameState.intuitionScore,
      intuitionAccuracy,       // 0..1 или null, если грамот не было
      chartersSubmitted: charterSessions.length,
      closedProjectsCount,
      dealsCount,              // число дел, в которые игрок вложил гроши
      minigameStats,           // статистика игр по архетипам: {BURATINO: {played, perfect, won, lost}, ...}
      archetypeTokens,         // {BURATINO: {earned, spent, balance, gamesPlayed, dealsTaken}, ...}
      tieLevels,               // {BURATINO: 3, BOYARIN: 7, ...} — уровни Завязок (0..10)
      tiesTotal,               // сумма всех уровней — для рейтинга «Связи»
      tiesMaxLevel: MAX_TIE_LEVEL,
      tiesBonusPerLevel: TIE_BONUS_PER_LEVEL,
      referralCount,           // число приведённых купцов
      weekStartWealth,         // снимок состояния на начало текущей недели
      userId: user.id,         // нужен для построения пригласительной ссылки
      dayStreak: gameState.dayStreak,
      isOnboardingComplete: gameState.isOnboardingComplete,
      totalInvested: gameState.totalInvested,
      totalReturned: gameState.totalReturned,
      balanceHistory: gameState.balanceHistory,
      investedHistory: gameState.investedHistory,
      pendingRankUp: gameState.pendingRankUp,
      preferredModel: gameState.preferredModel,
      preferredLanguage: gameState.preferredLanguage ?? 'ru',
      newsEnabled: gameState.newsEnabled,
      lastAdvancedAt: gameState.lastAdvancedAt ? gameState.lastAdvancedAt.toISOString() : null,
      advanceCooldownMs: ADVANCE_COOLDOWN_MS,
      consecutiveAdvances: gameState.consecutiveAdvances,
      maxConsecutiveAdvances: MAX_CONSECUTIVE_ADVANCES,
      activeProjects: activeProjects.map(p => toPublicDTO(p, { totalInvested: cumulativeInvestedMap.get(p.id) })),
      inboxProjects: inboxProjects.map(p => toPublicDTO(p)),
      seenTypes,
      seenArchetypes,
      seenFates,
      amaSessionsStarted,
      amaSessionsCompleted,
      extraSlotsBalance: gameState.extraSlotsBalance,
      pendingMarketAnnouncement: !gameState.marketAnnouncementSeen,
    }
  })

  // POST /api/announcement/market — отметить объявление просмотренным; action=claim → +100 г
  app.post('/api/announcement/market', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const body = z.object({ action: z.enum(['dismiss', 'claim']) }).safeParse(request.body)
    const action = body.success ? body.data.action : 'dismiss'

    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
      include: { gameState: true },
    })
    const gs = user.gameState!
    if (gs.marketAnnouncementSeen) return { rewardGranted: false, balance: gs.balance }

    const rewardGranted = action === 'claim' && !gs.marketAnnouncementRewardClaimed
    const newBalance = rewardGranted ? gs.balance + 100 : gs.balance

    await prisma.gameState.update({
      where: { userId: user.id },
      data: {
        marketAnnouncementSeen: true,
        ...(rewardGranted ? {
          marketAnnouncementRewardClaimed: true,
          balance: newBalance,
        } : {}),
      },
    })

    if (rewardGranted) {
      await prisma.transaction.create({
        data: {
          userId: user.id,
          projectName: 'Объявление',
          type: 'REFERRAL_BONUS',
          amount: 100,
          day: gs.currentDay,
        },
      })
    }

    return { rewardGranted, balance: newBalance }
  })

  // POST /api/game/advance-day — следующий день
  app.post('/api/game/advance-day', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
      include: { gameState: true },
    })

    try {
      const result = await advanceDay(user.id)
      return { success: true, newRank: result.newRank ?? null, closures: result.closures }
    } catch (err: any) {
      if (err.message === 'ADVANCE_TOO_SOON') {
        const since = user.gameState?.lastAdvancedAt
          ? Date.now() - user.gameState.lastAdvancedAt.getTime()
          : 0
        const secondsRemaining = Math.max(0, Math.ceil((ADVANCE_COOLDOWN_MS - since) / 1000))
        return reply.status(429).send({
          error: 'Слишком рано — день ещё не прошёл',
          secondsRemaining,
        })
      }
      throw err
    }
  })

  // POST /api/game/advance-day-skip — legacy endpoint; основной флоу через /api/payments/activate
  app.post('/api/game/advance-day-skip', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
    })
    const result = await advanceDay(user.id, { bypassCooldown: true })
    return { success: true, newRank: result.newRank ?? null, closures: result.closures }
  })

  // POST /api/game/clear-rank-up — сбросить pendingRankUp после показа
  app.post('/api/game/clear-rank-up', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
    })
    await prisma.gameState.update({
      where: { userId: user.id },
      data: { pendingRankUp: null },
    })
    return { success: true }
  })

  // POST /api/game/complete-onboarding — завершить онбординг и начислить бонус
  app.post('/api/game/complete-onboarding', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
      include: { gameState: true },
    })

    if (user.gameState?.isOnboardingComplete) {
      return reply.status(400).send({ error: 'Онбординг уже завершён' })
    }

    // Старт-бонус 50 г теперь начисляется СРАЗУ при создании GameState
    // («Подарок от Хозяина Ярмарки» — см. /api/game upsert-блок). Здесь
    // только переключаем флаг — без повторного начисления, чтобы не
    // отдавать игроку 100 г за один онбординг.
    await prisma.gameState.update({
      where: { userId: user.id },
      data: { isOnboardingComplete: true },
    })

    return { success: true, bonusAwarded: 0 }
  })

  // GET /api/game/settings
  app.get('/api/game/settings', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
      include: { gameState: true },
    })
    return {
      preferredModel: user.gameState?.preferredModel ?? 'deepseek/deepseek-v4-flash',
    }
  })

  // POST /api/game/settings
  app.post('/api/game/settings', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const body = z.object({
      preferredModel: z.enum([
        'deepseek/deepseek-v4-flash',
        'google/gemini-3.1-flash-lite-preview',
      ]).optional(),
      preferredLanguage: z.enum(['ru', 'en']).optional(),
      newsEnabled: z.boolean().optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid settings' })

    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
    })
    const updateData: Record<string, string | boolean> = {}
    if (body.data.preferredModel) updateData.preferredModel = body.data.preferredModel
    if (body.data.preferredLanguage) updateData.preferredLanguage = body.data.preferredLanguage
    if (typeof body.data.newsEnabled === 'boolean') updateData.newsEnabled = body.data.newsEnabled
    await prisma.gameState.update({
      where: { userId: user.id },
      data: updateData,
    })
    return { success: true, ...body.data }
  })

  // GET /api/leaderboard — топ-100 по общему состоянию
  app.get('/api/leaderboard', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser

    const currentUser = await prisma.user.findUnique({
      where: { telegramId: String(tgUser.id) },
      select: { id: true },
    })

    // Архивный режим (ARCHIVE_SEASON_VIEW в env) — отдаём заморозку
    // финального топа сезона. Живые цифры не считаются.
    const archived = await getArchivedLeaderboard('WEALTH')
    if (archived) {
      const myPosition = findMyPositionInArchive(archived.entries, currentUser?.id ?? null, String(tgUser.id))
      const entriesWithMe = archived.entries.map(e => ({
        ...e,
        isMe: currentUser ? e.userId === currentUser.id : false,
      }))
      return reply.send({
        entries: entriesWithMe,
        myPosition,
        totalPlayers: archived.totalPlayers,
        totalAllPlayers: archived.totalPlayers,
      })
    }

    const [gameStates, projectSums, totalAllPlayers] = await Promise.all([
      prisma.gameState.findMany({
        where: { isOnboardingComplete: true },
        include: {
          user: { select: { id: true, firstName: true, username: true } },
        },
      }),
      prisma.project.groupBy({
        by: ['userId'],
        where: { isActive: true },
        _sum: { currentValueRubles: true },
      }),
      prisma.gameState.count(),
    ])

    const sumByUserId = new Map(
      projectSums.map(p => [p.userId, p._sum.currentValueRubles ?? 0])
    )

    const ranked = gameStates
      .map(gs => ({
        userId: gs.userId,
        firstName: gs.user.firstName,
        username: gs.user.username ?? null,
        investorRank: gs.investorRank,
        currentDay: gs.currentDay,
        intuitionScore: gs.intuitionScore,
        totalWealth: gs.balance + (sumByUserId.get(gs.userId) ?? 0),
        isMe: currentUser ? gs.userId === currentUser.id : false,
      }))
      .sort((a, b) => b.totalWealth - a.totalWealth)

    const totalPlayers = ranked.length
    const top100 = ranked.slice(0, 100).map((e, i) => ({ ...e, position: i + 1 }))

    let myPosition: number | null = null
    if (currentUser) {
      const myIdx = ranked.findIndex(e => e.userId === currentUser.id)
      if (myIdx >= 0) myPosition = myIdx + 1
    }

    return reply.send({ entries: top100, myPosition, totalPlayers, totalAllPlayers })
  })

  // GET /api/leaderboard/week — «ярмарка недели»: рост состояния за текущую неделю (с понедельника МСК)
  app.get('/api/leaderboard/week', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const currentUser = await prisma.user.findUnique({
      where: { telegramId: String(tgUser.id) },
      select: { id: true },
    })

    const { getCurrentWeekStart } = await import('../../game/weeklyService')
    const weekStart = getCurrentWeekStart()

    const [gameStates, projectSums] = await Promise.all([
      prisma.gameState.findMany({
        where: { isOnboardingComplete: true },
        include: { user: { select: { id: true, firstName: true, username: true } } },
      }),
      prisma.project.groupBy({
        by: ['userId'],
        where: { isActive: true },
        _sum: { currentValueRubles: true },
      }),
    ])
    const sumByUserId = new Map(projectSums.map(p => [p.userId, p._sum.currentValueRubles ?? 0]))

    const ranked = gameStates
      .map(gs => {
        const currentWealth = gs.balance + (sumByUserId.get(gs.userId) ?? 0)
        // Если snapshot устарел — считаем с текущего состояния (прирост = 0)
        const snapshotValid = gs.weekStartAt && gs.weekStartAt >= weekStart
        const weekDelta = snapshotValid ? currentWealth - gs.weekStartWealth : 0
        return {
          userId: gs.userId,
          firstName: gs.user.firstName,
          username: gs.user.username ?? null,
          investorRank: gs.investorRank,
          currentDay: gs.currentDay,
          intuitionScore: gs.intuitionScore,
          totalWealth: currentWealth,
          weekDelta,
          isMe: currentUser ? gs.userId === currentUser.id : false,
        }
      })
      .filter(e => e.weekDelta > 0) // нулевой прирост — в топ не показываем
      .sort((a, b) => b.weekDelta - a.weekDelta)

    const totalPlayers = ranked.length
    const top100 = ranked.slice(0, 100).map((e, i) => ({ ...e, position: i + 1 }))

    let myPosition: number | null = null
    if (currentUser) {
      const myIdx = ranked.findIndex(e => e.userId === currentUser.id)
      if (myIdx >= 0) myPosition = myIdx + 1
    }

    return reply.send({ entries: top100, myPosition, totalPlayers, weekStart: weekStart.toISOString() })
  })

  // GET /api/leaderboard/referrals — «сваты»: кто сколько купцов зазвал
  app.get('/api/leaderboard/referrals', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const currentUser = await prisma.user.findUnique({
      where: { telegramId: String(tgUser.id) },
      select: { id: true },
    })

    const archived = await getArchivedLeaderboard('REFERRALS')
    if (archived) {
      const myPosition = findMyPositionInArchive(archived.entries, currentUser?.id ?? null, String(tgUser.id))
      const entriesWithMe = archived.entries.map(e => ({
        ...e,
        isMe: currentUser ? e.userId === currentUser.id : false,
      }))
      return reply.send({ entries: entriesWithMe, myPosition, totalPlayers: archived.totalPlayers })
    }

    // Группируем рефералов по referrerId
    const groups = await prisma.user.groupBy({
      by: ['referrerId'],
      where: { referrerId: { not: null } },
      _count: { _all: true },
    })

    const referrerIds = groups.map(g => g.referrerId as number)
    const referrers = await prisma.user.findMany({
      where: { id: { in: referrerIds } },
      select: { id: true, firstName: true, username: true, gameState: { select: { investorRank: true } } },
    })
    const byId = new Map(referrers.map(r => [r.id, r]))

    const ranked = groups
      .map(g => {
        const ref = byId.get(g.referrerId as number)
        if (!ref) return null
        return {
          userId: ref.id,
          firstName: ref.firstName,
          username: ref.username ?? null,
          investorRank: ref.gameState?.investorRank ?? 'NEWBIE',
          referralCount: g._count._all,
          isMe: currentUser ? ref.id === currentUser.id : false,
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => b.referralCount - a.referralCount)

    const totalPlayers = ranked.length
    const top100 = ranked.slice(0, 100).map((e, i) => ({ ...e, position: i + 1 }))

    let myPosition: number | null = null
    if (currentUser) {
      const myIdx = ranked.findIndex(e => e.userId === currentUser.id)
      if (myIdx >= 0) myPosition = myIdx + 1
    }

    return reply.send({ entries: top100, myPosition, totalPlayers })
  })

  // GET /api/leaderboard/ties — «связи»: суммарный уровень Завязок со всеми дельцами
  app.get('/api/leaderboard/ties', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const currentUser = await prisma.user.findUnique({
      where: { telegramId: String(tgUser.id) },
      select: { id: true },
    })

    const archived = await getArchivedLeaderboard('TIES')
    if (archived) {
      const myPosition = findMyPositionInArchive(archived.entries, currentUser?.id ?? null, String(tgUser.id))
      const entriesWithMe = archived.entries.map(e => ({
        ...e,
        isMe: currentUser ? e.userId === currentUser.id : false,
      }))
      return reply.send({ entries: entriesWithMe, myPosition, totalPlayers: archived.totalPlayers })
    }

    // Считаем уровни сразу для всех игроков одним блоком (без 1000 запросов
    // computeTieLevels). Источники: AmaSession (для подсчёта сыгранных мини-игр),
    // Project (для подсчёта взятых дел и знакомств) → дальше группируем по
    // userId × archetype и применяем ту же формулу что в tokenService.
    const TOKENS_PER_GAMES = 10
    const TOKENS_PER_DEALS = 5

    const [allUsers, allSessions, allInvestedProjects, allProjects] = await Promise.all([
      prisma.gameState.findMany({
        where: { isOnboardingComplete: true },
        include: { user: { select: { id: true, firstName: true, username: true } } },
      }),
      prisma.amaSession.findMany({
        where: { charterSubmittedAt: { not: null } },
        select: { userId: true, project: { select: { personaArchetype: true } } },
      }),
      prisma.project.findMany({
        where: { investedAmountRubles: { gt: 0 } },
        select: { userId: true, personaArchetype: true },
      }),
      prisma.project.findMany({ select: { userId: true, personaArchetype: true } }),
    ])

    // userId → archetype → counters
    const stats = new Map<number, Record<string, { games: number; deals: number; met: boolean }>>()
    const touch = (uid: number, arch: string) => {
      let m = stats.get(uid)
      if (!m) { m = {}; stats.set(uid, m) }
      let r = m[arch]
      if (!r) { r = { games: 0, deals: 0, met: false }; m[arch] = r }
      return r
    }
    for (const s of allSessions) touch(s.userId, s.project.personaArchetype).games += 1
    for (const p of allInvestedProjects) touch(p.userId, p.personaArchetype).deals += 1
    for (const p of allProjects) touch(p.userId, p.personaArchetype).met = true

    // Свернуть в суммарный уровень Завязок по игроку
    const ranked = allUsers
      .map(gs => {
        const m = stats.get(gs.userId) ?? {}
        let totalLvl = 0
        for (const r of Object.values(m)) {
          const earned = (r.met ? 1 : 0)
            + Math.floor(r.games / TOKENS_PER_GAMES)
            + Math.floor(r.deals / TOKENS_PER_DEALS)
          totalLvl += Math.min(MAX_TIE_LEVEL, earned)
        }
        return {
          userId: gs.userId,
          firstName: gs.user.firstName,
          username: gs.user.username ?? null,
          investorRank: gs.investorRank,
          tiesTotal: totalLvl,
          isMe: currentUser ? gs.userId === currentUser.id : false,
        }
      })
      .filter(e => e.tiesTotal > 0)
      .sort((a, b) => b.tiesTotal - a.tiesTotal)

    const totalPlayers = ranked.length
    const top100 = ranked.slice(0, 100).map((e, i) => ({ ...e, position: i + 1 }))

    let myPosition: number | null = null
    if (currentUser) {
      const myIdx = ranked.findIndex(e => e.userId === currentUser.id)
      if (myIdx >= 0) myPosition = myIdx + 1
    }

    return reply.send({ entries: top100, myPosition, totalPlayers })
  })

  // GET /api/leaderboard/intuition — топ-5 по чуйке
  app.get('/api/leaderboard/intuition', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const currentUser = await prisma.user.findUnique({
      where: { telegramId: String(tgUser.id) },
      select: { id: true },
    })

    const [gameStates, projectSums] = await Promise.all([
      prisma.gameState.findMany({
        where: { isOnboardingComplete: true },
        include: { user: { select: { id: true, firstName: true, username: true } } },
      }),
      prisma.project.groupBy({
        by: ['userId'],
        where: { isActive: true },
        _sum: { currentValueRubles: true },
      }),
    ])
    const sumByUserId = new Map(projectSums.map(p => [p.userId, p._sum.currentValueRubles ?? 0]))

    const ranked = gameStates
      .map(gs => ({
        userId: gs.userId,
        firstName: gs.user.firstName,
        username: gs.user.username ?? null,
        investorRank: gs.investorRank,
        currentDay: gs.currentDay,
        intuitionScore: gs.intuitionScore,
        totalWealth: gs.balance + (sumByUserId.get(gs.userId) ?? 0),
        isMe: currentUser ? gs.userId === currentUser.id : false,
      }))
      .sort((a, b) => b.intuitionScore - a.intuitionScore)

    const top100 = ranked.slice(0, 100).map((e, i) => ({ ...e, position: i + 1 }))
    const myEntry = currentUser ? ranked.find(e => e.userId === currentUser.id) : null
    const myPosition = myEntry ? ranked.indexOf(myEntry) + 1 : null

    return reply.send({ entries: top100, myPosition, totalPlayers: ranked.length })
  })

  // GET /api/leaderboard/days — топ-5 по количеству игровых дней
  app.get('/api/leaderboard/days', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const currentUser = await prisma.user.findUnique({
      where: { telegramId: String(tgUser.id) },
      select: { id: true },
    })

    const [gameStates, projectSums] = await Promise.all([
      prisma.gameState.findMany({
        where: { isOnboardingComplete: true },
        include: { user: { select: { id: true, firstName: true, username: true } } },
      }),
      prisma.project.groupBy({
        by: ['userId'],
        where: { isActive: true },
        _sum: { currentValueRubles: true },
      }),
    ])
    const sumByUserId = new Map(projectSums.map(p => [p.userId, p._sum.currentValueRubles ?? 0]))

    const ranked = gameStates
      .map(gs => ({
        userId: gs.userId,
        firstName: gs.user.firstName,
        username: gs.user.username ?? null,
        investorRank: gs.investorRank,
        currentDay: gs.currentDay,
        intuitionScore: gs.intuitionScore,
        totalWealth: gs.balance + (sumByUserId.get(gs.userId) ?? 0),
        isMe: currentUser ? gs.userId === currentUser.id : false,
      }))
      .sort((a, b) => b.currentDay - a.currentDay)

    const top100 = ranked.slice(0, 100).map((e, i) => ({ ...e, position: i + 1 }))
    const myEntry = currentUser ? ranked.find(e => e.userId === currentUser.id) : null
    const myPosition = myEntry ? ranked.indexOf(myEntry) + 1 : null

    return reply.send({ entries: top100, myPosition, totalPlayers: ranked.length })
  })

  // GET /api/leaderboard/achievements — топ-5 по количеству закрытых дел + разобранных грамот
  app.get('/api/leaderboard/achievements', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const currentUser = await prisma.user.findUnique({
      where: { telegramId: String(tgUser.id) },
      select: { id: true },
    })

    const archived = await getArchivedLeaderboard('ACHIEVEMENTS')
    if (archived) {
      const myPosition = findMyPositionInArchive(archived.entries, currentUser?.id ?? null, String(tgUser.id))
      const entriesWithMe = archived.entries.map(e => ({
        ...e,
        isMe: currentUser ? e.userId === currentUser.id : false,
      }))
      return reply.send({ entries: entriesWithMe, myPosition, totalPlayers: archived.totalPlayers })
    }

    const [gameStates, projectSums, closedCounts, charterCounts] = await Promise.all([
      prisma.gameState.findMany({
        where: { isOnboardingComplete: true },
        include: { user: { select: { id: true, firstName: true, username: true } } },
      }),
      prisma.project.groupBy({
        by: ['userId'],
        where: { isActive: true },
        _sum: { currentValueRubles: true },
      }),
      prisma.project.groupBy({
        by: ['userId'],
        where: { isClosed: true, investedAmountRubles: { gt: 0 } },
        _count: { _all: true },
      }),
      prisma.amaSession.groupBy({
        by: ['userId'],
        where: { charterSubmittedAt: { not: null } },
        _count: { _all: true },
      }),
    ])

    const sumByUserId = new Map(projectSums.map(p => [p.userId, p._sum.currentValueRubles ?? 0]))
    const closedByUserId = new Map(closedCounts.map(c => [c.userId, c._count._all]))
    const chartersByUserId = new Map(charterCounts.map(c => [c.userId, c._count._all]))

    const ranked = gameStates
      .map(gs => {
        const closed = closedByUserId.get(gs.userId) ?? 0
        const charters = chartersByUserId.get(gs.userId) ?? 0
        return {
          userId: gs.userId,
          firstName: gs.user.firstName,
          username: gs.user.username ?? null,
          investorRank: gs.investorRank,
          currentDay: gs.currentDay,
          intuitionScore: gs.intuitionScore,
          totalWealth: gs.balance + (sumByUserId.get(gs.userId) ?? 0),
          achievementScore: closed * 3 + charters,
          closedProjectsCount: closed,
          chartersSubmitted: charters,
          isMe: currentUser ? gs.userId === currentUser.id : false,
        }
      })
      .sort((a, b) => b.achievementScore - a.achievementScore)

    const top100 = ranked.slice(0, 100).map((e, i) => ({ ...e, position: i + 1 }))
    const myEntry = currentUser ? ranked.find(e => e.userId === currentUser.id) : null
    const myPosition = myEntry ? ranked.indexOf(myEntry) + 1 : null

    return reply.send({ entries: top100, myPosition, totalPlayers: ranked.length })
  })

  // GET /api/referrals/my — список сосватанных с их статусом
  app.get('/api/referrals/my', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const currentUser = await prisma.user.findUnique({
      where: { telegramId: String(tgUser.id) },
      select: { id: true },
    })
    if (!currentUser) return reply.status(404).send({ error: 'NOT_FOUND' })

    const referred = await prisma.user.findMany({
      where: { referrerId: currentUser.id },
      select: {
        id: true,
        firstName: true,
        username: true,
        referralBonusGranted: true,
        gameState: { select: { currentDay: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // В версии 4.0 бонус начисляется по числу ВЗЯТЫХ дел (Project с
    // investedAmountRubles > 0), а не по «чуйке». Считаем для каждого реферала.
    const dealsCounts = await Promise.all(
      referred.map(r =>
        prisma.project.count({
          where: { userId: r.id, investedAmountRubles: { gt: 0 } },
        })
      )
    )

    return reply.send({
      referrals: referred.map((r, idx) => ({
        userId: r.id,
        firstName: r.firstName,
        username: r.username ?? null,
        bonusGranted: r.referralBonusGranted,
        // Поле оставлено intuitionScore для совместимости со старым клиентом —
        // фактически тут число взятых дел.
        intuitionScore: dealsCounts[idx],
        currentDay: r.gameState?.currentDay ?? 0,
      })),
      threshold: REFERRAL_DEALS_THRESHOLD,
    })
  })

  // POST /api/game/reset
  app.post('/api/game/reset', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
      include: { gameState: true },
    })
    // Delete all user's projects (cascades to AmaSession, AmaMessage, DailyUpdate, PostMortem)
    await prisma.project.deleteMany({ where: { userId: user.id } })
    await prisma.transaction.deleteMany({ where: { userId: user.id } })
    // referrerId и referralBonusGranted намеренно НЕ сбрасываем:
    // бонус выдаётся ровно один раз в жизни аккаунта, независимо от сбросов.
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingReferralParam: null },
    })
    // Reset game state (keep preferredModel).
    // balance стартует с STARTING_GIFT (50 г) — иначе после сброса транзакция
    // «Подарок от Хозяина Ярмарки» создаётся (txCount===0 после deleteMany),
    // но грошей нет, потому что balance: 50 при upsert навешивается ТОЛЬКО
    // в create-ветке (для новых юзеров), а у сбросившего user уже существует.
    const preferredModel = user.gameState?.preferredModel ?? 'deepseek/deepseek-v4-flash'
    await prisma.gameState.update({
      where: { userId: user.id },
      data: {
        balance: 50,
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
    // Trigger new onboarding project
    const { generateOnboardingProject: genOnboarding } = await import('../../game/GenerateProjectService')
    genOnboarding(user.id, preferredModel).catch(console.error)
    return { success: true }
  })

  // GET /api/season-archive/:seasonNumber — «Зал славы» сезона.
  // Отдаёт сразу все 4 категории (Злато / Связи / Достижения / Сваты)
  // из SeasonArchive — клиент рисует страницу с табами. Если архива
  // на этот сезон нет — 404. Эндпоинт работает независимо от
  // ARCHIVE_SEASON_VIEW env-var (зал славы — постоянная история).
  app.get('/api/season-archive/:seasonNumber', { preHandler: telegramAuthHook }, async (request, reply) => {
    const params = request.params as { seasonNumber: string }
    const n = parseInt(params.seasonNumber, 10)
    if (!Number.isFinite(n) || n <= 0) {
      return reply.status(400).send({ error: 'BAD_SEASON' })
    }
    const rows = await prisma.seasonArchive.findMany({
      where: { seasonNumber: n, category: { in: ['WEALTH', 'TIES', 'ACHIEVEMENTS', 'REFERRALS'] } },
    })
    if (rows.length === 0) {
      return reply.status(404).send({ error: 'NOT_ARCHIVED' })
    }

    const byCategory: Record<string, { entries: any[]; totalPlayers: number; capturedAt: string }> = {}
    for (const r of rows) {
      byCategory[r.category] = {
        entries: r.entries as any[],
        totalPlayers: r.totalPlayers,
        capturedAt: r.capturedAt.toISOString(),
      }
    }

    return reply.send({ seasonNumber: n, categories: byCategory })
  })
}
