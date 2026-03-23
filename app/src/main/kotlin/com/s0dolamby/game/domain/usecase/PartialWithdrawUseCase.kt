package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.domain.model.ProjectType
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

        // Withdrawal rules depend on project type
        val actualReturned: Double = when (project.type) {
            // Долгосрочные — не более 25% вложенного за раз
            ProjectType.POTION_BREW, ProjectType.GUILD_SCHEME -> {
                val limit = project.investedAmountRubles * 0.25
                require(amountRubles <= limit) {
                    "Долгосрочное дело: лимит вывода %.0f ₽ (25%% от вложенного)".format(limit)
                }
                amountRubles
            }
            // Рискованные — вывести можно любую сумму, но с комиссией -25% «за срочность»
            ProjectType.CARD_GAME, ProjectType.TREASURE_HUNT -> {
                val fee = amountRubles * 0.25
                val returned = amountRubles - fee
                // inform caller via result — fee is deducted silently
                returned
            }
            // Честная торговля — без ограничений
            ProjectType.HONEST_TRADE -> amountRubles
        }

        val withdrawRatio = amountRubles / project.currentValueRubles
        val newInvested = max(0.0, project.investedAmountRubles * (1.0 - withdrawRatio))
        val newCurrentValue = project.currentValueRubles - amountRubles

        projectRepository.updateProject(project.copy(
            investedAmountRubles = newInvested,
            currentValueRubles = newCurrentValue
        ))

        val state = gameStateRepository.getGameState()
        gameStateRepository.updateBalance(state.balance + actualReturned)
        gameStateRepository.recordReturn(actualReturned)
        actualReturned
    }
}
