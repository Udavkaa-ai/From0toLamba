package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject
import kotlin.math.abs
import kotlin.random.Random

/** Игровой результат «Зоркого счёта» (что показала сама мини-игра). */
enum class BadNewsOutcome {
    /** Все числа найдены чисто (для вести о заморозке — вообще без ошибок). */
    WIN,
    /** Дошёл с помарками или почти успел. */
    LOSE,
    /** Совсем не собрался (найдено меньше половины). */
    FAIL
}

/** Применённое последствие — для снэкбара и звука. */
sealed class BadNewsEffect {
    /** Обычный негатив, победа: половина урона вернулась в дело. */
    data class Recovered(val amountRubles: Double) : BadNewsEffect()
    /** Обычный негатив, неудача: заморозка начислений. */
    data class Frozen(val days: Int) : BadNewsEffect()
    /** Весть о заморозке вывода, чистая победа: успел — вывод открыт. */
    object Unlocked : BadNewsEffect()
    /** Весть о заморозке вывода, неудача: условие вести просто действует. */
    object LockStays : BadNewsEffect()
}

/**
 * Применяет исход «Зоркого счёта» к делу.
 *
 * Обычная тревожная весть (урон события):
 *  - WIN → возврат 50% урона; иначе → заморозка начислений на 2–3 дня.
 *  Блокировки вывода за проигрыш БОЛЬШЕ НЕТ — это был перебор.
 *
 * Весть о заморозке вывода (дело уже с isWithdrawalLocked):
 *  - WIN (без ошибок) → вывод открывается: окно «вывести в последний момент»;
 *  - иначе → ничего не добавляется, условие вести просто остаётся в силе.
 */
class ReactToBadNewsUseCase @Inject constructor(
    private val projectRepository: ProjectRepository
) {
    suspend operator fun invoke(
        projectId: String,
        eventDeltaRubles: Double,
        outcome: BadNewsOutcome
    ): Result<BadNewsEffect> = runCatching {
        val project = projectRepository.getProjectById(projectId)
            ?: error("Дело не найдено")
        if (!project.isActive) error("Дело уже закрыто")

        if (project.isWithdrawalLocked) {
            // Реакция на весть о заморозке вывода
            if (outcome == BadNewsOutcome.WIN) {
                projectRepository.updateProject(project.copy(isWithdrawalLocked = false))
                AppLogger.i("BadNews", "UNLOCK window on ${project.claimedName}")
                BadNewsEffect.Unlocked
            } else {
                AppLogger.i("BadNews", "lock stays on ${project.claimedName}")
                BadNewsEffect.LockStays
            }
        } else when (outcome) {
            BadNewsOutcome.WIN -> {
                val recovered = abs(eventDeltaRubles) * 0.5
                projectRepository.updateProject(
                    project.copy(currentValueRubles = project.currentValueRubles + recovered)
                )
                AppLogger.i("BadNews", "WIN on ${project.claimedName}: +$recovered")
                BadNewsEffect.Recovered(recovered)
            }
            BadNewsOutcome.LOSE, BadNewsOutcome.FAIL -> {
                val days = Random.nextInt(2, 4) // 2..3 дня
                projectRepository.updateProject(project.copy(yieldFreezeDays = days))
                AppLogger.i("BadNews", "freeze on ${project.claimedName}: $days d")
                BadNewsEffect.Frozen(days)
            }
        }
    }
}
