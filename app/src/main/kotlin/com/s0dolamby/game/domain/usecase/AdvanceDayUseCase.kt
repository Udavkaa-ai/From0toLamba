package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.achievements.AchievementUnlockStore
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.events.EventKind
import com.s0dolamby.game.domain.events.MafiaOffers
import com.s0dolamby.game.domain.events.RandomEvents
import com.s0dolamby.game.domain.model.DailyEventKind
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.model.GameState
import com.s0dolamby.game.domain.model.PayoutStatus
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.model.ProjectFate
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.domain.repository.UpdateRepository
import java.util.UUID
import javax.inject.Inject
import kotlin.random.Random

class AdvanceDayUseCase @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val projectRepository: ProjectRepository,
    private val amaRepository: AmaRepository,
    private val updateRepository: UpdateRepository,
    private val generateProjectUseCase: GenerateProjectUseCase,
    private val generateDailyUpdatesUseCase: GenerateDailyUpdatesUseCase,
    private val achievementUnlockStore: AchievementUnlockStore
) {
    // Каждый игровой день засчитывается как 10 реальных — держит прогресс интересным
    private val YIELD_MULTIPLIER = 10.0

    /** Бонус к дневной доходности за уровень связи с архетипом (+1%/уровень, макс +10%). */
    private val TIE_BONUS_PER_LEVEL = 0.01

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
                        projectRepository.closeProject(project.id, buildClosureReason(project.fate), returned)
                        gameStateRepository.recordScamMissed()
                        gameStateRepository.awardArchetypeProgress(
                            project.personaArchetype,
                            profitable = returned > project.investedAmountRubles
                        )
                    }
                }

                // Обычный крах (не скам-судьбы).
                // Прибыльное SURVIVOR/UNICORN с выданным мафия-офером, которое игрок
                // дотянул до автозакрытия — принудительный выкуп: возвращается лишь 50%.
                newDaysUntilCollapse != null && newDaysUntilCollapse <= 0 -> {
                    val isProfitable = project.currentValueRubles > project.investedAmountRubles
                    val mafiaForced = isProfitable && project.mafiaOfferIssued &&
                        (project.fate == ProjectFate.SURVIVOR || project.fate == ProjectFate.UNICORN)
                    val lossPercent = when {
                        mafiaForced -> 1 - MafiaOffers.FORCED_CLOSURE_RETURN_PERCENT
                        project.fate == ProjectFate.HONEST_FAIL -> Random.nextDouble(0.10, 0.40)
                        else -> 0.0
                    }
                    val closureReason = if (mafiaForced) {
                        MafiaOffers.pick(project.id).closure
                    } else {
                        buildClosureReason(project.fate)
                    }
                    val returned = project.currentValueRubles * (1 - lossPercent)
                    balanceDelta += returned
                    gameStateRepository.recordReturn(returned)
                    projectRepository.closeProject(project.id, closureReason, returned)
                    // Только INSTANT_SCAM/SLOW_DRAIN с вложениями = пропущенный мошенник
                    gameStateRepository.awardArchetypeProgress(
                        project.personaArchetype,
                        profitable = returned > project.investedAmountRubles
                    )
                }

                // Обычный день — начисляем доход внутри проекта, возможно случайное событие
                else -> {
                    // Доходность = базовая × 10 (игровой день) + бонус за связь с
                    // дельцом-архетипом (+1% за уровень, макс +10% в день) — как в TG.
                    val tieBonus = tieBonusFor(state, project)
                    val dailyYield = project.investedAmountRubles *
                        (project.realDailyYieldRubles + tieBonus) * YIELD_MULTIPLIER
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

                    // ── «Предложение, от которого нельзя отказаться» ────────────
                    // Прибыльному SURVIVOR/UNICORN за 2-3 дня до автозакрытия с
                    // шансом 60% прилетает мафия-угроза. Она вытесняет случайное
                    // событие этого дня (двух драм в один день не бывает).
                    val inMafiaWindow = newDaysUntilCollapse in MafiaOffers.OFFER_DAYS_BEFORE &&
                        (project.fate == ProjectFate.SURVIVOR || project.fate == ProjectFate.UNICORN) &&
                        updatedProject.currentValueRubles > updatedProject.investedAmountRubles &&
                        updatedProject.investedAmountRubles > 0 &&
                        !project.mafiaOfferIssued
                    if (inMafiaWindow && Random.nextDouble() < MafiaOffers.OFFER_CHANCE) {
                        updatedProject = updatedProject.copy(mafiaOfferIssued = true)
                        projectRepository.updateProject(updatedProject)
                        val offer = MafiaOffers.pick(project.id)
                        val update = DailyUpdate(
                            id = UUID.randomUUID().toString(),
                            projectId = updatedProject.id,
                            projectName = updatedProject.claimedName,
                            day = updatedProject.daysSinceJoined,
                            title = "Предложение, от которого нельзя отказаться",
                            body = MafiaOffers.renderWarning(offer, updatedProject.claimedName),
                            userCountDelta = 0,
                            payoutStatus = PayoutStatus.NORMAL,
                            announcement = null,
                            redFlags = emptyList(),
                            eventKind = DailyEventKind.NEGATIVE
                        )
                        updateRepository.saveUpdate(update)
                        generatedUpdates.add(update)
                        AppLogger.i("AdvanceDayUseCase", "Mafia offer '${offer.id}' issued to ${project.claimedName}")
                        continue
                    }

                    // ── Случайное событие из каталога (порт TG randomEvents) ────
                    // Шанс 20-35%, INSTANT_SCAM получает только позитив/нейтраль,
                    // fateBias утраивает вес подходящих событий.
                    val event = RandomEvents.pick(updatedProject.type, updatedProject.fate)
                    if (event != null) {
                        val (newValue, delta) = RandomEvents.applyEffect(event, updatedProject.currentValueRubles)
                        updatedProject = updatedProject.copy(currentValueRubles = newValue)
                        projectRepository.updateProject(updatedProject)
                        AppLogger.i("AdvanceDayUseCase", "Event ${event.id} on ${project.claimedName}, delta=$delta")

                        val update = DailyUpdate(
                            id = UUID.randomUUID().toString(),
                            projectId = updatedProject.id,
                            projectName = updatedProject.claimedName,
                            day = updatedProject.daysSinceJoined,
                            title = event.title,
                            body = RandomEvents.renderBody(event, updatedProject.claimedName, delta),
                            userCountDelta = eventUserDelta(event.kind, updatedProject.currentUserCount),
                            payoutStatus = PayoutStatus.NORMAL,
                            announcement = null,
                            redFlags = emptyList(),
                            eventKind = when (event.kind) {
                                EventKind.POSITIVE -> DailyEventKind.POSITIVE
                                EventKind.NEGATIVE -> DailyEventKind.NEGATIVE
                                EventKind.NEUTRAL -> DailyEventKind.NEUTRAL
                            }
                        )
                        updateRepository.saveUpdate(update)
                        generatedUpdates.add(update)
                    } else {
                        generateDailyUpdatesUseCase(updatedProject)
                            .onSuccess { generatedUpdates.add(it) }
                            .onFailure { e -> AppLogger.e("AdvanceDayUseCase", "Update failed: ${e.message}") }
                    }

                    // ── «Все вкладчики разбежались» (порт TG abandon-closure) ────
                    // Если после кривой жизненного цикла и события народ ушёл в 0,
                    // дело рушится независимо от daysUntilCollapse: возвращается
                    // доля по lossRange судьбы.
                    if (updatedProject.currentUserCount <= 0 && updatedProject.investedAmountRubles > 0) {
                        val cfg = com.s0dolamby.game.domain.config.FateConfig.params.getValue(updatedProject.fate)
                        val abandonLoss = cfg.lossRange.start +
                            Random.nextDouble() * (cfg.lossRange.endInclusive - cfg.lossRange.start)
                        val returned = updatedProject.currentValueRubles * (1 - abandonLoss)
                        balanceDelta += returned
                        gameStateRepository.recordReturn(returned)
                        projectRepository.closeProject(
                            updatedProject.id,
                            "Все вкладчики разбежались — дело рухнуло",
                            returned
                        )
                        gameStateRepository.awardArchetypeProgress(
                            updatedProject.personaArchetype,
                            profitable = returned > updatedProject.investedAmountRubles
                        )
                        AppLogger.i("AdvanceDayUseCase", "Abandoned: ${updatedProject.claimedName}, returned=$returned")
                    }
                }
            }
        }

        val newBalance = state.balance + balanceDelta
        gameStateRepository.updateBalance(newBalance)
        gameStateRepository.appendBalanceSnapshot(newBalance)
        // Record invested value (sum of all active project currentValueRubles after updates)
        val totalActiveValue = projectRepository.getActiveProjectsTotalValue()
        gameStateRepository.appendInvestedSnapshot(totalActiveValue)
        gameStateRepository.advanceDay()
        gameStateRepository.updateRankIfNeeded()
        achievementUnlockStore.push(gameStateRepository.recomputeAchievements())

        // ── Подсчёт распознанных мошенников ──────────────────────────────────
        // Игрок "распознал" скам если: поговорил (≥1 вопрос в AMA) и отказался вкладывать.
        // Проверяем прямо перед тем, как входящие грамоты закроются.
        val inboxProjects = projectRepository.getInboxProjectsList()
        var detectedCount = 0
        for (inboxProject in inboxProjects) {
            val isScamFate = inboxProject.fate == ProjectFate.INSTANT_SCAM ||
                             inboxProject.fate == ProjectFate.SLOW_DRAIN
            if (isScamFate && inboxProject.investedAmountRubles == 0.0) {
                val session = amaRepository.getSessionByProjectId(inboxProject.id)
                if (session != null && session.questionCount > 0) {
                    gameStateRepository.recordScamDetected()
                    detectedCount++
                }
            }
        }
        if (detectedCount > 0) {
            AppLogger.i("AdvanceDayUseCase", "Scams detected today: $detectedCount")
        }

        projectRepository.closeAllInboxProjects()

        val newProjectCount = Random.nextInt(1, 4)
        repeat(newProjectCount) {
            generateProjectUseCase().onFailure { e ->
                AppLogger.e("AdvanceDayUseCase", "Project gen failed: ${e.message}")
            }
        }

        generatedUpdates
    }

    // ─── Вспомогательные события ─────────────────────────────────────────────

    /** Бонус к дневной доходности за уровень связи с архетипом дела (+1%/уровень). */
    private fun tieBonusFor(state: GameState, project: Project): Double {
        val level = state.tieLevels[project.personaArchetype] ?: 0
        return level.coerceIn(0, GameState.MAX_TIE_LEVEL) * TIE_BONUS_PER_LEVEL
    }

    /** Дельта вкладчиков после события — позитив ~+3-5%, негатив ~−3-7%. */
    private fun eventUserDelta(kind: EventKind, currentUserCount: Int): Int = when (kind) {
        EventKind.POSITIVE -> (currentUserCount * Random.nextDouble(0.03, 0.05)).toInt()
        EventKind.NEGATIVE -> -(currentUserCount * Random.nextDouble(0.03, 0.07)).toInt()
        EventKind.NEUTRAL -> 0
    }

    // ─── Вспомогательные ──────────────────────────────────────────────────────

    /**
     * Кривая вкладчиков по фазе жизни дела (порт TG AdvanceDayService):
     *  - INSTANT_SCAM: ровный рост до самого исчезновения — скам не палится;
     *  - SLOW_DRAIN: рост первые 50%, потом плавный отток;
     *  - HONEST_FAIL: резкий рост первые 30%, потом сильный спад;
     *  - SURVIVOR: рост → плато → лёгкое снижение;
     *  - UNICORN: рост → плато → резкий взлёт в конце.
     * Цифры дельт TG умножены ×10 масштабно к нашим userCount (у TG
     * счётчики в сотнях, у нас в тысячах).
     */
    private fun lifecycleUserDelta(project: Project): Int {
        val totalLife = project.daysSinceJoined + (project.daysUntilCollapse ?: 0)
        val progress = if (totalLife > 0) project.daysSinceJoined.toFloat() / totalLife else 0f
        return when (project.fate) {
            ProjectFate.INSTANT_SCAM -> Random.nextInt(30, 181)
            ProjectFate.SLOW_DRAIN ->
                if (progress < 0.5f) Random.nextInt(20, 101) else -Random.nextInt(20, 101)
            ProjectFate.HONEST_FAIL ->
                if (progress < 0.3f) Random.nextInt(150, 301) else -Random.nextInt(150, 351)
            ProjectFate.SURVIVOR -> when {
                progress < 0.3f -> Random.nextInt(20, 81)
                progress < 0.7f -> Random.nextInt(-30, 31)
                else -> -Random.nextInt(20, 51)
            }
            ProjectFate.UNICORN -> when {
                progress < 0.4f -> Random.nextInt(20, 81)
                progress < 0.7f -> Random.nextInt(-20, 51)
                else -> Random.nextInt(200, 501)
            }
        }
    }

    private fun updateHistories(
        project: Project,
        dailyYield: Double
    ): Pair<List<Int>, List<Float>> {
        val userDelta = lifecycleUserDelta(project)
        // 0 разрешён — «все вкладчики разбежались» закрывает дело в вызывающем коде.
        val newUserCount = maxOf(0, project.currentUserCount + userDelta)
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
