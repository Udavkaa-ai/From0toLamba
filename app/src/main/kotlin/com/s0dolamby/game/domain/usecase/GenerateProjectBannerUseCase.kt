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
 *  2. OpenRouter + flux.2-flex generates the image, returns a CDN URL — ~$0.003
 *
 * The CDN URL is stored in Room; Coil disk-cache ensures it's only fetched once per device.
 */
class GenerateProjectBannerUseCase @Inject constructor(
    private val api: OpenRouterApiService,
    private val promptBuilder: PromptBuilder,
    private val projectRepository: ProjectRepository
) {
    suspend operator fun invoke(project: Project): Result<String> = runCatching {
        // Step 1: unique visual concept from DeepSeek
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
                .replace(Regex("^[*_\"'`]+|[*_\"'`]+$"), "")
                .trim()
        } catch (e: Exception) {
            AppLogger.i("GenerateProjectBannerUseCase", "Concept gen failed, using name: ${e.message}")
            "digital art illustration inspired by the name ${project.claimedName}, vibrant colors, mobile game banner"
        }

        val finalPrompt = promptBuilder.buildFinalImagePrompt(concept)

        // Step 2: OpenRouter image generation — returns CDN URL
        val imageResp = api.chatCompletion(
            auth = "Bearer ${BuildConfig.OPENROUTER_API_KEY}",
            request = ChatRequest(
                model = GameConfig.IMAGE_MODEL,
                messages = listOf(ChatMessage("user", finalPrompt)),
                maxTokens = 1,
                modalities = listOf("image")
            )
        )
        val url = imageResp.choices.firstOrNull()?.message?.images?.firstOrNull()?.imageUrl?.url
            ?: throw Exception("No image URL in OpenRouter response")

        AppLogger.i("GenerateProjectBannerUseCase", "Banner URL saved for ${project.claimedName}")
        projectRepository.updateBannerUrl(project.id, url, concept)
        url
    }
}
