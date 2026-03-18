package com.s0dolamby.game.data.db.dao

import androidx.room.*
import com.s0dolamby.game.data.db.entity.UpdateEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface UpdateDao {
    @Query("SELECT * FROM daily_updates ORDER BY timestamp DESC")
    fun observeAll(): Flow<List<UpdateEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(update: UpdateEntity)

    @Query("SELECT * FROM daily_updates WHERE projectId = :projectId ORDER BY day ASC")
    suspend fun getForProject(projectId: String): List<UpdateEntity>
}
