package com.s0dolamby.game.domain.model

enum class ProjectType {
    CLICKER, P2E_RPG, FARMING_BOT, REFERRAL_PYRAMID, HONEST_GAMEFI
}

enum class ProjectFate {
    INSTANT_SCAM,
    SLOW_DRAIN,
    HONEST_FAIL,
    SURVIVOR,
    UNICORN
}

enum class LieTopic {
    USER_COUNT, DAILY_YIELD, LISTING_DATE, TEAM_SIZE,
    AUDIT_STATUS, PARTNER_STATUS, WITHDRAWAL_LIMITS
}

data class Project(
    val id: String,
    val name: String,
    val type: ProjectType,
    val developerPersonaId: String,

    // Hidden until PostMortem
    val fate: ProjectFate,
    val personaArchetype: PersonaArchetype,
    val daysUntilCollapse: Int?,
    val realDailyYieldTON: Double,
    val lieTopics: List<LieTopic>,
    val truthTopics: List<LieTopic>,

    // Visible to player
    val developerName: String,
    val developerAvatarSeed: String,
    val claimedName: String,
    val claimedAPY: Float,
    val claimedUserCount: Int,
    val claimedTeamSize: Int,
    val roadmap: List<String>,
    val description: String,

    // State
    val investedAmountTON: Double = 0.0,
    val currentValueTON: Double = 0.0,
    val daysSinceJoined: Int = 0,
    val isActive: Boolean = false,
    val isClosed: Boolean = false,
    val closureReason: String? = null,

    // Media
    val bannerImageUrl: String? = null,
    val bannerPromptUsed: String? = null,

    // Dynamic state (tracked each day)
    val isWithdrawalLocked: Boolean = false,
    val currentUserCount: Int = 0,
    val userCountHistory: List<Int> = emptyList(),
    val apyHistory: List<Float> = emptyList(),

    val lieGuessCorrect: Boolean = false
)
