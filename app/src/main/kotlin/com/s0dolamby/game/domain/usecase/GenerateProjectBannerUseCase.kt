package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.ai.ChatMessage
import com.s0dolamby.game.data.ai.ChatRequest
import com.s0dolamby.game.data.ai.OpenRouterApiService
import com.s0dolamby.game.data.ai.PromptBuilder
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject

class GenerateProjectBannerUseCase @Inject constructor(
    private val api: OpenRouterApiService,
    private val promptBuilder: PromptBuilder,
    private val projectRepository: ProjectRepository
) {
    suspend operator fun invoke(project: Project): Result<String> = runCatching {
        // Step 1: get visual concept from DeepSeek
        val conceptResponse = api.chatCompletion(
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
        val concept = conceptResponse.choices.first().message.content.trim()

        // Step 2: build Pollinations.ai URL (free, no API key needed)
        val finalPrompt = promptBuilder.buildFinalImagePrompt(concept)
        val encoded = java.net.URLEncoder.encode(finalPrompt, "UTF-8")
        val seed = kotlin.math.abs(project.id.hashCode())
        val url = "https://image.pollinations.ai/prompt/$encoded?width=512&height=512&nologo=true&seed=$seed"

        projectRepository.updateBannerUrl(project.id, url, concept)
        url
    }
}
