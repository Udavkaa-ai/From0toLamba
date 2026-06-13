package com.s0dolamby.game.presentation.common.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import kotlinx.coroutines.delay

/**
 * Глобальная плашка-приветствие при смене дня. Не блокирует клики
 * (висит над контентом, fade-in/out 1.6 сек), показывается только
 * если `currentDay` стал больше предыдущего значения.
 */
@Composable
fun DayBreakOverlay(currentDay: Int) {
    var previousDay by remember { mutableIntStateOf(-1) }
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(currentDay) {
        if (previousDay in 0 until currentDay) {
            visible = true
            delay(1600)
            visible = false
        }
        previousDay = currentDay
    }
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        AnimatedVisibility(
            visible = visible,
            enter = fadeIn(tween(280)) + scaleIn(tween(320), initialScale = 0.7f),
            exit = fadeOut(tween(220)) + scaleOut(tween(280), targetScale = 0.85f)
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.verticalGradient(listOf(EnchantedPurple, NightBlue))
                    )
                    .border(1.dp, FairyGold.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
                    .padding(horizontal = 28.dp, vertical = 18.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "🌅",
                        fontSize = 42.sp
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Утро дня $currentDay",
                        color = FairyGold,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        "Глашатай разносит вести с ярмарки",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 12.sp,
                        fontStyle = FontStyle.Italic
                    )
                }
            }
        }
    }
}
