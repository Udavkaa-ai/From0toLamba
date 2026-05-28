package com.s0dolamby.game.data.remote.dto

/**
 * Ответ GET /api/projects/portfolio. Активные дела + последние 10 закрытых
 * с (опциональным) PostMortem.
 */
data class PortfolioResponse(
    val active: List<ProjectPublicDto> = emptyList(),
    val closed: List<ClosedProjectDto> = emptyList(),
)

/** Закрытое дело: публичные поля + развёрнутый PostMortem (если разбор сделан). */
data class ClosedProjectDto(
    val id: String,
    val name: String,
    val type: String,
    val personaArchetype: String,
    val isInbox: Boolean = false,
    val isActive: Boolean = false,
    val isClosed: Boolean = true,
    val developerName: String,
    val developerAvatarSeed: String,
    val claimedName: String,
    val claimedAPY: Double,
    val claimedUserCount: Int,
    val claimedTeamSize: Int,
    val description: String,
    val roadmap: List<String> = emptyList(),
    val investedAmountRubles: Double = 0.0,
    val currentValueRubles: Double = 0.0,
    val totalWithdrawnRubles: Double = 0.0,
    val totalInvestedRubles: Double = 0.0,
    val daysSinceJoined: Int = 0,
    val isWithdrawalLocked: Boolean = false,
    val closureReason: String? = null,
    val bannerImageUrl: String? = null,
    val currentUserCount: Int = 0,
    val userCountHistory: List<Int> = emptyList(),
    val apyHistory: List<Double> = emptyList(),
    val valueHistory: List<Double> = emptyList(),
    val isSponsor: Boolean = false,
    val sponsorChannelUrl: String? = null,
    val sponsorPromoVerified: Boolean = false,
    val postMortem: PostMortemDto? = null,
)

/**
 * Раскрытый разбор закрытого дела — единственное место где сервер отдаёт
 * fate, lieTopics и архетип НА КЛИЕНТЕ (для активных дел эти поля скрыты).
 */
data class PostMortemDto(
    val revealedArchetype: String,         // PersonaArchetype.name
    val fate: String,                      // ProjectFate.name
    val lieTopics: List<String> = emptyList(),
    val analysis: String,
    val investedAmount: Double,
    val returnedAmount: Double,
    val profitPercent: Double,
    val daysActive: Int,
    val intuitionDelta: Int = 0,
)
