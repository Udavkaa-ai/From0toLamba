package com.s0dolamby.game.data.remote.api

import com.s0dolamby.game.data.remote.dto.*
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Retrofit-интерфейс под Fastify-API (tg/server/src/api/routes/*). Авторизация
 * — через OkHttp-интерсептор AndroidAuthInterceptor (header X-Android-Device-Id).
 *
 * Покрытие в этой фазе: read-only GameState + Portfolio + Inbox + Updates +
 * Transactions + Settings + mutation эндпоинты для прокрутки дня и онбординга.
 * AMA и Invest — следующий этап (когда переключим UseCase'ы).
 */
interface GameApi {

    // ---- Game state & progression ----

    @GET("/api/game")
    suspend fun getGameState(): GameStateResponse

    @POST("/api/game/advance-day")
    suspend fun advanceDay(): SimpleSuccessResponse

    @POST("/api/game/clear-rank-up")
    suspend fun clearRankUp(): SimpleSuccessResponse

    @POST("/api/game/complete-onboarding")
    suspend fun completeOnboarding(): SimpleSuccessResponse

    @POST("/api/game/reset")
    suspend fun resetGame(): SimpleSuccessResponse

    // ---- Settings ----

    @GET("/api/game/settings")
    suspend fun getSettings(): SettingsResponse

    @POST("/api/game/settings")
    suspend fun updateSettings(@Body body: SettingsUpdateBody): SimpleSuccessResponse

    // ---- Projects (read-only) ----

    @GET("/api/projects/inbox")
    suspend fun getInbox(): List<ProjectPublicDto>

    @GET("/api/projects/portfolio")
    suspend fun getPortfolio(): PortfolioResponse

    @GET("/api/projects/{id}/updates")
    suspend fun getProjectUpdates(@Path("id") projectId: String): List<DailyUpdateDto>

    @POST("/api/projects/{id}/skip")
    suspend fun skipProject(@Path("id") projectId: String): SimpleSuccessResponse

    @GET("/api/projects/transactions")
    suspend fun getTransactions(): List<TransactionDto>
}
