package com.s0dolamby.game.data.db.dao

import androidx.room.*
import com.s0dolamby.game.data.db.entity.GameStateEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PlayerDao {
    @Query("SELECT * FROM game_state WHERE id = 1")
    fun observeGameState(): Flow<GameStateEntity?>

    @Query("SELECT * FROM game_state WHERE id = 1")
    suspend fun getGameState(): GameStateEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(state: GameStateEntity)

    @Update
    suspend fun update(state: GameStateEntity)

    @Query("UPDATE game_state SET balance = :balance WHERE id = 1")
    suspend fun updateBalance(balance: Double)

    @Query("UPDATE game_state SET currentDay = currentDay + 1, dayStreak = dayStreak + 1 WHERE id = 1")
    suspend fun advanceDay()

    @Query("UPDATE game_state SET isOnboardingComplete = 1 WHERE id = 1")
    suspend fun completeOnboarding()

    @Query("UPDATE game_state SET pendingRankUp = NULL WHERE id = 1")
    suspend fun clearRankUpNotification()
}
