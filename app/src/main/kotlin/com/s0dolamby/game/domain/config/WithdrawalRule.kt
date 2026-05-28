package com.s0dolamby.game.domain.config

import com.s0dolamby.game.domain.model.ProjectType

data class WithdrawalRule(
    val maxPercent: Double?,
    val feePercent: Double
)

object WithdrawalRules {
    private val rules: Map<ProjectType, WithdrawalRule> = mapOf(
        ProjectType.POTION_BREW to WithdrawalRule(maxPercent = 0.25, feePercent = 0.0),
        ProjectType.GUILD_SCHEME to WithdrawalRule(maxPercent = 0.25, feePercent = 0.0),
        ProjectType.CARD_GAME to WithdrawalRule(maxPercent = null, feePercent = 0.25),
        ProjectType.TREASURE_HUNT to WithdrawalRule(maxPercent = null, feePercent = 0.25),
        ProjectType.HONEST_TRADE to WithdrawalRule(maxPercent = null, feePercent = 0.0)
    )

    operator fun get(type: ProjectType): WithdrawalRule = rules.getValue(type)
}
