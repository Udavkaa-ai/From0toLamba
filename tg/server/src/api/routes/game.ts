import type { FastifyInstance } from 'fastify'
import { prisma } from '../../db/prisma'
import { telegramAuthHook } from '../../middleware/telegramAuth'
import { advanceDay } from '../../game/AdvanceDayService'
import { generateOnboardingProject } from '../../game/GenerateProjectService'
import { toPublicDTO } from '../../game/projectUtils'
import { InvestorRank } from '../../game/types'

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
          create: { balance: 0 },
        },
      },
      update: {
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
      },
      include: { gameState: true },
    })

    const gameState = user.gameState!

    // Запускаем онбординг если не начат
    if (!gameState.isOnboardingComplete) {
      const inboxCount = await prisma.project.count({ where: { userId: user.id, isInbox: true } })
      if (inboxCount === 0) {
        generateOnboardingProject(user.id).catch(console.error)
      }
    }

    const activeProjects = await prisma.project.findMany({
      where: { userId: user.id, isActive: true },
    })

    const inboxProjects = await prisma.project.findMany({
      where: { userId: user.id, isInbox: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

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
      activeProjects: activeProjects.map(toPublicDTO),
      inboxProjects: inboxProjects.map(toPublicDTO),
    }
  })

  // POST /api/game/advance-day — следующий день
  app.post('/api/game/advance-day', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
    })

    try {
      const result = await advanceDay(user.id)
      return { success: true, newRank: result.newRank ?? null }
    } catch (err: any) {
      if (err.message === 'ADVANCE_TOO_SOON') {
        return reply.status(429).send({ error: 'Слишком рано — день ещё не прошёл' })
      }
      throw err
    }
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
}
