package com.s0dolamby.game.data.ai

import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.AmaMessage
import com.s0dolamby.game.domain.model.DeveloperPersona
import com.s0dolamby.game.domain.model.MessageRole
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.SettingsRepository
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AmaSessionManager @Inject constructor(
    private val api: OpenRouterApiService,
    private val promptBuilder: PromptBuilder,
    private val settingsRepository: SettingsRepository
) {
    suspend fun sendMessage(
        project: Project,
        persona: DeveloperPersona,
        userText: String,
        questionCount: Int,
        history: List<AmaMessage>
    ): Result<AmaMessage> = runCatching {
        val model = settingsRepository.getSettings().textModel
        val systemPrompt = promptBuilder.buildAmaSystemPrompt(project, persona, questionCount)
        val messages = buildMessageList(systemPrompt, history, userText)

        AppLogger.i("AmaSessionManager", "sendMessage q=$questionCount project=${project.claimedName}")
        val response = runCatching {
            api.chatCompletion(
                auth = "Bearer ${BuildConfig.OPENROUTER_API_KEY}",
                request = ChatRequest(
                    model = model,
                    messages = messages,
                    maxTokens = GameConfig.MAX_TOKENS_AMA,
                    temperature = 0.85f
                )
            )
        }.onFailure { AppLogger.e("AmaSessionManager", "API error", it) }.getOrThrow()

        AmaMessage(
            id = UUID.randomUUID().toString(),
            sessionId = history.firstOrNull()?.sessionId ?: "",
            role = MessageRole.ASSISTANT,
            content = response.choices.first().message.content.trim().stripMarkdown()
        )
    }

    private fun String.stripMarkdown(): String = this
        .replace(Regex("\\*\\*(.+?)\\*\\*"), "$1")
        .replace(Regex("\\*(.+?)\\*"), "$1")
        .replace(Regex("_(.+?)_"), "$1")
        .replace(Regex("`(.+?)`"), "$1")

    private fun buildMessageList(
        systemPrompt: String,
        history: List<AmaMessage>,
        newUserMessage: String
    ): List<ChatMessage> = buildList {
        add(ChatMessage("system", systemPrompt))
        history.forEach { msg ->
            add(ChatMessage(msg.role.name.lowercase(), msg.content))
        }
        add(ChatMessage("user", newUserMessage))
    }
}
