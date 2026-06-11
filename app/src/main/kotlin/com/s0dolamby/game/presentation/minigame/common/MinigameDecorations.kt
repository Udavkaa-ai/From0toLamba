package com.s0dolamby.game.presentation.minigame.common

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/** Звёздочка-блик: круг + 4-конечный «крест». Размер r — радиус «луча». */
fun DrawScope.drawSparkle(
    center: Offset,
    r: Float,
    color: Color = Color(0xFFFFE082)
) {
    val a = color.copy(alpha = 0.9f)
    drawCircle(a, radius = r * 0.5f, center = center)
    drawLine(
        a, start = Offset(center.x - r, center.y), end = Offset(center.x + r, center.y),
        strokeWidth = r * 0.45f
    )
    drawLine(
        a, start = Offset(center.x, center.y - r), end = Offset(center.x, center.y + r),
        strokeWidth = r * 0.45f
    )
    // короткие диагональные лучики
    val d = r * 0.7f
    val da = color.copy(alpha = 0.55f)
    drawLine(da,
        start = Offset(center.x - d, center.y - d),
        end = Offset(center.x + d, center.y + d),
        strokeWidth = r * 0.22f)
    drawLine(da,
        start = Offset(center.x - d, center.y + d),
        end = Offset(center.x + d, center.y - d),
        strokeWidth = r * 0.22f)
}

/** Венок из sparkle вокруг точки (для эталона / победы). */
fun DrawScope.drawSparkleHalo(
    center: Offset,
    radius: Float,
    count: Int = 6,
    sparkleSize: Float = 8f,
    color: Color = Color(0xFFFFE082),
    intensity: Float = 1f
) {
    val effectiveCount = (count * intensity.coerceIn(0f, 1f)).toInt().coerceAtLeast(2)
    for (i in 0 until effectiveCount) {
        val angle = 2.0 * Math.PI * i / effectiveCount
        val cx = center.x + (radius * cos(angle)).toFloat()
        val cy = center.y + (radius * sin(angle)).toFloat()
        drawSparkle(Offset(cx, cy), sparkleSize, color.copy(alpha = color.alpha * intensity))
    }
}

/** Внутренняя двойная рамка с орнаментом по углам — как «грамота». */
fun DrawScope.drawCharterFrame(
    outerColor: Color,
    innerColor: Color,
    cornerOffset: Float = 12f
) {
    drawRect(
        color = outerColor,
        size = size,
        style = Stroke(
            width = 2f,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 6f))
        )
    )
    drawRect(
        color = innerColor,
        topLeft = Offset(cornerOffset, cornerOffset),
        size = androidx.compose.ui.geometry.Size(
            size.width - cornerOffset * 2,
            size.height - cornerOffset * 2
        ),
        style = Stroke(width = 1f)
    )
}

private data class MistSeed(val x: Float, val y: Float, val phase: Float)

/** Мерцающие частицы-пылинки на фоне сцены. */
@Composable
fun MinigameMistOverlay(
    modifier: Modifier = Modifier,
    accent: Color,
    intensity: Float = 1f
) {
    val seeds = remember {
        List(24) { MistSeed(Random.nextFloat(), Random.nextFloat(), Random.nextFloat()) }
    }
    val infinite = rememberInfiniteTransition(label = "mist")
    val t by infinite.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(6000, easing = LinearEasing)),
        label = "mistT"
    )
    Canvas(modifier = modifier.fillMaxSize()) {
        seeds.forEach { seed ->
            val phase = (t + seed.phase) % 1f
            val cx = size.width * seed.x
            val cy = size.height * seed.y + (size.height * 0.15f) * (phase - 0.5f)
            val r = 1.2f + 2.4f * (1 - phase)
            val alpha = 0.10f + 0.25f * (1 - phase) * intensity
            drawCircle(accent.copy(alpha = alpha), radius = r * 2f, center = Offset(cx, cy))
        }
    }
}
