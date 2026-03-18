package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject

class InvestUseCase @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val projectRepository: ProjectRepository
) {
    suspend operator fun invoke(projectId: String, amountTON: Double): Result<Unit> = runCatching {
        require(amountTON >= GameConfig.MIN_INVESTMENT_TON) {
            "Минимальная инвестиция ${GameConfig.MIN_INVESTMENT_TON} TON"
        }
        require(amountTON <= GameConfig.MAX_INVESTMENT_TON) {
            "Максимальная инвестиция ${GameConfig.MAX_INVESTMENT_TON} TON"
        }

        val state = gameStateRepository.getGameState()
        require(state.balance >= amountTON) { "Недостаточно TON на балансе" }
        require(state.activeProjects.size < GameConfig.MAX_ACTIVE_PROJECTS) {
            "Максимум ${GameConfig.MAX_ACTIVE_PROJECTS} активных проектов"
        }

        val project = projectRepository.getProjectById(projectId)
            ?: error("Проект не найден")

        val updated = project.copy(
            investedAmountTON = project.investedAmountTON + amountTON,
            currentValueTON = project.investedAmountTON + amountTON,
            isActive = true
        )
        projectRepository.updateProject(updated)
        gameStateRepository.updateBalance(state.balance - amountTON)
        gameStateRepository.recordInvestment(amountTON)
    }
}
