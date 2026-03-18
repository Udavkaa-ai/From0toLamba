package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.domain.model.AmaSession
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import java.util.UUID
import javax.inject.Inject

class StartAmaSessionUseCase @Inject constructor(
    private val amaRepository: AmaRepository,
    private val projectRepository: ProjectRepository
) {
    suspend operator fun invoke(projectId: String): Result<AmaSession> = runCatching {
        val existing = amaRepository.getSessionByProjectId(projectId)
        if (existing != null) return@runCatching existing

        val session = AmaSession(
            id = UUID.randomUUID().toString(),
            projectId = projectId,
            messages = emptyList()
        )
        amaRepository.createSession(session)
        session
    }
}
