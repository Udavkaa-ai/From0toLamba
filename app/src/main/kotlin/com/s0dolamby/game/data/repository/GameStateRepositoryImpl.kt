package com.s0dolamby.game.data.repository

import com.s0dolamby.game.data.db.dao.PlayerDao
import com.s0dolamby.game.data.db.dao.ProjectDao
import com.s0dolamby.game.data.db.entity.GameStateEntity
import com.s0dolamby.game.domain.model.*
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.google.gson.Gson
import com.s0dolamby.game.data.db.entity.toDomain
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class GameStateRepositoryImpl @Inject constructor(
    private val playerDao: PlayerDao,
    private val projectDao: ProjectDao,
    private val gson: Gson
) : GameStateRepository {

    private fun parseBalanceHistory(json: String): List<Double> = runCatching {
        gson.fromJson(json, Array<Double>::class.java).toList()
    }.getOrDefault(emptyList())

    override fun observeGameState(): Flow<GameState> =
        combine(
            playerDao.observeGameState(),
            projectDao.observeActiveProjects(),
            projectDao.observeInboxProjects()
        ) { stateEntity, active, inbox ->
            val state = stateEntity ?: GameStateEntity()
            GameState(
                balance = state.balance,
                currentDay = state.currentDay,
                activeProjects = active.map { it.toDomain(gson) },
                pendingInbox = inbox.map { it.toDomain(gson) },
                investorRank = InvestorRank.valueOf(state.investorRank),
                totalInvested = state.totalInvested,
                totalReturned = state.totalReturned,
                scamsDetected = state.scamsDetected,
                scamsMissed = state.scamsMissed,
                dayStreak = state.dayStreak,
                isOnboardingComplete = state.isOnboardingComplete,
                balanceHistory = parseBalanceHistory(state.balanceHistory)
            )
        }

    override suspend fun getGameState(): GameState {
        val state = playerDao.getGameState() ?: GameStateEntity()
        val active = projectDao.getActiveProjects().map { it.toDomain(gson) }
        return GameState(
            balance = state.balance,
            currentDay = state.currentDay,
            activeProjects = active,
            pendingInbox = emptyList(),
            investorRank = InvestorRank.valueOf(state.investorRank),
            totalInvested = state.totalInvested,
            totalReturned = state.totalReturned,
            scamsDetected = state.scamsDetected,
            scamsMissed = state.scamsMissed,
            dayStreak = state.dayStreak,
            isOnboardingComplete = state.isOnboardingComplete,
            balanceHistory = parseBalanceHistory(state.balanceHistory)
        )
    }

    override suspend fun appendBalanceSnapshot(balance: Double) {
        val state = playerDao.getGameState() ?: return
        val history = parseBalanceHistory(state.balanceHistory).takeLast(59) + balance
        playerDao.update(state.copy(balanceHistory = gson.toJson(history)))
    }

    override suspend fun updateBalance(newBalance: Double) =
        playerDao.updateBalance(newBalance)

    override suspend fun advanceDay() = playerDao.advanceDay()

    override suspend fun recordInvestment(amountTON: Double) {
        val state = playerDao.getGameState() ?: return
        playerDao.update(state.copy(totalInvested = state.totalInvested + amountTON))
    }

    override suspend fun recordReturn(amountTON: Double) {
        val state = playerDao.getGameState() ?: return
        playerDao.update(state.copy(totalReturned = state.totalReturned + amountTON))
    }

    override suspend fun recordScamDetected() {
        val state = playerDao.getGameState() ?: return
        playerDao.update(state.copy(scamsDetected = state.scamsDetected + 1))
    }

    override suspend fun recordScamMissed() {
        val state = playerDao.getGameState() ?: return
        playerDao.update(state.copy(scamsMissed = state.scamsMissed + 1))
    }

    override suspend fun completeOnboarding() = playerDao.completeOnboarding()

    override suspend fun initializeGameState() {
        if (playerDao.getGameState() == null) {
            playerDao.insert(GameStateEntity(balance = GameConfig.STARTING_BALANCE))
        }
    }
}
