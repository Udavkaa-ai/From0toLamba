import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/prisma'
import { telegramAuthHook } from '../../middleware/telegramAuth'
// @ts-ignore
import leoProfanity from 'leo-profanity'

// Load Russian and English dictionaries
leoProfanity.loadDictionary('ru')
leoProfanity.add(leoProfanity.getDictionary('en'))

const MAX_MSG_LENGTH = 300
const RATE_LIMIT_SECONDS = 5
const MESSAGES_LIMIT = 60

export async function chatRoutes(app: FastifyInstance) {

  // GET /api/chat/messages?since=<id>
  app.get('/api/chat/messages', { preHandler: telegramAuthHook }, async (request) => {
    const query = request.query as { since?: string }
    const sinceId = query.since ? parseInt(query.since, 10) : 0

    const messages = await prisma.chatMessage.findMany({
      where: {
        isDeleted: false,
        ...(sinceId > 0 ? { id: { gt: sinceId } } : {}),
      },
      orderBy: { createdAt: sinceId > 0 ? 'asc' : 'desc' },
      take: MESSAGES_LIMIT,
    })

    // When fetching initial batch (no since), reverse to get oldest first
    return sinceId > 0 ? messages : messages.reverse()
  })

  // POST /api/chat/message
  app.post('/api/chat/message', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const body = z.object({ text: z.string().min(1).max(MAX_MSG_LENGTH) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid message' })

    const text = body.data.text.trim()

    // Anti-profanity check — auto-reject
    if (leoProfanity.check(text)) {
      return reply.status(400).send({ error: 'PROFANITY' })
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
      include: { gameState: true },
    })

    // Rate limit: no more than 1 message per RATE_LIMIT_SECONDS
    const recent = await prisma.chatMessage.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    if (recent) {
      const elapsed = Date.now() - recent.createdAt.getTime()
      if (elapsed < RATE_LIMIT_SECONDS * 1000) {
        return reply.status(429).send({ error: 'RATE_LIMIT', retryAfter: Math.ceil((RATE_LIMIT_SECONDS * 1000 - elapsed) / 1000) })
      }
    }

    const displayName = user.nickname ?? user.firstName
    const investorRank = user.gameState?.investorRank ?? 'NEWBIE'

    const message = await prisma.chatMessage.create({
      data: { userId: user.id, displayName, investorRank, text },
    })

    return message
  })

  // PATCH /api/user/nickname
  app.patch('/api/user/nickname', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const body = z.object({ nickname: z.string().min(1).max(20).nullable() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid nickname' })

    const raw = body.data.nickname
    // Allow null (reset to Telegram name), otherwise validate charset
    if (raw !== null) {
      const valid = /^[a-zA-Zа-яёА-ЯЁ0-9 \-_.]{1,20}$/.test(raw)
      if (!valid) return reply.status(400).send({ error: 'INVALID_CHARS' })
      if (leoProfanity.check(raw)) return reply.status(400).send({ error: 'PROFANITY' })
    }

    const user = await prisma.user.update({
      where: { telegramId: String(tgUser.id) },
      data: { nickname: raw },
    })

    return { nickname: user.nickname }
  })
}
