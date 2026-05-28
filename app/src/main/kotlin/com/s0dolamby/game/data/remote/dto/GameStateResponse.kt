package com.s0dolamby.game.data.remote.dto

/**
 * Ответ GET /api/game — полный снимок состояния игрока.
 * Соответствует объекту из tg/server/src/api/routes/game.ts (строки 232-274).
 */
data class GameStateResponse(
    val balance: Double,
    val currentDay: Int,
    val investorRank: String,
    val nickname: String?,
    val intuitionScore: Int,
    val intuitionAccuracy: Double?,
    val chartersSubmitted: Int,
    val closedProjectsCount: Int,
    val dealsCount: Int,

    // Статистика мини-игр по архетипам: {BURATINO: {played, perfect, won, lost}, ...}
    val minigameStats: Map<String, MinigameStatDto> = emptyMap(),
    // Жетоны хозяев — {BURATINO: {earned, spent, balance, gamesPlayed, dealsTaken}, ...}
    val archetypeTokens: Map<String, ArchetypeTokenInfoDto> = emptyMap(),
    // Уровни Завязок 0..tiesMaxLevel — {BURATINO: 3, ...}
    val tieLevels: Map<String, Int> = emptyMap(),
    val tiesTotal: Int = 0,
    val tiesMaxLevel: Int = 10,
    val tiesBonusPerLevel: Double = 0.0,

    val referralCount: Int = 0,
    val weekStartWealth: Double = 0.0,
    val userId: Int,
    val dayStreak: Int,
    val isOnboardingComplete: Boolean,
    val totalInvested: Double,
    val totalReturned: Double,
    val balanceHistory: List<Double> = emptyList(),
    val investedHistory: List<Double> = emptyList(),
    val pendingRankUp: String? = null,
    val preferredModel: String,
    val preferredLanguage: String,
    val newsEnabled: Boolean,
    val lastAdvancedAt: String? = null,          // ISO 8601
    val advanceCooldownMs: Long = 0L,
    val consecutiveAdvances: Int = 0,
    val maxConsecutiveAdvances: Int = 3,

    val activeProjects: List<ProjectPublicDto> = emptyList(),
    val inboxProjects: List<ProjectPublicDto> = emptyList(),

    val seenTypes: List<String> = emptyList(),
    val seenArchetypes: List<String> = emptyList(),
    val seenFates: List<String> = emptyList(),

    val amaSessionsStarted: Int = 0,
    val amaSessionsCompleted: Int = 0,
    val extraSlotsBalance: Int = 0,
    val pendingMarketAnnouncement: Boolean = false,
)

data class MinigameStatDto(
    val played: Int = 0,
    val perfect: Int = 0,
    val won: Int = 0,
    val lost: Int = 0,
)

data class ArchetypeTokenInfoDto(
    val earned: Int = 0,
    val spent: Int = 0,
    val balance: Int = 0,
    val gamesPlayed: Int = 0,
    val dealsTaken: Int = 0,
)
