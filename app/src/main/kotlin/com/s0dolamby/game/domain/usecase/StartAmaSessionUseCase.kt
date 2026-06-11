package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.ai.AmaSessionManager
import com.s0dolamby.game.data.registry.PersonaRegistry
import com.s0dolamby.game.domain.model.AmaSession
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import java.util.UUID
import javax.inject.Inject

class StartAmaSessionUseCase @Inject constructor(
    private val amaRepository: AmaRepository,
    private val projectRepository: ProjectRepository,
    private val personaRegistry: PersonaRegistry,
    private val sessionManager: AmaSessionManager
) {
    suspend operator fun invoke(projectId: String): Result<AmaSession> = runCatching {
        val existing = amaRepository.getSessionByProjectId(projectId)
        if (existing != null) {
            // Сессия есть, но первое сообщение могло не сгенериться (AI упал) —
            // как в TG: догенерируем приветствие, чтобы чат не был пустым
            if (existing.messages.isEmpty()) {
                val project = projectRepository.getProjectById(projectId)
                if (project != null) {
                    val persona = personaRegistry.getPersona(project.personaArchetype)
                    val first = sessionManager.generateFirstMessage(project, persona, existing.id)
                    amaRepository.addMessage(first)
                    return@runCatching existing.copy(messages = listOf(first))
                }
            }
            return@runCatching existing
        }

        val project = projectRepository.getProjectById(projectId)
            ?: error("Project not found: $projectId")
        val persona = personaRegistry.getPersona(project.personaArchetype)

        val session = AmaSession(
            id = UUID.randomUUID().toString(),
            projectId = projectId,
            messages = emptyList()
        )
        amaRepository.createSession(session)

        // Делец здоровается первым — приветствие в характере персоны (как в TG)
        val first = sessionManager.generateFirstMessage(project, persona, session.id)
        amaRepository.addMessage(first)

        session.copy(messages = listOf(first))
    }
}
