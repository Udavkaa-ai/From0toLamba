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
}
