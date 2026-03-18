package com.s0dolamby.game.data.repository

import com.google.gson.Gson
import com.s0dolamby.game.data.db.dao.AmaDao
import com.s0dolamby.game.data.db.entity.*
import com.s0dolamby.game.domain.model.*
import com.s0dolamby.game.domain.repository.AmaRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class AmaRepositoryImpl @Inject constructor(
    private val dao: AmaDao,
    private val gson: Gson
) : AmaRepository {

    override fun observeSession(sessionId: String): Flow<AmaSession?> =
        combine(
            dao.observeSession(sessionId),
            dao.observeMessages(sessionId)
        ) { entity, messages ->
            entity?.let {
                AmaSession(
                    id = it.id,
                    projectId = it.projectId,
                    messages = messages.map { m -> m.toDomain() },
                    questionCount = it.questionCount,
                    isComplete = it.isComplete
                )
            }
        }

    override suspend fun getSession(sessionId: String): AmaSession? =
        dao.getSession(sessionId)?.let { buildSession(it) }

    override suspend fun getSessionByProjectId(projectId: String): AmaSession? =
        dao.getSessionByProjectId(projectId)?.let { buildSession(it) }

    override suspend fun createSession(session: AmaSession) =
        dao.insertSession(AmaSessionEntity(
            id = session.id,
            projectId = session.projectId,
            questionCount = session.questionCount,
            isComplete = session.isComplete
        ))

    override suspend fun addMessage(message: AmaMessage) {
        dao.insertMessage(message.toEntity())
        if (message.role == MessageRole.USER) {
            dao.incrementQuestionCount(message.sessionId)
        }
    }

    override suspend fun completeSession(sessionId: String) =
        dao.completeSession(sessionId)

    override suspend fun savePostMortem(report: PostMortemReport) =
        dao.insertPostMortem(report.toEntity(gson))

    override suspend fun getPostMortem(projectId: String): PostMortemReport? =
        dao.getPostMortem(projectId)?.toDomain(gson)

    private suspend fun buildSession(entity: AmaSessionEntity): AmaSession {
        val messages = dao.getMessages(entity.id).map { it.toDomain() }
        return AmaSession(
            id = entity.id,
            projectId = entity.projectId,
            messages = messages,
            questionCount = entity.questionCount,
            isComplete = entity.isComplete
        )
    }
}
