package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

class InvestUseCase @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val projectRepository: ProjectRepository,
    private val generateProjectBannerUseCase: GenerateProjectBannerUseCase
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    suspend operator fun invoke(projectId: String, amountTON: Double): Result<Unit> = runCatching {
        require(amountTON >= GameConfig.MIN_INVESTMENT_TON) {
            "Минимальная инвестиция ${GameConfig.MIN_INVESTMENT_TON} TON"
        }
        require(amountTON <= GameConfig.MAX_INVESTMENT_TON) {
            "Максимальная инвестиция ${GameConfig.MAX_INVESTMENT_TON} TON"
        }

        val state = gameStateRepository.getGameState()
        require(state.balance >= amountTON) { "Недостаточно TON на балансе" }

        val project = projectRepository.getProjectById(projectId)
            ?: error("Проект не найден")

        // Only check project cap when investing for the first time
        if (!project.isActive) {
            require(state.activeProjects.size < GameConfig.MAX_ACTIVE_PROJECTS) {
                "Максимум ${GameConfig.MAX_ACTIVE_PROJECTS} активных проектов"
            }
        }
        require(!project.isWithdrawalLocked) { "Довложение невозможно — вывод средств заблокирован" }

        val isFirstInvestment = !project.isActive
        val updated = project.copy(
            investedAmountTON = project.investedAmountTON + amountTON,
            currentValueTON = project.currentValueTON + amountTON,
            isActive = true
        )
        projectRepository.updateProject(updated)
        gameStateRepository.updateBalance(state.balance - amountTON)
        gameStateRepository.recordInvestment(amountTON)

        // Generate banner only on first investment — saves API calls for projects player ignores
        if (isFirstInvestment && project.bannerImageUrl == null) {
            scope.launch {
                generateProjectBannerUseCase(updated)
                    .onFailure { e -> AppLogger.e("InvestUseCase", "Banner gen failed: ${e.message}") }
            }
        }
    }
}
