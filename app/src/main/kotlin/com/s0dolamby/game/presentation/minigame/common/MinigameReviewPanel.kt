package com.s0dolamby.game.presentation.minigame.common

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.FairyGold

/**
 * Сворачиваемый «Разбор игры» на экране результата мини-игры. По умолчанию
 * свёрнут: кому надо — раскрыл и посмотрел, где ошибся; кому нет — идёт
 * дальше. Содержимое (разметку доски с пометками ошибок) даёт сама игра.
 */
@Composable
fun MinigameReviewPanel(
    modifier: Modifier = Modifier,
    title: String = Strings.t("minigame.review.title"),
    content: @Composable () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0x33000000))
            .border(1.dp, FairyGold.copy(alpha = 0.3f), RoundedCornerShape(14.dp))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "🔍 $title",
                color = FairyGold,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(if (expanded) "▲" else "▼", color = FairyGold, fontSize = 13.sp)
        }
        AnimatedVisibility(visible = expanded) {
            Column(modifier = Modifier.padding(horizontal = 14.dp).padding(bottom = 14.dp)) {
                content()
            }
        }
    }
}
