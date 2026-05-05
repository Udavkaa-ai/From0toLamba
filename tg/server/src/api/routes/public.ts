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
    }
  })
}
