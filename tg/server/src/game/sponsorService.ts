// VIP-дела от спонсорских каналов.
//
// Появляются в инбоксе вместо обычной генерации с шансом SPONSOR_CHANCE,
// если в БД есть хотя бы одна активная SponsorCampaign. Игрок не проходит
// мини-игру — вместо этого вводит промокод, опубликованный на канале.
//
// Возврат: фиксированный SPONSOR_PROFIT_MULT× (3×) за durationDays (14 дней).
// Линейный прирост: currentValue растёт равномерно, daysSinceJoined считается
// как обычно через advanceDay.

import { prisma } from '../db/prisma'
import type { SponsorCampaign, Project } from '@prisma/client'
import { SPONSOR_PROFIT_MULT, ProjectFate, PersonaArchetype, ProjectType } from './types'
import { generateNpcTruthParams, computeProjectProfitPercent, getCumulativeInvested } from './projectUtils'

/** Случайная активная кампания (по весам), которую этот игрок ещё не видел.
 *  Исключает все кампании, по которым у него уже был Project любого статуса
 *  (inbox / active / closed). Возвращает null если все активные уже виделись
 *  или их вообще нет. */
export async function pickRandomActiveCampaign(userId: number): Promise<SponsorCampaign | null> {
  // 1. Какие кампании этот игрок уже видел (любой статус Project, включая закрытые)
  const seen = await prisma.project.findMany({
    where: { userId, sponsorCampaignId: { not: null } },
    select: { sponsorCampaignId: true },
    distinct: ['sponsorCampaignId'],
  })
  const seenIds = seen.map(p => p.sponsorCampaignId).filter((id): id is string => !!id)

  // 2. Активные кампании, которых игрок ещё не видел
  const active = await prisma.sponsorCampaign.findMany({
    where: {
      active: true,
      ...(seenIds.length ? { id: { notIn: seenIds } } : {}),
    },
  })
  if (active.length === 0) return null

  const totalWeight = active.reduce((s, c) => s + Math.max(1, c.weight), 0)
  let r = Math.random() * totalWeight
  for (const c of active) {
    r -= Math.max(1, c.weight)
    if (r <= 0) return c
  }
  return active[active.length - 1]
}

/** Материализует SponsorCampaign в новый Project (inbox). Возвращает созданный Project.
 *
 *  Поля Project.fate = SPONSOR_FIXED, isSponsor = true, promocode хранится в БД
 *  (на клиент не отдаётся, см. toPublicDTO). claimedAPY ставим высокий —
 *  игрок видит «обещание» как у обычного дела, реальный возврат фиксированный.
 */
export async function materializeSponsorProject(
  userId: number,
  campaign: SponsorCampaign,
): Promise<Project> {
  const type = campaign.type as ProjectType
  const archetype = campaign.archetype as PersonaArchetype
  // claimedAPY для спонсорского: возврат 3× за 14 дней ≈ ROI 200% за 14дн ≈
  // (1+x)^14 = 3 → x ≈ 8.18% в день. В год: 8.18%×365 ≈ 2984% (формально),
  // но мы скромно показываем 200% (фактическую прибыль за 2 недели).
  const claimedAPY = (SPONSOR_PROFIT_MULT - 1) * 100  // 200% при 3×

  const npcTruth = generateNpcTruthParams(type, ProjectFate.SPONSOR_FIXED, 0.0818)

  // Имена воеводы / артели уже заданы админом в кампании
  const project = await prisma.project.create({
    data: {
      userId,
      name: campaign.scenarioTitle,
      type,
      fate: ProjectFate.SPONSOR_FIXED,
      personaArchetype: archetype,
      daysUntilCollapse: campaign.durationDays,
      realDailyYieldRubles: 0,  // считается специально, см. AdvanceDayService
      lieTopics: [],
      truthTopics: [],
      npcTruthParams: npcTruth as any,
      developerName: campaign.developerName,
      developerAvatarSeed: campaign.id,
      claimedName: campaign.scenarioTitle,
      claimedAPY,
      claimedUserCount: 100 + Math.floor(Math.random() * 800),
      claimedTeamSize: 5 + Math.floor(Math.random() * 15),
      description: campaign.scenarioBody,
      roadmap: [],
      bannerImageUrl: campaign.bannerImageUrl ?? '/banners/SPONSOR_VIP_01.webp',
      // VIP-метки
      isSponsor: true,
      promocode: campaign.promocode,
      sponsorChannelUrl: campaign.channelUrl,
      sponsorCampaignId: campaign.id,
      sponsorPromoVerified: false,
      // Сразу в inbox, не preloaded — спонсорское всегда «горящее»
      isInbox: true,
      isPreloaded: false,
    },
  })

  return project
}

/** Проверка промокода (case-insensitive, обрезка пробелов).
 *  При совпадении ставит sponsorPromoVerified=true.
 *  Возвращает true если промокод верный. */
export async function verifyPromocode(projectId: string, userId: number, input: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, isSponsor: true, isInbox: true },
    select: { id: true, promocode: true, sponsorPromoVerified: true },
  })
  if (!project || !project.promocode) return false

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '')
  const ok = normalize(input) === normalize(project.promocode)
  if (!ok) return false

  if (!project.sponsorPromoVerified) {
    await prisma.project.update({
      where: { id: project.id },
      data: { sponsorPromoVerified: true },
    })
  }
  return true
}

/** Линейный прирост стоимости спонсорского дела. Вызывается из AdvanceDayService.
 *  За durationDays итог = SPONSOR_PROFIT_MULT × invested. */
export function computeSponsorValue(invested: number, daysActive: number, durationDays: number): number {
  if (invested <= 0) return 0
  const progress = Math.min(1, daysActive / durationDays)
  return invested * (1 + (SPONSOR_PROFIT_MULT - 1) * progress)
}

/** Должен ли спонсорский Project закрыться (срок вышел). */
export function shouldCloseSponsor(daysActive: number, durationDays: number): boolean {
  return daysActive >= durationDays
}

/** PostMortem для VIP-дела — без AI. Текст analysis = project.description
 *  (там сидит scenarioBody от админа при создании кампании). Так в Летописи
 *  игрок видит ровно то же сказочное приветственное описание, что и при
 *  попадании дела в инбокс — без сгенерированного «разбора скама». */
export async function createSponsorPostMortem(
  project: Project,
  returnedAmount: number,
  daysActive: number,
): Promise<void> {
  // Кумулятивные суммы — из истории транзакций (см. partialWithdraw в InvestService).
  const [cumulativeInvested, profitPercent] = await Promise.all([
    getCumulativeInvested(project.id),
    computeProjectProfitPercent(project.id, returnedAmount),
  ])
  await prisma.postMortem.create({
    data: {
      projectId: project.id,
      userId: project.userId,
      revealedArchetype: project.personaArchetype,
      fate: project.fate,
      lieTopics: [],
      analysis: project.description,
      investedAmount: cumulativeInvested,
      returnedAmount,
      profitPercent,
      daysActive,
      lieGuessCorrect: true,
      intuitionDelta: 0,
    },
  }).catch(err => console.error('[Sponsor PostMortem] insert failed:', err))
}
