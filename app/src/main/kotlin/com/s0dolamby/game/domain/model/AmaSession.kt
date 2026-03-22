package com.s0dolamby.game.domain.model

data class AmaSession(
    val id: String,
    val projectId: String,
    val messages: List<AmaMessage>,
    val questionCount: Int = 0,
    val isComplete: Boolean = false
)

data class AmaMessage(
    val id: String,
    val sessionId: String,
    val role: MessageRole,
    val content: String,
    val timestamp: Long = System.currentTimeMillis()
)

enum class MessageRole { USER, ASSISTANT }

data class PostMortemReport(
    val projectId: String,
    val projectName: String,
    val revealedArchetype: PersonaArchetype,
    val fate: ProjectFate,
    val lieTopics: List<LieTopic>,
    val redFlagsFound: List<String>,
    val redFlagsMissed: List<String>,
    val profitLossRubles: Double,
    val analysis: String
)
