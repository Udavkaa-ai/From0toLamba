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

// Модель, которой нет в whitelist, заменяется на FALLBACK.
const ALLOWED_MODELS = new Set([
  'deepseek/deepseek-v4-flash',
  'deepseek/deepseek-chat-v3-0324',
  'google/gemini-2.5-flash-lite-preview-09-2025',
  'qwen/qwen3.5-flash-02-23',
])
const FALLBACK_MODEL = 'deepseek/deepseek-v4-flash'

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
  device: z.string().max(80).nullish(),
  androidSdk: z.number().int().nullish(),
  screen: z.string().max(40).nullish(),
  // base64 JPEG скриншота, до ~3 МБ на всякий случай
  screenshot: z.string().max(3_000_000).nullish(),
})

const standingSchema = z.object({
  playerId: z.string().min(8).max(64),
  nickname: z.string().min(1).max(40),
  wealth: z.number().finite(),
  rankTitle: z.string().max(40).nullish(),
  day: z.number().int().nonnegative().max(100000).default(0),
  loginStreak: z.number().int().nonnegative().max(100000).default(0),
  appVersion: z.string().max(40).nullish(),
  platform: z.string().max(20).default('android'),
})

function checkKey(got: unknown): boolean {
  const expected = process.env.MOBILE_APP_KEY
  if (!expected) return true // ключ не задан — открыто (удобно для локалки)
  return got === expected
}

async function main() {
  // bodyLimit поднят: заметка со скриншотом (base64 JPEG) больше дефолтного 1 МБ
  const app = Fastify({ logger: { level: 'info' }, bodyLimit: 8 * 1024 * 1024 })

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
        device: f.device ?? null,
        androidSdk: f.androidSdk ?? null,
        screen: f.screen ?? null,
        screenshot: f.screenshot ?? null,
      },
    })
    return { ok: true }
  })

  // Купеческий рейтинг: игрок шлёт своё текущее положение (upsert по playerId).
  app.post('/api/mobile/leaderboard', async (request, reply) => {
    if (!checkKey(request.headers['x-app-key'])) {
      return reply.status(401).send({ error: 'Invalid app key' })
    }
    const parsed = standingSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad request', details: parsed.error.issues })
    }
    const s = parsed.data
    await prisma.merchant.upsert({
      where: { playerId: s.playerId },
      create: {
        playerId: s.playerId,
        nickname: s.nickname,
        wealth: s.wealth,
        rankTitle: s.rankTitle ?? null,
        day: s.day,
        loginStreak: s.loginStreak,
        appVersion: s.appVersion ?? null,
        platform: s.platform,
      },
      update: {
        nickname: s.nickname,
        wealth: s.wealth,
        rankTitle: s.rankTitle ?? null,
        day: s.day,
        loginStreak: s.loginStreak,
        appVersion: s.appVersion ?? null,
        platform: s.platform,
      },
    })
    return { ok: true }
  })

  // Топ купцов по богатству + общее число игроков (для приложения).
  app.get('/api/mobile/leaderboard', async (request, reply) => {
    if (!checkKey(request.headers['x-app-key'])) {
      return reply.status(401).send({ error: 'Invalid app key' })
    }
    const q = request.query as { limit?: string }
    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200)
    const [rows, total] = await Promise.all([
      prisma.merchant.findMany({ orderBy: { wealth: 'desc' }, take: limit }),
      prisma.merchant.count(),
    ])
    return {
      total,
      entries: rows.map((r, i) => ({
        position: i + 1,
        playerId: r.playerId,
        nickname: r.nickname,
        wealth: r.wealth,
        rankTitle: r.rankTitle,
        day: r.day,
      })),
    }
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
      const header = 'createdAt,type,nickname,page,appVersion,device,androidSdk,screen,message'
      const body = rows
        .map((r) =>
          [
            r.createdAt.toISOString(),
            r.type,
            r.nickname,
            r.page,
            r.appVersion,
            r.device,
            r.androidSdk,
            r.screen,
            r.message,
          ]
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

  // Лента купцов: кто играет, сколько их, когда заходили. ?format=csv тоже.
  app.get('/admin/merchants', async (request, reply) => {
    const q = request.query as { key?: string; format?: string }
    if (!checkKey(q.key)) {
      return reply.status(401).type('text/plain').send('Invalid key')
    }
    const rows = await prisma.merchant.findMany({
      orderBy: { wealth: 'desc' },
      take: 1000,
    })

    if (q.format === 'csv') {
      const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const header = 'position,nickname,wealth,rankTitle,day,loginStreak,appVersion,createdAt,updatedAt'
      const body = rows
        .map((r, i) =>
          [
            i + 1,
            r.nickname,
            Math.round(r.wealth),
            r.rankTitle,
            r.day,
            r.loginStreak,
            r.appVersion,
            r.createdAt.toISOString(),
            r.updatedAt.toISOString(),
          ]
            .map(esc)
            .join(','),
        )
        .join('\n')
      return reply
        .type('text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="merchants.csv"')
        .send(header + '\n' + body)
    }

    return reply.type('text/html; charset=utf-8').send(renderMerchants(rows, q.key ?? ''))
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
  const shot = (r: any) =>
    r.screenshot
      ? `<a href="data:image/jpeg;base64,${r.screenshot}" target="_blank" style="flex-shrink:0">
           <img src="data:image/jpeg;base64,${r.screenshot}" style="width:64px;height:auto;border-radius:8px;border:1px solid #3a2a5a" />
         </a>`
      : ''
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
      ${
        r.device || r.screen || r.androidSdk
          ? `<div style="color:#6b6580;font-size:11px;margin-bottom:6px">📱 ${esc(
              r.device || '?',
            )}${r.androidSdk ? ` · Android API ${esc(r.androidSdk)}` : ''}${
              r.screen ? ` · ${esc(r.screen)}` : ''
            }</div>`
          : ''
      }
      <div style="display:flex;gap:12px;align-items:flex-start">
        ${shot(r)}
        <div style="color:#eee;font-size:15px;line-height:1.4;white-space:pre-wrap;flex:1">${esc(r.message)}</div>
      </div>
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
    <a href="/admin/merchants?key=${encodeURIComponent(
      key,
    )}" style="padding:6px 12px;border-radius:8px;text-decoration:none;background:#241a3a;color:#ffb800;margin-left:auto">🏆 Купцы</a>
    <a href="/admin/feedback?key=${encodeURIComponent(key)}${
    activeType ? `&type=${activeType}` : ''
  }&format=csv" style="padding:6px 12px;border-radius:8px;text-decoration:none;background:#241a3a;color:#4caf50">⬇ CSV</a>
  </div>
  ${items || '<p style="color:#8c86a0">Пока пусто.</p>'}
</div></body></html>`
}

function renderMerchants(rows: any[], key: string): string {
  const esc = (v: any) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const active24 = rows.filter((r) => now - new Date(r.updatedAt).getTime() < DAY).length
  const active7 = rows.filter((r) => now - new Date(r.updatedAt).getTime() < 7 * DAY).length
  const fmt = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} г`
  const ago = (d: Date) => {
    const m = Math.floor((now - new Date(d).getTime()) / 60000)
    if (m < 60) return `${m} мин назад`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} ч назад`
    return `${Math.floor(h / 24)} дн назад`
  }
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)
  const items = rows
    .map(
      (r, i) => `
    <div style="display:flex;gap:12px;align-items:center;background:#1c142e;border:1px solid #3a2a5a;border-radius:12px;padding:12px 14px;margin-bottom:8px">
      <div style="width:34px;text-align:center;font-size:16px;color:#ffb800;font-weight:700">${medal(i)}</div>
      <div style="flex:1;min-width:0">
        <div style="color:#eee;font-size:15px;font-weight:600">${esc(r.nickname || 'без имени')}
          <span style="color:#8c86a0;font-size:12px;font-weight:400"> · ${esc(r.rankTitle || '—')}</span>
        </div>
        <div style="color:#6b6580;font-size:11px">День ${esc(r.day)} · серия ${esc(
        r.loginStreak,
      )} · v${esc(r.appVersion || '?')} · ${esc(ago(r.updatedAt))}</div>
      </div>
      <div style="color:#ffb800;font-size:15px;font-weight:700;white-space:nowrap">${fmt(r.wealth)}</div>
    </div>`,
    )
    .join('')

  const stat = (label: string, val: string | number) =>
    `<div style="background:#1c142e;border:1px solid #3a2a5a;border-radius:12px;padding:12px 16px;flex:1;min-width:120px">
       <div style="color:#8c86a0;font-size:12px">${label}</div>
       <div style="color:#ffb800;font-size:22px;font-weight:700">${val}</div>
     </div>`

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Купеческий рейтинг</title></head>
<body style="margin:0;background:#0d0a18;color:#eee;font-family:system-ui,sans-serif">
<div style="max-width:820px;margin:0 auto;padding:20px 16px 60px">
  <h1 style="color:#ffb800;font-size:22px">🏆 Купеческий рейтинг</h1>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 16px">
    ${stat('Всего купцов', rows.length)}
    ${stat('Активны за сутки', active24)}
    ${stat('Активны за неделю', active7)}
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 20px">
    <a href="/admin/feedback?key=${encodeURIComponent(
      key,
    )}" style="padding:6px 12px;border-radius:8px;text-decoration:none;background:#241a3a;color:#ffb800">🐞 Заметки тестеров</a>
    <a href="/admin/merchants?key=${encodeURIComponent(
      key,
    )}&format=csv" style="padding:6px 12px;border-radius:8px;text-decoration:none;background:#241a3a;color:#4caf50;margin-left:auto">⬇ CSV</a>
  </div>
  ${items || '<p style="color:#8c86a0">Пока никто не играл.</p>'}
</div></body></html>`
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
