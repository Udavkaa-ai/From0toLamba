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

    /** Отправить своё текущее положение в купеческий рейтинг (upsert по playerId). */
    @POST("api/mobile/leaderboard")
    suspend fun submitStanding(
        @Header("X-App-Key") appKey: String,
        @Body request: StandingRequest
    ): FeedbackAck

    /** Топ купцов + общее число игроков. */
    @retrofit2.http.GET("api/mobile/leaderboard")
    suspend fun fetchLeaderboard(
        @Header("X-App-Key") appKey: String,
        @retrofit2.http.Query("limit") limit: Int
    ): LeaderboardResponse
}

/** Строка, отправляемая в купеческий рейтинг. */
data class StandingRequest(
    val playerId: String,
    val nickname: String,
    val wealth: Double,
    val rankTitle: String?,
    val day: Int,
    val loginStreak: Int,
    val appVersion: String?,
    val platform: String = "android"
)

/** Ответ рейтинга: общее число купцов + верхушка. */
data class LeaderboardResponse(
    val total: Int = 0,
    val entries: List<LeaderboardEntryDto> = emptyList()
)

data class LeaderboardEntryDto(
    val position: Int = 0,
    val playerId: String = "",
    val nickname: String = "",
    val wealth: Double = 0.0,
    val rankTitle: String? = null,
    val day: Int = 0
)

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
    /** Устройство: «Samsung SM-G991B» (производитель + модель). */
    val device: String? = null,
    /** Версия Android как уровень API (Build.VERSION.SDK_INT), напр. 34. */
    val androidSdk: Int? = null,
    /** Экран: «1080×2340 @2.75x» (пиксели + плотность). */
    val screen: String? = null,
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
