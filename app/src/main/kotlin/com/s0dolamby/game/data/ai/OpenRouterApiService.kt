package com.s0dolamby.game.data.ai

import com.google.gson.annotations.SerializedName
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

/**
 * Клиент нашего Railway-прокси (tg/server, роуты api/mobile): тело запроса
 * и ответа повторяют формат OpenRouter chat/completions, но ключ
 * OpenRouter живёт на сервере — в APK только лёгкий X-App-Key допуска.
 */
interface OpenRouterApiService {

    @POST("api/mobile/chat")
    suspend fun chatCompletion(
        @Header("X-App-Key") appKey: String,
        @Body request: ChatRequest
    ): ChatResponse

    @POST("api/mobile/feedback")
    suspend fun sendFeedback(
        @Header("X-App-Key") appKey: String,
        @Body request: FeedbackRequest
    ): FeedbackAck
}

/** Ответ сервера на фидбек. Конкретный класс (а не Unit), чтобы Gson
 *  парсил его тем же путём, что и ответ чата — Unit-конверсия капризна. */
data class FeedbackAck(val ok: Boolean = false)

/** Заметка тестера — падает в Postgres на Railway. */
data class FeedbackRequest(
    val nickname: String?,
    /** BUG | SUGGESTION | QUESTION */
    val type: String,
    /** Экран, с которого отправлено (route). */
    val page: String?,
    val message: String,
    val appVersion: String?,
    val platform: String = "android",
    /** Скриншот момента: JPEG в base64 (без data-url). null — без картинки. */
    val screenshot: String? = null
)

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
