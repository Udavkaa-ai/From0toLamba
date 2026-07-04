package com.s0dolamby.game.presentation.common.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import com.s0dolamby.game.domain.model.PlayerVerdict
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import com.s0dolamby.game.presentation.common.theme.Success

/**
 * «Верю — не верю»: ставка на судьбу дела. Три состояния:
 *  - ставка сделана → запертая плашка с выбором;
 *  - можно ставить → две кнопки;
 *  - рано (нет информации) → подсказка, как разбудить чуйку.
 */
@Composable
fun VerdictCard(
    verdict: PlayerVerdict?,
    canBet: Boolean,
    onBet: (PlayerVerdict) -> Unit,
    modifier: Modifier = Modifier
) {
    FairyCard(modifier = modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            WobblyEmoji("🔮", fontSize = 20.sp, amplitudeDeg = 5f, periodMs = 2200)
            Text(
                Strings.t("verdict.title"),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = LocalAccentOnCard.current
            )
        }
        Spacer(Modifier.height(6.dp))

        when {
            verdict != null -> {
                val (emoji, labelKey, color) =
                    if (verdict == PlayerVerdict.HONEST) Triple("🤝", "verdict.locked.honest", Success)
                    else Triple("🕵️", "verdict.locked.scam", Error)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(emoji, fontSize = 18.sp)
                    Text(
                        Strings.t(labelKey),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = color
                    )
                }
                Spacer(Modifier.height(2.dp))
                Text(
                    Strings.t("verdict.locked.hint"),
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalContentColorMuted.current
                )
            }

            canBet -> {
                Text(
                    Strings.t("verdict.hint"),
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalContentColorMuted.current
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    VerdictButton(
                        text = Strings.t("verdict.btn.honest"),
                        color = Success,
                        modifier = Modifier.weight(1f)
                    ) { onBet(PlayerVerdict.HONEST) }
                    VerdictButton(
                        text = Strings.t("verdict.btn.scam"),
                        color = Error,
                        modifier = Modifier.weight(1f)
                    ) { onBet(PlayerVerdict.SCAM) }
                }
            }

            else -> Text(
                Strings.t("verdict.hint.locked"),
                style = MaterialTheme.typography.labelSmall,
                color = LocalContentColorMuted.current
            )
        }
    }
}

@Composable
private fun VerdictButton(
    text: String,
    color: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .background(color.copy(alpha = 0.14f), RoundedCornerShape(10.dp))
            .border(1.dp, color.copy(alpha = 0.55f), RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(vertical = 10.dp, horizontal = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text,
            color = color,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center
        )
    }
}
