package com.s0dolamby.game.presentation.common.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = TonBlue,
    onPrimary = Color.White,
    primaryContainer = TonBlueDark,
    secondary = Accent,
    onSecondary = Color.White,
    secondaryContainer = AccentLight,
    background = Background,
    surface = Surface,
    surfaceVariant = SurfaceVariant,
    onBackground = OnSurface,
    onSurface = OnSurface,
    onSurfaceVariant = OnSurfaceVariant,
    error = Error
)

@Composable
fun From0toLambaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content
    )
}
