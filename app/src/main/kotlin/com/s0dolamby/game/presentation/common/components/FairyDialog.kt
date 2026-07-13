package com.s0dolamby.game.presentation.common.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard
import com.s0dolamby.game.presentation.common.theme.LocalAppPalette

/**
 * Сказочная плашка-диалог под тему (пергамент/ночь): крупный эмодзи-иконка,
 * золотой заголовок, тело и две кнопки — золотая первичная + обводная
 * вторичная. Единый стиль для всех подтверждений («Ещё есть грамоты»,
 * «Беседа за рекламу» и т.п.).
 */
@Composable
fun FairyPromptDialog(
    emoji: String,
    title: String,
    body: String,
    primaryText: String,
    onPrimary: () -> Unit,
    secondaryText: String,
    onSecondary: () -> Unit,
    onDismissRequest: () -> Unit = onSecondary,
    primaryEnabled: Boolean = true
) {
    val palette = LocalAppPalette.current
    Dialog(onDismissRequest = onDismissRequest) {
        ProvideOnCardColors {
            Column(
                modifier = Modifier
                    .clip(RoundedCornerShape(22.dp))
                    .background(Brush.verticalGradient(listOf(palette.cardTop, palette.cardBottom)))
                    .border(1.5.dp, palette.cardBorderBright.copy(alpha = 0.8f), RoundedCornerShape(22.dp))
                    .padding(horizontal = 24.dp, vertical = 22.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(emoji, fontSize = 40.sp)
                Spacer(Modifier.height(10.dp))
                Text(
                    title,
                    color = LocalContentColor.current,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    body,
                    color = LocalContentColor.current.copy(alpha = 0.75f),
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(18.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Первичная — золотая (тускнеет и не кликается, если выключена)
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (primaryEnabled) FairyGold else FairyGold.copy(alpha = 0.35f))
                            .then(if (primaryEnabled) Modifier.clickable { onPrimary() } else Modifier)
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            primaryText,
                            color = Color(0xFF1A0A00).copy(alpha = if (primaryEnabled) 1f else 0.5f),
                            fontWeight = FontWeight.Bold, fontSize = 14.sp
                        )
                    }
                    // Вторичная — обводка
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(14.dp))
                            .border(1.5.dp, FairyGold.copy(alpha = 0.7f), RoundedCornerShape(14.dp))
                            .clickable { onSecondary() }
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(secondaryText, color = LocalAccentOnCard.current, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    }
                }
            }
        }
    }
}
