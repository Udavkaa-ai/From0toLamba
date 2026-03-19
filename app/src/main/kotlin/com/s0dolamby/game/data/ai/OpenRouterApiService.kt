package com.s0dolamby.game.data.ai

import com.google.gson.annotations.SerializedName
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

interface OpenRouterApiService {

    @POST("chat/completions")
    suspend fun chatCompletion(
        @Header("Authorization") auth: String,
        @Header("HTTP-Referer") referer: String = "https://github.com/s0dolamby",
        @Header("X-Title") title: String = "С 0 до Ламбы",
        @Body request: ChatRequest
    ): ChatResponse
}

data class ChatRequest(
    val model: String,
    val messages: List<ChatMessage>,
    @SerializedName("max_tokens") val maxTokens: Int,
    val temperature: Float = 0.85f,
    /** Set to ["image"] for image generation, ["image","text"] for mixed output */
    val modalities: List<String>? = null
)

/** Used for outgoing request messages */
data class ChatMessage(
    val role: String,
    val content: String
)

data class ChatResponse(
    val choices: List<Choice>
)

data class Choice(
    val message: ChatResponseMessage
)

/** Separate from ChatMessage so we can carry optional images in responses */
data class ChatResponseMessage(
    val role: String = "",
    val content: String = "",
    /** Present when modalities includes "image" — list of generated images */
    val images: List<ImageResponseItem>? = null
)

data class ImageResponseItem(
    @SerializedName("image_url") val imageUrl: ImageItemUrl
)

data class ImageItemUrl(
    val url: String  // either "data:image/png;base64,..." or a CDN URL
)

// Legacy types kept for source compatibility (unused at runtime)
data class ImageRequest(
    val model: String = "black-forest-labs/flux-schnell",
    val prompt: String,
    val n: Int = 1,
    val size: String = "512x512"
)

data class ImageResponse(val data: List<ImageData>)
data class ImageData(val url: String)
