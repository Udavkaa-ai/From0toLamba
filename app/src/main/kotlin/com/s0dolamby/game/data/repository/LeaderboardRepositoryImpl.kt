package com.s0dolamby.game.data.repository

import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.ai.OpenRouterApiService
import com.s0dolamby.game.data.ai.StandingRequest
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.LeaderboardData
import com.s0dolamby.game.domain.model.LeaderboardStanding
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.LeaderboardRepository
import com.s0dolamby.game.domain.repository.SettingsRepository
import java.util.UUID
import javax.inject.Inject

class LeaderboardRepositoryImpl @Inject constructor(
    private val api: OpenRouterApiService,
    private val settingsRepository: SettingsRepository,
    private val gameStateRepository: GameStateRepository
) : LeaderboardRepository {

    /** Стабильный id купца: выдаётся один раз и хранится в настройках. */
    private suspend fun ensurePlayerId(): String {
        val settings = settingsRepository.getSettings()
        if (settings.playerId.isNotBlank()) return settings.playerId
        val fresh = UUID.randomUUID().toString()
        settingsRepository.updateSettings(settings.copy(playerId = fresh))
        return fresh
    }

    override suspend fun submitStanding(): Result<Unit> = runCatching {
        val settings = settingsRepository.getSettings()
        val nickname = settings.nickname.trim()
        // Без имени в рейтинг не лезем — ник теперь обязателен, но подстрахуемся.
        require(nickname.isNotBlank()) { "no nickname yet" }
        val playerId = ensurePlayerId()
        val state = gameStateRepository.getGameState()
        val wealth = state.balance + state.activeProjects.sumOf { it.currentValueRubles }
        api.submitStanding(
            appKey = BuildConfig.MOBILE_APP_KEY,
            request = StandingRequest(
                playerId = playerId,
                nickname = nickname,
                wealth = wealth,
                rankTitle = state.investorRank.displayName,
                day = state.currentDay,
                loginStreak = state.loginStreak,
                appVersion = BuildConfig.VERSION_NAME
            )
        )
        Unit
    }.onFailure { AppLogger.e("Leaderboard", "submit failed", it) }

    override suspend fun fetchTop(limit: Int): Result<LeaderboardData> = runCatching {
        val myId = settingsRepository.getSettings().playerId
        val response = api.fetchLeaderboard(BuildConfig.MOBILE_APP_KEY, limit)
        val entries = response.entries.map { e ->
            LeaderboardStanding(
                position = e.position,
                playerId = e.playerId,
                nickname = e.nickname,
                wealth = e.wealth,
                rankTitle = e.rankTitle.orEmpty(),
                day = e.day,
                isMe = myId.isNotBlank() && e.playerId == myId
            )
        }
        LeaderboardData(
            total = response.total,
            entries = entries,
            myPosition = entries.firstOrNull { it.isMe }?.position
        )
    }.onFailure { AppLogger.e("Leaderboard", "fetch failed", it) }
}
