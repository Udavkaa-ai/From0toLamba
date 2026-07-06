package com.s0dolamby.game.domain.model

data class AppSettings(
    val textModel: String = DEFAULT_TEXT_MODEL,
    val imageGenerationEnabled: Boolean = false,
    /** Прозвище игрока — показывается на главной и в Зале славы. Пусто = «Гость». */
    val nickname: String = "",
    /** Активная тема (тёмная фиолетовая или тёплая ярмарка). */
    val themeMode: ThemeMode = ThemeMode.DARK_FAIRY,
    /** Язык интерфейса: "ru" / "en". */
    val language: String = "ru",
    /** Звуковые эффекты (щелчки, колокольчики, шелест пергамента). */
    val soundEnabled: Boolean = true,
    /** Фоновая музыка (сказочная тема по кругу). */
    val musicEnabled: Boolean = true,
    /** Напоминания: серия догорает, ярмарка ждёт. */
    val notificationsEnabled: Boolean = true,
    /** Стабильный id купца для облачного рейтинга (UUID). Пусто = ещё не выдан. */
    val playerId: String = ""
)

data class ModelOption(val label: String, val modelId: String)

/**
 * Дефолтная модель — тот же ID, что в продакшен-сервере TG-версии
 * (DEFAULT_MODEL = 'deepseek/deepseek-v4-flash'). Быстрый и дешёвый,
 * проверен в TG-проде.
 */
const val DEFAULT_TEXT_MODEL = "deepseek/deepseek-v4-flash"

// Список для будущего селектора (сейчас скрыт в настройках).
val TEXT_MODEL_OPTIONS = listOf(
    ModelOption("DeepSeek v4 Flash (рекомендуется)", DEFAULT_TEXT_MODEL),
    ModelOption("DeepSeek Chat v3", "deepseek/deepseek-chat-v3-0324"),
    ModelOption("Gemini Flash Lite", "google/gemini-2.5-flash-lite-preview-09-2025"),
    ModelOption("Qwen Flash", "qwen/qwen3.5-flash-02-23")
)
