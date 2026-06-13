package com.s0dolamby.game.data.repository

import com.s0dolamby.game.data.db.dao.PlayerDao
import com.s0dolamby.game.data.db.dao.ProjectDao
import com.s0dolamby.game.data.db.entity.GameStateEntity
import com.s0dolamby.game.domain.model.*
import com.s0dolamby.game.domain.ranks.RankService
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.s0dolamby.game.data.db.entity.toDomain
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.today.TodayRewards
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class GameStateRepositoryImpl @Inject constructor(
    private val playerDao: PlayerDao,
    private val projectDao: ProjectDao,
    private val gson: Gson
) : GameStateRepository {

    private fun parseDoubleHistory(json: String): List<Double> = runCatching {
        gson.fromJson(json, Array<Double>::class.java).toList()
    }.getOrDefault(emptyList())

    // Keep old name as alias for migration compatibility
    private fun parseBalanceHistory(json: String) = parseDoubleHistory(json)

    private fun parseArchetypeMap(json: String): Map<PersonaArchetype, Int> = runCatching {
        val type = object : TypeToken<Map<String, Int>>() {}.type
        val raw: Map<String, Int> = gson.fromJson(json, type) ?: emptyMap()
        raw.mapNotNull { (k, v) ->
            runCatching { PersonaArchetype.valueOf(k) }.getOrNull()?.let { it to v }
        }.toMap()
    }.getOrDefault(emptyMap())

    private fun serializeArchetypeMap(map: Map<PersonaArchetype, Int>): String =
        gson.toJson(map.mapKeys { it.key.name })

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
                balanceHistory = parseBalanceHistory(state.balanceHistory),
                investedHistory = parseDoubleHistory(state.investedHistory),
                pendingRankUp = state.pendingRankUp?.let {
                    runCatching { InvestorRank.valueOf(it) }.getOrNull()
                },
                loginStreak = state.loginStreak,
                lastSeenDay = state.lastSeenDay,
                lastDailyClaim = state.lastDailyClaim,
                tieLevels = parseArchetypeMap(state.tieLevelsJson),
                archetypeTokens = parseArchetypeMap(state.archetypeTokensJson)
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
            balanceHistory = parseBalanceHistory(state.balanceHistory),
            investedHistory = parseDoubleHistory(state.investedHistory),
            loginStreak = state.loginStreak,
            lastSeenDay = state.lastSeenDay,
            lastDailyClaim = state.lastDailyClaim,
            tieLevels = parseArchetypeMap(state.tieLevelsJson),
            archetypeTokens = parseArchetypeMap(state.archetypeTokensJson)
        )
    }

    override suspend fun appendBalanceSnapshot(balance: Double) {
        val state = playerDao.getGameState() ?: return
        val history = parseBalanceHistory(state.balanceHistory).takeLast(59) + balance
        playerDao.update(state.copy(balanceHistory = gson.toJson(history)))
    }

    override suspend fun appendInvestedSnapshot(invested: Double) {
        val state = playerDao.getGameState() ?: return
        val history = parseDoubleHistory(state.investedHistory).takeLast(59) + invested
        playerDao.update(state.copy(investedHistory = gson.toJson(history)))
    }

    override suspend fun updateRankIfNeeded() {
        val state = playerDao.getGameState() ?: return
        val takenDeals = projectDao.countTakenDeals()
        val newRank = RankService.rankFor(takenDeals)
        val currentRank = InvestorRank.valueOf(state.investorRank)
        if (newRank.ordinal > currentRank.ordinal) {
            playerDao.update(state.copy(investorRank = newRank.name, pendingRankUp = newRank.name))
        }
    }

    override suspend fun clearRankUpNotification() = playerDao.clearRankUpNotification()

    override suspend fun ensureDailyVisit() {
        val state = playerDao.getGameState() ?: return
        val (newStreak, wasFirstVisit) = TodayRewards.computeOnVisit(state.lastSeenDay, state.loginStreak)
        if (!wasFirstVisit) return
        playerDao.update(state.copy(
            loginStreak = newStreak,
            lastSeenDay = TodayRewards.todayKey()
        ))
    }

    override suspend fun awardArchetypeProgress(archetype: PersonaArchetype, profitable: Boolean) {
        if (!profitable) return
        val state = playerDao.getGameState() ?: return
        val ties = parseArchetypeMap(state.tieLevelsJson).toMutableMap()
        val tokens = parseArchetypeMap(state.archetypeTokensJson).toMutableMap()
        val currentTie = ties[archetype] ?: 0
        if (currentTie < GameState.MAX_TIE_LEVEL) ties[archetype] = currentTie + 1
        tokens[archetype] = (tokens[archetype] ?: 0) + 1
        playerDao.update(state.copy(
            tieLevelsJson = serializeArchetypeMap(ties),
            archetypeTokensJson = serializeArchetypeMap(tokens)
        ))
    }

    override suspend fun claimDailyReward(): Result<Int> = runCatching {
        val state = playerDao.getGameState() ?: error("GameState не инициализирован")
        val today = TodayRewards.todayKey()
        if (state.lastDailyClaim == today) error("Награда сегодня уже забрана")
        // Сначала зафиксируем стрик за сегодня (на случай если игрок миновал
        // tab «Сегодня» и сразу жмёт claim из push-уведомления в будущем).
        val (streakNow, _) = TodayRewards.computeOnVisit(state.lastSeenDay, state.loginStreak)
        val reward = TodayRewards.totalReward(streakNow)
        playerDao.update(state.copy(
            balance = state.balance + reward,
            loginStreak = streakNow,
            lastSeenDay = today,
            lastDailyClaim = today
        ))
        reward
    }

    override suspend fun updateBalance(newBalance: Double) =
        playerDao.updateBalance(newBalance)

    override suspend fun advanceDay() = playerDao.advanceDay()

    override suspend fun recordInvestment(amountRubles: Double) {
        val state = playerDao.getGameState() ?: return
        playerDao.update(state.copy(totalInvested = state.totalInvested + amountRubles))
    }

    override suspend fun recordReturn(amountRubles: Double) {
        val state = playerDao.getGameState() ?: return
        playerDao.update(state.copy(totalReturned = state.totalReturned + amountRubles))
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
