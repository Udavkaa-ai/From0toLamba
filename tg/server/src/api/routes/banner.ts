import type { FastifyInstance } from 'fastify'
import { prisma } from '../../db/prisma'
import { staticBannerFilename } from '../../ai/openRouterClient'
import { ProjectType, PersonaArchetype } from '../../game/types'

/**
 * Редирект для старых ссылок вида /api/banner/:projectId, которые могли
 * остаться в БД от предыдущей Pollinations-интеграции.
 * Вычисляет имя статического файла и делает 301 → /banners/:filename.
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

    const filename = staticBannerFilename(
      project.id,
      project.type as ProjectType,
      project.personaArchetype as PersonaArchetype,
    )
    return reply.redirect(`/banners/${filename}`, 301)
  })
}
