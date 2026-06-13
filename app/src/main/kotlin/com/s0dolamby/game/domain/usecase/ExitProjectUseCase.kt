package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject

class ExitProjectUseCase @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val projectRepository: ProjectRepository
) {
    suspend operator fun invoke(projectId: String): Result<Double> = runCatching {
        val project = projectRepository.getProjectById(projectId)
            ?: error("Дело не найдено")

        val returned = project.currentValueRubles
        projectRepository.closeProject(projectId, "Игрок вышел из дела", returned)

        val state = gameStateRepository.getGameState()
        gameStateRepository.updateBalance(state.balance + returned)
        gameStateRepository.recordReturn(returned)

        // Прогресс по архетипу: связь и жетон даются только если дело
        // вышло в плюс (возврат > вложений). Учитываем уже выведенные
        // ранее средства из totalWithdrawnRubles нельзя — поля нет в
        // domain Project, поэтому пока сравниваем по investedAmountRubles.
        gameStateRepository.awardArchetypeProgress(
            archetype = project.personaArchetype,
            profitable = returned > project.investedAmountRubles
        )
        gameStateRepository.recomputeAchievements()

        returned
    }
}
