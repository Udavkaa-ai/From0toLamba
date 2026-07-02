package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.achievements.AchievementUnlockStore
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.data.minigame.MinigameUnlockStore
import com.s0dolamby.game.domain.config.FateConfig
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.model.ProjectFate
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject
import kotlin.random.Random

class InvestUseCase @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val projectRepository: ProjectRepository,
    private val achievementUnlockStore: AchievementUnlockStore,
    private val minigameUnlockStore: MinigameUnlockStore
) {
    companion object {
        /**
         * Порт TG InvestService.maybeShiftFate: идеальное прохождение мини-игры
         * даёт +5% шанс, что судьба дела тайно сместится в UNICORN на моменте
         * первого вложения. «Госпожа удача улыбнулась» — игрок не знает наверняка.
         */
        const val PERFECT_GAME_UNICORN_BONUS = 0.05
    }

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
        // Сдвиг судьбы за идеал — только на ПЕРВОМ вложении.
        val shifted = if (isFirstInvestment) maybeShiftFate(project) else project
        val updated = shifted.copy(
            investedAmountRubles = shifted.investedAmountRubles + amountRubles,
            currentValueRubles = shifted.currentValueRubles + amountRubles,
            isActive = true
        )
        projectRepository.updateProject(updated)
        gameStateRepository.updateBalance(state.balance - amountRubles)
        gameStateRepository.recordInvestment(amountRubles)

        if (isFirstInvestment) {
            gameStateRepository.updateRankIfNeeded()
        }
        achievementUnlockStore.push(gameStateRepository.recomputeAchievements())
    }

    /**
     * Если мини-игра дела пройдена идеально (0 ошибок) — 5% шанс сместить
     * судьбу в UNICORN с перегенерацией скрытых параметров под новую судьбу.
     * Порт tg/server InvestService.maybeShiftFate.
     */
    private fun maybeShiftFate(project: Project): Project {
        if (project.fate == ProjectFate.UNICORN) return project
        val outcome = minigameUnlockStore.outcomeFor(project.id) ?: return project
        if (!outcome.isPerfect) return project
        if (Random.nextDouble() >= PERFECT_GAME_UNICORN_BONUS) return project

        val unicorn = FateConfig.params.getValue(ProjectFate.UNICORN)
        val newYield = unicorn.dailyYieldRange.start +
            Random.nextDouble() * (unicorn.dailyYieldRange.endInclusive - unicorn.dailyYieldRange.start)
        val newDays = unicorn.daysRange.random()
        AppLogger.i("InvestUseCase", "Perfect-game luck shift! ${project.claimedName} → UNICORN")
        return project.copy(
            fate = ProjectFate.UNICORN,
            realDailyYieldRubles = newYield,
            daysUntilCollapse = newDays
        )
    }
}
