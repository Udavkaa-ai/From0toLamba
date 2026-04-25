import type { FastifyInstance } from 'fastify'
import { Readable } from 'node:stream'
import { prisma } from '../../db/prisma'
import { pollinationsImageUrl } from '../../ai/openRouterClient'
import { ProjectType, PersonaArchetype } from '../../game/types'

/**
 * Прокси для баннеров проекта.
 * Клиент дёргает /api/banner/:projectId, сервер ходит в Pollinations с
 * приватным ключом из env (через Authorization header) и стримит ответ.
 *
 * Зачем прокси: ключ POLLINATIONS_API_KEY не должен утекать ни в БД, ни в DOM
 * пользователя. Прямой URL Pollinations с ?token= в БД был бы публичной утечкой.
 *
 * Без auth: баннер по сути публичен (это арт-картинка, не персональные данные),
 * а через тег <img> передать X-Telegram-Init-Data в header нельзя без сторонних
 * ухищрений. ID проекта — UUID, угадать сложно.
 */
export async function bannerRoutes(app: FastifyInstance) {
  app.get<{ Params: { projectId: string } }>('/api/banner/:projectId', async (request, reply) => {
    const { projectId } = request.params

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, type: true, personaArchetype: true },
    })
    if (!project) {
      return reply.code(404).send({ error: 'PROJECT_NOT_FOUND' })
    }

    const upstreamUrl = pollinationsImageUrl(
      project.id,
      project.type as ProjectType,
      project.personaArchetype as PersonaArchetype,
    )

    const headers: Record<string, string> = {}
    const apiKey = process.env.POLLINATIONS_API_KEY
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    let upstream: Response
    try {
      upstream = await fetch(upstreamUrl, { headers })
    } catch (err: any) {
      console.error(`[Banner] fetch failed for ${projectId}:`, err?.message ?? err)
      return reply.code(502).send({ error: 'UPSTREAM_FETCH_FAILED' })
    }

    if (!upstream.ok || !upstream.body) {
      console.error(`[Banner] upstream ${upstream.status} for ${projectId}`)
      return reply.code(502).send({ error: 'UPSTREAM_BAD_RESPONSE', status: upstream.status })
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
    reply.header('Content-Type', contentType)
    // Картинки детерминированы по seed — клиент и Cloudflare могут спокойно кешировать
    reply.header('Cache-Control', 'public, max-age=86400, immutable')

    // Web ReadableStream → Node Readable (Fastify 5 умеет такое стримить)
    return reply.send(Readable.fromWeb(upstream.body as any))
  })
}
