package com.s0dolamby.game.domain.repository

import com.s0dolamby.game.domain.model.GameState
import kotlinx.coroutines.flow.Flow

interface GameStateRepository {
    fun observeGameState(): Flow<GameState>
    suspend fun getGameState(): GameState
    suspend fun updateBalance(newBalance: Double)
    suspend fun advanceDay()
    suspend fun recordInvestment(amountRubles: Double)
    suspend fun recordReturn(amountRubles: Double)
    suspend fun recordScamDetected()
    suspend fun recordScamMissed()
    suspend fun completeOnboarding()
    suspend fun initializeGameState()
    suspend fun appendBalanceSnapshot(balance: Double)
    suspend fun appendInvestedSnapshot(invested: Double)
    suspend fun updateRankIfNeeded()
    suspend fun clearRankUpNotification()
    /** Обновить стрик + lastSeenDay при заходе на «Сегодня». No-op, если уже было сегодня. */
    suspend fun ensureDailyVisit()
    /** Забрать ежедневную награду. Возвращает сумму в грошах или ошибку «уже забрана». */
    suspend fun claimDailyReward(): Result<Int>
    /**
     * Зачислить прогресс по архетипу дельца после закрытия его дела.
     * При profitable=true +1 уровень связи (cap 10) и +1 жетон архетипа.
     */
    suspend fun awardArchetypeProgress(archetype: com.s0dolamby.game.domain.model.PersonaArchetype, profitable: Boolean)
    /**
     * Списать 1 жетон архетипа. Возвращает true, если жетон списан;
     * false — если баланса не хватило.
     */
    suspend fun spendArchetypeToken(archetype: com.s0dolamby.game.domain.model.PersonaArchetype): Boolean
    /**
     * Перебрать каталог [com.s0dolamby.game.domain.achievements.AchievementCatalog]
     * и разблокировать те, чьи условия теперь выполнены. Возвращает список
     * только что разблокированных подвигов (пустой, если ничего не изменилось).
     */
    suspend fun recomputeAchievements(): List<com.s0dolamby.game.domain.achievements.Achievement>
}
