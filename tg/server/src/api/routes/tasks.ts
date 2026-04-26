import type { FastifyInstance } from 'fastify'
import { prisma } from '../../db/prisma'
import { telegramAuthHook } from '../../middleware/telegramAuth'
import { CHANNEL_TASKS } from '../../game/channelTasksConfig'

// Проверяем подписку через Telegram Bot API getChatMember
async function isSubscribedToChannel(telegramId: string, channelUsername: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false
  try {
    const url = `https://api.telegram.org/bot${token}/getChatMember?chat_id=@${channelUsername}&user_id=${telegramId}`
    const res = await fetch(url)
    const json = await res.json() as { ok: boolean; result?: { status: string } }
    if (!json.ok || !json.result) return false
    const { status } = json.result
    return ['creator', 'administrator', 'member', 'restricted'].includes(status)
  } catch (err) {
    console.error('[tasks] getChatMember error:', err)
    return false
  }
}

export async function tasksRoutes(app: FastifyInstance) {

  // GET /api/tasks/channels — список каналов с признаком claimed
  app.get('/api/tasks/channels', { preHandler: telegramAuthHook }, async (request) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
      include: { channelClaims: true },
    })

    const claimedIds = new Set(user.channelClaims.map(c => c.taskId))

    return CHANNEL_TASKS.map(task => ({
      id: task.id,
      channelTitle: task.channelTitle,
      channelLink: task.channelLink,
      description: task.description,
      rewardRubles: task.rewardRubles,
      claimed: claimedIds.has(task.id),
    }))
  })

  // POST /api/tasks/channels/:taskId/claim — проверить подписку и выдать награду
  app.post('/api/tasks/channels/:taskId/claim', { preHandler: telegramAuthHook }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const tgUser = request.telegramUser

    const task = CHANNEL_TASKS.find(t => t.id === taskId)
    if (!task) return reply.status(404).send({ error: 'Задание не найдено' })

    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
      include: { channelClaims: true, gameState: true },
    })

    if (user.channelClaims.some(c => c.taskId === taskId)) {
      return reply.status(409).send({ error: 'Награда уже получена' })
    }

    // Проверяем подписку
    const subscribed = await isSubscribedToChannel(String(tgUser.id), task.channelUsername)
    if (!subscribed) {
      return reply.status(403).send({ error: 'Подпишись на канал, чтобы получить награду' })
    }

    // Зачисляем
    await prisma.$transaction([
      prisma.channelClaim.create({ data: { userId: user.id, taskId } }),
      prisma.gameState.update({
        where: { userId: user.id },
        data: { balance: { increment: task.rewardRubles } },
      }),
    ])

    console.log(`[tasks] user=${user.id} claimed channel ${task.channelUsername} +${task.rewardRubles}₽`)

    return { success: true, rewardRubles: task.rewardRubles }
  })
}
