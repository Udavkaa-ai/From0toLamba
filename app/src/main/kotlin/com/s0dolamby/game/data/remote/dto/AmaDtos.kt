package com.s0dolamby.game.data.remote.dto

/** POST /api/ama/:projectId/start — `{ sessionId, firstMessage }`. */
data class AmaStartResponse(
    val sessionId: String,
    val firstMessage: String,
)

/** GET /api/ama/:projectId — состояние беседы + история сообщений. */
data class AmaSessionResponse(
    val sessionId: String,
    val questionCount: Int = 0,
    val isComplete: Boolean = false,
    val isIntuitionEvaluated: Boolean = false,
    val selectedLieTopics: List<String> = emptyList(),
    val intuitionDelta: Int = 0,
    val developerName: String,
    val messages: List<AmaMessageDto> = emptyList(),
)

data class AmaMessageDto(
    val role: String,                      // "user" | "assistant"
    val content: String,
    val createdAt: String,                 // ISO 8601
)

data class AmaMessageBody(
    val message: String,
)

/** POST /api/ama/:projectId/message → reply + обновлённый счётчик. */
data class AmaMessageResponse(
    val reply: String,
    val questionCount: Int,
    val isSessionComplete: Boolean,
)

data class IntuitionEvalBody(
    val selectedTopics: List<String>,      // LieTopic[].name
)

/** POST /api/ama/:projectId/evaluate-intuition → дельта чуйки + раскрытие тем. */
data class IntuitionEvalResponse(
    val delta: Int,
    val correctTopics: List<String> = emptyList(),
    val falseTopics: List<String> = emptyList(),
)
