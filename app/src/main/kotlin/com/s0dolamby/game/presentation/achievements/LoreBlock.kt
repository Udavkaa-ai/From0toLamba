package com.s0dolamby.game.presentation.achievements

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.achievements.RevealTopic
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.i18n.loreFor
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import com.s0dolamby.game.presentation.common.theme.LocalContentColorSecondary

/**
 * «Запись в летописи» — справка о породе дела, личине хозяина или судьбе,
 * которую раскрывает справочный подвиг. Рисуется в оверлее «Подвиг свершён»
 * и в карточке подвига на экране «Успехи».
 */
@Composable
fun LoreBlock(topic: RevealTopic, modifier: Modifier = Modifier) {
    val lore = loreFor(topic) ?: return
    val accent = LocalAccentOnCard.current
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(FairyGold.copy(alpha = 0.10f))
            .border(1.dp, FairyGold.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            Strings.t("lore.section.title"),
            style = MaterialTheme.typography.labelSmall,
            color = accent,
            letterSpacing = 1.sp,
            fontWeight = FontWeight.SemiBold
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(lore.emoji, fontSize = 22.sp)
            Column {
                Text(
                    lore.name,
                    style = MaterialTheme.typography.titleSmall,
                    color = accent,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    lore.title,
                    style = MaterialTheme.typography.labelMedium,
                    color = LocalContentColorSecondary.current,
                    fontStyle = FontStyle.Italic
                )
            }
        }
        Text(
            lore.description,
            style = MaterialTheme.typography.bodySmall,
            color = LocalContentColorSecondary.current,
            lineHeight = 18.sp
        )
        if (lore.hints.isNotEmpty()) {
            Text(
                Strings.t("lore.hints.title"),
                style = MaterialTheme.typography.labelSmall,
                color = LocalContentColorMuted.current,
                fontWeight = FontWeight.SemiBold
            )
            lore.hints.forEach { hint ->
                Text(
                    "• $hint",
                    style = MaterialTheme.typography.labelMedium,
                    color = LocalContentColorSecondary.current
                )
            }
        }
    }
}
