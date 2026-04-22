import { InvestorRank } from './types'

/**
 * Ранги зависят только от достатка (totalWealth = balance + активные вложения)
 * и чуйки. Дни больше не влияют — механика кулдауна и так растягивает игру во времени.
 *
 *   Скоморох (NEWBIE)       — старт
 *   Купец    (AMBASSADOR)   — 100 ₽   + чуйка 10
 *   Мудрец   (ANALYST)      — 1 000 ₽ + чуйка 50
 *   Богатырь (SHARK)        — 3 000 ₽ + чуйка 100
 *   Царь     (LAMBO_SENSEI) — 10 000 ₽ + чуйка 300
 */
export function computeRank(params: {
  currentDay: number
  totalWealth: number
  intuitionScore: number
}): InvestorRank {
  const { totalWealth, intuitionScore } = params

  if (totalWealth >= 10000 && intuitionScore >= 300) return InvestorRank.LAMBO_SENSEI
  if (totalWealth >= 3000  && intuitionScore >= 100) return InvestorRank.SHARK
  if (totalWealth >= 1000  && intuitionScore >= 50)  return InvestorRank.ANALYST
  if (totalWealth >= 100   && intuitionScore >= 10)  return InvestorRank.AMBASSADOR
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
