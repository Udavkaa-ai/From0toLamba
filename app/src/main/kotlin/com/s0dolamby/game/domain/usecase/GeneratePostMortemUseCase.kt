package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.ai.ChatMessage
import com.s0dolamby.game.data.ai.ChatRequest
import com.s0dolamby.game.data.ai.OpenRouterApiService
import com.s0dolamby.game.data.ai.PromptBuilder
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.PostMortemReport
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.domain.repository.SettingsRepository
import javax.inject.Inject

/**
 * Генерирует «разбор сделки» от старца-наставника после закрытия дела.
 * Использует историю беседы из AMA + промпт PromptBuilder.buildPostMortemPrompt.
 *
 * Идемпотентна: если PostMortem уже есть в БД, возвращает существующий и
 * не дёргает сеть.
 */
class GeneratePostMortemUseCase @Inject constructor(
    private val api: OpenRouterApiService,
    private val promptBuilder: PromptBuilder,
    private val settingsRepository: SettingsRepository,
    private val amaRepository: AmaRepository,
    private val projectRepository: ProjectRepository
) {
    suspend operator fun invoke(projectId: String): Result<PostMortemReport> = runCatching {
        amaRepository.getPostMortem(projectId)?.let { return@runCatching it }

        val project = projectRepository.getProjectById(projectId)
            ?: error("Дело не найдено: $projectId")
        val session = amaRepository.getSessionByProjectId(projectId)
        val history = session?.messages.orEmpty()

        val systemPrompt = promptBuilder.buildPostMortemPrompt(project, history)
        val model = settingsRepository.getSettings().textModel

        AppLogger.i("PostMortem", "generate project=${project.claimedName} fate=${project.fate}")
        val response = api.chatCompletion(
            auth = "Bearer ${BuildConfig.OPENROUTER_API_KEY}",
            request = ChatRequest(
                model = model,
                messages = listOf(
                    ChatMessage("system", systemPrompt),
                    ChatMessage("user", "Разбери эту сделку. 3–5 предложений, без markdown.")
                ),
                maxTokens = 500,
                temperature = 0.75f
            )
        )

        val analysis = response.choices.first().message.content.trim().stripMarkdown()
        val pnl = project.currentValueRubles - project.investedAmountRubles
        val report = PostMortemReport(
            projectId = project.id,
            projectName = project.claimedName,
            revealedArchetype = project.personaArchetype,
            fate = project.fate,
            redFlagsFound = emptyList(),
            redFlagsMissed = emptyList(),
            profitLossRubles = pnl,
            analysis = analysis
        )
        amaRepository.savePostMortem(report)
        report
    }.onFailure { AppLogger.e("PostMortem", "generate failed", it) }

    private fun String.stripMarkdown(): String = this
        .replace(Regex("\\*\\*(.+?)\\*\\*"), "$1")
        .replace(Regex("\\*(.+?)\\*"), "$1")
        .replace(Regex("_(.+?)_"), "$1")
        .replace(Regex("`(.+?)`"), "$1")
}
