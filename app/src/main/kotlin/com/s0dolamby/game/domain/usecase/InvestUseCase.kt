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

/**
 * Все 5 обычных слотов заняты — UI ловит и предлагает купить
 * дополнительный торговый слот за [InvestUseCase.EXTRA_SLOT_COST_RUBLES].
 */
class MaxProjectsReachedException : Exception("MAX_PROJECTS_REACHED")

class InvestUseCase @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val projectRepository: ProjectRepository,
    private val achievementUnlockStore: AchievementUnlockStore,
    private val minigameUnlockStore: MinigameUnlockStore,
    private val amaRepository: com.s0dolamby.game.domain.repository.AmaRepository
) {
    companion object {
        /**
         * Порт TG InvestService.maybeShiftFate: идеальное прохождение мини-игры
         * даёт +5% шанс, что судьба дела тайно сместится в UNICORN на моменте
         * первого вложения. «Госпожа удача улыбнулась» — игрок не знает наверняка.
         */
        const val PERFECT_GAME_UNICORN_BONUS = 0.05

        /** Цена дополнительного торгового слота (TG: EXTRA_SLOT_COST_GROSHY). */
        const val EXTRA_SLOT_COST_RUBLES = 1000.0

        /** Сверх обычного лимита можно открыть максимум 5 слотов (TG: MAX_EXTRA_SLOTS). */
        const val MAX_EXTRA_SLOTS = 5

        /**
         * «Уговор» — награда за беседу с дельцом: каждый заданный в AMA вопрос
         * добавляет +1% сверху к ПЕРВОМУ вложению (делец добрасывает от себя),
         * максимум +10% за все 10 вопросов. Это и есть причина тратить время
         * (и — позже — рекламу) на разговор.
         */
        const val UGOVOR_BONUS_PER_QUESTION = 0.01
        const val UGOVOR_MAX_QUESTIONS = 10

        /** Процент уговора (0..10) по числу заданных вопросов. */
        fun ugovorPercent(questionCount: Int): Int =
            questionCount.coerceIn(0, UGOVOR_MAX_QUESTIONS)
    }

    suspend operator fun invoke(
        projectId: String,
        amountRubles: Double,
        buyExtraSlot: Boolean = false,
        /**
         * Бонус за реакцию на весть (игра «Сечение»): +N% сверху к этому
         * вложению — делец добрасывает за меткий глаз. 0 = без бонуса.
         */
        reactionBonusPercent: Int = 0
    ): Result<Unit> = runCatching {
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

        // Порт TG InvestService: при заполненных 5 слотах можно вложиться
        // сверх лимита, купив дополнительный слот за 1000 г (max +5).
        var slotCost = 0.0
        if (!project.isActive && state.activeProjects.size >= GameConfig.MAX_ACTIVE_PROJECTS) {
            if (!buyExtraSlot) throw MaxProjectsReachedException()
            require(state.activeProjects.size < GameConfig.MAX_ACTIVE_PROJECTS + MAX_EXTRA_SLOTS) {
                "Достигнут лимит $MAX_EXTRA_SLOTS дополнительных дел"
            }
            require(state.balance >= amountRubles + EXTRA_SLOT_COST_RUBLES) {
                "Недостаточно грошей для слота"
            }
            slotCost = EXTRA_SLOT_COST_RUBLES
        }
        require(!project.isWithdrawalLocked) { "Довложение невозможно — деньги заморожены" }

        val isFirstInvestment = !project.isActive
        // Сдвиг судьбы за идеал — только на ПЕРВОМ вложении.
        val shifted = if (isFirstInvestment) maybeShiftFate(project) else project
        // «Уговор»: за каждый заданный дельцу вопрос он добрасывает +1% сверху
        // к первому вложению (max +10%). Списывается с игрока только amount.
        val ugovorBonus = if (isFirstInvestment) {
            val questions = amaRepository.getSessionByProjectId(projectId)?.questionCount ?: 0
            amountRubles * ugovorPercent(questions) * UGOVOR_BONUS_PER_QUESTION
        } else 0.0
        // Бонус за реакцию на весть — работает и для довложений
        val reactionBonus = amountRubles * reactionBonusPercent.coerceIn(0, 10) / 100.0
        if (ugovorBonus > 0 || reactionBonus > 0) {
            AppLogger.i("InvestUseCase",
                "Bonuses on ${project.claimedName}: ugovor=$ugovorBonus reaction=$reactionBonus")
        }
        val updated = shifted.copy(
            investedAmountRubles = shifted.investedAmountRubles + amountRubles,
            currentValueRubles = shifted.currentValueRubles + amountRubles + ugovorBonus + reactionBonus,
            isActive = true
        )
        projectRepository.updateProject(updated)
        gameStateRepository.updateBalance(state.balance - amountRubles - slotCost)
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
