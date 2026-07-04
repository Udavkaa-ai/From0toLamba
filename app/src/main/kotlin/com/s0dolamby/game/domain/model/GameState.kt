package com.s0dolamby.game.domain.model

enum class InvestorRank {
    NEWBIE,
    AMBASSADOR,
    ANALYST,
    SHARK,
    LAMBO_SENSEI;

    val displayName: String get() = when (this) {
        NEWBIE -> "Скоморох"
        AMBASSADOR -> "Купец"
        ANALYST -> "Мудрец"
        SHARK -> "Боярин"
        LAMBO_SENSEI -> "Князь"
    }
}

data class GameState(
    val balance: Double,
    val currentDay: Int,
    val activeProjects: List<Project>,
    val pendingInbox: List<Project>,
    val investorRank: InvestorRank,
    val totalInvested: Double,
    val totalReturned: Double,
    val scamsDetected: Int,
    val scamsMissed: Int,
    val dayStreak: Int,
    val isOnboardingComplete: Boolean = false,
    val balanceHistory: List<Double> = emptyList(),
    val investedHistory: List<Double> = emptyList(),
    val pendingRankUp: InvestorRank? = null,
    /** Ежедневный стрик (растёт +1 каждый день, когда юзер заходит). */
    val loginStreak: Int = 0,
    /** YYYY-MM-DD MSK — день когда стрик обновлялся в последний раз. */
    val lastSeenDay: String? = null,
    /** YYYY-MM-DD MSK — день последней забранной ежедневной награды. */
    val lastDailyClaim: String? = null,
    /** Уровень связи с архетипом дельца (0..[MAX_TIE_LEVEL]). */
    val tieLevels: Map<PersonaArchetype, Int> = emptyMap(),
    /** Баланс жетонов архетипа — мини-валюта на пропуск мини-игр и т.п. */
    val archetypeTokens: Map<PersonaArchetype, Int> = emptyMap(),
    /** ID разблокированных подвигов (Achievement.id). */
    val unlockedAchievements: Set<String> = emptySet(),

    // «Верю — не верю» — рейтинг чуйки
    /** Очки чуйки (не опускаются ниже 0). */
    val chuykaPoints: Int = 0,
    /** Всего разрешённых прогнозов. */
    val chuykaTotal: Int = 0,
    /** Из них верных. */
    val chuykaCorrect: Int = 0,
    /** Текущая серия верных прогнозов подряд. */
    val chuykaStreak: Int = 0,
    /** Лучшая серия за игру. */
    val chuykaBestStreak: Int = 0
) {
    companion object {
        const val MAX_TIE_LEVEL = 10
        const val TIE_BONUS_PERCENT_PER_LEVEL = 1
    }
}
