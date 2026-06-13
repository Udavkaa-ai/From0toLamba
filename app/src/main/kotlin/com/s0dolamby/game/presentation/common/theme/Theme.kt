package com.s0dolamby.game.presentation.common.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import com.s0dolamby.game.domain.model.ThemeMode

private fun colorSchemeFor(palette: AppPalette) = darkColorScheme(
    primary = palette.fairyGold,
    onPrimary = Color(0xFF1A0A00),
    primaryContainer = palette.enchantedPurple,
    secondary = palette.accent,
    onSecondary = Color.White,
    secondaryContainer = AccentLight,
    background = palette.nightBlue,
    surface = palette.enchantedPurple,
    surfaceVariant = SurfaceVariant,
    onBackground = OnSurface,
    onSurface = OnSurface,
    onSurfaceVariant = OnSurfaceVariant,
    error = palette.error
)

@Composable
fun From0toLambaTheme(
    themeMode: ThemeMode = ThemeMode.DARK_FAIRY,
    content: @Composable () -> Unit
) {
    val palette = when (themeMode) {
        ThemeMode.DARK_FAIRY -> DarkFairyPalette
        ThemeMode.WARM_FAIRY -> WarmFairyPalette
    }
    CompositionLocalProvider(
        LocalAppPalette provides palette,
        LocalThemeMode provides themeMode
    ) {
        MaterialTheme(
            colorScheme = colorSchemeFor(palette),
            typography = Typography,
            content = content
        )
    }
}
