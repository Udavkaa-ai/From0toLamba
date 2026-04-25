import type { Project } from '@prisma/client'
import { ProjectPublicDTO, PersonaArchetype, ProjectFate, LieTopic, ProjectType, WITHDRAWAL_RULES } from './types'

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

/** Конвертирует DB-запись в публичное DTO (без скрытых полей) */
export function toPublicDTO(project: Project): ProjectPublicDTO {
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
    daysSinceJoined: project.daysSinceJoined,
    isWithdrawalLocked: project.isWithdrawalLocked,
    closureReason: project.closureReason,
    // Все баннеры идут через наш прокси /api/banner/:id — он сам ходит в Pollinations
    // с приватным ключом. Старые прямые Pollinations-URL в БД игнорируются.
    bannerImageUrl: project.bannerImageUrl ? `/api/banner/${project.id}` : null,
    currentUserCount: project.currentUserCount,
    userCountHistory: project.userCountHistory,
    apyHistory: project.apyHistory,
    valueHistory: project.valueHistory,
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
