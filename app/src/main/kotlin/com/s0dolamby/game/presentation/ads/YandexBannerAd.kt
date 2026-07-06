package com.s0dolamby.game.presentation.ads

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.viewinterop.AndroidView
import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.logging.AppLogger
import com.yandex.mobile.ads.banner.BannerAdEventListener
import com.yandex.mobile.ads.banner.BannerAdSize
import com.yandex.mobile.ads.banner.BannerAdView
import com.yandex.mobile.ads.common.AdRequest
import com.yandex.mobile.ads.common.AdRequestError
import com.yandex.mobile.ads.common.ImpressionData

/**
 * Баннер Yandex Mobile Ads (РСЯ) как Compose-элемент. При выключенной
 * рекламе ([BuildConfig.ADS_ENABLED] == false) ничего не рисует — просто
 * исчезает, не занимая места. Ширина адаптивная (sticky) по ширине контента.
 *
 * API сверен по classes.jar 8.2.0: BannerAdView.setAdSize(BannerAdSize.sticky),
 * loadAd(AdRequest.Builder(unitId)); id блока едет через AdRequest, как у
 * rewarded (setAdUnitId в 8.x нет). Уничтожается в onRelease.
 */
@Composable
fun YandexBannerAd(modifier: Modifier = Modifier) {
    if (!BuildConfig.ADS_ENABLED) return
    // Ширина баннера в dp: ширина контента списка (экран минус боковые
    // отступы 16+16). sticky сам подберёт высоту под эту ширину.
    val widthDp = (LocalConfiguration.current.screenWidthDp - 32).coerceAtLeast(120)
    AndroidView(
        modifier = modifier.fillMaxWidth(),
        factory = { ctx ->
            BannerAdView(ctx).apply {
                setAdSize(BannerAdSize.sticky(ctx, widthDp))
                setBannerAdEventListener(object : BannerAdEventListener {
                    override fun onAdLoaded() {}
                    override fun onAdFailedToLoad(error: AdRequestError) {
                        AppLogger.i("Ads", "banner не загрузился: ${error.description}")
                    }
                    override fun onAdClicked() {}
                    override fun onImpression(impressionData: ImpressionData?) {}
                })
                loadAd(AdRequest.Builder(BuildConfig.YANDEX_BANNER_UNIT_ID).build())
            }
        },
        onRelease = { it.destroy() }
    )
}
