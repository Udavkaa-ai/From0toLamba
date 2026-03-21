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
}

enum class LieTopic {
    PATRON_COUNT,      // Количество вкладчиков/участников
    DAILY_PROFIT,      // Ежедневный доход
    PAYOUT_DATE,       // Дата выплат или листинга
    GUILD_SIZE,        // Размер артели/команды
    ELDER_BLESSING,    // Одобрение старейшин / проверка
    NOBLE_BACKING,     // Поддержка знатных покровителей
    WITHDRAWAL_LIMITS  // Ограничения на вывод средств
}

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
    val lieTopics: List<LieTopic>,
    val truthTopics: List<LieTopic>,

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
    val currentUserCount: Int = 0,
    val userCountHistory: List<Int> = emptyList(),
    val apyHistory: List<Float> = emptyList(),

    val lieGuessCorrect: Boolean = false
)
