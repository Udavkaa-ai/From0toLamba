package com.s0dolamby.game.presentation.common.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/**
 * «Живой» эмодзи: мягко покачивается и дышит — дешёвый способ добавить
 * сказочности пустым состояниям, чипам и кнопкам. Никаких ассетов.
 */
@Composable
fun WobblyEmoji(
    emoji: String,
    fontSize: TextUnit = 28.sp,
    /** Амплитуда покачивания в градусах. */
    amplitudeDeg: Float = 6f,
    /** Период полного качания в мс. */
    periodMs: Int = 1600,
    /** Цвет глифа — для текстовых символов вроде «✦»; эмодзи не красятся. */
    color: Color = Color.Unspecified,
    modifier: Modifier = Modifier
) {
    val infinite = rememberInfiniteTransition(label = "wobble")
    val phase by infinite.animateFloat(
        initialValue = -1f, targetValue = 1f,
        animationSpec = infiniteRepeatable(
            tween(periodMs, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "wobblePhase"
    )
    Text(
        emoji,
        color = color,
        fontSize = fontSize,
        modifier = modifier.graphicsLayer {
            rotationZ = phase * amplitudeDeg
            val s = 1f + 0.03f * phase
            scaleX = s
            scaleY = s
        }
    )
}
