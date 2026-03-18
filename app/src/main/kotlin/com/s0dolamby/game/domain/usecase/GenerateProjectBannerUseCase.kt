package com.s0dolamby.game.domain.usecase

import android.content.Context
import android.util.Base64
import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.ai.ChatMessage
import com.s0dolamby.game.data.ai.ChatRequest
import com.s0dolamby.game.data.ai.OpenRouterApiService
import com.s0dolamby.game.data.ai.PromptBuilder
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.ProjectRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject

class GenerateProjectBannerUseCase @Inject constructor(
    private val api: OpenRouterApiService,
    private val promptBuilder: PromptBuilder,
    private val projectRepository: ProjectRepository,
    @ApplicationContext private val context: Context
) {
    suspend operator fun invoke(project: Project): Result<String> = runCatching {
        // Step 1: DeepSeek generates a unique visual concept for this project name
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
        val finalPrompt = promptBuilder.buildFinalImagePrompt(concept)

        // Step 2: Generate image via OpenRouter chat/completions + modalities:["image"]
        // OpenRouter does NOT support /images/generations — the correct endpoint is
        // /chat/completions with modalities param. Response: message.images[0].image_url.url
        val url = tryOpenRouterImageGen(project, finalPrompt, concept)
            ?: buildPollinationsFallbackUrl(project, finalPrompt)

        projectRepository.updateBannerUrl(project.id, url, concept)
        url
    }

    private suspend fun tryOpenRouterImageGen(
        project: Project,
        prompt: String,
        concept: String
    ): String? = try {
        val response = api.chatCompletion(
            auth = "Bearer ${BuildConfig.OPENROUTER_API_KEY}",
            request = ChatRequest(
                model = GameConfig.IMAGE_MODEL,
                messages = listOf(ChatMessage("user", prompt)),
                maxTokens = 1,          // image-only model; text tokens irrelevant
                temperature = 1.0f,
                modalities = listOf("image")
            )
        )

        // OpenRouter can return image in two ways:
        // 1. message.images[0].image_url.url  (image-only models)
        // 2. message.content as JSON array: [{"type":"image_url","image_url":{"url":"..."}}]
        val msg = response.choices.firstOrNull()?.message ?: return null
        val dataUrl = msg.images?.firstOrNull()?.imageUrl?.url
            ?: extractImageUrlFromContent(msg.content)
            ?: return null

        if (dataUrl.startsWith("data:image")) {
            // base64 PNG — decode and save to local file
            val base64 = dataUrl.substringAfter("base64,")
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            val dir = File(context.filesDir, "banners").also { it.mkdirs() }
            val file = File(dir, "${project.id}.png")
            file.writeBytes(bytes)
            AppLogger.i("GenerateProjectBannerUseCase", "Saved banner to ${file.absolutePath}")
            file.toURI().toString()   // "file:///data/data/.../files/banners/<id>.png"
        } else {
            // CDN URL returned directly — use as-is
            dataUrl
        }
    } catch (e: Exception) {
        AppLogger.i("GenerateProjectBannerUseCase",
            "OpenRouter image gen failed (${e.javaClass.simpleName}: ${e.message}), using Pollinations fallback")
        null
    }

    /**
     * Some models return image as a JSON content array:
     * content = "[{\"type\":\"image_url\",\"image_url\":{\"url\":\"data:image/png;base64,...\"}}]"
     */
    private fun extractImageUrlFromContent(content: String): String? {
        return try {
            if (!content.trimStart().startsWith("[")) null
            else Regex(""""url"\s*:\s*"(data:image[^"]+)"""").find(content)?.groupValues?.get(1)
        } catch (_: Exception) { null }
    }

    /** Fallback: Pollinations.ai — free, no key. Uses proper percent-encoding so 400 never happens. */
    private fun buildPollinationsFallbackUrl(project: Project, prompt: String): String {
        // Limit length — very long URLs can trigger 400/414 on some proxies
        val safePrompt = prompt.take(400)
        // URLEncoder encodes spaces as '+'; replace with %20 for RFC-3986 path segment
        val encoded = java.net.URLEncoder.encode(safePrompt, "UTF-8").replace("+", "%20")
        val seed = kotlin.math.abs(project.id.hashCode())
        return "https://image.pollinations.ai/prompt/$encoded" +
               "?width=512&height=512&seed=$seed&model=flux&nologo=true"
    }
}
