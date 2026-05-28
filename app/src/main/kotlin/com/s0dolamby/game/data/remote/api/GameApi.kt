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

    // ---- AMA (беседа с хозяином) ----

    @POST("/api/ama/{projectId}/start")
    suspend fun startAmaSession(@Path("projectId") projectId: String): AmaStartResponse

    @GET("/api/ama/{projectId}")
    suspend fun getAmaSession(@Path("projectId") projectId: String): AmaSessionResponse

    @POST("/api/ama/{projectId}/message")
    suspend fun sendAmaMessage(
        @Path("projectId") projectId: String,
        @Body body: AmaMessageBody,
    ): AmaMessageResponse

    @POST("/api/ama/{projectId}/evaluate-intuition")
    suspend fun evaluateIntuition(
        @Path("projectId") projectId: String,
        @Body body: IntuitionEvalBody,
    ): IntuitionEvalResponse

    // ---- Invest (вложения и выводы) ----

    @POST("/api/invest/{projectId}")
    suspend fun invest(
        @Path("projectId") projectId: String,
        @Body body: InvestBody,
    ): InvestResponse

    @POST("/api/invest/{projectId}/add")
    suspend fun addInvestment(
        @Path("projectId") projectId: String,
        @Body body: AddInvestBody,
    ): SimpleSuccessResponse

    @POST("/api/invest/{projectId}/withdraw")
    suspend fun partialWithdraw(
        @Path("projectId") projectId: String,
        @Body body: WithdrawBody,
    ): WithdrawResponse

    @POST("/api/invest/{projectId}/exit")
    suspend fun exitProject(@Path("projectId") projectId: String): WithdrawResponse
}
