import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/prisma'
import { telegramAuthHook } from '../../middleware/telegramAuth'
import { advanceDay, ADVANCE_COOLDOWN_MS, MAX_CONSECUTIVE_ADVANCES } from '../../game/AdvanceDayService'
import { generateOnboardingProject } from '../../game/GenerateProjectService'
import { toPublicDTO } from '../../game/projectUtils'

export async function gameRoutes(app: FastifyInstance) {

  // GET /api/game — возвращает GameState + активные проекты
  app.get('/api/game', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser

    // Upsert пользователя
    const user = await prisma.user.upsert({
      where: { telegramId: String(tgUser.id) },
      create: {
        telegramId: String(tgUser.id),
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
        gameState: {
          create: { balance: 10 },
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

    // Мигрируем устаревшие ID модели Gemini
    const oldGeminiIds = ['google/gemini-2.5-flash-preview', 'google/gemini-2.5-flash-preview-05-20']
    if (oldGeminiIds.includes(gameState.preferredModel)) {
      await prisma.gameState.update({
        where: { userId: user.id },
        data: { preferredModel: 'google/gemini-3.1-flash-lite-preview' },
      })
      gameState = { ...gameState, preferredModel: 'google/gemini-3.1-flash-lite-preview' }
    }

    // Запускаем онбординг если не начат
    if (!gameState.isOnboardingComplete) {
      const inboxCount = await prisma.project.count({ where: { userId: user.id, isInbox: true } })
      if (inboxCount === 0) {
        generateOnboardingProject(user.id, gameState.preferredModel).catch(console.error)
      }
    }

    const [activeProjects, inboxProjects] = await Promise.all([
      prisma.project.findMany({ where: { userId: user.id, isActive: true } }),
      prisma.project.findMany({ where: { userId: user.id, isInbox: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ])

    return {
      balance: gameState.balance,
      currentDay: gameState.currentDay,
      investorRank: gameState.investorRank,
      intuitionScore: gameState.intuitionScore,
      scamsDetected: gameState.scamsDetected,
      scamsMissed: gameState.scamsMissed,
      dayStreak: gameState.dayStreak,
      isOnboardingComplete: gameState.isOnboardingComplete,
      totalInvested: gameState.totalInvested,
      totalReturned: gameState.totalReturned,
      balanceHistory: gameState.balanceHistory,
      investedHistory: gameState.investedHistory,
      pendingRankUp: gameState.pendingRankUp,
      preferredModel: gameState.preferredModel,
      lastAdvancedAt: gameState.lastAdvancedAt ? gameState.lastAdvancedAt.toISOString() : null,
      advanceCooldownMs: ADVANCE_COOLDOWN_MS,
      consecutiveAdvances: gameState.consecutiveAdvances,
      maxConsecutiveAdvances: MAX_CONSECUTIVE_ADVANCES,
      activeProjects: activeProjects.map(toPublicDTO),
      inboxProjects: inboxProjects.map(toPublicDTO),
    }
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
      return { success: true, newRank: result.newRank ?? null }
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

  // POST /api/game/advance-day-skip — заглушка «посмотрел рекламу, пропускаю ожидание»
  // TODO: впилить реальную проверку показа рекламы Telegram Ads / Yandex
  app.post('/api/game/advance-day-skip', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
    })
    const result = await advanceDay(user.id, { bypassCooldown: true })
    return { success: true, newRank: result.newRank ?? null }
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

    const ONBOARDING_BONUS = 50
    await prisma.gameState.update({
      where: { userId: user.id },
      data: {
        isOnboardingComplete: true,
        balance: { increment: ONBOARDING_BONUS },
      },
    })

    return { success: true, bonusAwarded: ONBOARDING_BONUS }
  })

  // GET /api/game/settings
  app.get('/api/game/settings', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
      include: { gameState: true },
    })
    return {
      preferredModel: user.gameState?.preferredModel ?? 'deepseek/deepseek-chat-v3-0324',
    }
  })

  // POST /api/game/settings
  app.post('/api/game/settings', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const body = z.object({
      preferredModel: z.enum(['deepseek/deepseek-chat-v3-0324', 'google/gemini-3.1-flash-lite-preview']),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Неверная модель' })

    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
    })
    await prisma.gameState.update({
      where: { userId: user.id },
      data: { preferredModel: body.data.preferredModel },
    })
    return { success: true, preferredModel: body.data.preferredModel }
  })

  // GET /api/leaderboard — топ-100 по общему состоянию
  app.get('/api/leaderboard', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser

    const currentUser = await prisma.user.findUnique({
      where: { telegramId: String(tgUser.id) },
      select: { id: true },
    })

    const [gameStates, projectSums] = await Promise.all([
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

    return reply.send({ entries: top100, myPosition, totalPlayers })
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
    // Reset game state (keep preferredModel)
    const preferredModel = user.gameState?.preferredModel ?? 'deepseek/deepseek-chat-v3-0324'
    await prisma.gameState.update({
      where: { userId: user.id },
      data: {
        balance: 0,
        currentDay: 0,
        investorRank: 'NEWBIE',
        intuitionScore: 0,
        scamsDetected: 0,
        scamsMissed: 0,
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
        preferredModel,
      },
    })
    // Trigger new onboarding project
    const { generateOnboardingProject: genOnboarding } = await import('../../game/GenerateProjectService')
    genOnboarding(user.id, preferredModel).catch(console.error)
    return { success: true }
  })
}
