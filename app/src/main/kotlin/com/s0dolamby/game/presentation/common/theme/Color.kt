package com.s0dolamby.game.presentation.common.theme

import androidx.compose.ui.graphics.Color

// ─── Статичные цвета ────────────────────────────────────────────────────────

val Background = Color(0xFF0D0D0F)
val Surface = Color(0xFF1A1A1F)
val SurfaceVariant = Color(0xFF252530)
val OnSurface = Color(0xFFE8E8F0)
val OnSurfaceVariant = Color(0xFF9898A8)

val TonBlue = Color(0xFF0088CC)
val TonBlueDark = Color(0xFF006699)
val AccentLight = Color(0xFFB488E8)

val RedFlag = Color(0xFFFF3D3D)

val ScamRed = Color(0xFFCC2222)
val SurvivorGreen = Color(0xFF22AA55)
val UnicornPurple = Color(0xFF9933FF)

// ─── Палитра «Тёмная ночь» (FairyGold/EnchantedPurple/NightBlue + штатные) ─
// Эти константы используются во всех Canvas/LaunchedEffect/DrawScope-лямбдах,
// поэтому остаются обычными top-level val. Переключение тем работает через
// MaterialTheme.colorScheme (Material-виджеты) и через LocalAppPalette
// (явно читаемая палитра в screens, которые мигрируем порционно).

val FairyGold = Color(0xFFFFB800)
val EnchantedPurple = Color(0xFF2A1960)
val NightBlue = Color(0xFF0D1735)

val Success = Color(0xFF4CAF50)
val Warning = Color(0xFFFFC107)
val Error = Color(0xFFFF5252)

val Accent = Color(0xFF7B5EA7)
