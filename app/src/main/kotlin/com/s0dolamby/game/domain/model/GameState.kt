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
    val pendingRankUp: InvestorRank? = null
)
