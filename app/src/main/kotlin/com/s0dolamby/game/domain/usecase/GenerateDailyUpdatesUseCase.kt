package com.s0dolamby.game.domain.usecase

import com.google.gson.Gson
import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.ai.ChatMessage
import com.s0dolamby.game.data.ai.ChatRequest
import com.s0dolamby.game.data.ai.OpenRouterApiService
import com.s0dolamby.game.data.ai.PromptBuilder
import com.s0dolamby.game.domain.model.*
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.UpdateRepository
import java.util.UUID
import javax.inject.Inject

class GenerateDailyUpdatesUseCase @Inject constructor(
    private val api: OpenRouterApiService,
    private val promptBuilder: PromptBuilder,
    private val updateRepository: UpdateRepository,
    private val gson: Gson
) {
    suspend operator fun invoke(project: Project): Result<DailyUpdate> = runCatching {
        val response = api.chatCompletion(
            auth = "Bearer ${BuildConfig.OPENROUTER_API_KEY}",
            request = ChatRequest(
                model = GameConfig.TEXT_MODEL,
                messages = listOf(
                    ChatMessage("user", promptBuilder.buildDailyUpdatePrompt(project, project.daysUntilCollapse))
                ),
                maxTokens = GameConfig.MAX_TOKENS_UPDATE
            )
        )

        val json = response.choices.first().message.content.trim()
        val update = parseUpdate(project, json)
        updateRepository.saveUpdate(update)
        update
    }

    private data class UpdateJson(
        val title: String = "",
        val body: String = "",
        val metrics: Metrics = Metrics(),
        val redFlags: List<String> = emptyList()
    )

    private data class Metrics(
        val userCountDelta: Int = 0,
        val payoutStatus: String = "normal",
        val announcement: String? = null
    )

    private fun parseUpdate(project: Project, json: String): DailyUpdate {
        return try {
            // Extract JSON from potential markdown code blocks
            val cleanJson = json.substringAfter("```json").substringAfter("```")
                .substringBefore("```").trim()
                .let { if (it.startsWith("{")) it else json }

            val parsed = gson.fromJson(cleanJson, UpdateJson::class.java)
            DailyUpdate(
                id = UUID.randomUUID().toString(),
                projectId = project.id,
                projectName = project.claimedName,
                day = project.daysSinceJoined,
                title = parsed.title,
                body = parsed.body,
                userCountDelta = parsed.metrics.userCountDelta,
                payoutStatus = runCatching { PayoutStatus.valueOf(parsed.metrics.payoutStatus.uppercase()) }
                    .getOrDefault(PayoutStatus.NORMAL),
                announcement = parsed.metrics.announcement?.let {
                    runCatching { AnnouncementType.valueOf(it.uppercase()) }.getOrNull()
                },
                redFlags = parsed.redFlags
            )
        } catch (e: Exception) {
            DailyUpdate(
                id = UUID.randomUUID().toString(),
                projectId = project.id,
                projectName = project.claimedName,
                day = project.daysSinceJoined,
                title = "Обновление проекта",
                body = json.take(200),
                userCountDelta = 0,
                payoutStatus = PayoutStatus.NORMAL,
                announcement = null,
                redFlags = emptyList()
            )
        }
    }
}
