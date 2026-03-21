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
        projectRepository.closeProject(projectId, "Игрок вышел из дела")

        val state = gameStateRepository.getGameState()
        gameStateRepository.updateBalance(state.balance + returned)
        gameStateRepository.recordReturn(returned)

        returned
    }
}
