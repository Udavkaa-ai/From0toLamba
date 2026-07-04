package com.s0dolamby.game.presentation.common.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

private data class Coin(
    val x0: Float,        // стартовая колонка 0..1
    val delay: Float,     // доля анимации до появления 0..0.35
    val radiusDp: Float,  // размер монеты
    val swayAmp: Float,   // амплитуда покачивания в долях ширины
    val swayFreq: Float,  // колебаний за падение
    val spinFreq: Float,  // оборотов «ребром» за падение
    val tiltDeg: Float    // постоянный наклон
)

// Детерминированный набор: одно и то же красивое падение у всех.
private val coins: List<Coin> = Random(20260704).let { rng ->
    List(26) {
        Coin(
            x0 = rng.nextFloat(),
            delay = rng.nextFloat() * 0.35f,
            radiusDp = 5f + rng.nextFloat() * 5f,
            swayAmp = 0.02f + rng.nextFloat() * 0.05f,
            swayFreq = 1.5f + rng.nextFloat() * 2f,
            spinFreq = 2f + rng.nextFloat() * 3f,
            tiltDeg = -25f + rng.nextFloat() * 50f
        )
    }
}

/**
 * Дождь золотых монет — праздник при закрытии дела в прибыль.
 * Одноразовый (progress 0→1), рисуется кодом: овалы с «вращением ребром»,
 * золотой градиент, блик. Никаких ассетов.
 */
@Composable
fun CoinConfettiOverlay(
    modifier: Modifier = Modifier,
    durationMs: Int = 2600,
    onFinished: () -> Unit = {}
) {
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        progress.animateTo(1f, tween(durationMs, easing = LinearEasing))
        onFinished()
    }

    Canvas(modifier = modifier) {
        val p = progress.value
        coins.forEach { coin ->
            // Локальный прогресс монеты с учётом её задержки
            val t = ((p - coin.delay) / (1f - coin.delay)).coerceIn(0f, 1f)
            if (t <= 0f || t >= 1f) return@forEach

            val r = coin.radiusDp * density
            // Падение сверху за нижний край, с лёгким ускорением
            val y = size.height * (t * t * 0.4f + t * 0.8f) - r * 4f
            val x = size.width * (coin.x0 +
                coin.swayAmp * sin(t * coin.swayFreq * 2f * Math.PI.toFloat()))
            // «Вращение ребром»: сжимаем по X косинусом
            val flip = abs(cos(t * coin.spinFreq * 2f * Math.PI.toFloat()))
                .coerceAtLeast(0.12f)
            // Плавное растворение к концу падения
            val alpha = when {
                t < 0.1f -> t / 0.1f
                t > 0.85f -> (1f - t) / 0.15f
                else -> 1f
            }

            translate(left = x, top = y) {
                rotate(coin.tiltDeg, pivot = Offset.Zero) {
                    scale(scaleX = flip, scaleY = 1f, pivot = Offset.Zero) {
                        drawCircle(
                            brush = Brush.radialGradient(
                                colors = listOf(
                                    Color(0xFFFFE082).copy(alpha = alpha),
                                    Color(0xFFFFB800).copy(alpha = alpha),
                                    Color(0xFFB07400).copy(alpha = alpha)
                                ),
                                center = Offset(-r * 0.25f, -r * 0.3f),
                                radius = r * 1.6f
                            ),
                            radius = r,
                            center = Offset.Zero
                        )
                        // Кромка чекана
                        drawCircle(
                            color = Color(0xFF8A5B00).copy(alpha = alpha * 0.8f),
                            radius = r,
                            center = Offset.Zero,
                            style = androidx.compose.ui.graphics.drawscope.Stroke(
                                width = r * 0.16f
                            )
                        )
                        // Блик
                        drawCircle(
                            color = Color.White.copy(alpha = alpha * 0.45f),
                            radius = r * 0.28f,
                            center = Offset(-r * 0.35f, -r * 0.4f)
                        )
                    }
                }
            }
        }
    }
}
