import Fastify from 'fastify'
import cors from '@fastify/cors'
import compress from '@fastify/compress'
import staticFiles from '@fastify/static'
import path from 'path'

import { gameRoutes } from './api/routes/game'
import { projectRoutes } from './api/routes/projects'
import { amaRoutes } from './api/routes/ama'
import { charterRoutes } from './api/routes/charter'
import { investRoutes } from './api/routes/invest'
import { createWebhookHandler, getBot } from './bot/bot'
import { startDailyScheduler } from './scheduler/dailyJob'
import { prisma } from './db/prisma'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  },
})

async function main() {
  await app.register(compress, { global: true })

  // CORS — разрешаем Mini App origin
  await app.register(cors, {
    origin: [
      process.env.MINI_APP_URL ?? 'http://localhost:5173',
      'https://web.telegram.org',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Telegram-Init-Data'],
  })

  // API routes
  await app.register(gameRoutes)
  await app.register(projectRoutes)
  await app.register(amaRoutes)
  await app.register(charterRoutes)
  await app.register(investRoutes)

  // Telegram webhook
  const webhookSecret = process.env.TELEGRAM_BOT_TOKEN?.split(':')[0]
  app.post(
    `/bot/webhook`,
    { config: { rawBody: true } },
    createWebhookHandler(),
  )

  // Health check
  app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }))

  // Version endpoint — клиент сравнивает и перезагружается если устарел
  app.get('/api/version', async () => ({ version: '1.6.2' }))

  // Статика клиента (SPA)
  const publicDir = path.join(__dirname, '..', 'public')
  await app.register(staticFiles, {
    root: publicDir,
    prefix: '/',
    wildcard: false,
    setHeaders: (res: any, filePath: string) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
      }
    },
  })
  // SPA fallback — все неизвестные GET → index.html
  app.setNotFoundHandler(async (req, reply) => {
    if (req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/bot')) {
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate')
      return reply.sendFile('index.html', publicDir)
    }
    reply.code(404).send({ message: `Route ${req.method}:${req.url} not found`, error: 'Not Found', statusCode: 404 })
  })

  // Graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'] as const
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`[Server] ${signal} received — shutting down`)
      await app.close()
      await prisma.$disconnect()
      process.exit(0)
    })
  }

  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`[Server] Running on port ${port}`)

  // Запускаем scheduler только в production
  if (process.env.NODE_ENV === 'production') {
    startDailyScheduler()

    // Регистрируем webhook у Telegram
    const miniAppUrl = process.env.MINI_APP_URL ?? ''
    if (miniAppUrl) {
      try {
        const bot = getBot()
        await bot.api.setWebhook(`${miniAppUrl}/bot/webhook`)
        console.log('[Bot] Webhook registered')
      } catch (err) {
        console.error('[Bot] Failed to register webhook:', err)
      }
    }
  } else {
    // В dev режиме — long polling
    console.log('[Bot] Starting long polling (dev mode)...')
    const bot = getBot()
    bot.start().catch(console.error)
  }
}

main().catch(err => {
  console.error('[Server] Fatal error:', err)
  process.exit(1)
})
