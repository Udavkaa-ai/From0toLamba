package com.s0dolamby.game.presentation.minigame.common

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Круговой таймер: внешнее кольцо тает по часовой стрелке, число секунд в центре.
 * Цвет плавно сдвигается от primary к красному при приближении к концу.
 */
@Composable
fun MinigameTimerRing(
    secondsLeft: Int,
    totalSeconds: Int,
    primary: Color,
    accent: Color
) {
    val progress = (secondsLeft.toFloat() / totalSeconds.coerceAtLeast(1)).coerceIn(0f, 1f)
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 900),
        label = "timerProgress"
    )
    val alarm = progress <= 0.3f
    val ringColor by animateColorAsState(
        targetValue = if (alarm) Color(0xFFFF7043) else primary,
        animationSpec = tween(500),
        label = "ringColor"
    )

    Box(modifier = Modifier.size(72.dp), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(72.dp)) {
            val stroke = 6.dp.toPx()
            val pad = stroke / 2f
            val arcSize = Size(size.width - stroke, size.height - stroke)
            // Подложка
            drawArc(
                color = accent.copy(alpha = 0.25f),
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = Offset(pad, pad),
                size = arcSize,
                style = Stroke(width = stroke)
            )
            // Прогресс
            drawArc(
                color = ringColor,
                startAngle = -90f,
                sweepAngle = -360f * animatedProgress,
                useCenter = false,
                topLeft = Offset(pad, pad),
                size = arcSize,
                style = Stroke(width = stroke)
            )
        }
        Text(
            "$secondsLeft",
            color = if (alarm) Color(0xFFFFAB91) else Color.White,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold
        )
    }
}
