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
import com.s0dolamby.game.domain.repository.SettingsRepository
import com.s0dolamby.game.domain.repository.UpdateRepository
import java.util.UUID
import javax.inject.Inject

class GenerateDailyUpdatesUseCase @Inject constructor(
    private val api: OpenRouterApiService,
    private val promptBuilder: PromptBuilder,
    private val updateRepository: UpdateRepository,
    private val gson: Gson,
    private val settingsRepository: SettingsRepository
) {
    suspend operator fun invoke(
        project: Project,
        event: AnnouncementType? = null
    ): Result<DailyUpdate> = runCatching {
        val model = settingsRepository.getSettings().textModel
        val response = api.chatCompletion(
            auth = "Bearer ${BuildConfig.OPENROUTER_API_KEY}",
            request = ChatRequest(
                model = model,
                messages = listOf(
                    ChatMessage("user", promptBuilder.buildDailyUpdatePrompt(project, project.daysUntilCollapse, event))
                ),
                maxTokens = GameConfig.MAX_TOKENS_UPDATE
            )
        )

        val json = response.choices.first().message.content.trim()
        val update = parseUpdate(project, json, event)
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
        if (raw.contains("```json")) return raw.substringAfter("```json").substringBefore("```").trim()
        if (raw.contains("```")) return raw.substringAfter("```").substringBefore("```").trim()
        val start = raw.indexOf('{')
        val end = raw.lastIndexOf('}')
        if (start != -1 && end > start) return raw.substring(start, end + 1)
        return raw.trim()
    }

    private fun parseUpdate(project: Project, raw: String, event: AnnouncementType?): DailyUpdate {
        return try {
            val parsed = gson.fromJson(extractJson(raw), UpdateJson::class.java)
            val payoutStatus = runCatching {
                PayoutStatus.valueOf(parsed.metrics.payoutStatus.uppercase())
            }.getOrDefault(PayoutStatus.NORMAL)

            // Event-driven red flags as fallback if AI didn't provide them
            val redFlags = if (event in listOf(AnnouncementType.CRIMINAL_CASE, AnnouncementType.HACK)
                && parsed.redFlags.isEmpty()
            ) {
                listOf(
                    when (event) {
                        AnnouncementType.CRIMINAL_CASE -> "Правоохранительные органы начали расследование"
                        AnnouncementType.HACK -> "Средства пользователей под угрозой"
                        else -> ""
                    }
                )
            } else parsed.redFlags

            DailyUpdate(
                id = UUID.randomUUID().toString(),
                projectId = project.id,
                projectName = project.claimedName,
                day = project.daysSinceJoined,
                title = parsed.title.ifBlank { event?.fallbackTitle ?: "Обновление проекта" },
                body = parsed.body.ifBlank { "Дело идёт, и то ладно." },
                userCountDelta = parsed.metrics.userCountDelta,
                payoutStatus = if (event == AnnouncementType.CRIMINAL_CASE || event == AnnouncementType.HACK) {
                    PayoutStatus.DELAYED
                } else payoutStatus,
                // Event type always wins over whatever AI put in announcement field
                announcement = event ?: parsed.metrics.announcement?.let {
                    runCatching { AnnouncementType.valueOf(it.uppercase()) }.getOrNull()
                },
                redFlags = redFlags
            )
        } catch (e: Exception) {
            AppLogger.e("GenerateDailyUpdatesUseCase", "Parse failed for ${project.claimedName}: ${e.message}")
            DailyUpdate(
                id = UUID.randomUUID().toString(),
                projectId = project.id,
                projectName = project.claimedName,
                day = project.daysSinceJoined,
                title = event?.fallbackTitle ?: "Обновление проекта",
                body = event?.fallbackBody ?: "Дело идёт, и то ладно.",
                userCountDelta = 0,
                payoutStatus = if (event == AnnouncementType.CRIMINAL_CASE || event == AnnouncementType.HACK)
                    PayoutStatus.DELAYED else PayoutStatus.NORMAL,
                announcement = event,
                redFlags = emptyList()
            )
        }
    }

    private val AnnouncementType.fallbackTitle: String get() = when (this) {
        AnnouncementType.LISTING -> "Официальный листинг токена!"
        AnnouncementType.VIP_COLLAB -> "VIP-партнёрство подписано"
        AnnouncementType.BAD_RUMOR -> "Слухи о проблемах в проекте"
        AnnouncementType.CRIMINAL_CASE -> "Возбуждено уголовное дело"
        AnnouncementType.HACK -> "Хакерская атака на проект"
        else -> "Обновление проекта"
    }

    private val AnnouncementType.fallbackBody: String get() = when (this) {
        AnnouncementType.LISTING -> "Проект объявил о листинге токена на бирже. Ожидается рост числа пользователей."
        AnnouncementType.VIP_COLLAB -> "Проект заключил партнёрство с крупным инфлюенсером. Аудитория растёт."
        AnnouncementType.BAD_RUMOR -> "В сети распространились слухи о проблемах. Команда отрицает обвинения."
        AnnouncementType.CRIMINAL_CASE -> "Правоохранительные органы начали расследование. Вывод средств приостановлен."
        AnnouncementType.HACK -> "Проект подвергся взлому. Часть средств похищена. Команда работает над восстановлением."
        else -> "Дело идёт, и то ладно."
    }
}
