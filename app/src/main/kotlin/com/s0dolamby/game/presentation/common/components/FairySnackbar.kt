package com.s0dolamby.game.presentation.common.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue

/**
 * Снэкбар в сказочном стиле вместо стандартного Material — тёмный свиток
 * с золотой рамкой и крупным текстом. Тестировщики жаловались, что
 * дефолтные уведомления («не более 5 дел», «недостаточно грошей»)
 * мелкие и выбиваются из антуража.
 *
 * Тёмный градиент читается на обеих темах — снэкбар плавает поверх фона.
 */
@Composable
fun FairySnackbarHost(state: SnackbarHostState, modifier: Modifier = Modifier) {
    SnackbarHost(hostState = state, modifier = modifier) { data ->
        Row(
            modifier = Modifier
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(16.dp))
                .clip(RoundedCornerShape(16.dp))
                .background(Brush.verticalGradient(listOf(EnchantedPurple, NightBlue)))
                .border(1.5.dp, FairyGold.copy(alpha = 0.55f), RoundedCornerShape(16.dp))
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text("📜", fontSize = 20.sp)
            Text(
                data.visuals.message,
                color = Color.White,
                fontSize = 15.sp,
                lineHeight = 21.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}
