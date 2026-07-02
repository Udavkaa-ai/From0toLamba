package com.s0dolamby.game.data.sound

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import com.s0dolamby.game.data.logging.AppLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin
import kotlin.random.Random

/**
 * Звуковой движок — порт tg/client/src/sounds.ts (Web Audio → AudioTrack).
 *
 * Эстетика: приглушённые щелчки дерева/пергамента, шелест страниц,
 * колокольчики — под антураж сказочной Руси. Никаких файлов: каждый звук
 * синтезируется в PCM-буфер один раз при первом обращении и кэшируется.
 *
 * Семь звуков:
 *  - tap    — щелчок деревянной кнопки (удар + шелест)
 *  - invest — монета падает на стол (два удара)
 *  - day    — шелест страницы пергамента + лёгкий хлопок
 *  - win    — мягкий перезвон двух колокольчиков
 *  - lose   — глухой двойной стук, как захлопнутая книга
 *  - rankup — три колокольчика лесенкой + шелест
 *  - seal   — печать по воску (мягкий штамп)
 */
enum class SoundName { TAP, INVEST, DAY, WIN, LOSE, RANKUP, SEAL }

@Singleton
class SoundEngine @Inject constructor() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val cache = HashMap<SoundName, ShortArray>()

    /** Выключены ли эффекты — выставляется из настроек (persisted в Room). */
    @Volatile var muted: Boolean = false

    /** Громкость 0..1 — как в TG, по умолчанию 0.5. */
    @Volatile var volume: Float = 0.5f

    fun play(name: SoundName) {
        if (muted || volume <= 0f) return
        scope.launch {
            try {
                val pcm = synchronized(cache) { cache.getOrPut(name) { render(name) } }
                playPcm(pcm)
            } catch (e: Exception) {
                AppLogger.e("SoundEngine", "play($name) failed: ${e.message}")
            }
        }
    }

    // ─── PCM-примитивы (аналог Web Audio узлов) ────────────────────────────

    private fun buf(durationSec: Double) = ShortArray((SAMPLE_RATE * durationSec).toInt())

    /**
     * Глухой удар (дерево/войлок): синус с падающей частотой и
     * экспоненциальным затуханием — аналог playThud из TG.
     */
    private fun mixThud(target: ShortArray, offsetSec: Double, freq: Double, durSec: Double, peak: Double) {
        val start = (offsetSec * SAMPLE_RATE).toInt()
        val len = (durSec * SAMPLE_RATE).toInt()
        var phase = 0.0
        for (i in 0 until len) {
            val idx = start + i
            if (idx >= target.size) break
            val t = i.toDouble() / len
            // Частота чуть падает — как настоящий удар (freq → freq×0.6)
            val f = freq * (1.0 - 0.4 * t)
            phase += 2 * PI * f / SAMPLE_RATE
            val env = exp(-5.0 * t)
            val sample = sin(phase) * peak * env
            target[idx] = clip(target[idx] + (sample * Short.MAX_VALUE).toInt())
        }
    }

    /**
     * Шелест пергамента: белый шум через грубый lowpass (скользящее среднее),
     * с линейной атакой и затуханием — аналог playNoise из TG.
     */
    private fun mixNoise(target: ShortArray, offsetSec: Double, durSec: Double, lpFreq: Double, peak: Double, attackRatio: Double = 0.15) {
        val start = (offsetSec * SAMPLE_RATE).toInt()
        val len = (durSec * SAMPLE_RATE).toInt()
        // Ширина окна сглаживания ≈ SAMPLE_RATE / lpFreq — простой FIR-lowpass
        val window = (SAMPLE_RATE / lpFreq).toInt().coerceIn(1, 64)
        var acc = 0.0
        val ring = DoubleArray(window)
        var ringIdx = 0
        val attackLen = (len * attackRatio).toInt().coerceAtLeast(1)
        for (i in 0 until len) {
            val idx = start + i
            if (idx >= target.size) break
            val white = Random.nextDouble(-1.0, 1.0)
            acc += white - ring[ringIdx]
            ring[ringIdx] = white
            ringIdx = (ringIdx + 1) % window
            val filtered = acc / window
            val env = if (i < attackLen) i.toDouble() / attackLen
            else 1.0 - (i - attackLen).toDouble() / (len - attackLen)
            val sample = filtered * peak * env
            target[idx] = clip(target[idx] + (sample * Short.MAX_VALUE).toInt())
        }
    }

    /**
     * Колокольчик: чистый синус с быстрой атакой и долгим экспоненциальным
     * затуханием — аналог playBell из TG (bandpass имитируем чистотой тона).
     */
    private fun mixBell(target: ShortArray, offsetSec: Double, freq: Double, durSec: Double, peak: Double) {
        val start = (offsetSec * SAMPLE_RATE).toInt()
        val len = (durSec * SAMPLE_RATE).toInt()
        var phase = 0.0
        val attackLen = (0.01 * SAMPLE_RATE).toInt()
        for (i in 0 until len) {
            val idx = start + i
            if (idx >= target.size) break
            phase += 2 * PI * freq / SAMPLE_RATE
            val t = i.toDouble() / len
            val env = if (i < attackLen) i.toDouble() / attackLen else exp(-4.0 * t)
            val sample = sin(phase) * peak * env
            target[idx] = clip(target[idx] + (sample * Short.MAX_VALUE).toInt())
        }
    }

    private fun clip(v: Int): Short = v.coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()

    // ─── Рецепты звуков (тайминги/частоты 1:1 из TG sounds.ts) ─────────────

    private fun render(name: SoundName): ShortArray = when (name) {
        SoundName.TAP -> buf(0.10).also {
            mixThud(it, 0.0, 180.0, 0.07, 0.4)
            mixNoise(it, 0.0, 0.06, 400.0, 0.08)
        }
        SoundName.INVEST -> buf(0.25).also {
            mixThud(it, 0.0, 260.0, 0.12, 0.45)
            mixThud(it, 0.09, 220.0, 0.09, 0.25)
        }
        SoundName.DAY -> buf(0.40).also {
            mixNoise(it, 0.0, 0.28, 1200.0, 0.55, 0.08)
            mixThud(it, 0.22, 140.0, 0.10, 0.15)
        }
        SoundName.WIN -> buf(0.70).also {
            mixBell(it, 0.0, 520.0, 0.5, 0.35)
            mixBell(it, 0.14, 780.0, 0.45, 0.28)
        }
        SoundName.LOSE -> buf(0.35).also {
            mixThud(it, 0.0, 120.0, 0.18, 0.45)
            mixThud(it, 0.11, 100.0, 0.15, 0.30)
        }
        SoundName.RANKUP -> buf(1.10).also {
            mixBell(it, 0.0, 440.0, 0.6, 0.30)
            mixBell(it, 0.17, 550.0, 0.55, 0.30)
            mixBell(it, 0.34, 660.0, 0.7, 0.35)
            mixNoise(it, 0.0, 0.35, 900.0, 0.20, 0.4)
        }
        SoundName.SEAL -> buf(0.12).also {
            mixThud(it, 0.0, 200.0, 0.08, 0.30)
            mixNoise(it, 0.0, 0.07, 600.0, 0.10)
        }
    }

    private fun playPcm(pcm: ShortArray) {
        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_GAME)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(pcm.size * 2)
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()
        track.setVolume(volume)
        track.write(pcm, 0, pcm.size)
        track.play()
        // MODE_STATIC доигрывает буфер сам; release по завершении.
        scope.launch {
            kotlinx.coroutines.delay((pcm.size * 1000L / SAMPLE_RATE) + 100)
            runCatching { track.release() }
        }
    }

    companion object {
        private const val SAMPLE_RATE = 22050
    }
}
