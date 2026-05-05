import type { FastifyInstance } from 'fastify'
import { prisma } from '../../db/prisma'

export async function publicRoutes(app: FastifyInstance) {

  // GET /api/public/check-player?tg_user_id=<ID>
  // Публичный эндпоинт без авторизации — для партнёрских коллабораций.
  // Возвращает базовую информацию о прогрессе игрока.
  app.get('/api/public/check-player', async (request, reply) => {
    const { tg_user_id } = request.query as { tg_user_id?: string }

    if (!tg_user_id || !/^\d+$/.test(tg_user_id)) {
      return reply.status(400).send({ error: 'tg_user_id is required and must be numeric' })
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: tg_user_id },
      include: { gameState: true },
    })

    if (!user || !user.gameState) {
      return { exists: false, onboarding_complete: false }
    }

    return {
      exists: true,
      onboarding_complete: user.gameState.isOnboardingComplete,
      utm_source: user.utmSource ?? null,
    }
  })

  // GET /api/public/partner-stats?utm_source=utm_gk
  // Агрегатная статистика по партнёрскому UTM-источнику.
  // Аналог "Player Statistics" в партнёрских дашбордах (Gift Kombat и др.).
  app.get('/api/public/partner-stats', async (request, reply) => {
    const { utm_source } = request.query as { utm_source?: string }

    if (!utm_source) {
      return reply.status(400).send({ error: 'utm_source is required' })
    }

    const users = await prisma.user.findMany({
      where: { utmSource: utm_source },
      include: { gameState: true },
    })

    const total = users.length
    const active = users.filter(u => u.gameState?.isOnboardingComplete).length
    const experienced = users.filter(u =>
      u.gameState && ['ANALYST', 'SHARK', 'LAMBO_SENSEI'].includes(u.gameState.investorRank)
    ).length
    const totalIntuition = users.reduce((s, u) => s + (u.gameState?.intuitionScore ?? 0), 0)
    const totalWealth = users.reduce((s, u) => s + (u.gameState?.balance ?? 0), 0)
    const avgWealth = total > 0 ? Math.floor(totalWealth / total) : 0

    return {
      partner: utm_source,
      total_players: total,
      active_players: active,           // прошли онбординг
      experienced_players: experienced, // достигли чина Мудрец и выше
      total_intuition_score: totalIntuition,
      avg_balance_groshy: avgWealth,
    }
  })
}
