package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.ProjectFate
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.random.Random

class AdvanceDayUseCase @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val projectRepository: ProjectRepository,
    private val generateProjectUseCase: GenerateProjectUseCase,
    private val generateDailyUpdatesUseCase: GenerateDailyUpdatesUseCase,
    private val generateProjectBannerUseCase: GenerateProjectBannerUseCase
) {
    suspend operator fun invoke(): Result<Unit> = runCatching {
        val state = gameStateRepository.getGameState()
        AppLogger.i("AdvanceDayUseCase", "day=${state.currentDay} activeProjects=${state.activeProjects.size}")
        var balanceDelta = 0.0

        // Process each active project
        for (project in state.activeProjects) {
            val newDaysUntilCollapse = project.daysUntilCollapse?.minus(1)

            if (newDaysUntilCollapse != null && newDaysUntilCollapse <= 0) {
                // Project collapses
                val lossPercent = when (project.fate) {
                    ProjectFate.INSTANT_SCAM -> Random.nextDouble(0.80, 1.0)
                    ProjectFate.SLOW_DRAIN -> Random.nextDouble(0.30, 0.70)
                    ProjectFate.HONEST_FAIL -> Random.nextDouble(0.10, 0.40)
                    else -> 0.0
                }
                val returned = project.investedAmountTON * (1 - lossPercent)
                balanceDelta += returned
                gameStateRepository.recordReturn(returned)
                projectRepository.closeProject(project.id, buildClosureReason(project.fate))
                gameStateRepository.recordScamMissed()
            } else {
                // Accrue daily yield
                val dailyYield = project.investedAmountTON * project.realDailyYieldTON
                balanceDelta += dailyYield
                gameStateRepository.recordReturn(dailyYield)

                val updatedProject = project.copy(
                    daysSinceJoined = project.daysSinceJoined + 1,
                    daysUntilCollapse = newDaysUntilCollapse,
                    currentValueTON = project.currentValueTON + dailyYield
                )
                projectRepository.updateProject(updatedProject)

                // Generate daily update text
                generateDailyUpdatesUseCase(updatedProject)
                    .onFailure { e -> AppLogger.e("AdvanceDayUseCase", "Update generation failed: ${e.message}") }
            }
        }

        // Update balance and day counter
        val newBalance = state.balance + balanceDelta
        gameStateRepository.updateBalance(newBalance)
        gameStateRepository.advanceDay()

        // Close yesterday's inbox offers, then generate fresh ones
        projectRepository.closeAllInboxProjects()

        val newProjectCount = Random.nextInt(1, 4)
        coroutineScope {
            repeat(newProjectCount) {
                val project = generateProjectUseCase().getOrNull()
                if (project != null) {
                    // Generate banner in parallel — doesn't block the day advance result
                    launch {
                        generateProjectBannerUseCase(project)
                            .onFailure { e -> AppLogger.e("AdvanceDayUseCase", "Banner generation failed: ${e.message}") }
                    }
                } else {
                    AppLogger.e("AdvanceDayUseCase", "Failed to generate project")
                }
            }
        }
    }

    private fun buildClosureReason(fate: ProjectFate): String = when (fate) {
        ProjectFate.INSTANT_SCAM -> "Проект исчез вместе с деньгами"
        ProjectFate.SLOW_DRAIN -> "Проект тихо закрылся без объяснений"
        ProjectFate.HONEST_FAIL -> "Разработчик объявил о закрытии из-за экономики"
        else -> "Проект завершил работу"
    }
}
