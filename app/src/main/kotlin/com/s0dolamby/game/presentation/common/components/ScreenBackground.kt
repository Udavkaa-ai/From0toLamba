package com.s0dolamby.game.presentation.common.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.s0dolamby.game.domain.model.ThemeMode
import com.s0dolamby.game.presentation.common.theme.LocalThemeMode

@Composable
fun ScreenBackground(
    @DrawableRes imageRes: Int,
    content: @Composable () -> Unit
) {
    val themeMode = LocalThemeMode.current
    Box(modifier = Modifier.fillMaxSize()) {
        Image(
            painter = painterResource(imageRes),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )
        // Темо-зависимый градиентный оверлей.
        // DARK_FAIRY: фиолетово-чернильный, как ночь.
        // WARM_FAIRY: тёплый янтарно-карамельный — фон будто облит
        // ярмарочным мёдом, картинка просвечивает желтоватым тоном.
        val gradient = when (themeMode) {
            ThemeMode.DARK_FAIRY -> Brush.verticalGradient(
                colorStops = arrayOf(
                    0f to Color(0xD9060412),
                    0.4f to Color(0xBF0A0818),
                    1f to Color(0xF0060412)
                )
            )
            ThemeMode.WARM_FAIRY -> Brush.verticalGradient(
                colorStops = arrayOf(
                    0f to Color(0xCC2B1A0C),     // верх — тёплое какао
                    0.4f to Color(0xB36E4322),   // мидл — янтарь
                    1f to Color(0xE52B1A0C)      // низ — снова какао
                )
            )
        }
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(gradient)
        )
        // Мерцающие искры — та же анимация, что на главном экране
        SparklesOverlay(
            modifier = Modifier
                .fillMaxWidth()
                .height(320.dp)
        )
        content()
    }
}
