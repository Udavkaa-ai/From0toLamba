import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/prisma'
import { telegramAuthHook } from '../../middleware/telegramAuth'
// @ts-ignore
import leoProfanity from 'leo-profanity'
import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  defaultHeaders: {
    'HTTP-Referer': process.env.MINI_APP_URL ?? '',
    'X-Title': 'Iz gryazi v knyazi',
  },
})

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

    return sinceId > 0 ? messages : messages.reverse()
  })

  // POST /api/chat/message
  app.post('/api/chat/message', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const body = z.object({
      text: z.string().min(1).max(MAX_MSG_LENGTH),
      replyToId: z.number().int().positive().optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid message' })

    const { text, replyToId } = body.data
    const trimmed = text.trim()

    if (leoProfanity.check(trimmed)) {
      return reply.status(400).send({ error: 'PROFANITY' })
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { telegramId: String(tgUser.id) },
      include: { gameState: true },
    })

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

    // Snapshot reply context so it survives deletion of original
    let replyToText: string | null = null
    let replyToDisplayName: string | null = null
    if (replyToId) {
      const orig = await prisma.chatMessage.findUnique({ where: { id: replyToId } })
      if (orig && !orig.isDeleted) {
        replyToText = orig.text.slice(0, 100)
        replyToDisplayName = orig.displayName
      }
    }

    const message = await prisma.chatMessage.create({
      data: {
        userId: user.id, displayName, investorRank, text: trimmed,
        replyToId: replyToId ?? null,
        replyToText,
        replyToDisplayName,
      },
    })

    return message
  })

  // DELETE /api/chat/message/:id — soft-delete own message
  app.delete('/api/chat/message/:id', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const id = parseInt((request.params as { id: string }).id, 10)
    if (isNaN(id)) return reply.status(400).send({ error: 'Invalid id' })

    const user = await prisma.user.findUnique({ where: { telegramId: String(tgUser.id) } })
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const msg = await prisma.chatMessage.findUnique({ where: { id } })
    if (!msg) return reply.status(404).send({ error: 'Not found' })
    if (msg.userId !== user.id) return reply.status(403).send({ error: 'Forbidden' })

    await prisma.chatMessage.update({ where: { id }, data: { isDeleted: true } })
    return { ok: true }
  })

  // POST /api/chat/translate — перевести сообщение на русский
  app.post('/api/chat/translate', { preHandler: telegramAuthHook }, async (request, reply) => {
    const body = z.object({ text: z.string().min(1).max(MAX_MSG_LENGTH) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid text' })

    try {
      const completion = await openai.chat.completions.create({
        model: 'deepseek/deepseek-v4-flash',
        messages: [
          {
            role: 'system',
            content: 'Переведи текст на русский язык. Верни ТОЛЬКО перевод без пояснений и кавычек. Если текст уже на русском — верни его без изменений.',
          },
          { role: 'user', content: body.data.text },
        ],
        max_tokens: 300,
      })
      const translation = completion.choices[0]?.message?.content?.trim() ?? body.data.text
      return { translation }
    } catch {
      return reply.status(500).send({ error: 'Translation failed' })
    }
  })

  // PATCH /api/user/nickname
  app.patch('/api/user/nickname', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const body = z.object({ nickname: z.string().min(1).max(20).nullable() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid nickname' })

    const raw = body.data.nickname
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
