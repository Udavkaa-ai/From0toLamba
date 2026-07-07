package com.s0dolamby.game.presentation.minigame.common

import com.s0dolamby.game.domain.model.InvestorRank

/**
 * Общая сложность мини-игр по чину игрока. Чем выше чин, тем длиннее
 * последовательности запоминания и короче отпущенное время — как в печатях
 * Боярина (там растёт число видов отличий). Каждая игра берёт [tier] (0..4)
 * и подкручивает свои параметры.
 */
object MinigameDifficulty {
    fun tier(rank: InvestorRank): Int = when (rank) {
        InvestorRank.NEWBIE -> 0
        InvestorRank.AMBASSADOR -> 1
        InvestorRank.ANALYST -> 2
        InvestorRank.SHARK -> 3
        InvestorRank.LAMBO_SENSEI -> 4
    }
}
