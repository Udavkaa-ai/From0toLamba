import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/prisma'
import { telegramAuthHook } from '../../middleware/telegramAuth'
import { startSession, sendMessage, evaluateIntuition, getSessionMessages } from '../../game/AmaSessionService'
import { LieTopic } from '../../game/types'

export async function amaRoutes(app: FastifyInstance) {

  // POST /api/ama/:projectId/start — начать беседу
  app.post('/api/ama/:projectId/start', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    try {
      const gameState = await prisma.gameState.findUnique({ where: { userId: user.id } })
      const model = gameState?.preferredModel ?? 'deepseek/deepseek-chat-v3-0324'
      const result = await startSession(user.id, projectId, model)
      return result
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // GET /api/ama/:projectId — получить историю беседы
  app.get('/api/ama/:projectId', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }

    const session = await getSessionMessages(projectId)
    if (!session) {
      return reply.status(404).send({ error: 'Сессия не найдена' })
    }
    return session
  })

  // POST /api/ama/:projectId/message — отправить вопрос
  app.post('/api/ama/:projectId/message', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const tgUser = request.telegramUser

    const bodySchema = z.object({ message: z.string().min(1).max(500) })
    const body = bodySchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Неверный формат запроса' })
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    try {
      const gameState = await prisma.gameState.findUnique({ where: { userId: user.id } })
      const model = gameState?.preferredModel ?? 'deepseek/deepseek-chat-v3-0324'
      const result = await sendMessage(user.id, projectId, body.data.message, model)
      return result
    } catch (err: any) {
      if (err.message === 'SESSION_COMPLETE') {
        return reply.status(410).send({ error: 'Беседа завершена — вопросы исчерпаны' })
      }
      throw err
    }
  })

  // POST /api/ama/:projectId/evaluate-intuition — оценить Чуйку
  app.post('/api/ama/:projectId/evaluate-intuition', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const tgUser = request.telegramUser

    const bodySchema = z.object({
      selectedTopics: z.array(z.nativeEnum(LieTopic)),
    })
    const body = bodySchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Неверный формат запроса' })
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    try {
      const result = await evaluateIntuition(user.id, projectId, body.data.selectedTopics)
      return result
    } catch (err: any) {
      if (err.message === 'ALREADY_EVALUATED') {
        return reply.status(400).send({ error: 'Чуйка уже была оценена' })
      }
      throw err
    }
  })
}
