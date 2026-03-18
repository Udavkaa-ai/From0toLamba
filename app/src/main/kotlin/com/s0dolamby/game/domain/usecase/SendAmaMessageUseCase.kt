package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.ai.AmaSessionManager
import com.s0dolamby.game.data.registry.PersonaRegistry
import com.s0dolamby.game.domain.model.AmaMessage
import com.s0dolamby.game.domain.model.MessageRole
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.ProjectRepository
import java.util.UUID
import javax.inject.Inject

class SendAmaMessageUseCase @Inject constructor(
    private val amaRepository: AmaRepository,
    private val projectRepository: ProjectRepository,
    private val personaRegistry: PersonaRegistry,
    private val sessionManager: AmaSessionManager
) {
    suspend operator fun invoke(
        sessionId: String,
        userText: String
    ): Result<AmaMessage> = runCatching {
        val session = amaRepository.getSession(sessionId)
            ?: error("Session not found: $sessionId")

        if (session.isComplete || session.questionCount >= GameConfig.AMA_MAX_QUESTIONS) {
            error("Session is complete")
        }

        val project = projectRepository.getProjectById(session.projectId)
            ?: error("Project not found")

        val persona = personaRegistry.getPersona(project.personaArchetype)

        val userMessage = AmaMessage(
            id = UUID.randomUUID().toString(),
            sessionId = sessionId,
            role = MessageRole.USER,
            content = userText
        )
        amaRepository.addMessage(userMessage)

        val aiResponse = sessionManager.sendMessage(
            project = project,
            persona = persona,
            userText = userText,
            questionCount = session.questionCount + 1,
            history = session.messages
        ).getOrThrow()

        val responseWithSession = aiResponse.copy(sessionId = sessionId)
        amaRepository.addMessage(responseWithSession)

        if (session.questionCount + 1 >= GameConfig.AMA_MAX_QUESTIONS) {
            amaRepository.completeSession(sessionId)
        }

        responseWithSession
    }
}
