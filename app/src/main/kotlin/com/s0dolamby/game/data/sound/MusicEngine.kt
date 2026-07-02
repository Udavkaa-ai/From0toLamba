package com.s0dolamby.game.data.sound

import android.content.Context
import android.media.MediaPlayer
import com.s0dolamby.game.R
import com.s0dolamby.game.data.logging.AppLogger
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Фоновая музыка — сказочная тема main_theme.mp3 из TG-версии, крутится
 * по кругу всю сессию. Пауза при сворачивании приложения (onStop),
 * возобновление при возврате (onStart) — управляет MainActivity.
 *
 * Громкость как в TG: ползунок 0.5 × музыкальный множитель 0.4 = 0.2.
 */
@Singleton
class MusicEngine @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private var player: MediaPlayer? = null

    /** Включена ли музыка в настройках (persisted в Room). */
    @Volatile private var enabled: Boolean = true

    /** Активность на переднем плане — музыка играет только тогда. */
    @Volatile private var inForeground: Boolean = false

    fun setEnabled(value: Boolean) {
        enabled = value
        if (value && inForeground) ensurePlaying() else pausePlayback()
    }

    fun onForeground() {
        inForeground = true
        if (enabled) ensurePlaying()
    }

    fun onBackground() {
        inForeground = false
        pausePlayback()
    }

    fun release() {
        runCatching { player?.release() }
        player = null
    }

    private fun ensurePlaying() {
        try {
            val p = player ?: MediaPlayer.create(context, R.raw.main_theme)?.apply {
                isLooping = true
                setVolume(MUSIC_VOLUME, MUSIC_VOLUME)
            }?.also { player = it }
            if (p != null && !p.isPlaying) p.start()
        } catch (e: Exception) {
            AppLogger.e("MusicEngine", "ensurePlaying failed: ${e.message}")
        }
    }

    private fun pausePlayback() {
        runCatching { player?.takeIf { it.isPlaying }?.pause() }
    }

    companion object {
        // 0.5 (дефолтный ползунок TG) × 0.4 (музыкальный множитель) = 0.2
        private const val MUSIC_VOLUME = 0.2f
    }
}
