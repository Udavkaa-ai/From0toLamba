import { InvestorRank } from './types'
import { prisma } from '../db/prisma'

/**
 * Ранги зависят от достатка (totalWealth = balance + активные вложения) и чуйки.
 *
 *   Скоморох (NEWBIE)       — старт
 *   Купец    (AMBASSADOR)   — 100 г    + чуйка 20
 *   Мудрец   (ANALYST)      — 1 000 г  + чуйка 100
 *   Боярин   (SHARK)        — 10 000 г + чуйка 300
 *   Князь    (LAMBO_SENSEI) — 50 000 г + чуйка 500
 */
export function computeRank(params: {
  currentDay: number
  totalWealth: number
  intuitionScore: number
}): InvestorRank {
  const { totalWealth, intuitionScore } = params

  if (totalWealth >= 50000 && intuitionScore >= 500) return InvestorRank.LAMBO_SENSEI
  if (totalWealth >= 10000 && intuitionScore >= 300) return InvestorRank.SHARK
  if (totalWealth >= 1000  && intuitionScore >= 100) return InvestorRank.ANALYST
  if (totalWealth >= 100   && intuitionScore >= 20)  return InvestorRank.AMBASSADOR
  return InvestorRank.NEWBIE
}

/** Порядок рангов по возрастанию — чтобы различать повышение и понижение */
const RANK_ORDER: Record<InvestorRank, number> = {
  [InvestorRank.NEWBIE]:       0,
  [InvestorRank.AMBASSADOR]:   1,
  [InvestorRank.ANALYST]:      2,
  [InvestorRank.SHARK]:        3,
  [InvestorRank.LAMBO_SENSEI]: 4,
}

export function isRankUp(oldRank: InvestorRank, newRank: InvestorRank): boolean {
  return RANK_ORDER[newRank] > RANK_ORDER[oldRank]
}

/**
 * Пересчитать ранг по актуальным данным и сохранить, если изменился.
 * При повышении ставит pendingRankUp — на главной покажется поздравление.
 * Вызывать после событий, которые меняют чуйку или достаток вне advance-day
 * (сабмит грамоты, выход из дела) — иначе ранг «прилипает» к значению
 * последнего перехода дня.
 */
export async function recomputeRank(userId: number): Promise<InvestorRank> {
  const [gs, actives] = await Promise.all([
    prisma.gameState.findUniqueOrThrow({ where: { userId } }),
    prisma.project.findMany({
      where: { userId, isActive: true },
      select: { currentValueRubles: true },
    }),
  ])
  const totalWealth = gs.balance + actives.reduce((s, p) => s + p.currentValueRubles, 0)
  const newRank = computeRank({
    currentDay: gs.currentDay,
    totalWealth,
    intuitionScore: gs.intuitionScore,
  })
  const oldRank = gs.investorRank as InvestorRank
  if (newRank === oldRank) return newRank

  const rankUp = isRankUp(oldRank, newRank)
  await prisma.gameState.update({
    where: { userId },
    data: {
      investorRank: newRank,
      ...(rankUp ? { pendingRankUp: newRank } : {}),
    },
  })
  return newRank
}
