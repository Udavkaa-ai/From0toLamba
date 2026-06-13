package com.s0dolamby.game.presentation.common.theme

import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * Палитра, через которую все экраны получают свои цвета. Меняем через
 * [LocalAppPalette] провайдер в [From0toLambaTheme], и все @Composable-
 * геттеры [FairyGold] / [EnchantedPurple] / [NightBlue] начнут отдавать
 * новые значения без ручной правки call-сайтов.
 *
 * Текущие две темы — оба «тёмные», просто в разных гаммах:
 *  - DARK_FAIRY: фиолетово-сапфировая, как было.
 *  - WARM_FAIRY: карамельно-сепиевая «ярмарка вечером».
 * Контрастность `Color.White`-текста сохраняется в обеих — поэтому
 * 200+ хитов хардкода Color.White не приходится переписывать.
 */
data class AppPalette(
    val fairyGold: Color,
    val enchantedPurple: Color,
    val nightBlue: Color,
    val success: Color,
    val error: Color,
    val warning: Color,
    val accent: Color,
    val ranks: RankPalette
)

data class RankPalette(
    val bronze: Color,
    val silver: Color,
    val gold: Color,
    val platinum: Color
)

private val SharedRankPalette = RankPalette(
    bronze = Color(0xFFCD7F32),
    silver = Color(0xFFC8D0DA),
    gold = Color(0xFFFFB800),
    platinum = Color(0xFFE5E4E2)
)

val DarkFairyPalette = AppPalette(
    fairyGold = Color(0xFFFFB800),
    enchantedPurple = Color(0xFF2A1960),
    nightBlue = Color(0xFF0D1735),
    success = Color(0xFF4CAF50),
    error = Color(0xFFFF5252),
    warning = Color(0xFFFFC107),
    accent = Color(0xFF7B5EA7),
    ranks = SharedRankPalette
)

val WarmFairyPalette = AppPalette(
    fairyGold = Color(0xFFFFD66B),                  // светлее, чтобы выделяться на коричневом фоне
    enchantedPurple = Color(0xFF6E4322),            // тёплое дерево вместо фиолета
    nightBlue = Color(0xFF2B1A0C),                  // глубокий шоколад вместо ночной синевы
    success = Color(0xFF50C878),
    error = Color(0xFFE34234),
    warning = Color(0xFFFFA72E),
    accent = Color(0xFFD4A017),
    ranks = SharedRankPalette
)

val LocalAppPalette = compositionLocalOf { DarkFairyPalette }
