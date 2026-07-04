import Fastify from 'fastify'
import cors from '@fastify/cors'
import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'
import { z } from 'zod'

/**
 * Отдельный мини-бэкенд для Android-версии «Из грязи в князи».
 *
 * Зачем отдельный сервис: чтобы не касаться TG-сервера и его базы с
 * живыми игроками. Здесь своя маленькая Postgres (одна таблица Feedback)
 * и свой доступ к OpenRouter.
 *
 *   POST /api/mobile/chat      — прокси к OpenRouter chat/completions
 *   POST /api/mobile/feedback  — заметка тестера в Postgres
 *   GET  /admin/feedback       — веб-выгрузка заметок (лента + CSV)
 *   GET  /health               — проверка живости
 *
 * Допуск к /api/mobile/* и /admin/* — общий секрет MOBILE_APP_KEY
 * (заголовок X-App-Key или ?key= для admin). Ключ OpenRouter в APK не
 * попадает — живёт только здесь, в env.
 */

const prisma = new PrismaClient()

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_REFERER ?? 'https://from0tolamba',
    'X-Title': 'Iz gryazi v knyazi (android)',
  },
})

// Только реальные ID OpenRouter (несуществующий пробрасывается наверх и даёт
// ошибку). Модель, которую клиент не в whitelist, заменяется на FALLBACK.
const ALLOWED_MODELS = new Set([
  'deepseek/deepseek-chat-v3-0324',
  'deepseek/deepseek-v3.2',
  'google/gemini-3.1-flash-lite-preview',
])
const FALLBACK_MODEL = 'deepseek/deepseek-chat-v3-0324'

const chatSchema = z.object({
  model: z.string().optional(),
  messages: z.array(z.object({ role: z.string(), content: z.string() })).min(1),
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

function checkKey(got: unknown): boolean {
  const expected = process.env.MOBILE_APP_KEY
  if (!expected) return true // ключ не задан — открыто (удобно для локалки)
  return got === expected
}

async function main() {
  const app = Fastify({ logger: { level: 'info' } })

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-App-Key'],
  })

  app.get('/health', async () => ({ ok: true }))

  app.post('/api/mobile/chat', async (request, reply) => {
    if (!checkKey(request.headers['x-app-key'])) {
      return reply.status(401).send({ error: 'Invalid app key' })
    }
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
      return {
        choices: completion.choices.map((c) => ({
          message: { role: c.message.role, content: c.message.content ?? '' },
        })),
      }
    } catch (err: any) {
      request.log.error({ err }, 'mobile chat failed')
      return reply.status(502).send({ error: 'AI upstream error' })
    }
  })

  app.post('/api/mobile/feedback', async (request, reply) => {
    if (!checkKey(request.headers['x-app-key'])) {
      return reply.status(401).send({ error: 'Invalid app key' })
    }
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

  // Веб-выгрузка. ?key=... (тот же MOBILE_APP_KEY), ?type=BUG, ?format=csv
  app.get('/admin/feedback', async (request, reply) => {
    const q = request.query as { key?: string; type?: string; format?: string }
    if (!checkKey(q.key)) {
      return reply.status(401).type('text/plain').send('Invalid key')
    }
    const where = q.type && ['BUG', 'SUGGESTION', 'QUESTION'].includes(q.type)
      ? { type: q.type }
      : {}
    const rows = await prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    if (q.format === 'csv') {
      const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const header = 'createdAt,type,nickname,page,appVersion,message'
      const body = rows
        .map((r) =>
          [r.createdAt.toISOString(), r.type, r.nickname, r.page, r.appVersion, r.message]
            .map(esc)
            .join(','),
        )
        .join('\n')
      return reply
        .type('text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="feedback.csv"')
        .send(header + '\n' + body)
    }

    return reply.type('text/html; charset=utf-8').send(renderPage(rows, q.type, q.key ?? ''))
  })

  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`mobile-backend on :${port}`)
}

function renderPage(rows: any[], activeType: string | undefined, key: string): string {
  const esc = (v: any) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const badge = (t: string) => {
    const c = t === 'BUG' ? '#e05353' : t === 'SUGGESTION' ? '#4caf50' : '#8ab4f8'
    const label = t === 'BUG' ? '🐞 Баг' : t === 'SUGGESTION' ? '💡 Идея' : '❓ Вопрос'
    return `<span style="background:${c}22;color:${c};border:1px solid ${c}66;border-radius:10px;padding:2px 8px;font-size:12px;white-space:nowrap">${label}</span>`
  }
  const link = (t: string, txt: string) => {
    const active = (activeType ?? '') === t
    const href = `/admin/feedback?key=${encodeURIComponent(key)}${t ? `&type=${t}` : ''}`
    return `<a href="${href}" style="padding:6px 12px;border-radius:8px;text-decoration:none;${
      active ? 'background:#ffb800;color:#1a0a00' : 'background:#241a3a;color:#ffb800'
    }">${txt}</a>`
  }
  const items = rows
    .map(
      (r) => `
    <div style="background:#1c142e;border:1px solid #3a2a5a;border-radius:12px;padding:14px 16px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:6px">
        ${badge(r.type)}
        <span style="color:#8c86a0;font-size:12px">${esc(r.nickname || 'аноним')} · ${esc(
        r.page || '—',
      )} · v${esc(r.appVersion || '?')} · ${new Date(r.createdAt).toLocaleString('ru-RU')}</span>
      </div>
      <div style="color:#eee;font-size:15px;line-height:1.4;white-space:pre-wrap">${esc(r.message)}</div>
    </div>`,
    )
    .join('')

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Заметки тестеров</title></head>
<body style="margin:0;background:#0d0a18;color:#eee;font-family:system-ui,sans-serif">
<div style="max-width:820px;margin:0 auto;padding:20px 16px 60px">
  <h1 style="color:#ffb800;font-size:22px">🐞 Заметки тестеров <span style="color:#8c86a0;font-size:15px;font-weight:400">(${rows.length})</span></h1>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 20px">
    ${link('', 'Все')} ${link('BUG', '🐞 Баги')} ${link('SUGGESTION', '💡 Идеи')} ${link('QUESTION', '❓ Вопросы')}
    <a href="/admin/feedback?key=${encodeURIComponent(key)}${
    activeType ? `&type=${activeType}` : ''
  }&format=csv" style="padding:6px 12px;border-radius:8px;text-decoration:none;background:#241a3a;color:#4caf50;margin-left:auto">⬇ CSV</a>
  </div>
  ${items || '<p style="color:#8c86a0">Пока пусто.</p>'}
</div></body></html>`
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
