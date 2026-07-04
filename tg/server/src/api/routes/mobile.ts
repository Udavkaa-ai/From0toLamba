import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import OpenAI from 'openai'
import { prisma } from '../../db/prisma'

/**
 * Роуты для Android-приложения (без Telegram-авторизации).
 *
 * Доступ по общему секрету X-App-Key (MOBILE_APP_KEY в env) — лёгкий
 * барьер против случайных запросов; ключ можно ротировать, не трогая
 * серверный OPENROUTER_API_KEY, который в APK не попадает.
 *
 *  POST /api/mobile/chat     — прокси к OpenRouter chat/completions
 *  POST /api/mobile/feedback — заметка тестера в Postgres
 */

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  defaultHeaders: {
    'HTTP-Referer': process.env.MINI_APP_URL ?? '',
    'X-Title': 'Iz gryazi v knyazi (android)',
  },
})

const ALLOWED_MODELS = new Set([
  'deepseek/deepseek-v4-flash',
  'deepseek/deepseek-chat-v3-0324',
  'google/gemini-2.5-flash-lite-preview-09-2025',
  'qwen/qwen3.5-flash-02-23',
])
const FALLBACK_MODEL = 'deepseek/deepseek-chat-v3-0324'

const chatSchema = z.object({
  model: z.string().optional(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).min(1),
  max_tokens: z.number().int().positive().max(1000).optional(),
  temperature: z.number().min(0).max(2).optional(),
})

const feedbackSchema = z.object({
  nickname: z.string().max(40).nullish(),
  type: z.enum(['BUG', 'SUGGESTION', 'QUESTION']),
  page: z.string().max(80).nullish(),
  message: z.string().min(1).max(2000),
  appVersion: z.string().max(40).nullish(),
  platform: z.string().max(20).default('android'),
})

function requireAppKey(request: any, reply: any): boolean {
  const expected = process.env.MOBILE_APP_KEY
  // Если ключ на сервере не задан — прокси открыт (удобно для локалки),
  // но в проде обязательно выставить MOBILE_APP_KEY.
  if (!expected) return true
  const got = request.headers['x-app-key']
  if (got !== expected) {
    reply.status(401).send({ error: 'Invalid app key' })
    return false
  }
  return true
}

export async function mobileRoutes(app: FastifyInstance) {

  app.post('/api/mobile/chat', async (request, reply) => {
    if (!requireAppKey(request, reply)) return
    const parsed = chatSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad request', details: parsed.error.issues })
    }
    const { model, messages, max_tokens, temperature } = parsed.data
    const useModel = model && ALLOWED_MODELS.has(model) ? model : FALLBACK_MODEL

    try {
      const completion = await openrouter.chat.completions.create({
        model: useModel,
        messages: messages as any,
        max_tokens: max_tokens ?? 200,
        temperature: temperature ?? 0.85,
      })
      // Возвращаем ровно тот формат, что ждёт Android-клиент (choices[].message)
      return { choices: completion.choices.map((c) => ({ message: { role: c.message.role, content: c.message.content ?? '' } })) }
    } catch (err: any) {
      request.log.error({ err }, 'mobile chat failed')
      return reply.status(502).send({ error: 'AI upstream error' })
    }
  })

  app.post('/api/mobile/feedback', async (request, reply) => {
    if (!requireAppKey(request, reply)) return
    const parsed = feedbackSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad request', details: parsed.error.issues })
    }
    const f = parsed.data
    await prisma.feedback.create({
      data: {
        nickname: f.nickname ?? null,
        type: f.type,
        page: f.page ?? null,
        message: f.message,
        appVersion: f.appVersion ?? null,
        platform: f.platform,
      },
    })
    return { ok: true }
  })
}
