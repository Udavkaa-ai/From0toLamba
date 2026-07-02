package com.s0dolamby.game.presentation.common.components

import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.TextFieldColors
import androidx.compose.runtime.Composable
import com.s0dolamby.game.presentation.common.theme.LocalAppPalette

/**
 * Цвета OutlinedTextField для полей НА КАРТОЧНОМ фоне (шиты, диалоги с
 * containerColor = palette.cardMid). Дефолтные цвета Material берутся из
 * тёмной схемы — на пергаменте тёплой темы вводимый текст был белым и
 * не читался.
 */
@Composable
fun fairyOnCardTextFieldColors(): TextFieldColors {
    val palette = LocalAppPalette.current
    return OutlinedTextFieldDefaults.colors(
        focusedTextColor = palette.onCard,
        unfocusedTextColor = palette.onCard,
        focusedBorderColor = palette.accentOnCard,
        unfocusedBorderColor = palette.accentOnCard.copy(alpha = 0.5f),
        cursorColor = palette.accentOnCard,
        focusedLabelColor = palette.accentOnCard,
        unfocusedLabelColor = palette.onCardMuted,
        focusedContainerColor = palette.onCard.copy(alpha = 0.04f),
        unfocusedContainerColor = palette.onCard.copy(alpha = 0.02f)
    )
}
