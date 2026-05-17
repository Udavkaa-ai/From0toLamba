import type { FastifyInstance } from 'fastify'
import { telegramAuthHook } from '../../middleware/telegramAuth'
import { prisma } from '../../db/prisma'
import { verifyPromocode } from '../../game/sponsorService'

export async function sponsorRoutes(app: FastifyInstance) {
  // POST /api/sponsor/:projectId/verify { promocode } → { ok: boolean }
  // Принимает промокод от игрока, сравнивает с БД (case-insensitive).
  // При успехе ставит sponsorPromoVerified=true — после этого можно
  // инвестировать без мини-игры.
  app.post<{ Params: { projectId: string }; Body: { promocode?: string } }>(
    '/api/sponsor/:projectId/verify',
    { preHandler: telegramAuthHook },
    async (request, reply) => {
      const tgUser = request.telegramUser
      const user = await prisma.user.findUnique({
        where: { telegramId: String(tgUser.id) },
        select: { id: true },
      })
      if (!user) return reply.status(404).send({ error: 'NOT_FOUND' })

      const { projectId } = request.params
      const promocode = (request.body?.promocode ?? '').toString()
      if (!promocode.trim()) return reply.send({ ok: false })

      const ok = await verifyPromocode(projectId, user.id, promocode)
      return reply.send({ ok })
    },
  )
}
