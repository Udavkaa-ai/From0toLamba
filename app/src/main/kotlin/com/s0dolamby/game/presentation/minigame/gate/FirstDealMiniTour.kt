package com.s0dolamby.game.presentation.minigame.gate

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue

private data class DealTourStep(val emoji: String, val title: String, val body: String)

/**
 * Мини-тур при открытии первого дела: объясняет цикл дела — испытание
 * дельца, беседа в кабаке, как ловить враньё и что можно сделать после
 * мини-игры. Показывается один раз (флаг firstDealTourShown), закрывается
 * через [onDone]; после этого начинается сам гейт с мини-игрой.
 */
@Composable
fun FirstDealMiniTour(onDone: () -> Unit) {
    val steps = listOf(
        DealTourStep("🎲", Strings.t("firstdeal.game.title"), Strings.t("firstdeal.game.body")),
        DealTourStep("💬", Strings.t("firstdeal.chat.title"), Strings.t("firstdeal.chat.body")),
        DealTourStep("🕵️", Strings.t("firstdeal.lies.title"), Strings.t("firstdeal.lies.body")),
        DealTourStep("⚖️", Strings.t("firstdeal.after.title"), Strings.t("firstdeal.after.body"))
    )
    var step by remember { mutableStateOf(0) }
    val current = steps[step]
    val isLast = step == steps.lastIndex

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xF00A0620))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {},
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .padding(horizontal = 24.dp)
                .widthIn(max = 360.dp)
                .verticalScroll(rememberScrollState())
                .clip(RoundedCornerShape(20.dp))
                .background(Brush.verticalGradient(listOf(EnchantedPurple, NightBlue)))
                .border(1.dp, FairyGold.copy(alpha = 0.45f), RoundedCornerShape(20.dp))
                .padding(22.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(Strings.t("firstdeal.header"), color = Color.White.copy(alpha = 0.55f), fontSize = 11.sp)
            Spacer(Modifier.height(8.dp))
            Text(current.emoji, fontSize = 34.sp)
            Spacer(Modifier.height(8.dp))
            Text(
                current.title,
                color = FairyGold,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(8.dp))
            Text(
                current.body,
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 14.sp,
                lineHeight = 19.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                steps.indices.forEach { i ->
                    Box(
                        modifier = Modifier
                            .size(if (i == step) 9.dp else 6.dp)
                            .clip(CircleShape)
                            .background(if (i == step) FairyGold else Color.White.copy(alpha = 0.25f))
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (step > 0) {
                    OutlinedButton(onClick = { step-- }, modifier = Modifier.weight(1f)) {
                        Text(Strings.t("tour.back"), color = Color.White.copy(alpha = 0.8f))
                    }
                }
                Button(
                    onClick = { if (isLast) onDone() else step++ },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = FairyGold, contentColor = NightBlue)
                ) {
                    Text(
                        if (isLast) Strings.t("firstdeal.done") else Strings.t("tour.next"),
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
            if (!isLast) {
                Spacer(Modifier.height(4.dp))
                Text(
                    Strings.t("tour.skip"),
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp,
                    modifier = Modifier.clickable { onDone() }.padding(6.dp)
                )
            }
        }
    }
}
