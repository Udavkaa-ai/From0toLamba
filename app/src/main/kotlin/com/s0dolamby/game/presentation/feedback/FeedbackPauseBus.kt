package com.s0dolamby.game.presentation.feedback

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow

/**
 * Глобальный сигнал «открыт попап фидбека» → мини-игры на время
 * замирают, пока тестер пишет заметку. Ставится [FeedbackReporter]'ом.
 */
object FeedbackPauseBus {
    val paused = MutableStateFlow(false)
}

/**
 * Задержка, которая НЕ идёт, пока активна пауза фидбека. Тикает мелкими
 * шагами и прибавляет время только когда не на паузе — так таймер
 * мини-игры честно замирает и продолжается с того же места.
 *
 * Заменяет обычный `delay(ms)` в отсчётах мини-игр.
 */
suspend fun pausableDelay(ms: Long, step: Long = 50L) {
    var elapsed = 0L
    while (elapsed < ms) {
        delay(step)
        if (!FeedbackPauseBus.paused.value) elapsed += step
    }
}
