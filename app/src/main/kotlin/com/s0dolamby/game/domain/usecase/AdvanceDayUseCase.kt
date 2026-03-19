package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.model.ProjectFate
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject
import kotlin.random.Random

class AdvanceDayUseCase @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val projectRepository: ProjectRepository,
    private val generateProjectUseCase: GenerateProjectUseCase,
    private val generateDailyUpdatesUseCase: GenerateDailyUpdatesUseCase
) {
    // Each game day counts as 10 real days of yield — keeps progression engaging
    private val YIELD_MULTIPLIER = 10.0

    suspend operator fun invoke(): Result<List<DailyUpdate>> = runCatching {
        val state = gameStateRepository.getGameState()
        AppLogger.i("AdvanceDayUseCase", "day=${state.currentDay} activeProjects=${state.activeProjects.size}")
        var balanceDelta = 0.0
        val generatedUpdates = mutableListOf<DailyUpdate>()

        for (project in state.activeProjects) {
            val newDaysUntilCollapse = project.daysUntilCollapse?.minus(1)
            val isScamFate = project.fate == ProjectFate.INSTANT_SCAM || project.fate == ProjectFate.SLOW_DRAIN

            when {
                // Lock withdrawals 2 days before collapse for scam-type fates
                isScamFate && newDaysUntilCollapse != null && newDaysUntilCollapse == 2 && !project.isWithdrawalLocked -> {
                    val dailyYield = project.investedAmountTON * project.realDailyYieldTON * YIELD_MULTIPLIER
                    balanceDelta += dailyYield
                    gameStateRepository.recordReturn(dailyYield)
                    val (newHistory, newApyHistory) = updateHistories(project, dailyYield)
                    projectRepository.updateProject(project.copy(
                        daysSinceJoined = project.daysSinceJoined + 1,
                        daysUntilCollapse = newDaysUntilCollapse,
                        currentValueTON = project.currentValueTON + dailyYield,
                        isWithdrawalLocked = true,
                        currentUserCount = newHistory.lastOrNull() ?: project.currentUserCount,
                        userCountHistory = newHistory,
                        apyHistory = newApyHistory
                    ))
                    generateDailyUpdatesUseCase(project)
                        .onSuccess { generatedUpdates.add(it) }
                        .onFailure { e -> AppLogger.e("AdvanceDayUseCase", "Update failed: ${e.message}") }
                }

                // Collapse moment — chance to recover or close
                newDaysUntilCollapse != null && newDaysUntilCollapse <= 0 && isScamFate -> {
                    if (Random.nextFloat() < 0.20f) {
                        // Lucky recovery — project resumes for a few more days
                        val recoveryDays = Random.nextInt(3, 8)
                        val dailyYield = project.investedAmountTON * project.realDailyYieldTON * YIELD_MULTIPLIER
                        balanceDelta += dailyYield
                        gameStateRepository.recordReturn(dailyYield)
                        val (newHistory, newApyHistory) = updateHistories(project, dailyYield)
                        projectRepository.updateProject(project.copy(
                            daysSinceJoined = project.daysSinceJoined + 1,
                            daysUntilCollapse = recoveryDays,
                            currentValueTON = project.currentValueTON + dailyYield,
                            isWithdrawalLocked = false,
                            currentUserCount = newHistory.lastOrNull() ?: project.currentUserCount,
                            userCountHistory = newHistory,
                            apyHistory = newApyHistory
                        ))
                        AppLogger.i("AdvanceDayUseCase", "Project ${project.id} recovered for $recoveryDays more days")
                    } else {
                        // Project collapses
                        val lossPercent = when (project.fate) {
                            ProjectFate.INSTANT_SCAM -> Random.nextDouble(0.80, 1.0)
                            ProjectFate.SLOW_DRAIN -> Random.nextDouble(0.30, 0.70)
                            else -> 0.0
                        }
                        val returned = project.investedAmountTON * (1 - lossPercent)
                        balanceDelta += returned
                        gameStateRepository.recordReturn(returned)
                        projectRepository.closeProject(project.id, buildClosureReason(project.fate))
                        gameStateRepository.recordScamMissed()
                    }
                }

                // Normal collapse (non-scam fates)
                newDaysUntilCollapse != null && newDaysUntilCollapse <= 0 -> {
                    val lossPercent = when (project.fate) {
                        ProjectFate.HONEST_FAIL -> Random.nextDouble(0.10, 0.40)
                        else -> 0.0
                    }
                    val returned = project.investedAmountTON * (1 - lossPercent)
                    balanceDelta += returned
                    gameStateRepository.recordReturn(returned)
                    projectRepository.closeProject(project.id, buildClosureReason(project.fate))
                    gameStateRepository.recordScamMissed()
                }

                // Normal day — accrue yield
                else -> {
                    val dailyYield = project.investedAmountTON * project.realDailyYieldTON * YIELD_MULTIPLIER
                    balanceDelta += dailyYield
                    gameStateRepository.recordReturn(dailyYield)
                    val (newHistory, newApyHistory) = updateHistories(project, dailyYield)
                    val updatedProject = project.copy(
                        daysSinceJoined = project.daysSinceJoined + 1,
                        daysUntilCollapse = newDaysUntilCollapse,
                        currentValueTON = project.currentValueTON + dailyYield,
                        currentUserCount = newHistory.lastOrNull() ?: project.currentUserCount,
                        userCountHistory = newHistory,
                        apyHistory = newApyHistory
                    )
                    projectRepository.updateProject(updatedProject)
                    generateDailyUpdatesUseCase(updatedProject)
                        .onSuccess { generatedUpdates.add(it) }
                        .onFailure { e -> AppLogger.e("AdvanceDayUseCase", "Update failed: ${e.message}") }
                }
            }
        }

        val newBalance = state.balance + balanceDelta
        gameStateRepository.updateBalance(newBalance)
        gameStateRepository.advanceDay()

        projectRepository.closeAllInboxProjects()

        val newProjectCount = Random.nextInt(1, 4)
        repeat(newProjectCount) {
            generateProjectUseCase().onFailure { e ->
                AppLogger.e("AdvanceDayUseCase", "Project gen failed: ${e.message}")
            }
        }

        generatedUpdates
    }

    /** Returns updated (userCountHistory, apyHistory) pair after one day. */
    private fun updateHistories(
        project: com.s0dolamby.game.domain.model.Project,
        dailyYield: Double
    ): Pair<List<Int>, List<Float>> {
        val userDelta = when (project.fate) {
            ProjectFate.INSTANT_SCAM -> Random.nextInt(-5000, -500)
            ProjectFate.SLOW_DRAIN -> Random.nextInt(-2000, 500)
            ProjectFate.HONEST_FAIL -> Random.nextInt(-1000, 1000)
            ProjectFate.SURVIVOR -> Random.nextInt(-500, 2000)
            ProjectFate.UNICORN -> Random.nextInt(500, 10000)
        }
        val newUserCount = maxOf(100, project.currentUserCount + userDelta)
        val newUserHistory = (project.userCountHistory + newUserCount).takeLast(30)

        val effectiveDailyAPYPct = if (project.investedAmountTON > 0) {
            (dailyYield / project.investedAmountTON * 100).toFloat()
        } else {
            project.claimedAPY / 365f
        }
        val noise = Random.nextFloat() * 0.5f - 0.25f
        val newApyHistory = (project.apyHistory + (effectiveDailyAPYPct + noise)).takeLast(30)

        return Pair(newUserHistory, newApyHistory)
    }

    private fun buildClosureReason(fate: ProjectFate): String = when (fate) {
        ProjectFate.INSTANT_SCAM -> "Проект исчез вместе с деньгами"
        ProjectFate.SLOW_DRAIN -> "Проект тихо закрылся без объяснений"
        ProjectFate.HONEST_FAIL -> "Разработчик объявил о закрытии из-за экономики"
        else -> "Проект завершил работу"
    }
}
