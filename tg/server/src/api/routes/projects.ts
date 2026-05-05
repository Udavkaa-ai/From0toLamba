import type { FastifyInstance } from 'fastify'
import { prisma } from '../../db/prisma'
import { telegramAuthHook } from '../../middleware/telegramAuth'
import { toPublicDTO } from '../../game/projectUtils'

export async function projectRoutes(app: FastifyInstance) {

  // GET /api/projects/inbox — входящие грамоты
  app.get('/api/projects/inbox', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    const projects = await prisma.project.findMany({
      where: { userId: user.id, isInbox: true },
      orderBy: { createdAt: 'desc' },
    })

    return projects.map(toPublicDTO)
  })

  // GET /api/projects/portfolio — казна (активные + закрытые)
  app.get('/api/projects/portfolio', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    const [active, closed] = await Promise.all([
      prisma.project.findMany({
        where: { userId: user.id, isActive: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.findMany({
        where: {
          userId: user.id,
          isClosed: true,
          investedAmountRubles: { gt: 0 }, // только дела с реальным вложением попадают в Летопись
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: { postMortem: true },
      }),
    ])

    return {
      active: active.map(toPublicDTO),
      closed: closed.map(p => ({
        ...toPublicDTO(p),
        postMortem: p.postMortem
          ? {
              revealedArchetype: p.postMortem.revealedArchetype,
              fate: p.postMortem.fate,
              lieTopics: p.postMortem.lieTopics,
              analysis: p.postMortem.analysis,
              investedAmount: p.postMortem.investedAmount,
              returnedAmount: p.postMortem.returnedAmount,
              profitPercent: p.postMortem.profitPercent,
              daysActive: p.postMortem.daysActive,
              intuitionDelta: p.postMortem.intuitionDelta,
            }
          : null,
      })),
    }
  })

  // GET /api/projects/:id/updates — вести о проекте
  app.get('/api/projects/:id/updates', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    const updates = await prisma.dailyUpdate.findMany({
      where: { projectId: id, userId: user.id },
      orderBy: { day: 'desc' },
      take: 20,
    })

    return updates
  })

  // POST /api/projects/:id/skip — пропустить дело из Inbox
  app.post('/api/projects/:id/skip', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    await prisma.project.updateMany({
      where: { id, userId: user.id, isInbox: true },
      data: { isInbox: false, isClosed: true, closureReason: 'Пропущено' },
    })

    return { success: true }
  })

  // GET /api/projects/transactions — история движения средств
  app.get('/api/projects/transactions', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return transactions
  })
}
