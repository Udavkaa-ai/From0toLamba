import { createHash, createHmac } from 'crypto'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

// Добавляем telegramUser и authSource к типу FastifyRequest.
// authSource = 'telegram' | 'android' — позволяет роутам отличать источник
// если нужна разная логика (например, отключить TON-донат для Android).
declare module 'fastify' {
  interface FastifyRequest {
    telegramUser: TelegramUser
    telegramStartParam: string | null
    authSource: 'telegram' | 'android'
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
 * Превращает Android device-id (строка ≥ 8 символов) в стабильный numeric ID
 * в отрицательном диапазоне ([-2^47, -1]). Telegram IDs всегда положительные,
 * поэтому коллизии исключены — Android-юзер живёт со своим уникальным числом
 * в той же таблице User.telegramId. 48 бит SHA-256 → шанс коллизии ~10^-14
 * при миллионе устройств, для нашего масштаба избыточно надёжно.
 */
export function deviceIdToTelegramId(deviceId: string): number {
  const hash = createHash('sha256').update(deviceId).digest()
  // readUIntBE(0, 6) = 48-битное unsigned число. Делаем отрицательным.
  return -1 * hash.readUIntBE(0, 6)
}

const ANDROID_FALLBACK_FIRSTNAME = 'Купец'
const MIN_DEVICE_ID_LENGTH = 8
const MAX_DEVICE_ID_LENGTH = 128

/**
 * Fastify preHandler hook — принимает ОДИН из двух способов авторизации:
 *
 *   1) X-Telegram-Init-Data — стандартный Telegram WebApp initData (HMAC-валидация).
 *   2) X-Android-Device-Id  — device-id Android-клиента (UUID/ANDROID_ID, длина 8..128).
 *      Middleware апсёртит User по этому device-id и подставляет стабильный
 *      numeric ID в request.telegramUser, чтобы дальнейшие роуты работали без правок.
 *
 * Источник доступен в request.authSource: 'telegram' | 'android'.
 */
export async function telegramAuthHook(request: FastifyRequest, reply: FastifyReply) {
  const initData = request.headers['x-telegram-init-data'] as string | undefined
  const androidDeviceId = request.headers['x-android-device-id'] as string | undefined

  if (androidDeviceId) {
    // Санитайз: только printable ASCII без пробелов, ограниченная длина.
    if (
      androidDeviceId.length < MIN_DEVICE_ID_LENGTH ||
      androidDeviceId.length > MAX_DEVICE_ID_LENGTH ||
      !/^[A-Za-z0-9_\-]+$/.test(androidDeviceId)
    ) {
      return reply.status(401).send({ error: 'Invalid X-Android-Device-Id header' })
    }

    const numericId = deviceIdToTelegramId(androidDeviceId)
    const telegramIdStr = String(numericId)

    // Гарантируем существование User для этого device-id. Используем
    // androidDeviceId как ключ (он @unique), чтобы при первом контакте
    // создать User со стабильным telegramId-хэшем.
    await prisma.user.upsert({
      where: { androidDeviceId },
      create: {
        telegramId: telegramIdStr,
        androidDeviceId,
        firstName: ANDROID_FALLBACK_FIRSTNAME,
      },
      update: {},
    })

    request.telegramUser = {
      id: numericId,
      first_name: ANDROID_FALLBACK_FIRSTNAME,
      language_code: (request.headers['accept-language'] as string | undefined)?.startsWith('ru') ? 'ru' : 'en',
    }
    request.telegramStartParam = null
    request.authSource = 'android'
    return
  }

  if (!initData) {
    return reply.status(401).send({ error: 'Missing X-Telegram-Init-Data or X-Android-Device-Id header' })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return reply.status(500).send({ error: 'Bot token not configured' })
  }

  // В dev-режиме можно пропустить реальную валидацию (для локального тестирования)
  if (process.env.NODE_ENV === 'development' && initData === 'dev') {
    request.telegramUser = { id: 1, first_name: 'Dev', username: 'devuser' }
    request.telegramStartParam = null
    request.authSource = 'telegram'
    return
  }

  const result = validateTelegramInitData(initData, botToken)
  if (!result) {
    return reply.status(401).send({ error: 'Invalid Telegram initData' })
  }

  request.telegramUser = result.user
  request.telegramStartParam = result.startParam
  request.authSource = 'telegram'
}
