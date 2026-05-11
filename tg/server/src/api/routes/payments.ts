import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '../../db/prisma'
import { telegramAuthHook } from '../../middleware/telegramAuth'
import { createTimerSkipInvoice, createAmaUnlockInvoice, createExtraSlotInvoice, createMinigameBypassInvoice } from '../../bot/bot'
import { advanceDay } from '../../game/AdvanceDayService'

const STARS_AMOUNT = 10

// PAYMENTS_ENABLED=true в .env включает реальные Telegram Stars-платежи.
// По умолчанию false — разработка проходит без реальной оплаты.
const paymentsEnabled = process.env.PAYMENTS_ENABLED === 'true'

export async function paymentsRoutes(app: FastifyInstance) {

  // POST /api/payments/invoice — создать инвойс-ссылку для Mini App
  // Если PAYMENTS_ENABLED != true — сразу активируем фичу и возвращаем invoiceLink: null
  app.post('/api/payments/invoice', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const bodySchema = z.object({
      feature: z.enum(['timer_skip', 'ama_unlock', 'extra_slot', 'minigame_bypass']),
      projectId: z.string().optional(),
      merchantName: z.string().optional(),
    })
    const body = bodySchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Неверный запрос' })

    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    if (!paymentsEnabled) {
      // Бесплатный режим разработки — активируем сразу
      const activationResult = await activateFeature(user.id, body.data.feature, body.data.projectId)
      return { invoiceLink: null, ...activationResult }
    }

    const uuid = randomUUID()
    let payload: string
    let invoiceLink: string

    if (body.data.feature === 'timer_skip') {
      payload = `ts:${uuid}`
      invoiceLink = await createTimerSkipInvoice(user.id, payload)
    } else if (body.data.feature === 'extra_slot') {
      payload = `es:${uuid}`
      invoiceLink = await createExtraSlotInvoice(user.id, payload)
    } else if (body.data.feature === 'minigame_bypass') {
      payload = `mb:${uuid}`
      invoiceLink = await createMinigameBypassInvoice(user.id, payload)
    } else {
      const projectId = body.data.projectId
      if (!projectId) return reply.status(400).send({ error: 'projectId обязателен для ama_unlock' })
      payload = `au:${uuid}:${projectId}`
      const merchantName = body.data.merchantName ?? 'дельцом'
      invoiceLink = await createAmaUnlockInvoice(merchantName, user.id, payload)
    }

    // Сохраняем запись для аудита и возможных возвратов
    const purchaseProjectId =
      body.data.feature === 'extra_slot' || body.data.feature === 'minigame_bypass'
        ? null
        : (body.data.projectId ?? null)
    await prisma.starPurchase.create({
      data: {
        userId: user.id,
        feature: body.data.feature,
        projectId: purchaseProjectId,
        starsAmount: STARS_AMOUNT,
        payload,
      },
    })

    return { invoiceLink }
  })

  // POST /api/payments/activate — активировать фичу после успешной оплаты
  // Вызывается клиентом сразу после callback "paid" от Telegram.WebApp.openInvoice
  app.post('/api/payments/activate', { preHandler: telegramAuthHook }, async (request, reply) => {
    const tgUser = request.telegramUser
    const bodySchema = z.object({
      feature: z.enum(['timer_skip', 'ama_unlock', 'extra_slot', 'minigame_bypass']),
      projectId: z.string().optional(),
    })
    const body = bodySchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Неверный запрос' })

    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })
    const result = await activateFeature(user.id, body.data.feature, body.data.projectId)
    return result
  })
}

async function activateFeature(userId: number, feature: string, projectId?: string) {
  if (feature === 'timer_skip') {
    const result = await advanceDay(userId, { bypassCooldown: true })
    return { success: true, newRank: result.newRank ?? null, closures: [] }
  }

  if (feature === 'ama_unlock') {
    if (!projectId) throw new Error('projectId обязателен')
    await prisma.project.findFirstOrThrow({ where: { id: projectId, userId } })

    const existing = await prisma.amaSession.findUnique({ where: { projectId } })
    if (existing) {
      await prisma.amaSession.update({ where: { projectId }, data: { isPaid: true } })
    } else {
      await prisma.amaSession.create({ data: { projectId, userId, isPaid: true } })
    }
    return { success: true }
  }

  if (feature === 'extra_slot') {
    await prisma.gameState.update({ where: { userId }, data: { extraSlotsBalance: { increment: 1 } } })
    return { success: true }
  }

  if (feature === 'minigame_bypass') {
    // Одноразовый пропуск — БД не трогаем. Клиент после success открывает InvestSheet.
    return { success: true }
  }

  throw new Error('Неизвестная фича')
}
