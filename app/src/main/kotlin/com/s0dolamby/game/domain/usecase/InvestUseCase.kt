package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject

class InvestUseCase @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val projectRepository: ProjectRepository
) {
    suspend operator fun invoke(projectId: String, amountRubles: Double): Result<Unit> = runCatching {
        require(amountRubles >= GameConfig.MIN_INVESTMENT_RUBLES) {
            "Минимальный вклад ${GameConfig.MIN_INVESTMENT_RUBLES.toInt()} г"
        }
        require(amountRubles <= GameConfig.MAX_INVESTMENT_RUBLES) {
            "Максимальный вклад ${GameConfig.MAX_INVESTMENT_RUBLES.toInt()} г"
        }

        val state = gameStateRepository.getGameState()
        require(state.balance >= amountRubles) { "Недостаточно грошей в кошеле" }

        val project = projectRepository.getProjectById(projectId)
            ?: error("Дело не найдено")

        if (!project.isActive) {
            require(state.activeProjects.size < GameConfig.MAX_ACTIVE_PROJECTS) {
                "Не более ${GameConfig.MAX_ACTIVE_PROJECTS} активных дел"
            }
        }
        require(!project.isWithdrawalLocked) { "Довложение невозможно — деньги заморожены" }

        val isFirstInvestment = !project.isActive
        val updated = project.copy(
            investedAmountRubles = project.investedAmountRubles + amountRubles,
            currentValueRubles = project.currentValueRubles + amountRubles,
            isActive = true
        )
        projectRepository.updateProject(updated)
        gameStateRepository.updateBalance(state.balance - amountRubles)
        gameStateRepository.recordInvestment(amountRubles)

        if (isFirstInvestment) {
            gameStateRepository.updateRankIfNeeded()
        }
    }
}
