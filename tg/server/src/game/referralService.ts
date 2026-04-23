import { prisma } from '../db/prisma'

/** Бонус обоим — и свату, и приглашённому — когда связь зарегистрирована */
export const REFERRAL_BONUS_RUBLES = 100

/**
 * Парсит startParam вида `ref_<userId>` и привязывает referrerId,
 * если ещё не привязан и не сам себя. Возвращает true, если бонус надо выдать.
 * Идемпотентен: второй вызов ничего не делает.
 */
export async function tryAttachReferrer(userId: number, startParam: string | null): Promise<{
  referrerId: number | null
  bonusGranted: boolean
}> {
  if (!startParam) return { referrerId: null, bonusGranted: false }

  const match = /^ref_(\d+)$/.exec(startParam)
  if (!match) return { referrerId: null, bonusGranted: false }

  const referrerId = Number(match[1])
  if (!Number.isFinite(referrerId) || referrerId === userId) {
    return { referrerId: null, bonusGranted: false }
  }

  const [user, referrer] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.user.findUnique({ where: { id: referrerId } }),
  ])
  if (!user || !referrer) return { referrerId: null, bonusGranted: false }
  if (user.referrerId || user.referralBonusGranted) {
    // Уже был привязан ранее — ничего не делаем
    return { referrerId: user.referrerId, bonusGranted: false }
  }

  // Привязываем + выдаём бонус обоим внутри транзакции
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { referrerId, referralBonusGranted: true },
    }),
    prisma.gameState.update({
      where: { userId },
      data: { balance: { increment: REFERRAL_BONUS_RUBLES } },
    }),
    prisma.gameState.update({
      where: { userId: referrerId },
      data: { balance: { increment: REFERRAL_BONUS_RUBLES } },
    }),
    prisma.transaction.create({
      data: {
        userId,
        projectName: `По пригласительной грамоте от ${referrer.firstName}`,
        type: 'REFERRAL_BONUS',
        amount: REFERRAL_BONUS_RUBLES,
        day: 0,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: referrerId,
        projectName: `За сватовство ${user.firstName}`,
        type: 'REFERRAL_BONUS',
        amount: REFERRAL_BONUS_RUBLES,
        day: 0,
      },
    }),
  ])

  return { referrerId, bonusGranted: true }
}

/** Число приглашённых «купцов» — для ленидерборда сватов */
export async function countReferrals(userId: number): Promise<number> {
  return prisma.user.count({ where: { referrerId: userId } })
}
