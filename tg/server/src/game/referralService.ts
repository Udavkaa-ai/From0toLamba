import { prisma } from '../db/prisma'

export const REFERRAL_BONUS_RUBLES = 100
export const REFERRAL_INTUITION_THRESHOLD = 10

/**
 * Привязывает реферера к пользователю, НО НЕ выдаёт бонус сразу.
 * Бонус начисляется позже — когда приглашённый наберёт REFERRAL_INTUITION_THRESHOLD чуйки.
 * Идемпотентен: второй вызов ничего не делает.
 */
export async function tryAttachReferrer(userId: number, startParam: string | null): Promise<{
  referrerId: number | null
  attached: boolean
}> {
  if (!startParam) return { referrerId: null, attached: false }

  const match = /^ref_(\d+)$/.exec(startParam)
  if (!match) return { referrerId: null, attached: false }

  const referrerId = Number(match[1])
  if (!Number.isFinite(referrerId) || referrerId === userId) {
    return { referrerId: null, attached: false }
  }

  const [user, referrer] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.user.findUnique({ where: { id: referrerId } }),
  ])
  if (!user || !referrer) return { referrerId: null, attached: false }
  if (user.referrerId) {
    return { referrerId: user.referrerId, attached: false }
  }

  // Только привязываем — бонус придёт позже
  await prisma.user.update({
    where: { id: userId },
    data: { referrerId },
  })

  return { referrerId, attached: true }
}

/**
 * Проверяет, заслужил ли приглашённый игрок реферальный бонус
 * (чуйка >= REFERRAL_INTUITION_THRESHOLD), и начисляет его обоим, если да.
 * Вызывать после каждого submitCharter.
 */
export async function checkAndGrantReferralBonus(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referrerId: true, referralBonusGranted: true, firstName: true },
  })
  if (!user?.referrerId || user.referralBonusGranted) return false

  const [gameState, referrer] = await Promise.all([
    prisma.gameState.findUnique({ where: { userId }, select: { intuitionScore: true, currentDay: true } }),
    prisma.user.findUnique({ where: { id: user.referrerId }, select: { firstName: true } }),
  ])
  if (!gameState || !referrer) return false
  if (gameState.intuitionScore < REFERRAL_INTUITION_THRESHOLD) return false

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { referralBonusGranted: true },
    }),
    prisma.gameState.update({
      where: { userId },
      data: { balance: { increment: REFERRAL_BONUS_RUBLES } },
    }),
    prisma.gameState.update({
      where: { userId: user.referrerId },
      data: { balance: { increment: REFERRAL_BONUS_RUBLES } },
    }),
    prisma.transaction.create({
      data: {
        userId,
        projectName: `По пригласительной грамоте от ${referrer.firstName}`,
        type: 'REFERRAL_BONUS',
        amount: REFERRAL_BONUS_RUBLES,
        day: gameState.currentDay,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: user.referrerId,
        projectName: `За сватовство ${user.firstName}`,
        type: 'REFERRAL_BONUS',
        amount: REFERRAL_BONUS_RUBLES,
        day: gameState.currentDay,
      },
    }),
  ])

  console.log(`[Referral] BONUS GRANTED user=${userId} referrerId=${user.referrerId} intuition=${gameState.intuitionScore}`)
  return true
}

/** Число приглашённых «купцов» — для лидерборда сватов */
export async function countReferrals(userId: number): Promise<number> {
  return prisma.user.count({ where: { referrerId: userId } })
}
