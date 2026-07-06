package com.s0dolamby.game.domain.repository

import com.s0dolamby.game.domain.model.LeaderboardData

/**
 * Купеческий рейтинг через mobile-backend. Отправляет текущее положение
 * игрока (богатство, чин, день) и забирает верхушку таблицы. Всё сетевое —
 * офлайн просто вернёт неуспех, игру это не ломает.
 */
interface LeaderboardRepository {
    /** Отправить своё текущее положение (upsert по стабильному playerId). */
    suspend fun submitStanding(): Result<Unit>

    /** Забрать топ купцов и общее число игроков. */
    suspend fun fetchTop(limit: Int = 50): Result<LeaderboardData>
}
