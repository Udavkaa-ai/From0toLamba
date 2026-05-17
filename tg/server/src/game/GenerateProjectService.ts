import { prisma } from '../db/prisma'
import { generateProjectData, generateProjectBanner } from '../ai/openRouterClient'
import { ProjectType, ProjectFate, PersonaArchetype, FATE_CONFIG, SPONSOR_CHANCE } from './types'
import { randomInRange as rng, randomIntInRange as irng, weightedRandom as wr, selectLieAndTruthTopics as slt, generateNpcTruthParams } from './projectUtils'
import { pickRandomActiveCampaign, materializeSponsorProject } from './sponsorService'

/** Диапазоны множителя по судьбе: мошенники врут вверх, UNICORN занижает.
 *  SPONSOR_FIXED здесь — заглушка, реальный claimedAPY ставится напрямую
 *  в sponsorService.materializeSponsorProject(). */
const CLAIMED_APY_MULTIPLIER: Record<ProjectFate, [number, number]> = {
  [ProjectFate.INSTANT_SCAM]: [0.9, 1.5],
  [ProjectFate.SLOW_DRAIN]:   [0.7, 1.4],
  [ProjectFate.HONEST_FAIL]:  [0.5, 1.0],
  [ProjectFate.SURVIVOR]:     [0.7, 1.3],
  [ProjectFate.UNICORN]:      [0.3, 0.7],
  [ProjectFate.SPONSOR_FIXED]: [1.0, 1.0],
}

export function computeClaimedAPY(realDailyYield: number, fate: ProjectFate): number {
  const realAnnualPct = realDailyYield * 365 * 100
  const [lo, hi] = CLAIMED_APY_MULTIPLIER[fate]
  const multiplier = lo + Math.random() * (hi - lo)
  const raw = Math.round(realAnnualPct * multiplier)
  // Округляем до «красивого» числа — мошенники не говорят «2347%»
  const step = raw >= 2000 ? 100 : raw >= 500 ? 50 : 25
  return Math.max(50, Math.min(Math.round(raw / step) * step, 9999))
}

const ALL_FATES = Object.entries(FATE_CONFIG).map(([value, cfg]) => ({
  value: value as ProjectFate,
  weight: cfg.weight,
}))

const ALL_TYPES = Object.values(ProjectType)
const ALL_ARCHETYPES = Object.values(PersonaArchetype)

// In-memory mutex для VIP-критической секции: одна запись на userId,
// удерживается пока идёт async-проверка существующего VIP + создание.
// Защищает от TOCTOU между параллельными generateProject() (см. комментарий
// внутри функции). Railway → один Node-процесс, шарить через DB не нужно.
const vipCreationLocks = new Set<number>()

export async function generateProject(
  userId: number,
  overrideFate?: ProjectFate,
  model?: string,
  options: { preloaded?: boolean } = {},
  lang = 'ru',
): Promise<string> {
  // VIP-перехват: с шансом SPONSOR_CHANCE генерируем спонсорское дело
  // вместо обычного, если в БД есть активная кампания. Не зависит от
  // preloaded — материализация спонсора всегда сразу в инбоксе
  // (isInbox=true, isPreloaded=false внутри materializeSponsorProject),
  // даже если этот вызов был фоновым из advance-day preload-цикла.
  if (!overrideFate && Math.random() < SPONSOR_CHANCE) {
    // Защита от дублей. AdvanceDayService и /api/game стреляют 2-3
    // generateProject() параллельно (fire-and-forget). Раньше тут
    // была только async проверка existingSponsor===0 — это TOCTOU,
    // оба параллельных вызова проходили проверку ДО того как любой
    // успел вставить запись, и игрок получал 2 одинаковых VIP в инбокс.
    // Теперь — модульный in-memory mutex по userId: первый параллельный
    // VIP-ролл захватывает лок, остальные сразу проваливаются в обычную
    // генерацию (потеря VIP-шанса для них — приемлемо, лучше чем дубль).
    if (!vipCreationLocks.has(userId)) {
      vipCreationLocks.add(userId)
      try {
        const gs = await prisma.gameState.findUnique({
          where: { userId },
          select: { isOnboardingComplete: true },
        })
        const existingSponsor = await prisma.project.count({
          where: { userId, isSponsor: true, OR: [{ isInbox: true }, { isActive: true }] },
        })
        if (gs?.isOnboardingComplete && existingSponsor === 0) {
          const campaign = await pickRandomActiveCampaign(userId)
          if (campaign) {
            const sponsored = await materializeSponsorProject(userId, campaign)
            return sponsored.id
          }
        }
      } finally {
        vipCreationLocks.delete(userId)
      }
    }
  }

  // Случайные базовые параметры
  const type = ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)]
  // Спонсорские судьбы НЕ участвуют в случайном выборе обычных дел
  const fate = overrideFate ?? wr(ALL_FATES.filter(f => f.value !== ProjectFate.SPONSOR_FIXED))
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
  const claimedAPY = computeClaimedAPY(realDailyYieldRubles, fate)

  const placeholderName = lang === 'en' ? 'Secret Venture' : 'Тайное дело'
  const placeholderDev = lang === 'en' ? 'Emelya the Sly' : 'Ефим Лукавый'
  const placeholderDesc = lang === 'en' ? 'A profitable venture for bold investors.' : 'Прибыльное дело для смелых вкладчиков.'
  const placeholderRoadmap = lang === 'en'
    ? ['Open the venture', 'Collect kopecks', 'Distribute profits']
    : ['Открыть дело', 'Собрать гроши', 'Распределить прибыль']

  const project = await prisma.project.create({
    data: {
      userId,
      name: placeholderName,
      type,
      fate,
      personaArchetype: archetype,
      daysUntilCollapse,
      realDailyYieldRubles,
      lieTopics,
      truthTopics,
      developerName: placeholderDev,
      developerAvatarSeed: avatarSeed,
      claimedName: placeholderName,
      claimedAPY,
      claimedUserCount: irng(50, 5000),
      claimedTeamSize: irng(3, 30),
      description: placeholderDesc,
      roadmap: placeholderRoadmap,
      currentUserCount: irng(50, 5000),
      npcTruthParams,
      isInbox: !options.preloaded,
      isPreloaded: !!options.preloaded,
    },
  })

  // AI-обогащение имён/описания и баннер — в фоне, не блокируем вызывающего
  ;(async () => {
    try {
      const aiData = await generateProjectData({ type, fate, archetype, lieTopics }, model, lang)
      await prisma.project.update({
        where: { id: project.id },
        data: {
          name: aiData.name,
          claimedName: aiData.claimedName,
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
export async function generateOnboardingProject(userId: number, model?: string, lang = 'ru'): Promise<string> {
  return generateProject(userId, ProjectFate.HONEST_FAIL, model, {}, lang)
}

// Чтобы heal не стартовал одну и ту же генерацию многократно (например,
// если клиент часто пулит /api/game), держим в памяти процесса множество
// projectId, которые прямо сейчас догружаются. После UPDATE — вынимаем.
const enrichingInFlight = new Set<string>()

/**
 * Догенерить имя/описание/баннер для проекта, который застрял с
 * плейсхолдерами («Тайное дело / Ефим Лукавый»). Запускается в фоне
 * при обнаружении таких дел в inbox/preloaded.
 */
export async function enrichPlaceholderProject(
  projectId: string,
  model?: string,
  lang = 'ru',
): Promise<void> {
  if (enrichingInFlight.has(projectId)) return
  enrichingInFlight.add(projectId)
  const placeholder = lang === 'en' ? 'Secret Venture' : 'Тайное дело'
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return
    // Проверяем что дело всё ещё с плейсхолдером — иначе заменим качественный
    // текст пустым фолбэком при очередной неудачной генерации
    if (project.name !== 'Тайное дело' && project.name !== 'Secret Venture') return

    const aiData = await generateProjectData({
      type: project.type as ProjectType,
      fate: project.fate as ProjectFate,
      archetype: project.personaArchetype as PersonaArchetype,
      lieTopics: project.lieTopics as any,
    }, model, lang)

    // Если AI снова вернул плейсхолдер — не трогаем запись, попробуем в другой раз
    if (aiData.name === placeholder) return

    await prisma.project.update({
      where: { id: projectId },
      data: {
        name: aiData.name,
        claimedName: aiData.claimedName,
        developerName: aiData.developerName,
        description: aiData.description,
        roadmap: aiData.roadmap,
      },
    })
    generateProjectBanner(
      projectId,
      aiData.name,
      project.type as ProjectType,
      project.personaArchetype as PersonaArchetype,
    ).catch(console.error)
  } catch (err) {
    console.error('[enrichPlaceholderProject] failed:', err)
  } finally {
    enrichingInFlight.delete(projectId)
  }
}
