package com.s0dolamby.game.presentation.common.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color

// ─── Статичные цвета (не зависят от темы) ────────────────────────────────────

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

// ─── Темо-зависимые цвета — top-level @Composable getters ────────────────────
// Все старые ссылки `FairyGold`, `EnchantedPurple` и т.д. продолжают работать,
// но теперь читают активную палитру из LocalAppPalette.

val FairyGold: Color
    @Composable
    @ReadOnlyComposable
    get() = LocalAppPalette.current.fairyGold

val EnchantedPurple: Color
    @Composable
    @ReadOnlyComposable
    get() = LocalAppPalette.current.enchantedPurple

val NightBlue: Color
    @Composable
    @ReadOnlyComposable
    get() = LocalAppPalette.current.nightBlue

val Success: Color
    @Composable
    @ReadOnlyComposable
    get() = LocalAppPalette.current.success

val Error: Color
    @Composable
    @ReadOnlyComposable
    get() = LocalAppPalette.current.error

val Warning: Color
    @Composable
    @ReadOnlyComposable
    get() = LocalAppPalette.current.warning

val Accent: Color
    @Composable
    @ReadOnlyComposable
    get() = LocalAppPalette.current.accent
