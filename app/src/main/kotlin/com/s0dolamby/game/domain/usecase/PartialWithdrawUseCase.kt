package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject
import kotlin.math.max

class PartialWithdrawUseCase @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val projectRepository: ProjectRepository
) {
    suspend operator fun invoke(projectId: String, amountRubles: Double): Result<Double> = runCatching {
        val project = projectRepository.getProjectById(projectId)
            ?: error("Дело не найдено")
        require(project.isActive) { "Дело не активно" }
        require(!project.isWithdrawalLocked) { "Вывод заблокирован — ждите восстановления или закрытия" }
        require(amountRubles >= 5.0) { "Минимум 5 ₽" }
        require(amountRubles <= project.currentValueRubles) {
            "Недостаточно средств: %.0f ₽ доступно".format(project.currentValueRubles)
        }
        val dailyLimit = project.investedAmountRubles * 0.25
        require(amountRubles <= dailyLimit) {
            "Суточный лимит вывода: %.0f ₽ (25%% от вложенного)".format(dailyLimit)
        }

        val withdrawRatio = amountRubles / project.currentValueRubles
        val newInvested = max(0.0, project.investedAmountRubles * (1.0 - withdrawRatio))
        val newCurrentValue = project.currentValueRubles - amountRubles

        projectRepository.updateProject(project.copy(
            investedAmountRubles = newInvested,
            currentValueRubles = newCurrentValue
        ))

        val state = gameStateRepository.getGameState()
        gameStateRepository.updateBalance(state.balance + amountRubles)
        gameStateRepository.recordReturn(amountRubles)
        amountRubles
    }
}
