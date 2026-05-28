package com.s0dolamby.game.domain.config

import com.s0dolamby.game.domain.model.ProjectFate

data class FateParams(
    val daysRange: IntRange,
    val dailyYieldRange: ClosedFloatingPointRange<Double>,
    val lossRange: ClosedFloatingPointRange<Double>,
    val weight: Int
)

object FateConfig {
    val params: Map<ProjectFate, FateParams> = mapOf(
        ProjectFate.INSTANT_SCAM to FateParams(
            daysRange = 1..3,
            dailyYieldRange = 0.002..0.008,
            lossRange = 0.8..1.0,
            weight = 30
        ),
        ProjectFate.SLOW_DRAIN to FateParams(
            daysRange = 7..21,
            dailyYieldRange = 0.003..0.015,
            lossRange = 0.3..0.7,
            weight = 25
        ),
        ProjectFate.HONEST_FAIL to FateParams(
            daysRange = 14..30,
            dailyYieldRange = 0.001..0.005,
            lossRange = 0.1..0.4,
            weight = 15
        ),
        ProjectFate.SURVIVOR to FateParams(
            daysRange = 15..30,
            dailyYieldRange = 0.003..0.015,
            lossRange = 0.0..0.0,
            weight = 20
        ),
        ProjectFate.UNICORN to FateParams(
            daysRange = 20..30,
            dailyYieldRange = 0.02..0.1,
            lossRange = 0.0..0.0,
            weight = 10
        )
    )

    operator fun get(fate: ProjectFate): FateParams = params.getValue(fate)
}
