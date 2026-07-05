package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.ai.FeedbackRequest
import com.s0dolamby.game.data.ai.OpenRouterApiService
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.repository.SettingsRepository
import javax.inject.Inject

/** Тип заметки тестера. */
enum class FeedbackType { BUG, SUGGESTION, QUESTION }

/**
 * Заметка тестера (баг / предложение / вопрос): уходит на Railway-прокси,
 * тот кладёт её в Postgres (таблица Feedback) с привязкой к экрану, версии
 * и автору. Оттуда всё выгружается разом.
 */
class SendFeedbackUseCase @Inject constructor(
    private val api: OpenRouterApiService,
    private val settingsRepository: SettingsRepository
) {
    suspend operator fun invoke(
        type: FeedbackType,
        message: String,
        page: String?,
        screenshotBase64: String? = null
    ): Result<Unit> = runCatching {
        val text = message.trim()
        require(text.length >= 3) { "Слишком коротко — напиши хоть пару слов" }
        val nickname = settingsRepository.getSettings().nickname.ifBlank { null }
        val ack = api.sendFeedback(
            appKey = BuildConfig.MOBILE_APP_KEY,
            request = FeedbackRequest(
                nickname = nickname,
                type = type.name,
                page = page,
                message = text.take(2000),
                appVersion = BuildConfig.VERSION_NAME,
                screenshot = screenshotBase64
            )
        )
        AppLogger.i("Feedback", "sent type=$type page=$page shot=${screenshotBase64 != null} ok=${ack.ok}")
    }.onFailure { AppLogger.e("Feedback", "send failed", it) }
}
