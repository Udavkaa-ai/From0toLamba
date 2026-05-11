import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/prisma'
import { telegramAuthHook } from '../../middleware/telegramAuth'
import { startCharter, getCharter, submitCharter, submitMiniGame } from '../../game/CharterService'
import { checkAndGrantReferralBonus } from '../../game/referralService'

export async function charterRoutes(app: FastifyInstance) {

  // POST /api/charter/:projectId/start — создать грамоту (или вернуть существующую)
  app.post('/api/charter/:projectId/start', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
      include: { gameState: true },
    })
    const rank = user.gameState?.investorRank ?? 'NEWBIE'

    try {
      const view = await startCharter(user.id, projectId, rank)
      return view
    } catch (err: any) {
      if (err.message === 'CHARTER_EXPIRED') {
        return reply.status(410).send({ error: 'Эта грамота истекла', code: 'CHARTER_EXPIRED' })
      }
      return reply.status(400).send({ error: err.message })
    }
  })

  // GET /api/charter/:projectId — получить состояние грамоты (или 404)
  app.get('/api/charter/:projectId', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
      include: { gameState: true },
    })
    const rank = user.gameState?.investorRank ?? 'NEWBIE'

    try {
      const view = await getCharter(user.id, projectId, rank)
      if (!view) return reply.status(404).send({ error: 'Грамота ещё не открыта' })
      return view
    } catch (err: any) {
      if (err.message === 'CHARTER_EXPIRED') {
        return reply.status(410).send({ error: 'Эта грамота истекла', code: 'CHARTER_EXPIRED' })
      }
      throw err
    }
  })

  // POST /api/charter/:projectId/submit-minigame — сабмит результата мини-игры (не-BOYARIN)
  app.post('/api/charter/:projectId/submit-minigame', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const tgUser = request.telegramUser

    const bodySchema = z.object({ won: z.boolean() })
    const body = bodySchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Неверный формат запроса' })
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    try {
      const result = await submitMiniGame(user.id, projectId, body.data.won)
      checkAndGrantReferralBonus(user.id).catch(console.error)
      return result
    } catch (err: any) {
      if (err.message === 'ALREADY_SUBMITTED') {
        return reply.status(400).send({ error: 'Грамота уже проверена' })
      }
      if (err.message === 'NO_CHARTER') {
        return reply.status(400).send({ error: 'Грамота не открыта' })
      }
      if (err.message === 'FORBIDDEN') {
        return reply.status(403).send({ error: 'Нет доступа' })
      }
      throw err
    }
  })

  // POST /api/charter/:projectId/submit — сабмит выбранных подделок, оценка чуйки
  app.post('/api/charter/:projectId/submit', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const tgUser = request.telegramUser

    const bodySchema = z.object({
      selectedIndices: z.array(z.number().int().nonnegative()).max(64),
    })
    const body = bodySchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Неверный формат запроса' })
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    try {
      const result = await submitCharter(user.id, projectId, body.data.selectedIndices)
      // Проверяем реферальный бонус — мог дозреть после этой грамоты
      checkAndGrantReferralBonus(user.id).catch(console.error)
      return result
    } catch (err: any) {
      if (err.message === 'ALREADY_SUBMITTED') {
        return reply.status(400).send({ error: 'Грамота уже проверена' })
      }
      if (err.message === 'NO_CHARTER') {
        return reply.status(400).send({ error: 'Грамота не открыта' })
      }
      if (err.message === 'FORBIDDEN') {
        return reply.status(403).send({ error: 'Нет доступа' })
      }
      throw err
    }
  })
}
