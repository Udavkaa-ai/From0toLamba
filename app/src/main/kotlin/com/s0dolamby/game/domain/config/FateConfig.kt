package com.s0dolamby.game.domain.config

import com.s0dolamby.game.domain.model.ProjectFate

data class FateParams(
    val daysRange: IntRange,
    val dailyYieldRange: ClosedFloatingPointRange<Double>,
    val lossRange: ClosedFloatingPointRange<Double>,
    val weight: Int
)

/**
 * БАЛАНС ЭКОНОМИКИ. Суммарная доходность дела за жизнь считается как
 * `dailyYield × YIELD_MULTIPLIER(10) × days` (простые проценты от вложенного).
 *
 * Целевые суммарные доходности при благополучном исходе:
 *  - UNICORN («Жар-птица») — максимум игры: 200–495% за 20–30 дней;
 *  - SURVIVOR — честный долгожитель: 18–150% за 15–30 дней;
 *  - скам-судьбы заманивают ДНЕВНОЙ доходностью выше честной, но
 *    забирают всё крахом — сказочно выгодных дел в игре нет.
 */
object FateConfig {
    val params: Map<ProjectFate, FateParams> = mapOf(
        // Приманка: 8–20% в день — слишком хорошо, чтобы быть правдой.
        // Живёт 2–5 дней (как в летописи) и исчезает с 80–100% денег.
        ProjectFate.INSTANT_SCAM to FateParams(
            daysRange = 2..5,
            dailyYieldRange = 0.008..0.020,
            lossRange = 0.8..1.0,
            weight = 30
        ),
        // Заманчивее честных: 3–8% в день, но в конце −30..70%.
        ProjectFate.SLOW_DRAIN to FateParams(
            daysRange = 7..21,
            dailyYieldRange = 0.003..0.008,
            lossRange = 0.3..0.7,
            weight = 25
        ),
        // Честный неудачник: скромные 1–3% в день, в конце −10..40%.
        ProjectFate.HONEST_FAIL to FateParams(
            daysRange = 14..30,
            dailyYieldRange = 0.001..0.003,
            lossRange = 0.1..0.4,
            weight = 15
        ),
        // Опора капитала: 1.2–5% в день → 18–150% за жизнь.
        ProjectFate.SURVIVOR to FateParams(
            daysRange = 15..30,
            dailyYieldRange = 0.0012..0.005,
            lossRange = 0.0..0.0,
            weight = 20
        ),
        // Жар-птица: 10–16.5% в день → 200–495% за жизнь. Потолок игры.
        ProjectFate.UNICORN to FateParams(
            daysRange = 20..30,
            dailyYieldRange = 0.010..0.0165,
            lossRange = 0.0..0.0,
            weight = 10
        )
    )

    operator fun get(fate: ProjectFate): FateParams = params.getValue(fate)
}
