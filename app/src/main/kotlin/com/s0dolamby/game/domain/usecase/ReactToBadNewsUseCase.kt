package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject
import kotlin.math.abs
import kotlin.random.Random

/** Исход «Зоркого счёта» — реакции на тревожную весть. */
enum class BadNewsOutcome {
    /** Все числа найдены, ≤1 ошибки — беда отбита, возврат половины урона. */
    WIN,
    /** Дошёл, но с помарками (2+ ошибки) или почти успел — паника: заморозка начислений. */
    LOSE,
    /** Совсем не собрался (найдено меньше половины) — вывод заперт до закрытия. */
    FAIL
}

/**
 * Применяет исход реакции на негативную весть к делу:
 *  - WIN: возвращает 50% урона события в стоимость дела;
 *  - LOSE: заморозка начислений на 2–3 дня;
 *  - FAIL: блокировка вывода до закрытия дела.
 */
class ReactToBadNewsUseCase @Inject constructor(
    private val projectRepository: ProjectRepository
) {
    /**
     * @param eventDeltaRubles дельта события из вести (отрицательная для урона)
     * @return сумма возврата при WIN (для снэкбара), 0.0 иначе
     */
    suspend operator fun invoke(
        projectId: String,
        eventDeltaRubles: Double,
        outcome: BadNewsOutcome
    ): Result<Double> = runCatching {
        val project = projectRepository.getProjectById(projectId)
            ?: error("Дело не найдено")
        if (!project.isActive) error("Дело уже закрыто")

        when (outcome) {
            BadNewsOutcome.WIN -> {
                val recovered = abs(eventDeltaRubles) * 0.5
                projectRepository.updateProject(
                    project.copy(currentValueRubles = project.currentValueRubles + recovered)
                )
                AppLogger.i("BadNews", "WIN on ${project.claimedName}: +$recovered")
                recovered
            }
            BadNewsOutcome.LOSE -> {
                val days = Random.nextInt(2, 4) // 2..3 дня
                projectRepository.updateProject(project.copy(yieldFreezeDays = days))
                AppLogger.i("BadNews", "LOSE on ${project.claimedName}: freeze $days d")
                0.0
            }
            BadNewsOutcome.FAIL -> {
                projectRepository.updateProject(project.copy(isWithdrawalLocked = true))
                AppLogger.i("BadNews", "FAIL on ${project.claimedName}: withdrawal locked")
                0.0
            }
        }
    }
}
