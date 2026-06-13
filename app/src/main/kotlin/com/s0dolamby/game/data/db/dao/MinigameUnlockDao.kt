package com.s0dolamby.game.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.s0dolamby.game.data.db.entity.MinigameUnlockEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface MinigameUnlockDao {
    @Query("SELECT * FROM minigame_unlock")
    fun observeAll(): Flow<List<MinigameUnlockEntity>>

    @Query("SELECT * FROM minigame_unlock")
    suspend fun getAll(): List<MinigameUnlockEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: MinigameUnlockEntity)

    @Query("DELETE FROM minigame_unlock WHERE projectId = :projectId")
    suspend fun delete(projectId: String)

    @Query("DELETE FROM minigame_unlock")
    suspend fun clearAll()
}
