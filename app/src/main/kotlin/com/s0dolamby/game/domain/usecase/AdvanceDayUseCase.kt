package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.AnnouncementType
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.model.Project
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
    // Каждый игровой день засчитывается как 10 реальных — держит прогресс интересным
    private val YIELD_MULTIPLIER = 10.0

    // 10% шанс случайного события на проект в день
    private val EVENT_CHANCE = 0.10f

    suspend operator fun invoke(): Result<List<DailyUpdate>> = runCatching {
        val state = gameStateRepository.getGameState()
        AppLogger.i("AdvanceDayUseCase", "day=${state.currentDay} activeProjects=${state.activeProjects.size}")
        var balanceDelta = 0.0
        val generatedUpdates = mutableListOf<DailyUpdate>()

        for (project in state.activeProjects) {
            val newDaysUntilCollapse = project.daysUntilCollapse?.minus(1)
            val isScamFate = project.fate == ProjectFate.INSTANT_SCAM || project.fate == ProjectFate.SLOW_DRAIN

            when {
                // Блокируем вывод за 2 дня до краха для скам-судеб
                isScamFate && newDaysUntilCollapse != null && newDaysUntilCollapse == 2 && !project.isWithdrawalLocked -> {
                    val dailyYield = project.investedAmountRubles * project.realDailyYieldRubles * YIELD_MULTIPLIER
                    // Доход остаётся внутри проекта — не добавляем в свободный баланс
                    val (newHistory, newApyHistory) = updateHistories(project, dailyYield)
                    projectRepository.updateProject(project.copy(
                        daysSinceJoined = project.daysSinceJoined + 1,
                        daysUntilCollapse = newDaysUntilCollapse,
                        currentValueRubles = project.currentValueRubles + dailyYield,
                        isWithdrawalLocked = true,
                        currentUserCount = newHistory.lastOrNull() ?: project.currentUserCount,
                        userCountHistory = newHistory,
                        apyHistory = newApyHistory
                    ))
                    generateDailyUpdatesUseCase(project)
                        .onSuccess { generatedUpdates.add(it) }
                        .onFailure { e -> AppLogger.e("AdvanceDayUseCase", "Update failed: ${e.message}") }
                }

                // Момент краха — шанс на спасение
                newDaysUntilCollapse != null && newDaysUntilCollapse <= 0 && isScamFate -> {
                    if (Random.nextFloat() < 0.20f) {
                        // Счастливое спасение — дело продолжается ещё немного
                        val recoveryDays = Random.nextInt(3, 8)
                        val dailyYield = project.investedAmountRubles * project.realDailyYieldRubles * YIELD_MULTIPLIER
                        // Доход остаётся внутри проекта
                        val (newHistory, newApyHistory) = updateHistories(project, dailyYield)
                        projectRepository.updateProject(project.copy(
                            daysSinceJoined = project.daysSinceJoined + 1,
                            daysUntilCollapse = recoveryDays,
                            currentValueRubles = project.currentValueRubles + dailyYield,
                            isWithdrawalLocked = false,
                            currentUserCount = newHistory.lastOrNull() ?: project.currentUserCount,
                            userCountHistory = newHistory,
                            apyHistory = newApyHistory
                        ))
                        AppLogger.i("AdvanceDayUseCase", "Project ${project.id} recovered for $recoveryDays more days")
                    } else {
                        // Дело рухнуло — возвращаем часть текущей стоимости в свободный баланс
                        val lossPercent = when (project.fate) {
                            ProjectFate.INSTANT_SCAM -> Random.nextDouble(0.80, 1.0)
                            ProjectFate.SLOW_DRAIN -> Random.nextDouble(0.30, 0.70)
                            else -> 0.0
                        }
                        val returned = project.currentValueRubles * (1 - lossPercent)
                        balanceDelta += returned
                        gameStateRepository.recordReturn(returned)
                        projectRepository.closeProject(project.id, buildClosureReason(project.fate))
                        gameStateRepository.recordScamMissed()
                    }
                }

                // Обычный крах (не скам-судьбы)
                newDaysUntilCollapse != null && newDaysUntilCollapse <= 0 -> {
                    val lossPercent = when (project.fate) {
                        ProjectFate.HONEST_FAIL -> Random.nextDouble(0.10, 0.40)
                        else -> 0.0
                    }
                    val returned = project.currentValueRubles * (1 - lossPercent)
                    balanceDelta += returned
                    gameStateRepository.recordReturn(returned)
                    projectRepository.closeProject(project.id, buildClosureReason(project.fate))
                    gameStateRepository.recordScamMissed()
                }

                // Обычный день — начисляем доход внутри проекта, возможно случайное событие
                else -> {
                    val dailyYield = project.investedAmountRubles * project.realDailyYieldRubles * YIELD_MULTIPLIER
                    // Доход прирастает в currentValueRubles, не в свободном балансе
                    val (newHistory, newApyHistory) = updateHistories(project, dailyYield)
                    var updatedProject = project.copy(
                        daysSinceJoined = project.daysSinceJoined + 1,
                        daysUntilCollapse = newDaysUntilCollapse,
                        currentValueRubles = project.currentValueRubles + dailyYield,
                        currentUserCount = newHistory.lastOrNull() ?: project.currentUserCount,
                        userCountHistory = newHistory,
                        apyHistory = newApyHistory
                    )
                    projectRepository.updateProject(updatedProject)

                    // ── Случайное событие ──────────────────────────────────────
                    val event = rollEvent(updatedProject)
                    if (event != null) {
                        val result = applyEvent(updatedProject, event)
                        // Событие меняет currentValueRubles проекта, а не свободный баланс
                        projectRepository.updateProject(result.project)
                        updatedProject = result.project
                        AppLogger.i("AdvanceDayUseCase", "Event $event on ${project.claimedName}, delta=${result.balanceDelta}")

                        generateDailyUpdatesUseCase(updatedProject, event)
                            .onSuccess { generatedUpdates.add(it) }
                            .onFailure { e -> AppLogger.e("AdvanceDayUseCase", "Event update failed: ${e.message}") }
                    } else {
                        generateDailyUpdatesUseCase(updatedProject)
                            .onSuccess { generatedUpdates.add(it) }
                            .onFailure { e -> AppLogger.e("AdvanceDayUseCase", "Update failed: ${e.message}") }
                    }
                }
            }
        }

        val newBalance = state.balance + balanceDelta
        gameStateRepository.updateBalance(newBalance)
        gameStateRepository.appendBalanceSnapshot(newBalance)
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

    // ─── Система случайных событий ────────────────────────────────────────────

    private fun rollEvent(project: Project): AnnouncementType? {
        if (Random.nextFloat() > EVENT_CHANCE) return null
        val candidates = when (project.fate) {
            ProjectFate.INSTANT_SCAM -> listOf(
                AnnouncementType.CRIMINAL_CASE, AnnouncementType.CRIMINAL_CASE,
                AnnouncementType.HACK, AnnouncementType.BAD_RUMOR
            )
            ProjectFate.SLOW_DRAIN -> listOf(
                AnnouncementType.BAD_RUMOR, AnnouncementType.BAD_RUMOR,
                AnnouncementType.HACK, AnnouncementType.CRIMINAL_CASE
            )
            ProjectFate.UNICORN -> listOf(
                AnnouncementType.LISTING, AnnouncementType.LISTING,
                AnnouncementType.VIP_COLLAB, AnnouncementType.VIP_COLLAB,
                AnnouncementType.BAD_RUMOR
            )
            ProjectFate.SURVIVOR -> listOf(
                AnnouncementType.VIP_COLLAB, AnnouncementType.LISTING,
                AnnouncementType.BAD_RUMOR, AnnouncementType.BAD_RUMOR
            )
            ProjectFate.HONEST_FAIL -> listOf(
                AnnouncementType.BAD_RUMOR, AnnouncementType.VIP_COLLAB,
                AnnouncementType.HACK, AnnouncementType.CRIMINAL_CASE
            )
        }
        return candidates.random()
    }

    private data class EventResult(val project: Project, val balanceDelta: Double)

    private fun applyEvent(project: Project, event: AnnouncementType): EventResult {
        return when (event) {
            AnnouncementType.LISTING -> {
                val multiplier = Random.nextDouble(1.5, 4.0)
                val gain = project.investedAmountRubles * (multiplier - 1)
                EventResult(
                    project = project.copy(
                        currentValueRubles = project.currentValueRubles * multiplier,
                        currentUserCount = project.currentUserCount + Random.nextInt(5000, 50000),
                        daysUntilCollapse = project.daysUntilCollapse?.let { it + Random.nextInt(5, 15) }
                    ),
                    balanceDelta = gain
                )
            }
            AnnouncementType.VIP_COLLAB -> {
                val gain = project.investedAmountRubles * Random.nextDouble(0.10, 0.35)
                EventResult(
                    project = project.copy(
                        currentValueRubles = project.currentValueRubles * Random.nextDouble(1.10, 1.40),
                        currentUserCount = project.currentUserCount + Random.nextInt(2000, 15000)
                    ),
                    balanceDelta = gain
                )
            }
            AnnouncementType.BAD_RUMOR -> {
                val loss = project.investedAmountRubles * Random.nextDouble(0.05, 0.20)
                EventResult(
                    project = project.copy(
                        currentValueRubles = maxOf(0.0, project.currentValueRubles - loss),
                        currentUserCount = maxOf(100, project.currentUserCount - Random.nextInt(2000, 10000))
                    ),
                    balanceDelta = -loss
                )
            }
            AnnouncementType.CRIMINAL_CASE -> {
                val loss = project.investedAmountRubles * Random.nextDouble(0.20, 0.60)
                val newCollapse = project.daysUntilCollapse
                    ?.let { minOf(it, Random.nextInt(2, 5)) }
                    ?: Random.nextInt(2, 5)
                EventResult(
                    project = project.copy(
                        currentValueRubles = maxOf(0.0, project.currentValueRubles - loss),
                        currentUserCount = maxOf(100, project.currentUserCount - Random.nextInt(10000, 50000)),
                        isWithdrawalLocked = true,
                        daysUntilCollapse = newCollapse
                    ),
                    balanceDelta = -loss
                )
            }
            AnnouncementType.HACK -> {
                val loss = project.investedAmountRubles * Random.nextDouble(0.15, 0.45)
                val newCollapse = project.daysUntilCollapse
                    ?.let { minOf(it, Random.nextInt(3, 7)) }
                    ?: Random.nextInt(3, 7)
                EventResult(
                    project = project.copy(
                        currentValueRubles = maxOf(0.0, project.currentValueRubles - loss),
                        currentUserCount = maxOf(100, project.currentUserCount - Random.nextInt(3000, 20000)),
                        isWithdrawalLocked = true,
                        daysUntilCollapse = newCollapse
                    ),
                    balanceDelta = -loss
                )
            }
            else -> EventResult(project = project, balanceDelta = 0.0)
        }
    }

    // ─── Вспомогательные ──────────────────────────────────────────────────────

    private fun updateHistories(
        project: Project,
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

        val effectiveDailyAPYPct = if (project.investedAmountRubles > 0) {
            (dailyYield / project.investedAmountRubles * 100).toFloat()
        } else {
            project.claimedAPY / 365f
        }
        val noise = Random.nextFloat() * 0.5f - 0.25f
        val newApyHistory = (project.apyHistory + (effectiveDailyAPYPct + noise)).takeLast(30)

        return Pair(newUserHistory, newApyHistory)
    }

    private fun buildClosureReason(fate: ProjectFate): String = when (fate) {
        ProjectFate.INSTANT_SCAM -> "Пропал с деньгами вкладчиков"
        ProjectFate.SLOW_DRAIN -> "Дело тихо закрылось без объяснений"
        ProjectFate.HONEST_FAIL -> "Хозяин объявил о закрытии — не сошлась экономика"
        else -> "Дело завершило работу"
    }
}
