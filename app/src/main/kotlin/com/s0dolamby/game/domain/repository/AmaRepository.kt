package com.s0dolamby.game.domain.repository

import com.s0dolamby.game.domain.model.AmaSession
import com.s0dolamby.game.domain.model.AmaMessage
import com.s0dolamby.game.domain.model.PostMortemReport
import kotlinx.coroutines.flow.Flow

interface AmaRepository {
    fun observeSession(sessionId: String): Flow<AmaSession?>
    suspend fun getSession(sessionId: String): AmaSession?
    suspend fun getSessionByProjectId(projectId: String): AmaSession?
    suspend fun createSession(session: AmaSession)
    suspend fun addMessage(message: AmaMessage)
    suspend fun completeSession(sessionId: String)
    suspend fun markIntuitionEvaluated(sessionId: String)
    suspend fun savePostMortem(report: PostMortemReport)
    suspend fun getPostMortem(projectId: String): PostMortemReport?
}
