import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/prisma'
import { telegramAuthHook } from '../../middleware/telegramAuth'

// Минимальная валидация TON-адреса. Friendly-form (EQ.../UQ...) — 48 символов
// base64url. Raw-form (0:hex) — 66 символов. Допускаем оба, без жёсткого
// HMAC-разбора — TON Connect SDK на клиенте уже отдаёт валидный адрес.
const TON_ADDRESS_RE = /^(?:[EU]Q[A-Za-z0-9_-]{46}|-?\d:[0-9a-fA-F]{64})$/

const TON_CONNECT_BONUS = 200

const connectBodySchema = z.object({
  address: z.string().min(48).max(80),
})

export async function walletRoutes(app: FastifyInstance) {

  /**
   * POST /api/wallet/connect — привязать TON-кошелёк к юзеру (после
   * успешного TonConnectUI.connector.onStatusChange на клиенте).
   * Первое подключение → бонус +200 г и tonConnectBonusGranted=true.
   * Повторные вызовы (например, переподключение того же кошелька) — без бонуса.
   */
  app.post('/api/wallet/connect', { preHandler: telegramAuthHook }, async (request, reply) => {
    const parsed = connectBodySchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_BODY' })
    const { address } = parsed.data
    if (!TON_ADDRESS_RE.test(address)) return reply.code(400).send({ error: 'INVALID_ADDRESS' })

    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })

    // Если бонус уже выдан — просто обновляем адрес (юзер мог сменить кошелёк).
    if (user.tonConnectBonusGranted) {
      if (user.tonWallet !== address) {
        await prisma.user.update({ where: { id: user.id }, data: { tonWallet: address } })
      }
      return { bonusGranted: false, address }
    }

    // Первое подключение — атомарно: адрес + флаг + balance += 200.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { tonWallet: address, tonConnectBonusGranted: true },
      }),
      prisma.gameState.update({
        where: { userId: user.id },
        data: { balance: { increment: TON_CONNECT_BONUS } },
      }),
    ])

    return { bonusGranted: true, bonusAmount: TON_CONNECT_BONUS, address }
  })

  /**
   * POST /api/wallet/disconnect — отвязать кошелёк (юзер нажал «Disconnect»
   * в TonConnectButton). Бонус НЕ возвращается обратно.
   */
  app.post('/api/wallet/disconnect', { preHandler: telegramAuthHook }, async (request) => {
    const tgUser = request.telegramUser
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tgUser.id) } })
    if (user.tonWallet) {
      await prisma.user.update({ where: { id: user.id }, data: { tonWallet: null } })
    }
    return { ok: true }
  })

  /**
   * GET /api/wallet/donate-address — куда слать донат. Адрес лежит в
   * TON_DONATE_ADDRESS env-var; если не задан, клиент скрывает кнопку доната.
   */
  app.get('/api/wallet/donate-address', { preHandler: telegramAuthHook }, async () => {
    return { address: process.env.TON_DONATE_ADDRESS ?? null }
  })
}
