import type { Project } from '@prisma/client'
import { ProjectPublicDTO, PersonaArchetype, ProjectFate, LieTopic, ProjectType } from './types'

/** Конвертирует DB-запись в публичное DTO (без скрытых полей) */
export function toPublicDTO(project: Project): ProjectPublicDTO {
  return {
    id: project.id,
    name: project.name,
    type: project.type as ProjectType,
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
    bannerImageUrl: project.bannerImageUrl,
    currentUserCount: project.currentUserCount,
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
