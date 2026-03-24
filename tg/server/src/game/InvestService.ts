import { prisma } from '../db/prisma'
import { ProjectType, WITHDRAWAL_RULES } from './types'

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
}

export async function partialWithdraw(userId: number, projectId: string, amount: number): Promise<number> {
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

  return received
}

export async function exitProject(userId: number, projectId: string): Promise<number> {
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

  return received
}
