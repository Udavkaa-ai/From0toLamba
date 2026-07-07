package com.s0dolamby.game.domain.ranks

import com.s0dolamby.game.domain.model.InvestorRank

/**
 * Чин по числу взятых дел.
 *
 * "Взятое дело" = дело, в которое игрок вкладывался хотя бы раз
 * (Project.isActive=true сейчас, либо Project.isClosed=true с любой
 * причиной кроме «Предложение не принято»).
 *
 * Пороги (новая механика 4.0+, ранее зависело от дня/баланса/чуйки):
 *   ≥ 100 → Князь
 *   ≥  50 → Боярин
 *   ≥  20 → Мудрец
 *   ≥   5 → Купец
 *   <   5 → Скоморох
 */
object RankService {

    fun rankFor(takenDeals: Int): InvestorRank = when {
        takenDeals >= 100 -> InvestorRank.LAMBO_SENSEI
        takenDeals >= 50  -> InvestorRank.SHARK
        takenDeals >= 20  -> InvestorRank.ANALYST
        takenDeals >= 5   -> InvestorRank.AMBASSADOR
        else              -> InvestorRank.NEWBIE
    }

    /** Сколько дел нужно ещё чтобы дойти до следующего ранга. null если уже на максимуме. */
    fun dealsUntilNextRank(takenDeals: Int): Int? = when {
        takenDeals < 5   -> 5 - takenDeals
        takenDeals < 20  -> 20 - takenDeals
        takenDeals < 50  -> 50 - takenDeals
        takenDeals < 100 -> 100 - takenDeals
        else             -> null
    }

    /** Тиеры суммарного вложения в одно дело (г). */
    val INVESTMENT_TIERS: List<Double> = listOf(100.0, 1000.0, 5000.0, 10000.0)

    /**
     * Потолок СУММАРНОГО вложения в одно дело по чину: чем выше чин, тем
     * больше можно доверить одному делу. Раньше потолок был только на разовую
     * транзакцию (5000), а докладывать можно было без предела — теперь предел
     * на всё дело.
     */
    fun maxInvestmentPerDeal(rank: InvestorRank): Double = when (rank) {
        InvestorRank.NEWBIE -> 100.0
        InvestorRank.AMBASSADOR -> 1000.0
        InvestorRank.ANALYST -> 5000.0
        InvestorRank.SHARK -> 10000.0
        InvestorRank.LAMBO_SENSEI -> 10000.0
    }
}
