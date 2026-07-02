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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import com.s0dolamby.game.domain.model.ThemeMode
import com.s0dolamby.game.presentation.common.theme.LocalAppPalette
import com.s0dolamby.game.presentation.common.theme.LocalThemeMode

/**
 * Фоны экранов — те же webp, что в TG (tools/banners/output_backgrounds):
 * у каждого экрана СВОЯ пара картинок — ночная и дневная (_LIGHT), выбирается
 * по активной теме. Поверх — темозависимый градиент из палитры и искры.
 */
enum class AppBg(private val base: String) {
    HOME("HOME_01"),
    INBOX("BG_INBOX"),
    PORTFOLIO("BG_PORTFOLIO"),
    STATS("BG_STATS"),
    LEADERBOARD("BG_LEADERBOARD"),
    REGISTRY("BG_REGISTRY"),
    TAVERN("HOME_03"),      // «Сегодня» — кабак/ярмарка
    NEWS("HOME_05"),        // «Вести с ярмарки»
    SETTINGS("HOME_07");

    fun assetPath(mode: ThemeMode): String {
        val suffix = if (mode == ThemeMode.WARM_FAIRY) "_LIGHT" else ""
        return "file:///android_asset/backgrounds/$base$suffix.webp"
    }
}

@Composable
fun ScreenBackground(
    bg: AppBg,
    content: @Composable () -> Unit
) {
    val mode = LocalThemeMode.current
    Box(modifier = Modifier.fillMaxSize()) {
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(bg.assetPath(mode))
                .memoryCachePolicy(CachePolicy.ENABLED)
                .crossfade(false)
                .build(),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )
        BackgroundDressing()
        content()
    }
}

/**
 * Legacy-вариант с drawable — для экранов со СПЕЦИАЛЬНЫМ фоном, у которого
 * нет темной/светлой пары (онбординг, беседа с архетипным портретом).
 */
@Composable
fun ScreenBackground(
    @DrawableRes imageRes: Int,
    content: @Composable () -> Unit
) {
    Box(modifier = Modifier.fillMaxSize()) {
        Image(
            painter = painterResource(imageRes),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )
        BackgroundDressing()
        content()
    }
}

/**
 * Общий «наряд» фона: темозависимый градиентный оверлей + искры.
 *   DARK: тёмная фиолетово-чернильная ночь (картинка глушится).
 *   WARM: лёгкий тёплый ореол + виньетка по краям — картинка просвечивает
 *         золотистым «полуднем на ярмарке», а не глушится шоколадом.
 */
@Composable
private fun BackgroundDressing() {
    val palette = LocalAppPalette.current
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
}
