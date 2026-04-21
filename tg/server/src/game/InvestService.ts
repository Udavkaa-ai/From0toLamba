import { prisma } from '../db/prisma'
import { ProjectType, WITHDRAWAL_RULES } from './types'
import { generatePostMortem } from '../ai/openRouterClient'

const MIN_INVEST = 5
const MAX_INVEST_PER_PROJECT = 5000
const MAX_ACTIVE_PROJECTS = 5

export async function invest(userId: number, projectId: string, amount: number): Promise<void> {
  if (amount < MIN_INVEST) throw new Error('AMOUNT_TOO_SMALL')
  if (amount > MAX_INVEST_PER_PROJECT) throw new Error('AMOUNT_TOO_LARGE')

  const [gameState, project] = await Promise.all([
    prisma.gameState.findUniqueOrThrow({ where: { userId } }),
    prisma.project.findFirstOrThrow({ where: { id: projectId, userId } }),
  ])

  if (gameState.balance < amount) throw new Error('INSUFFICIENT_BALANCE')

  const activeCount = await prisma.project.count({ where: { userId, isActive: true } })
  if (activeCount >= MAX_ACTIVE_PROJECTS) throw new Error('MAX_PROJECTS_REACHED')

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
      },
    }),
  ])

  await prisma.transaction.create({
    data: { userId, projectId, projectName: project.name, type: 'INVEST', amount, day: gameState.currentDay },
  })
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

  // Проверяем лимит
  if (rules.maxPercent !== null) {
    const maxAllowed = project.investedAmountRubles * rules.maxPercent
    if (amount > maxAllowed) throw new Error('EXCEEDS_LIMIT')
  }

  if (amount > project.currentValueRubles) throw new Error('EXCEEDS_CURRENT_VALUE')

  // Применяем комиссию
  const received = amount * (1 - rules.feePercent)

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { currentValueRubles: { decrement: amount } },
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
  const profitPercent = project.investedAmountRubles > 0
    ? ((received - project.investedAmountRubles) / project.investedAmountRubles) * 100
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
  }).catch(console.error)

  return received
}
