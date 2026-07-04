package com.s0dolamby.game.data.db.dao

import androidx.room.*
import com.s0dolamby.game.data.db.entity.ProjectEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ProjectDao {
    @Query("SELECT * FROM projects WHERE isActive = 1 AND isClosed = 0")
    fun observeActiveProjects(): Flow<List<ProjectEntity>>

    @Query("SELECT * FROM projects WHERE isActive = 1 AND isClosed = 0")
    suspend fun getActiveProjects(): List<ProjectEntity>

    @Query("SELECT * FROM projects WHERE isActive = 0 AND isClosed = 0")
    fun observeInboxProjects(): Flow<List<ProjectEntity>>

    @Query("SELECT * FROM projects WHERE isActive = 0 AND isClosed = 0")
    suspend fun getInboxProjects(): List<ProjectEntity>

    @Query("UPDATE projects SET isClosed = 1, closureReason = 'Предложение не принято' WHERE isActive = 0 AND isClosed = 0")
    suspend fun closeAllInboxProjects()

    @Query("SELECT * FROM projects WHERE isClosed = 1")
    fun observeClosedProjects(): Flow<List<ProjectEntity>>

    @Query("SELECT * FROM projects WHERE isClosed = 1")
    suspend fun getClosedProjects(): List<ProjectEntity>

    @Query("SELECT * FROM projects WHERE id = :id")
    suspend fun getById(id: String): ProjectEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(project: ProjectEntity)

    @Update
    suspend fun update(project: ProjectEntity)

    @Query("UPDATE projects SET isClosed = 1, isActive = 0, closureReason = :reason, currentValueRubles = :returnedValue WHERE id = :id")
    suspend fun closeProject(id: String, reason: String, returnedValue: Double)

    @Query("UPDATE projects SET bannerImageUrl = :url, bannerPromptUsed = :prompt WHERE id = :id")
    suspend fun updateBanner(id: String, url: String, prompt: String)

    @Query(
        "SELECT COUNT(*) FROM projects " +
            "WHERE isActive = 1 OR (isClosed = 1 AND closureReason != 'Предложение не принято')"
    )
    suspend fun countTakenDeals(): Int

    // ─── «Верю — не верю» ────────────────────────────────────────────────
    // Ставка одна на дело: WHERE playerVerdict IS NULL защищает от перезаписи
    // даже при гонке двух экранов.
    @Query("UPDATE projects SET playerVerdict = :verdict WHERE id = :id AND playerVerdict IS NULL AND isClosed = 0")
    suspend fun setPlayerVerdict(id: String, verdict: String): Int

    @Query("UPDATE projects SET verdictCorrect = :correct WHERE id = :id")
    suspend fun setVerdictResolved(id: String, correct: Boolean)

    @Query("SELECT * FROM projects WHERE playerVerdict IS NOT NULL AND verdictCorrect IS NULL AND isClosed = 1")
    suspend fun getUnresolvedVerdictProjects(): List<ProjectEntity>
}
