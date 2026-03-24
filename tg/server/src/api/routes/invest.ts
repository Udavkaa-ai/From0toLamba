import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/prisma'
import { telegramAuthHook } from '../../middleware/telegramAuth'
import { invest, partialWithdraw, exitProject } from '../../game/InvestService'

export async function investRoutes(app: FastifyInstance) {

  // POST /api/invest/:projectId — вложить рубли
  app.post('/api/invest/:projectId', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const tgUser = request.telegramUser

    const bodySchema = z.object({ amount: z.number().positive() })
    const body = bodySchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Неверный формат запроса' })
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    try {
      await invest(user.id, projectId, body.data.amount)
      return { success: true }
    } catch (err: any) {
      const errMap: Record<string, [number, string]> = {
        AMOUNT_TOO_SMALL: [400, 'Минимальное вложение — 5 ₽'],
        AMOUNT_TOO_LARGE: [400, 'Максимальное вложение — 5 000 ₽ на дело'],
        INSUFFICIENT_BALANCE: [400, 'Недостаточно рублей'],
        MAX_PROJECTS_REACHED: [400, 'Нельзя вести больше 5 дел одновременно'],
      }
      const mapped = errMap[err.message]
      if (mapped) return reply.status(mapped[0]).send({ error: mapped[1] })
      throw err
    }
  })

  // POST /api/invest/:projectId/withdraw — частичный вывод
  app.post('/api/invest/:projectId/withdraw', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const tgUser = request.telegramUser

    const bodySchema = z.object({ amount: z.number().positive() })
    const body = bodySchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Неверный формат запроса' })
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    try {
      const received = await partialWithdraw(user.id, projectId, body.data.amount)
      return { success: true, received }
    } catch (err: any) {
      const errMap: Record<string, [number, string]> = {
        WITHDRAWAL_LOCKED: [403, 'Вывод заблокирован — хозяин готовится к побегу 🔒'],
        EXCEEDS_LIMIT: [400, 'Превышен лимит вывода для этого типа дела'],
        EXCEEDS_CURRENT_VALUE: [400, 'Нельзя вывести больше, чем есть в деле'],
      }
      const mapped = errMap[err.message]
      if (mapped) return reply.status(mapped[0]).send({ error: mapped[1] })
      throw err
    }
  })

  // POST /api/invest/:projectId/exit — покинуть дело (вывести всё)
  app.post('/api/invest/:projectId/exit', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const tgUser = request.telegramUser

    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    try {
      const received = await exitProject(user.id, projectId)
      return { success: true, received }
    } catch (err: any) {
      if (err.message === 'WITHDRAWAL_LOCKED') {
        return reply.status(403).send({ error: 'Вывод заблокирован 🔒' })
      }
      throw err
    }
  })
}
