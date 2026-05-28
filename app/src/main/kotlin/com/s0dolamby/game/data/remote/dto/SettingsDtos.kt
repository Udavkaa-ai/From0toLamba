package com.s0dolamby.game.data.remote.dto

/**
 * Ответ GET /api/game/settings — текущие настройки игрока.
 * POST /api/game/settings принимает SettingsUpdateBody с любым подмножеством полей.
 */
data class SettingsResponse(
    val preferredModel: String,
)

data class SettingsUpdateBody(
    val preferredModel: String? = null,
    val preferredLanguage: String? = null,         // "ru" | "en"
    val newsEnabled: Boolean? = null,
)

/** Ответы простых mutation-эндпоинтов (advance-day, complete-onboarding и т.п.). */
data class SimpleSuccessResponse(
    val success: Boolean = true,
    val newRank: String? = null,
    val closures: List<String>? = null,
    val bonusAwarded: Double? = null,
)

/** 429 на /advance-day — слишком рано. secondsRemaining до cooldown'а. */
data class AdvanceCooldownErrorBody(
    val error: String,
    val secondsRemaining: Int,
)
