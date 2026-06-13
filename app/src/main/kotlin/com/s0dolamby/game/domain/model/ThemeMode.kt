package com.s0dolamby.game.domain.model

/**
 * Какую палитру отрисовывает [com.s0dolamby.game.presentation.common.theme.
 * From0toLambaTheme]. Меняется через настройки и наблюдается из MainActivity.
 */
enum class ThemeMode(val displayName: String, val emoji: String) {
    DARK_FAIRY("Тёмная ночь", "🌙"),
    WARM_FAIRY("Тёплая ярмарка", "🍯");

    companion object {
        fun fromName(name: String?): ThemeMode = entries.firstOrNull { it.name == name } ?: DARK_FAIRY
    }
}
