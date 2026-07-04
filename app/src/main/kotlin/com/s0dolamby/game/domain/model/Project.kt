package com.s0dolamby.game.domain.model

enum class ProjectType {
    CARD_GAME,       // Карточные игры и азартные дела
    TREASURE_HUNT,   // Поиск кладов и сокровищ
    POTION_BREW,     // Алхимия, зелья, снадобья
    GUILD_SCHEME,    // Артели, гильдии — пирамида
    HONEST_TRADE     // Честная торговля и ремесло
}

enum class ProjectFate {
    INSTANT_SCAM,    // Бежит с деньгами на 1–3 день, вероятность 30%
    SLOW_DRAIN,      // Держится 1–3 недели, тихо исчезает, 25%
    HONEST_FAIL,     // Честно старался, не взлетело, 15%
    SURVIVOR,        // Долгожитель, стабильный маленький доход, 20%
    UNICORN          // Взлетел по-настоящему: слава, иксы, 10%
    // SPONSOR_FIXED добавится в Phase 2 вместе с server-driven fate
    // и обработкой VIP-дел (фиксированный возврат 3× за durationDays).
}

/**
 * Прогноз игрока «Верю — не верю»: чем обернётся дело.
 * HONEST покрывает HONEST_FAIL/SURVIVOR/UNICORN (хозяин не врал),
 * SCAM — INSTANT_SCAM/SLOW_DRAIN (обман). Сверяется при закрытии дела.
 */
enum class PlayerVerdict { HONEST, SCAM }

/** Судьбы-обманы — для сверки прогноза и подсчёта чуйки. */
val ProjectFate.isScamFate: Boolean
    get() = this == ProjectFate.INSTANT_SCAM || this == ProjectFate.SLOW_DRAIN

data class Project(
    val id: String,
    val name: String,
    val type: ProjectType,
    val developerPersonaId: String,

    // Скрытые параметры — до PostMortem не показывать
    val fate: ProjectFate,
    val personaArchetype: PersonaArchetype,
    val daysUntilCollapse: Int?,
    val realDailyYieldRubles: Double,

    // Публичные параметры — видит игрок
    val developerName: String,
    val developerAvatarSeed: String,
    val claimedName: String,
    val claimedAPY: Float,
    val claimedUserCount: Int,
    val claimedTeamSize: Int,
    val roadmap: List<String>,
    val description: String,

    // Состояние
    val investedAmountRubles: Double = 0.0,
    val currentValueRubles: Double = 0.0,
    val daysSinceJoined: Int = 0,
    val isActive: Boolean = false,
    val isClosed: Boolean = false,
    val closureReason: String? = null,

    // Медиа
    val bannerImageUrl: String? = null,
    val bannerPromptUsed: String? = null,

    // Динамическое состояние (обновляется каждый день)
    val isWithdrawalLocked: Boolean = false,
    /**
     * Выпало «предложение, от которого нельзя отказаться» (см. MafiaOffers).
     * Прибыльному SURVIVOR/UNICORN за 2-3 дня до автозакрытия с шансом 60%
     * прилетает угроза: выйди руками — заберёшь всё; дотянешь до
     * автозакрытия — получишь только 50%.
     */
    val mafiaOfferIssued: Boolean = false,
    /**
     * Дней без начислений — штраф за проигрыш в «Зорком счёте» (реакция
     * на тревожную весть). Каждый advance-day списывает по одному.
     */
    val yieldFreezeDays: Int = 0,
    val currentUserCount: Int = 0,
    val userCountHistory: List<Int> = emptyList(),
    val apyHistory: List<Float> = emptyList(),

    // «Верю — не верю»
    /** Прогноз игрока. null — ставка не сделана. Одна на дело, не меняется. */
    val playerVerdict: PlayerVerdict? = null,
    /** Итог прогноза после закрытия дела. null — ещё не разрешён. */
    val verdictCorrect: Boolean? = null
)
