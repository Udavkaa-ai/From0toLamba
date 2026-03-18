package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject
import kotlin.math.max

class PartialWithdrawUseCase @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val projectRepository: ProjectRepository
) {
    suspend operator fun invoke(projectId: String, amountTON: Double): Result<Double> = runCatching {
        val project = projectRepository.getProjectById(projectId)
            ?: error("Проект не найден")
        require(project.isActive) { "Проект не активен" }
        require(!project.isWithdrawalLocked) { "Вывод заблокирован — дождитесь восстановления или закрытия проекта" }
        require(amountTON >= 0.1) { "Минимум 0.1 TON" }
        require(amountTON <= project.currentValueTON) {
            "Недостаточно средств: %.2f TON доступно".format(project.currentValueTON)
        }

        // Reduce invested proportionally so daily yield reflects remaining stake
        val withdrawRatio = amountTON / project.currentValueTON
        val newInvested = max(0.0, project.investedAmountTON * (1.0 - withdrawRatio))
        val newCurrentValue = project.currentValueTON - amountTON

        projectRepository.updateProject(project.copy(
            investedAmountTON = newInvested,
            currentValueTON = newCurrentValue
        ))

        val state = gameStateRepository.getGameState()
        gameStateRepository.updateBalance(state.balance + amountTON)
        gameStateRepository.recordReturn(amountTON)
        amountTON
    }
}
