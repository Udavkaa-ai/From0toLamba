package com.s0dolamby.game.presentation.achievements

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.s0dolamby.game.data.achievements.AchievementUnlockStore
import com.s0dolamby.game.domain.achievements.Achievement
import com.s0dolamby.game.presentation.common.components.CardCornerOrnaments
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.i18n.localizedDescription
import com.s0dolamby.game.presentation.common.i18n.localizedTitle
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class AchievementOverlayViewModel @Inject constructor(
    private val store: AchievementUnlockStore
) : ViewModel() {
    val queue = store.queue
    fun pop() = store.pop()
}

/**
 * Глобальный overlay: если в [AchievementUnlockStore] появилась
 * новая запись — рисуем «Жалованную Грамоту». Тап в любом месте
 * убирает её и подтягивает следующую из очереди.
 */
@Composable
fun AchievementUnlockedOverlay(
    viewModel: AchievementOverlayViewModel = hiltViewModel()
) {
    val queue by viewModel.queue.collectAsState()
    val top = queue.firstOrNull() ?: return

    // Spring scale entrance — добавляет ощущение «бабах, награда!»
    val scale = remember(top.id) { Animatable(0.7f) }
    LaunchedEffect(top.id) {
        scale.animateTo(
            1f,
            spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMediumLow)
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.78f))
            .clickable { viewModel.pop() },
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .graphicsLayer { scaleX = scale.value; scaleY = scale.value }
                .padding(horizontal = 24.dp)
                .fillMaxWidth()
        ) {
            val palette = com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.verticalGradient(
                            listOf(palette.cardTop, palette.cardMid, palette.cardBottom)
                        )
                    )
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        Strings.t("ach.unlocked.banner"),
                        style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
                        color = FairyGold.copy(alpha = 0.7f),
                        fontStyle = FontStyle.Italic,
                        letterSpacing = 1.5.sp,
                        textAlign = TextAlign.Center
                    )
                    OrnamentDivider()
                    Text(top.emoji, fontSize = 64.sp)
                    Text(
                        top.localizedTitle(),
                        color = FairyGold,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        top.localizedDescription(),
                        color = palette.onCardSecondary,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        fontStyle = FontStyle.Italic
                    )
                    OrnamentDivider()
                    Text(
                        Strings.t("ach.unlocked.tapHint") + if (queue.size > 1) Strings.t("ach.unlocked.queueMore", queue.size - 1) else "",
                        color = palette.onCardMuted,
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
            CardCornerOrnaments(
                modifier = Modifier.matchParentSize(),
                cornerSize = 22.dp,
                alpha = 0.55f
            )
        }
    }
}

@Suppress("unused")
private fun Achievement.touch(): Achievement = this // keep import alive when no other usage
