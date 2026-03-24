import { InvestorRank } from './types'

export function computeRank(params: {
  currentDay: number
  totalWealth: number // balance + sum(currentValueRubles)
  intuitionScore: number
}): InvestorRank {
  const { currentDay, totalWealth, intuitionScore } = params

  if (currentDay >= 777 && totalWealth >= 7777 && intuitionScore >= 20) {
    return InvestorRank.LAMBO_SENSEI
  }
  if (currentDay >= 50 && totalWealth >= 1000 && intuitionScore >= 10) {
    return InvestorRank.SHARK
  }
  if (currentDay >= 30 && totalWealth >= 300 && intuitionScore >= 5) {
    return InvestorRank.ANALYST
  }
  if (currentDay >= 5 || totalWealth >= 20) {
    return InvestorRank.AMBASSADOR
  }
  return InvestorRank.NEWBIE
}
