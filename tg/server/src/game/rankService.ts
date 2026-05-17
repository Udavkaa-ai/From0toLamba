import { InvestorRank } from './types'
import { prisma } from '../db/prisma'

/**
 * С версии 4 «чуйка» из игры убрана. Чины зависят только от количества дел,
 * в которых игрок принял участие (investedAmountRubles > 0):
 *
 *   Скоморох (NEWBIE)        — 0..4 дел
 *   Купец    (AMBASSADOR)    — 5..19 дел
 *   Мудрец   (ANALYST)       — 20..49 дел
 *   Боярин   (SHARK)         — 50..99 дел
 *   Князь    (LAMBO_SENSEI)  — 100+ дел
 */
export const RANK_DEAL_THRESHOLDS = {
  AMBASSADOR: 5,
  ANALYST: 20,
  SHARK: 50,
  LAMBO_SENSEI: 100,
}

export function computeRank(params: { dealsCount: number }): InvestorRank {
  const { dealsCount } = params
  if (dealsCount >= RANK_DEAL_THRESHOLDS.LAMBO_SENSEI) return InvestorRank.LAMBO_SENSEI
  if (dealsCount >= RANK_DEAL_THRESHOLDS.SHARK)        return InvestorRank.SHARK
  if (dealsCount >= RANK_DEAL_THRESHOLDS.ANALYST)      return InvestorRank.ANALYST
  if (dealsCount >= RANK_DEAL_THRESHOLDS.AMBASSADOR)   return InvestorRank.AMBASSADOR
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

/** Сколько дел игрок «взял» (вложил гроши) — активных + закрытых, без inbox и
 *  пропущенных. */
export async function countDeals(userId: number): Promise<number> {
  return prisma.project.count({
    where: { userId, investedAmountRubles: { gt: 0 } },
  })
}

/**
 * Пересчитать ранг по актуальному числу взятых дел и сохранить, если изменился.
 * При повышении ставит pendingRankUp — на главной покажется поздравление.
 * Вызывать после событий, которые меняют число дел (вход в дело, выход).
 */
export async function recomputeRank(userId: number): Promise<InvestorRank> {
  const [gs, dealsCount] = await Promise.all([
    prisma.gameState.findUniqueOrThrow({ where: { userId }, select: { investorRank: true } }),
    countDeals(userId),
  ])
  const newRank = computeRank({ dealsCount })
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
