package com.s0dolamby.game.data.db.dao

import androidx.room.*
import com.s0dolamby.game.data.db.entity.ProjectEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ProjectDao {
    @Query("SELECT * FROM projects WHERE isActive = 1 AND isClosed = 0")
    fun observeActiveProjects(): Flow<List<ProjectEntity>>

    @Query("SELECT * FROM projects WHERE isActive = 0 AND isClosed = 0")
    fun observeInboxProjects(): Flow<List<ProjectEntity>>

    @Query("SELECT * FROM projects WHERE isClosed = 1")
    fun observeClosedProjects(): Flow<List<ProjectEntity>>

    @Query("SELECT * FROM projects WHERE id = :id")
    suspend fun getById(id: String): ProjectEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(project: ProjectEntity)

    @Update
    suspend fun update(project: ProjectEntity)

    @Query("UPDATE projects SET isClosed = 1, isActive = 0, closureReason = :reason WHERE id = :id")
    suspend fun closeProject(id: String, reason: String)

    @Query("UPDATE projects SET bannerImageUrl = :url, bannerPromptUsed = :prompt WHERE id = :id")
    suspend fun updateBanner(id: String, url: String, prompt: String)
}
