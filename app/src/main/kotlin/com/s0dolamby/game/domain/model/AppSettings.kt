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
    val notificationsEnabled: Boolean = true
)

data class ModelOption(val label: String, val modelId: String)

/**
 * Дефолтная модель — реальный существующий ID на OpenRouter. Раньше стоял
 * несуществующий `deepseek/deepseek-v4-flash`, из-за чего чат падал.
 * DeepSeek V3 (0324) — проверенный, дешёвый ($0.20/$0.80 за 1М токенов),
 * хорошо держит русский и характер персонажа. Тот же, что в TG-проде.
 */
const val DEFAULT_TEXT_MODEL = "deepseek/deepseek-chat-v3-0324"

// Список для будущего селектора (сейчас скрыт в настройках). Только
// реальные ID OpenRouter. DeepSeek V3.2 — ещё дешевле по выводу ($0.34/1М).
val TEXT_MODEL_OPTIONS = listOf(
    ModelOption("DeepSeek V3 (рекомендуется)", DEFAULT_TEXT_MODEL),
    ModelOption("DeepSeek V3.2 (дешевле)", "deepseek/deepseek-v3.2"),
    ModelOption("Gemini Flash Lite", "google/gemini-3.1-flash-lite-preview")
)
