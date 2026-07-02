package com.s0dolamby.game.presentation.common.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf

/** easeOutCubic — как в TG CountUp (1 - (1-t)³). */
private val EaseOutCubic = CubicBezierEasing(0.33f, 1f, 0.68f, 1f)

/**
 * Плавный счётчик (порт tg/client/src/components/CountUp.tsx).
 * При изменении [target] перебирает от предыдущего значения к новому
 * за [durationMillis] с easeOutCubic. Использовать так:
 *
 * ```
 * val animated by rememberCountUp(balance)
 * Text(formatGroshes(animated))
 * ```
 */
@Composable
fun rememberCountUp(target: Double, durationMillis: Int = 800): State<Double> {
    val animatable = remember { Animatable(target.toFloat()) }
    LaunchedEffect(target) {
        animatable.animateTo(
            target.toFloat(),
            animationSpec = tween(durationMillis, easing = EaseOutCubic)
        )
    }
    return remember { derivedStateOf { animatable.value.toDouble() } }
}
