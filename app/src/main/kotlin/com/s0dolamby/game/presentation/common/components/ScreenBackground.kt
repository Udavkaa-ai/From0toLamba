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
import com.s0dolamby.game.presentation.common.theme.LocalAppPalette

@Composable
fun ScreenBackground(
    @DrawableRes imageRes: Int,
    content: @Composable () -> Unit
) {
    val palette = LocalAppPalette.current
    Box(modifier = Modifier.fillMaxSize()) {
        Image(
            painter = painterResource(imageRes),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )
        // Темо-зависимый градиентный оверлей.
        //   DARK: тёмная фиолетово-чернильная ночь (картинка глушится).
        //   WARM: лёгкий тёплый ореол + виньетка по краям. Тело градиента
        //         почти прозрачное — картинка bg должна просвечивать
        //         золотистым «полуднем на ярмарке», а не глушиться шоколадом.
        val gradient = Brush.verticalGradient(
            colorStops = arrayOf(
                0f to palette.screenBgTop,
                0.4f to palette.screenBgMid,
                1f to palette.screenBgBottom
            )
        )
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
