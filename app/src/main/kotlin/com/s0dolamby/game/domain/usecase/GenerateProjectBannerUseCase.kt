package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.ai.ChatMessage
import com.s0dolamby.game.data.ai.ChatRequest
import com.s0dolamby.game.data.ai.OpenRouterApiService
import com.s0dolamby.game.data.ai.PromptBuilder
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject

/**
 * Generates a project banner in two steps:
 *  1. DeepSeek invents a visual concept (creative, unique per project name) — ~$0.00003
 *  2. Builds a Pollinations.ai URL from that concept — FREE, FLUX.1-schnell under the hood
 *
 * Pollinations.ai generates the image lazily when Coil first loads the URL.
 * Coil disk-cache ensures the image is only fetched once per device.
 */
class GenerateProjectBannerUseCase @Inject constructor(
    private val api: OpenRouterApiService,
    private val promptBuilder: PromptBuilder,
    private val projectRepository: ProjectRepository
) {
    suspend operator fun invoke(project: Project): Result<String> = runCatching {
        // Step 1: unique visual concept from DeepSeek — keeps every banner distinct
        val concept = try {
            val resp = api.chatCompletion(
                auth = "Bearer ${BuildConfig.OPENROUTER_API_KEY}",
                request = ChatRequest(
                    model = GameConfig.TEXT_MODEL,
                    messages = listOf(
                        ChatMessage("user", promptBuilder.buildBannerConceptPrompt(project.claimedName))
                    ),
                    maxTokens = GameConfig.MAX_TOKENS_BANNER_CONCEPT,
                    temperature = 1.0f
                )
            )
            resp.choices.first().message.content
                .trim()
                .replace(Regex("^[*_\"'`]+|[*_\"'`]+$"), "") // strip markdown bold/italic/quotes
                .trim()
        } catch (e: Exception) {
            // Fallback concept if DeepSeek is unavailable — still gives a decent image
            AppLogger.i("GenerateProjectBannerUseCase", "Concept gen failed, using name: ${e.message}")
            "digital art illustration inspired by the name ${project.claimedName}, vibrant colors, mobile game banner"
        }

        val finalPrompt = promptBuilder.buildFinalImagePrompt(concept)

        // Step 2: Pollinations.ai — FLUX.1-schnell, free tier (no API key needed).
        // URLEncoder + replace("+","%20") guarantees RFC-3986 compliant path segment.
        val encoded = java.net.URLEncoder.encode(finalPrompt.take(400), "UTF-8")
            .replace("+", "%20")
        val seed = kotlin.math.abs(project.id.hashCode())
        val url = "https://image.pollinations.ai/prompt/$encoded" +
                  "?width=512&height=512&seed=$seed&model=flux&nologo=true"

        AppLogger.i("GenerateProjectBannerUseCase", "Banner URL saved for ${project.claimedName}")
        projectRepository.updateBannerUrl(project.id, url, concept)
        url
    }
}
