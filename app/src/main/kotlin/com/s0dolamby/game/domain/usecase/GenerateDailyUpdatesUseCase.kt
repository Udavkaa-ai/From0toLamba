package com.s0dolamby.game.domain.usecase

import com.google.gson.Gson
import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.ai.ChatMessage
import com.s0dolamby.game.data.ai.ChatRequest
import com.s0dolamby.game.data.ai.OpenRouterApiService
import com.s0dolamby.game.data.ai.PromptBuilder
import com.s0dolamby.game.data.logging.AppLogger
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

    private fun extractJson(raw: String): String {
        // 1. Markdown code blocks
        if (raw.contains("```json")) return raw.substringAfter("```json").substringBefore("```").trim()
        if (raw.contains("```")) return raw.substringAfter("```").substringBefore("```").trim()
        // 2. Find first '{' … last '}' — handles explanatory text before/after JSON
        val start = raw.indexOf('{')
        val end = raw.lastIndexOf('}')
        if (start != -1 && end > start) return raw.substring(start, end + 1)
        return raw.trim()
    }

    private fun parseUpdate(project: Project, raw: String): DailyUpdate {
        return try {
            val parsed = gson.fromJson(extractJson(raw), UpdateJson::class.java)
            DailyUpdate(
                id = UUID.randomUUID().toString(),
                projectId = project.id,
                projectName = project.claimedName,
                day = project.daysSinceJoined,
                title = parsed.title.ifBlank { "Обновление проекта" },
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
            AppLogger.e("GenerateDailyUpdatesUseCase", "Parse failed for ${project.claimedName}: ${e.message}\nRaw: ${raw.take(300)}")
            DailyUpdate(
                id = UUID.randomUUID().toString(),
                projectId = project.id,
                projectName = project.claimedName,
                day = project.daysSinceJoined,
                title = "Обновление проекта",
                body = "Проект работает в штатном режиме.",
                userCountDelta = 0,
                payoutStatus = PayoutStatus.NORMAL,
                announcement = null,
                redFlags = emptyList()
            )
        }
    }
}
