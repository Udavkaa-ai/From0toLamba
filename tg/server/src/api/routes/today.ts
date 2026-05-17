import type { FastifyInstance } from 'fastify'
import { prisma } from '../../db/prisma'
import { telegramAuthHook } from '../../middleware/telegramAuth'
import { touchLoginStreak, getTodayState, claimDaily } from '../../game/todayService'
import { getArchivedLeaderboard } from '../../game/seasonArchive'

export async function todayRoutes(app: FastifyInstance) {
  // GET /api/today — обновляет стрик (если новый день) + возвращает состояние +
  // топ-10 рейтинга по богатству. На вкладке «Сегодня» один запрос — всё нужное.
  app.get('/api/today', { preHandler: telegramAuthHook }, async (request) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })
    await touchLoginStreak(user.id)
    const state = await getTodayState(user.id)

    // Если включён архивный режим (ARCHIVE_SEASON_VIEW в env) — отдаём
    // замороженный финальный топ сезона вместо живых вычислений.
    const archived = await getArchivedLeaderboard('WEALTH_TODAY')
    if (archived) {
      const topTen = archived.entries.slice(0, 10)
      const myIndexInArchive = archived.entries.findIndex((r: any) => r.telegramId === String(tgUser.id))
      return {
        ...state,
        leaderboard: {
          top: topTen,
          myPosition: myIndexInArchive >= 0 ? myIndexInArchive + 1 : null,
          totalPlayers: archived.totalPlayers,
        },
      }
    }

    // Топ-10 по общему состоянию (баланс + стоимость активных дел).
    const all = await prisma.user.findMany({
      include: {
        gameState: true,
        projects: { where: { isActive: true } },
      },
    })
    const ranked = all
      .filter(u => u.gameState && u.gameState.isOnboardingComplete)
      .map(u => {
        const active = u.projects.reduce((s, p) => s + p.currentValueRubles, 0)
        const wealth = (u.gameState!.balance + active)
        return {
          telegramId: u.telegramId,
          firstName: u.firstName,
          username: u.username,
          nickname: u.nickname,
          rank: u.gameState!.investorRank,
          wealth: Math.floor(wealth),
        }
      })
      .sort((a, b) => b.wealth - a.wealth)

    const topTen = ranked.slice(0, 10)
    const myIndex = ranked.findIndex(r => r.telegramId === String(tgUser.id))
    return {
      ...state,
      leaderboard: {
        top: topTen,
        myPosition: myIndex >= 0 ? myIndex + 1 : null,
        totalPlayers: ranked.length,
      },
    }
  })

  // POST /api/today/claim — забрать сегодняшнюю награду
  app.post('/api/today/claim', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })
    try {
      const result = await claimDaily(user.id)
      return { success: true, ...result }
    } catch (err: any) {
      if (err.message === 'ALREADY_CLAIMED') {
        return reply.status(400).send({ error: 'Награда уже получена сегодня' })
      }
      throw err
    }
  })
}
