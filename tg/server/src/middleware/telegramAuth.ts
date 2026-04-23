import { createHmac } from 'crypto'
import type { FastifyRequest, FastifyReply } from 'fastify'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

// Добавляем telegramUser к типу FastifyRequest
declare module 'fastify' {
  interface FastifyRequest {
    telegramUser: TelegramUser
    telegramStartParam: string | null
  }
}

/**
 * Верифицирует Telegram WebApp initData по HMAC и вытаскивает startParam.
 * Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(initData: string, botToken: string):
  { user: TelegramUser; startParam: string | null } | null {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null

    // Собираем строку для проверки: все поля кроме hash, отсортированные по ключу
    params.delete('hash')
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    // HMAC-SHA256: key = HMAC-SHA256("WebAppData", botToken)
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
    const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    if (expectedHash !== hash) return null

    // Проверяем актуальность (не старше 24 часов)
    const authDate = Number(params.get('auth_date'))
    if (Date.now() / 1000 - authDate > 86400) return null

    const userRaw = params.get('user')
    if (!userRaw) return null

    return {
      user: JSON.parse(userRaw) as TelegramUser,
      startParam: params.get('start_param'),
    }
  } catch {
    return null
  }
}

/**
 * Fastify preHandler hook — проверяет initData из заголовка X-Telegram-Init-Data.
 * Кидает 401 если данные невалидны.
 */
export async function telegramAuthHook(request: FastifyRequest, reply: FastifyReply) {
  const initData = request.headers['x-telegram-init-data'] as string | undefined

  if (!initData) {
    return reply.status(401).send({ error: 'Missing X-Telegram-Init-Data header' })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return reply.status(500).send({ error: 'Bot token not configured' })
  }

  // В dev-режиме можно пропустить реальную валидацию (для локального тестирования)
  if (process.env.NODE_ENV === 'development' && initData === 'dev') {
    request.telegramUser = { id: 1, first_name: 'Dev', username: 'devuser' }
    request.telegramStartParam = null
    return
  }

  const result = validateTelegramInitData(initData, botToken)
  if (!result) {
    return reply.status(401).send({ error: 'Invalid Telegram initData' })
  }

  request.telegramUser = result.user
  request.telegramStartParam = result.startParam
}
