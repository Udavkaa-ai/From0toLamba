package com.s0dolamby.game.data.ai

import com.google.gson.annotations.SerializedName
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

interface OpenRouterApiService {

    @POST("chat/completions")
    suspend fun chatCompletion(
        @Header("Authorization") auth: String,
        @Header("HTTP-Referer") referer: String = "com.s0dolamby.game",
        @Body request: ChatRequest
    ): ChatResponse

    @POST("images/generations")
    suspend fun generateImage(
        @Header("Authorization") auth: String,
        @Header("HTTP-Referer") referer: String = "com.s0dolamby.game",
        @Body request: ImageRequest
    ): ImageResponse
}

data class ChatRequest(
    val model: String,
    val messages: List<ChatMessage>,
    @SerializedName("max_tokens") val maxTokens: Int,
    val temperature: Float = 0.85f
)

data class ChatMessage(
    val role: String,
    val content: String
)

data class ChatResponse(
    val choices: List<Choice>
)

data class Choice(
    val message: ChatMessage
)

data class ImageRequest(
    val model: String = "black-forest-labs/flux-schnell",
    val prompt: String,
    val n: Int = 1,
    val size: String = "512x512"
)

data class ImageResponse(
    val data: List<ImageData>
)

data class ImageData(
    val url: String
)
