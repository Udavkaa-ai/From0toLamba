package com.s0dolamby.game.presentation.common.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.usecase.InvestUseCase
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.Error as ErrorColor
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard
import com.s0dolamby.game.presentation.common.theme.LocalAppPalette
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import com.s0dolamby.game.presentation.common.theme.Success

/**
 * Общий шит «Вложить гроши» — используется и в беседе, и прямо из грамот
 * (после мини-игры чат не обязателен). Показывает строку «Уговор» —
 * бонус +1%/вопрос за беседу с дельцом, чтобы у чата была ценность.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvestSheet(
    freeBalance: Double,
    /** Процент уговора 0..10 — от числа заданных дельцу вопросов. */
    ugovorPercent: Int = 0,
    /** Своя бонус-строка (например реакция «Сечением») — заменяет уговор. */
    bonusText: String? = null,
    /** Сколько ещё можно вложить в это дело (потолок по чину минус уже вложенное,
     *  ограничено кошелём). null — не показывать лимит (валидация всё равно в use-case). */
    maxInvestment: Double? = null,
    onDismiss: () -> Unit,
    onInvest: (Double) -> Unit
) {
    var amountText by remember { mutableStateOf("") }
    val amount = amountText.toDoubleOrNull()
    val overCap = amount != null && maxInvestment != null && amount > maxInvestment
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val palette = LocalAppPalette.current
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = palette.cardMid,
        contentColor = palette.onCard
    ) {
        ProvideOnCardColors {
        Column(
            modifier = Modifier.padding(horizontal = 24.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    Strings.t("ama.invest.title"),
                    style = MaterialTheme.typography.titleLarge,
                    color = LocalContentColor.current
                )
                Surface(
                    color = LocalAccentOnCard.current.copy(alpha = 0.15f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        Strings.t("ama.invest.free", "%.0f г".format(freeBalance)),
                        style = MaterialTheme.typography.labelMedium,
                        color = LocalAccentOnCard.current,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }
            OutlinedTextField(
                value = amountText,
                onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                label = { Text(Strings.t("ama.invest.amount")) },
                suffix = { Text("г", color = LocalContentColor.current) },
                isError = overCap,
                modifier = Modifier.fillMaxWidth(),
                colors = fairyOnCardTextFieldColors()
            )
            // Потолок вложения в дело по чину: остаток + быстрые тиеры
            if (maxInvestment != null) {
                Text(
                    if (maxInvestment <= 0.0) Strings.t("invest.cap.reached")
                    else Strings.t("invest.cap.left", "%.0f г".format(maxInvestment)),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (overCap) ErrorColor else LocalContentColorMuted.current,
                    fontWeight = if (overCap) FontWeight.SemiBold else FontWeight.Normal
                )
                val tiers = com.s0dolamby.game.domain.ranks.RankService.INVESTMENT_TIERS
                    .filter { it <= maxInvestment }
                if (tiers.isNotEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        tiers.forEach { tier ->
                            Surface(
                                onClick = { amountText = tier.toInt().toString() },
                                color = LocalAccentOnCard.current.copy(alpha = 0.12f),
                                shape = MaterialTheme.shapes.small
                            ) {
                                Text(
                                    "%.0f".format(tier),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = LocalAccentOnCard.current,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }
                }
            }
            // Бонус-строка: своя (реакция «Сечением») либо «уговор» за беседу
            when {
                bonusText != null -> Text(
                    bonusText,
                    style = MaterialTheme.typography.bodySmall,
                    color = Success,
                    fontWeight = FontWeight.SemiBold
                )
                ugovorPercent > 0 -> Text(
                    Strings.t("invest.ugovor.active", ugovorPercent),
                    style = MaterialTheme.typography.bodySmall,
                    color = Success,
                    fontWeight = FontWeight.SemiBold
                )
                else -> Text(
                    Strings.t("invest.ugovor.hint"),
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalContentColorMuted.current
                )
            }
            Text(
                Strings.t("ama.invest.minimum"),
                style = MaterialTheme.typography.labelSmall,
                color = LocalContentColorMuted.current
            )
            Button(
                onClick = { amount?.let { onInvest(it) } },
                enabled = amount != null && amount >= 5.0 && !overCap,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = FairyGold,
                    contentColor = Color(0xFF1A0A00),
                    disabledContainerColor = FairyGold.copy(alpha = 0.35f),
                    disabledContentColor = Color(0xFF1A0A00).copy(alpha = 0.6f)
                )
            ) {
                Text(Strings.t("ama.invest.confirm"), fontWeight = FontWeight.SemiBold)
            }
        }
        } // ProvideOnCardColors
    }
}

/**
 * Оффер дополнительного торгового слота (все 5 дел заняты) — общий для
 * беседы и грамот. Порт TG ExtraSlotModal, вариант со Stars вырезан.
 */
@Composable
fun ExtraSlotDialog(
    pendingAmount: Double,
    freeBalance: Double,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    val slotCost = InvestUseCase.EXTRA_SLOT_COST_RUBLES
    val canAfford = freeBalance >= pendingAmount + slotCost
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Text("🗃️", fontSize = 40.sp) },
        title = {
            Text(
                Strings.t("extraSlot.title"),
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(Strings.t("extraSlot.body"))
                if (!canAfford) {
                    Text(Strings.t("extraSlot.noBalance"), color = ErrorColor)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                enabled = canAfford,
                colors = ButtonDefaults.buttonColors(
                    containerColor = FairyGold,
                    contentColor = Color(0xFF1A0A00)
                )
            ) { Text(Strings.t("extraSlot.buy"), fontWeight = FontWeight.SemiBold) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(Strings.t("btn.cancel")) }
        }
    )
}
