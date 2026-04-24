import { prisma } from '../db/prisma'
import { generateProjectData, generateProjectBanner } from '../ai/openRouterClient'
import { ProjectType, ProjectFate, PersonaArchetype, FATE_CONFIG } from './types'
import { randomInRange as rng, randomIntInRange as irng, weightedRandom as wr, selectLieAndTruthTopics as slt, generateNpcTruthParams } from './projectUtils'

const ALL_FATES = Object.entries(FATE_CONFIG).map(([value, cfg]) => ({
  value: value as ProjectFate,
  weight: cfg.weight,
}))

const ALL_TYPES = Object.values(ProjectType)
const ALL_ARCHETYPES = Object.values(PersonaArchetype)

export async function generateProject(
  userId: number,
  overrideFate?: ProjectFate,
  model?: string,
  options: { preloaded?: boolean } = {},
): Promise<string> {
  // Случайные базовые параметры
  const type = ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)]
  const fate = overrideFate ?? wr(ALL_FATES)
  const archetype = ALL_ARCHETYPES[Math.floor(Math.random() * ALL_ARCHETYPES.length)]

  const fateCfg = FATE_CONFIG[fate]
  const daysUntilCollapse = irng(fateCfg.daysRange[0], fateCfg.daysRange[1])
  const realDailyYieldRubles = rng(fateCfg.dailyYieldRange[0], fateCfg.dailyYieldRange[1])
  const { lieTopics, truthTopics } = slt(archetype, fate)

  const avatarSeed = Math.random().toString(36).slice(2, 10)
  const npcTruthParams = generateNpcTruthParams(type, fate, realDailyYieldRubles)

  // Создаём запись СРАЗУ с плейсхолдером — чтобы preloadedCount сразу вырос
  // и повторные seed'ы из /api/game не насеяли дублей, пока AI тормозит.
  // Имена/описания AI подтянет в фоне через update ниже.
  const project = await prisma.project.create({
    data: {
      userId,
      name: 'Тайное дело',
      type,
      fate,
      personaArchetype: archetype,
      daysUntilCollapse,
      realDailyYieldRubles,
      lieTopics,
      truthTopics,
      developerName: 'Ефим Лукавый',
      developerAvatarSeed: avatarSeed,
      claimedName: 'Тайное дело',
      claimedAPY: 100,
      claimedUserCount: irng(50, 5000),
      claimedTeamSize: irng(3, 30),
      description: 'Прибыльное дело для смелых вкладчиков.',
      roadmap: ['Открыть дело', 'Собрать рубли', 'Распределить прибыль'],
      currentUserCount: irng(50, 5000),
      npcTruthParams,
      isInbox: !options.preloaded,
      isPreloaded: !!options.preloaded,
    },
  })

  // AI-обогащение имён/описания и баннер — в фоне, не блокируем вызывающего
  ;(async () => {
    try {
      const aiData = await generateProjectData({ type, fate, archetype, lieTopics }, model)
      await prisma.project.update({
        where: { id: project.id },
        data: {
          name: aiData.name,
          claimedName: aiData.claimedName,
          claimedAPY: aiData.claimedAPY,
          developerName: aiData.developerName,
          description: aiData.description,
          roadmap: aiData.roadmap,
        },
      })
      generateProjectBanner(project.id, aiData.name, type, archetype).catch(console.error)
    } catch (err) {
      console.error('[generateProject] AI enrich failed:', err)
    }
  })()

  return project.id
}

/** Онбординг-проект (всегда HONEST_FAIL, гарантированная выплата) */
export async function generateOnboardingProject(userId: number, model?: string): Promise<string> {
  return generateProject(userId, ProjectFate.HONEST_FAIL, model)
}
