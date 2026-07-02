package com.s0dolamby.game.presentation.common.sound

import androidx.compose.runtime.staticCompositionLocalOf
import com.s0dolamby.game.data.sound.SoundEngine

/**
 * Доступ к звуковому движку из Composable-слоя (оверлеи результатов
 * мини-игр, поздравление с чином). Реальный singleton прокидывается
 * из MainActivity; дефолт — отдельный экземпляр для превью, он молчит,
 * пока его не попросят играть.
 */
val LocalSoundEngine = staticCompositionLocalOf { SoundEngine() }
