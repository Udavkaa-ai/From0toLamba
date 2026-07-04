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
}
