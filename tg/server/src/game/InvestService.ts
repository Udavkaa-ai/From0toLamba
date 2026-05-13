import { prisma } from '../db/prisma'
import { ProjectType, ProjectFate, WITHDRAWAL_RULES, FATE_CONFIG } from './types'
import { generatePostMortem } from '../ai/openRouterClient'
import { recomputeRank } from './rankService'

const MIN_INVEST = 5
const MAX_INVEST_PER_PROJECT = 5000
const MAX_ACTIVE_PROJECTS = 5
const MAX_EXTRA_SLOTS = 5
const EXTRA_SLOT_COST_GROSHY = 1000

// «Лестница судеб» от худшей к лучшей. Идеальная игра (errorCount=0) даёт шанс
// сдвинуть судьбу на ступеньку вверх — это связь скилла и удачи.
const FATE_LADDER: ProjectFate[] = [
  ProjectFate.INSTANT_SCAM,
  ProjectFate.SLOW_DRAIN,
  ProjectFate.HONEST_FAIL,
  ProjectFate.SURVIVOR,
  ProjectFate.UNICORN,
]
const PERFECT_GAME_LUCK_CHANCE = 0.25  // 25% при errorCount=0

/**
 * Если игрок прошёл мини-игру без ошибок (errorCount = 0), то с
 * вероятностью PERFECT_GAME_LUCK_CHANCE «переламываем» судьбу на ступеньку
 * вверх (INSTANT_SCAM → SLOW_DRAIN → HONEST_FAIL → SURVIVOR → UNICORN).
 * Возвращает обновлённый patch для project.update либо null, если сдвига нет.
 */
function maybeShiftFate(currentFate: ProjectFate): {
  newFate: ProjectFate
  newDailyYield: number
  newDaysUntilCollapse: number
} | null {
  const idx = FATE_LADDER.indexOf(currentFate)
  if (idx < 0 || idx === FATE_LADDER.length - 1) return null  // UNICORN — некуда расти
  if (Math.random() >= PERFECT_GAME_LUCK_CHANCE) return null
  const newFate = FATE_LADDER[idx + 1]
  const cfg = FATE_CONFIG[newFate]
  const newDailyYield = cfg.dailyYieldRange[0] + Math.random() * (cfg.dailyYieldRange[1] - cfg.dailyYieldRange[0])
  const newDaysUntilCollapse = cfg.daysRange[0] + Math.floor(Math.random() * (cfg.daysRange[1] - cfg.daysRange[0] + 1))
  return { newFate, newDailyYield, newDaysUntilCollapse }
}

/** Результат инвеста: была ли удача-сдвиг судьбы (для красивого баннера на клиенте) */
export interface InvestResult {
  luckShift: { from: ProjectFate; to: ProjectFate } | null
}

export async function invest(
  userId: number,
  projectId: string,
  amount: number,
  extraSlot?: 'groshy' | 'stars',
): Promise<InvestResult> {
  if (amount < MIN_INVEST) throw new Error('AMOUNT_TOO_SMALL')
  if (amount > MAX_INVEST_PER_PROJECT) throw new Error('AMOUNT_TOO_LARGE')

  const [gameState, project, amaSession] = await Promise.all([
    prisma.gameState.findUniqueOrThrow({ where: { userId } }),
    prisma.project.findFirstOrThrow({ where: { id: projectId, userId } }),
    prisma.amaSession.findUnique({ where: { projectId } }),
  ])

  // Если игрок прошёл мини-игру без ошибок — шанс «переломить судьбу» дела
  // на одну ступеньку лучше. errorCount хранится в AmaSession.intuitionDelta
  // (legacy-имя поля, см. CharterService).
  const errorCount = amaSession?.intuitionDelta ?? null
  const fateShift = errorCount === 0
    ? maybeShiftFate(project.fate as ProjectFate)
    : null
  const projectShiftPatch = fateShift ? {
    fate: fateShift.newFate,
    realDailyYieldRubles: fateShift.newDailyYield,
    daysUntilCollapse: fateShift.newDaysUntilCollapse,
  } : {}
  const luckShift: InvestResult['luckShift'] = fateShift
    ? { from: project.fate as ProjectFate, to: fateShift.newFate }
    : null

  const activeCount = await prisma.project.count({ where: { userId, isActive: true } })

  if (activeCount >= MAX_ACTIVE_PROJECTS) {
    if (!extraSlot) throw new Error('MAX_PROJECTS_REACHED')

    const extraActiveCount = await prisma.project.count({ where: { userId, isActive: true, isExtraSlot: true } })
    if (extraActiveCount >= MAX_EXTRA_SLOTS) throw new Error('MAX_EXTRA_SLOTS_REACHED')

    if (extraSlot === 'groshy') {
      if (gameState.balance < amount + EXTRA_SLOT_COST_GROSHY) throw new Error('INSUFFICIENT_BALANCE')
      await prisma.$transaction([
        prisma.gameState.update({
          where: { userId },
          data: {
            balance: { decrement: amount + EXTRA_SLOT_COST_GROSHY },
            totalInvested: { increment: amount },
          },
        }),
        prisma.project.update({
          where: { id: projectId },
          data: {
            investedAmountRubles: { increment: amount },
            currentValueRubles: { increment: amount },
            isActive: true,
            isInbox: false,
            isExtraSlot: true,
            ...projectShiftPatch,
          },
        }),
      ])
      await prisma.transaction.create({
        data: { userId, projectId, projectName: project.name, type: 'INVEST', amount, day: gameState.currentDay },
      })
      return { luckShift }
    }

    // stars path: use pre-purchased slot token
    if (gameState.extraSlotsBalance <= 0) throw new Error('NO_EXTRA_SLOTS')
    if (gameState.balance < amount) throw new Error('INSUFFICIENT_BALANCE')
    await prisma.$transaction([
      prisma.gameState.update({
        where: { userId },
        data: {
          balance: { decrement: amount },
          totalInvested: { increment: amount },
          extraSlotsBalance: { decrement: 1 },
        },
      }),
      prisma.project.update({
        where: { id: projectId },
        data: {
          investedAmountRubles: { increment: amount },
          currentValueRubles: { increment: amount },
          isActive: true,
          isInbox: false,
          isExtraSlot: true,
          ...projectShiftPatch,
        },
      }),
    ])
    await prisma.transaction.create({
      data: { userId, projectId, projectName: project.name, type: 'INVEST', amount, day: gameState.currentDay },
    })
    return { luckShift }
  }

  if (gameState.balance < amount) throw new Error('INSUFFICIENT_BALANCE')

  await prisma.$transaction([
    prisma.gameState.update({
      where: { userId },
      data: {
        balance: { decrement: amount },
        totalInvested: { increment: amount },
      },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        investedAmountRubles: { increment: amount },
        currentValueRubles: { increment: amount },
        isActive: true,
        isInbox: false,
        ...projectShiftPatch,
      },
    }),
  ])

  await prisma.transaction.create({
    data: { userId, projectId, projectName: project.name, type: 'INVEST', amount, day: gameState.currentDay },
  })

  return { luckShift }
}

export async function addInvestment(userId: number, projectId: string, amount: number): Promise<void> {
  if (amount < MIN_INVEST) throw new Error('AMOUNT_TOO_SMALL')

  const [gameState, project] = await Promise.all([
    prisma.gameState.findUniqueOrThrow({ where: { userId } }),
    prisma.project.findFirstOrThrow({ where: { id: projectId, userId, isActive: true } }),
  ])

  if (project.isWithdrawalLocked) throw new Error('WITHDRAWAL_LOCKED')
  if (gameState.balance < amount) throw new Error('INSUFFICIENT_BALANCE')

  const newTotal = project.investedAmountRubles + amount
  if (newTotal > MAX_INVEST_PER_PROJECT) throw new Error('AMOUNT_TOO_LARGE')

  await prisma.$transaction([
    prisma.gameState.update({
      where: { userId },
      data: {
        balance: { decrement: amount },
        totalInvested: { increment: amount },
      },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        investedAmountRubles: { increment: amount },
        currentValueRubles: { increment: amount },
      },
    }),
  ])

  await prisma.transaction.create({
    data: { userId, projectId, projectName: project.name, type: 'ADD', amount, day: gameState.currentDay },
  })
}

export async function partialWithdraw(userId: number, projectId: string, amount: number): Promise<number> {
  const gameState = await prisma.gameState.findFirstOrThrow({ where: { userId } })
  const project = await prisma.project.findFirstOrThrow({ where: { id: projectId, userId, isActive: true } })

  if (project.isWithdrawalLocked) throw new Error('WITHDRAWAL_LOCKED')

  const type = project.type as ProjectType
  const rules = WITHDRAWAL_RULES[type]

  if (rules.maxPercent !== null) {
    const maxAllowed = Math.floor(project.currentValueRubles * rules.maxPercent)
    if (amount > maxAllowed) throw new Error('EXCEEDS_LIMIT')
  }

  if (amount > project.currentValueRubles) throw new Error('EXCEEDS_CURRENT_VALUE')

  const received = amount * (1 - rules.feePercent)

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: {
        currentValueRubles: { decrement: amount },
        totalWithdrawnRubles: { increment: received },
      },
    }),
    prisma.gameState.update({
      where: { userId },
      data: {
        balance: { increment: received },
        totalReturned: { increment: received },
      },
    }),
  ])

  await prisma.transaction.create({
    data: { userId, projectId, projectName: project.name, type: 'WITHDRAW', amount: received, day: gameState.currentDay },
  })

  return received
}

export async function exitProject(userId: number, projectId: string): Promise<number> {
  const gameState = await prisma.gameState.findFirstOrThrow({ where: { userId } })
  const project = await prisma.project.findFirstOrThrow({ where: { id: projectId, userId, isActive: true } })

  if (project.isWithdrawalLocked) throw new Error('WITHDRAWAL_LOCKED')

  const type = project.type as ProjectType
  const rules = WITHDRAWAL_RULES[type]
  const received = project.currentValueRubles * (1 - rules.feePercent)

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: {
        isActive: false,
        isClosed: true,
        closureReason: 'Вышел из дела досрочно',
        currentValueRubles: received,
      },
    }),
    prisma.gameState.update({
      where: { userId },
      data: {
        balance: { increment: received },
        totalReturned: { increment: received },
      },
    }),
  ])

  await prisma.transaction.create({
    data: { userId, projectId, projectName: project.name, type: 'EXIT', amount: received, day: gameState.currentDay },
  })

  const amaSession = await prisma.amaSession.findUnique({ where: { projectId } })
  const totalWithdrawn = project.totalWithdrawnRubles
  const profitPercent = project.investedAmountRubles > 0
    ? ((received + totalWithdrawn - project.investedAmountRubles) / project.investedAmountRubles) * 100
    : 0

  generatePostMortem({
    projectId,
    userId,
    archetype: project.personaArchetype,
    fate: project.fate,
    lieTopics: project.lieTopics,
    investedAmount: project.investedAmountRubles,
    returnedAmount: received,
    profitPercent,
    daysActive: project.daysSinceJoined,
    intuitionDelta: amaSession?.intuitionDelta ?? 0,
  }, undefined, gameState.preferredLanguage ?? 'ru').catch(console.error)

  await recomputeRank(userId)

  return received
}
