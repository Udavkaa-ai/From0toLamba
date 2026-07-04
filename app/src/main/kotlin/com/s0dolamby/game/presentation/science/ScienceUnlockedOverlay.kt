package com.s0dolamby.game.presentation.science

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
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
import com.s0dolamby.game.data.science.ScienceUnlockStore
import com.s0dolamby.game.presentation.common.components.CardCornerOrnaments
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.components.ProvideOnCardColors
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.LocalAppPalette
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class ScienceOverlayViewModel @Inject constructor(
    private val store: ScienceUnlockStore
) : ViewModel() {
    val queue = store.queue
    fun pop() = store.pop()
}

/**
 * Глобальный оверлей «свиток науки»: старец вручает карту приёма,
 * усвоенного на закрытом деле. Тап — убрать и показать следующую.
 */
@Composable
fun ScienceUnlockedOverlay(
    viewModel: ScienceOverlayViewModel = hiltViewModel()
) {
    val queue by viewModel.queue.collectAsState()
    val top = queue.firstOrNull() ?: return

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
            val palette = LocalAppPalette.current
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
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ProvideOnCardColors {
                        Text(
                            Strings.t("science.unlocked.banner"),
                            style = MaterialTheme.typography.labelMedium,
                            color = palette.accentOnCard.copy(alpha = 0.7f),
                            fontStyle = FontStyle.Italic,
                            letterSpacing = 1.5.sp,
                            textAlign = TextAlign.Center
                        )
                        OrnamentDivider()
                        Text(top.emoji, fontSize = 56.sp)
                        Text(
                            top.title,
                            color = palette.accentOnCard,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.ExtraBold,
                            textAlign = TextAlign.Center
                        )
                        ScienceCardBody(
                            tale = top.tale,
                            reality = top.reality,
                            advice = top.advice
                        )
                        OrnamentDivider()
                        Text(
                            Strings.t("science.unlocked.tapHint"),
                            color = palette.onCardMuted,
                            fontSize = 11.sp,
                            textAlign = TextAlign.Center
                        )
                    }
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

/** Тело карты: сказка → жизнь → наука. Общее для оверлея и коллекции. */
@Composable
fun ScienceCardBody(tale: String, reality: String, advice: String) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            Strings.t("science.section.tale"),
            style = MaterialTheme.typography.labelSmall,
            color = LocalContentColorMuted.current
        )
        Text(
            tale,
            style = MaterialTheme.typography.bodyMedium,
            fontStyle = FontStyle.Italic,
            color = LocalContentColor.current
        )
        Spacer(Modifier.height(2.dp))
        Text(
            Strings.t("science.section.reality"),
            style = MaterialTheme.typography.labelSmall,
            color = LocalContentColorMuted.current
        )
        Text(
            reality,
            style = MaterialTheme.typography.bodyMedium,
            color = LocalContentColor.current
        )
        Spacer(Modifier.height(2.dp))
        Text(
            Strings.t("science.section.advice"),
            style = MaterialTheme.typography.labelSmall,
            color = LocalContentColorMuted.current
        )
        Text(
            "«$advice»",
            style = MaterialTheme.typography.bodyMedium,
            fontStyle = FontStyle.Italic,
            fontWeight = FontWeight.Medium,
            color = com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard.current
        )
    }
}
