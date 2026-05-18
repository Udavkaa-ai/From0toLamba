import type { Project } from '@prisma/client'
import { ProjectPublicDTO, PersonaArchetype, ProjectFate, LieTopic, ProjectType, WITHDRAWAL_RULES } from './types'
import { prisma } from '../db/prisma'

export interface NpcTruthParams {
  realPatronCount: number
  realDailyProfitDesc: string
  realPayoutSchedule: string
  realGuildSize: number
  elderBlessingPassed: boolean
  nobleBacking: string | null
  withdrawalPolicy: string
}

const PAYOUT_SCHEDULES: Record<ProjectType, string> = {
  [ProjectType.POTION_BREW]: 'раз в неделю по пятницам',
  [ProjectType.GUILD_SCHEME]: 'раз в месяц первого числа',
  [ProjectType.CARD_GAME]: 'сразу по завершении игры',
  [ProjectType.TREASURE_HUNT]: 'после нахождения клада',
  [ProjectType.HONEST_TRADE]: 'раз в две недели',
}

const NOBLE_NAMES = [
  'купец Степан Борисович', 'боярин Тихон Малой', 'торговый дом «Ярославских»',
  'артель «Северный путь»', 'купеческий союз Новгорода', null, null, null,
]

export function generateNpcTruthParams(
  type: ProjectType,
  fate: ProjectFate,
  realDailyYieldRubles: number,
): NpcTruthParams {
  const isScam = fate === ProjectFate.INSTANT_SCAM || fate === ProjectFate.SLOW_DRAIN
  const isGood = fate === ProjectFate.SURVIVOR || fate === ProjectFate.UNICORN

  const realPatronCount = isScam
    ? randomIntInRange(8, 60)
    : randomIntInRange(80, 600)

  const dailyPercent = (realDailyYieldRubles * 100).toFixed(2)
  const monthlyPercent = (realDailyYieldRubles * 30 * 100).toFixed(1)
  const realDailyProfitDesc = `${dailyPercent}% в день (≈${monthlyPercent}% в месяц) от вложенной суммы`

  const realPayoutSchedule = PAYOUT_SCHEDULES[type]

  const realGuildSize = isScam
    ? randomIntInRange(1, 5)
    : randomIntInRange(5, 25)

  const elderBlessingPassed = isGood ? Math.random() > 0.3 : Math.random() > 0.85

  const nobleBacking = isGood && Math.random() > 0.5
    ? NOBLE_NAMES[Math.floor(Math.random() * (NOBLE_NAMES.length - 3))]
    : null

  const rules = WITHDRAWAL_RULES[type]
  let withdrawalPolicy: string
  if (rules.feePercent > 0) {
    withdrawalPolicy = `любая сумма, но с комиссией ${rules.feePercent * 100}%`
  } else if (rules.maxPercent !== null) {
    withdrawalPolicy = `не более ${rules.maxPercent * 100}% от вложенного за раз, без комиссии`
  } else {
    withdrawalPolicy = 'без ограничений и комиссий'
  }

  return {
    realPatronCount,
    realDailyProfitDesc,
    realPayoutSchedule,
    realGuildSize,
    elderBlessingPassed,
    nobleBacking,
    withdrawalPolicy,
  }
}

/** Конвертирует DB-запись в публичное DTO (без скрытых полей).
 *
 * `opts.totalInvested` — кумулятивно вложено в это дело за всё время (sum INVEST+ADD
 * из Transaction). Передаётся из роутов, которые делают groupBy одним запросом для
 * всего списка проектов. Если не передано — fallback на `investedAmountRubles`
 * (для inbox/закрытых, где это совпадает или просто 0). */
export function toPublicDTO(project: Project, opts?: { totalInvested?: number }): ProjectPublicDTO {
  return {
    id: project.id,
    name: project.name,
    type: project.type as ProjectType,
    personaArchetype: project.personaArchetype as PersonaArchetype,
    isInbox: project.isInbox,
    isActive: project.isActive,
    isClosed: project.isClosed,
    developerName: project.developerName,
    developerAvatarSeed: project.developerAvatarSeed,
    claimedName: project.claimedName,
    claimedAPY: project.claimedAPY,
    claimedUserCount: project.claimedUserCount,
    claimedTeamSize: project.claimedTeamSize,
    description: project.description,
    roadmap: project.roadmap,
    investedAmountRubles: project.investedAmountRubles,
    currentValueRubles: project.currentValueRubles,
    totalWithdrawnRubles: project.totalWithdrawnRubles ?? 0,
    totalInvestedRubles: opts?.totalInvested ?? project.investedAmountRubles,
    daysSinceJoined: project.daysSinceJoined,
    isWithdrawalLocked: project.isWithdrawalLocked,
    closureReason: project.closureReason,
    // Все баннеры идут через наш прокси /api/banner/:id — он сам ходит в Pollinations
    // с приватным ключом. Старые прямые Pollinations-URL в БД игнорируются.
    // VIP-дела: bannerImageUrl уже прямая ссылка на /banners/SPONSOR_*.webp,
    // прокси не нужен (он считает filename по архетипу — для спонсорских не годится).
    bannerImageUrl: project.isSponsor
      ? project.bannerImageUrl
      : (project.bannerImageUrl ? `/api/banner/${project.id}` : null),
    currentUserCount: project.currentUserCount,
    userCountHistory: project.userCountHistory,
    apyHistory: project.apyHistory,
    valueHistory: project.valueHistory,
    // СПОНСОРСКИЕ поля: promocode СПЕЦИАЛЬНО НЕ отдаём — проверяется только
    // на сервере. Канал и факт верификации — публичны.
    isSponsor: project.isSponsor,
    sponsorChannelUrl: project.sponsorChannelUrl,
    sponsorPromoVerified: project.sponsorPromoVerified,
  }
}

/** Случайное число в диапазоне [min, max] */
export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** Случайное целое в диапазоне [min, max] */
export function randomIntInRange(min: number, max: number): number {
  return Math.floor(randomInRange(min, max + 1))
}

/** Взвешенный случайный выбор */
export function weightedRandom<T>(items: Array<{ value: T; weight: number }>): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let rand = Math.random() * total
  for (const item of items) {
    rand -= item.weight
    if (rand <= 0) return item.value
  }
  return items[items.length - 1].value
}

/**
 * Сколько всего г игрок положил в дело за всё время — сумма INVEST + ADD.
 * Источник правды — таблица Transaction. С версии 4.4.8 `Project.investedAmountRubles`
 * означает «текущий принципал в работе» (уменьшается при partialWithdraw
 * пропорционально), поэтому для красивых цифр в Летописи и корректного
 * profit% нужна история транзакций, а не текущее поле.
 */
export async function getCumulativeInvested(projectId: string): Promise<number> {
  const agg = await prisma.transaction.aggregate({
    where: { projectId, type: { in: ['INVEST', 'ADD'] } },
    _sum: { amount: true },
  })
  return agg._sum.amount ?? 0
}

/**
 * Кумулятивно вложено по каждому проекту из списка — одним groupBy-запросом.
 * Используется в роутах `/api/projects/portfolio` и `/api/game` для batch-обогащения
 * DTO активных дел полем `totalInvestedRubles` (без N+1 запросов).
 */
export async function getCumulativeInvestedMap(projectIds: string[]): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map()
  const rows = await prisma.transaction.groupBy({
    by: ['projectId'],
    where: { projectId: { in: projectIds }, type: { in: ['INVEST', 'ADD'] } },
    _sum: { amount: true },
  })
  const map = new Map<string, number>()
  for (const r of rows) {
    if (r.projectId) map.set(r.projectId, r._sum.amount ?? 0)
  }
  return map
}

/**
 * profit% по итогам дела:  (returned + всё-выведенное − всё-вложенное) / всё-вложенное × 100.
 * `returned` — финальная выплата (exit/RETURNED). Возвраты по WITHDRAW и сумма
 * вложений берутся из Transaction. Если игрок ни рубля не положил — 0%.
 */
export async function computeProjectProfitPercent(projectId: string, returned: number): Promise<number> {
  const [investAgg, withdrawAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { projectId, type: { in: ['INVEST', 'ADD'] } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { projectId, type: 'WITHDRAW' },
      _sum: { amount: true },
    }),
  ])
  const totalDeposited = investAgg._sum.amount ?? 0
  const totalWithdrawn = withdrawAgg._sum.amount ?? 0
  if (totalDeposited <= 0) return 0
  return ((returned + totalWithdrawn - totalDeposited) / totalDeposited) * 100
}

/** Выбрать lieTopics и truthTopics для проекта по архетипу */
export function selectLieAndTruthTopics(
  archetype: PersonaArchetype,
  fate: ProjectFate,
): { lieTopics: LieTopic[]; truthTopics: LieTopic[] } {
  const allTopics = Object.values(LieTopic)

  // Скамеры врут больше
  const isScam = fate === ProjectFate.INSTANT_SCAM || fate === ProjectFate.SLOW_DRAIN
  const lieCount = isScam ? randomIntInRange(3, 5) : randomIntInRange(1, 2)

  const shuffled = [...allTopics].sort(() => Math.random() - 0.5)
  const lieTopics = shuffled.slice(0, lieCount)
  const truthTopics = shuffled.slice(lieCount)

  return { lieTopics, truthTopics }
}
