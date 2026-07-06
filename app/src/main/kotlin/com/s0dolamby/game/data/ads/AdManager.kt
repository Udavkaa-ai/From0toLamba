package com.s0dolamby.game.data.ads

import android.app.Activity
import android.content.Context
import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.logging.AppLogger
import com.yandex.mobile.ads.common.AdError
import com.yandex.mobile.ads.common.AdRequestConfiguration
import com.yandex.mobile.ads.common.AdRequestError
import com.yandex.mobile.ads.common.ImpressionData
import com.yandex.mobile.ads.common.MobileAds
import com.yandex.mobile.ads.rewarded.Reward
import com.yandex.mobile.ads.rewarded.RewardedAd
import com.yandex.mobile.ads.rewarded.RewardedAdEventListener
import com.yandex.mobile.ads.rewarded.RewardedAdLoadListener
import com.yandex.mobile.ads.rewarded.RewardedAdLoader
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Единственное место, где мы трогаем Yandex Mobile Ads SDK (РСЯ/YAN).
 * Всё изолировано здесь, чтобы реклама была необязательной: при
 * [BuildConfig.ADS_ENABLED] == false SDK не инициализируется, рекламы нет,
 * а вызовы просто «пропускают» игрока дальше — офлайн и без рекламы игра
 * работает как раньше.
 *
 * Сейчас используется только вознаграждаемая (rewarded) реклама: игрок сам
 * решает посмотреть ролик за выгоду (вход в беседу без мини-игры и т.п.).
 */
@Singleton
class AdManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    val enabled: Boolean get() = BuildConfig.ADS_ENABLED

    private var initialized = false
    private var loader: RewardedAdLoader? = null
    private var rewardedAd: RewardedAd? = null
    private var loading = false

    /** Зовём из Application.onCreate. При выключенной рекламе — no-op. */
    fun init() {
        if (!enabled || initialized) return
        initialized = true
        runCatching {
            MobileAds.initialize(context) { AppLogger.i(TAG, "Yandex Ads SDK готов") }
            loader = RewardedAdLoader(context).apply {
                setAdLoadListener(object : RewardedAdLoadListener {
                    override fun onAdLoaded(rewarded: RewardedAd) {
                        rewardedAd = rewarded
                        loading = false
                    }

                    override fun onAdFailedToLoad(error: AdRequestError) {
                        rewardedAd = null
                        loading = false
                        AppLogger.i(TAG, "rewarded не загрузился: ${error.description}")
                    }
                })
            }
            preload()
        }.onFailure { AppLogger.e(TAG, "init рекламы упал", it) }
    }

    private fun preload() {
        if (!enabled || loading || rewardedAd != null) return
        loading = true
        runCatching {
            loader?.loadAd(
                AdRequestConfiguration.Builder(BuildConfig.YANDEX_REWARDED_UNIT_ID).build()
            )
        }.onFailure {
            loading = false
            AppLogger.e(TAG, "loadAd упал", it)
        }
    }

    /**
     * Показать вознаграждаемую рекламу.
     * @param onReward награда начислена (игрок досмотрел) — выдаём бонус.
     * @param onUnavailable реклама выключена/не готова/ошибка показа — НЕ
     *   наказываем игрока: обычно сюда передают тот же «пропустить дальше».
     */
    fun showRewarded(activity: Activity, onReward: () -> Unit, onUnavailable: () -> Unit) {
        val ad = rewardedAd
        if (!enabled || ad == null) {
            onUnavailable()
            preload()
            return
        }
        rewardedAd = null
        var granted = false
        ad.setAdEventListener(object : RewardedAdEventListener {
            override fun onAdShown() {}

            override fun onAdFailedToShow(adError: AdError) {
                AppLogger.i(TAG, "show упал: ${adError.description}")
                onUnavailable()
                preload()
            }

            override fun onAdDismissed() {
                if (granted) onReward()
                preload()
            }

            override fun onAdClicked() {}

            override fun onAdImpression(impressionData: ImpressionData?) {}

            override fun onRewarded(reward: Reward) {
                granted = true
            }
        })
        runCatching { ad.show(activity) }.onFailure {
            AppLogger.e(TAG, "ad.show упал", it)
            onUnavailable()
            preload()
        }
    }

    private companion object {
        const val TAG = "Ads"
    }
}
