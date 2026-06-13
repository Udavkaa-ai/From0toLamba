package com.s0dolamby.game.presentation.common.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

// ─── Мерцающие искры на фоне ─────────────────────────────────────────────────

private data class SparkleParticle(
    val x: Float,      // 0..1 relative
    val y: Float,      // 0..1 relative
    val radius: Float, // dp
    val phase: Float,  // initial phase offset
    val speed: Float   // animation speed multiplier
)

private val sparkleParticles: List<SparkleParticle> = List(22) {
    SparkleParticle(
        x = Random.nextFloat(),
        y = Random.nextFloat(),
        radius = Random.nextFloat() * 2.5f + 1.0f,
        phase = Random.nextFloat() * (2f * PI.toFloat()),
        speed = Random.nextFloat() * 0.6f + 0.2f
    )
}

/**
 * Полупрозрачные мерцающие золотые точки — накладываются поверх фона.
 * Частицы сосредоточены в верхней трети экрана, где идёт градиент.
 */
@Composable
fun SparklesOverlay(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "sparkles")
    val time by transition.animateFloat(
        initialValue = 0f,
        targetValue = 2f * PI.toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(14_000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "sparkleTime"
    )
    val themedGold = androidx.compose.material3.MaterialTheme.colorScheme.primary

    Canvas(modifier = modifier) {
        sparkleParticles.forEach { p ->
            // alpha: мягкое синусоидальное мерцание
            val alpha = ((sin(time * p.speed + p.phase) + 1f) / 2f) * 0.45f
            drawCircle(
                color = themedGold.copy(alpha = alpha),
                radius = p.radius * density,
                center = Offset(p.x * size.width, p.y * size.height)
            )
        }
    }
}

// ─── Орнаментальный разделитель секций ────────────────────────────────────────

/**
 * Золотой разделитель в стиле русского орнамента:
 * затухающая линия — малый ромб — большой ромб — малый ромб — затухающая линия.
 */
@Composable
fun OrnamentDivider(
    modifier: Modifier = Modifier,
    height: Dp = 20.dp
) {
    val themedGold = androidx.compose.material3.MaterialTheme.colorScheme.primary
    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
    ) {
        val cx = size.width / 2f
        val cy = size.height / 2f
        val gold = themedGold

        // Левая затухающая линия
        drawLine(
            brush = Brush.horizontalGradient(
                colors = listOf(Color.Transparent, gold.copy(alpha = 0.35f)),
                startX = 0f,
                endX = cx - 26.dp.toPx()
            ),
            start = Offset(0f, cy),
            end = Offset(cx - 26.dp.toPx(), cy),
            strokeWidth = 0.8.dp.toPx()
        )

        // Правая затухающая линия
        drawLine(
            brush = Brush.horizontalGradient(
                colors = listOf(gold.copy(alpha = 0.35f), Color.Transparent),
                startX = cx + 26.dp.toPx(),
                endX = size.width
            ),
            start = Offset(cx + 26.dp.toPx(), cy),
            end = Offset(size.width, cy),
            strokeWidth = 0.8.dp.toPx()
        )

        // Малый ромб слева
        drawDiamond(
            center = Offset(cx - 18.dp.toPx(), cy),
            halfW = 4.dp.toPx(),
            halfH = 5.dp.toPx(),
            color = gold.copy(alpha = 0.45f)
        )

        // Центральный ромб (крупный)
        drawDiamond(
            center = Offset(cx, cy),
            halfW = 6.dp.toPx(),
            halfH = 8.dp.toPx(),
            color = gold.copy(alpha = 0.75f)
        )

        // Малый ромб справа
        drawDiamond(
            center = Offset(cx + 18.dp.toPx(), cy),
            halfW = 4.dp.toPx(),
            halfH = 5.dp.toPx(),
            color = gold.copy(alpha = 0.45f)
        )
    }
}

private fun DrawScope.drawDiamond(
    center: Offset,
    halfW: Float,
    halfH: Float,
    color: Color
) {
    val path = Path().apply {
        moveTo(center.x, center.y - halfH)
        lineTo(center.x + halfW, center.y)
        lineTo(center.x, center.y + halfH)
        lineTo(center.x - halfW, center.y)
        close()
    }
    drawPath(path, color = color)
}

// ─── Декоративная рамка карточки ─────────────────────────────────────────────

/**
 * Тонкая золотая рамка с ромбами в углах — рисуется поверх содержимого карточки.
 * Накладывается как Canvas поверх Box.
 */
@Composable
fun CardCornerOrnaments(
    modifier: Modifier = Modifier,
    cornerSize: Dp = 14.dp,
    alpha: Float = 0.35f
) {
    val themedGold = androidx.compose.material3.MaterialTheme.colorScheme.primary
    Canvas(modifier = modifier) {
        val cs = cornerSize.toPx()
        val gold = themedGold.copy(alpha = alpha)
        val stroke = 1.2.dp.toPx()

        // Четыре угла — L-образные штрихи
        listOf(
            Offset(0f, 0f) to Pair(Offset(cs, 0f), Offset(0f, cs)),
            Offset(size.width, 0f) to Pair(Offset(size.width - cs, 0f), Offset(size.width, cs)),
            Offset(0f, size.height) to Pair(Offset(cs, size.height), Offset(0f, size.height - cs)),
            Offset(size.width, size.height) to Pair(
                Offset(size.width - cs, size.height),
                Offset(size.width, size.height - cs)
            )
        ).forEach { (corner, lines) ->
            drawLine(gold, corner, lines.first, stroke)
            drawLine(gold, corner, lines.second, stroke)
        }

        // Маленький ромб в каждом углу
        val d = 3.dp.toPx()
        listOf(
            Offset(0f, 0f),
            Offset(size.width, 0f),
            Offset(0f, size.height),
            Offset(size.width, size.height)
        ).forEach { corner ->
            drawDiamond(corner, d, d, themedGold.copy(alpha = alpha + 0.15f))
        }
    }
}
