package com.s0dolamby.game.domain.model

/** Одна строка купеческого рейтинга. */
data class LeaderboardStanding(
    val position: Int,
    val playerId: String,
    val nickname: String,
    val wealth: Double,
    val rankTitle: String,
    val day: Int,
    /** Это строка текущего игрока — подсветить в списке. */
    val isMe: Boolean
)

/** Верхушка рейтинга + сколько всего купцов зарегистрировано. */
data class LeaderboardData(
    val total: Int,
    val entries: List<LeaderboardStanding>,
    /** Позиция игрока в общем зачёте, если он попал в выданный список. */
    val myPosition: Int?
)
