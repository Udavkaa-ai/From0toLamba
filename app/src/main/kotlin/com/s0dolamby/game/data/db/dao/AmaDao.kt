package com.s0dolamby.game.data.db.dao

import androidx.room.*
import com.s0dolamby.game.data.db.entity.AmaMessageEntity
import com.s0dolamby.game.data.db.entity.AmaSessionEntity
import com.s0dolamby.game.data.db.entity.PostMortemEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface AmaDao {
    @Query("SELECT * FROM ama_sessions WHERE id = :sessionId")
    fun observeSession(sessionId: String): Flow<AmaSessionEntity?>

    @Query("SELECT * FROM ama_sessions WHERE id = :sessionId")
    suspend fun getSession(sessionId: String): AmaSessionEntity?

    @Query("SELECT * FROM ama_sessions WHERE projectId = :projectId LIMIT 1")
    suspend fun getSessionByProjectId(projectId: String): AmaSessionEntity?

    @Query("SELECT * FROM ama_messages WHERE sessionId = :sessionId ORDER BY timestamp ASC")
    suspend fun getMessages(sessionId: String): List<AmaMessageEntity>

    @Query("SELECT * FROM ama_messages WHERE sessionId = :sessionId ORDER BY timestamp ASC")
    fun observeMessages(sessionId: String): Flow<List<AmaMessageEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSession(session: AmaSessionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: AmaMessageEntity)

    @Query("UPDATE ama_sessions SET isComplete = 1 WHERE id = :sessionId")
    suspend fun completeSession(sessionId: String)

    @Query("UPDATE ama_sessions SET questionCount = questionCount + 1 WHERE id = :sessionId")
    suspend fun incrementQuestionCount(sessionId: String)

    @Query("UPDATE ama_sessions SET isIntuitionEvaluated = 1 WHERE id = :sessionId")
    suspend fun markIntuitionEvaluated(sessionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPostMortem(report: PostMortemEntity)

    @Query("SELECT * FROM post_mortems WHERE projectId = :projectId")
    suspend fun getPostMortem(projectId: String): PostMortemEntity?
}
