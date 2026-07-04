package com.s0dolamby.game

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.lifecycleScope
import androidx.compose.runtime.CompositionLocalProvider
import com.s0dolamby.game.domain.model.ThemeMode
import com.s0dolamby.game.domain.repository.SettingsRepository
import com.s0dolamby.game.presentation.common.i18n.LocalLanguage
import com.s0dolamby.game.presentation.common.sound.LocalSoundEngine
import com.s0dolamby.game.presentation.common.theme.From0toLambaTheme
import com.s0dolamby.game.presentation.navigation.NavGraph
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var settingsRepository: SettingsRepository
    @Inject lateinit var soundEngine: com.s0dolamby.game.data.sound.SoundEngine
    @Inject lateinit var musicEngine: com.s0dolamby.game.data.sound.MusicEngine

    /** Запрос POST_NOTIFICATIONS (Android 13+). Отказ — не страшно, напоминания просто молчат. */
    private val notifPermissionLauncher =
        registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (android.os.Build.VERSION.SDK_INT >= 33 &&
            androidx.core.content.ContextCompat.checkSelfPermission(
                this, android.Manifest.permission.POST_NOTIFICATIONS
            ) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            notifPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }
        val settingsFlow = settingsRepository.observeSettings()
            .stateIn(lifecycleScope, SharingStarted.Eagerly, com.s0dolamby.game.domain.model.AppSettings())
        // Sound/Music — singleton'ы вне Compose; синхронизируем с настройками.
        lifecycleScope.launch {
            settingsFlow.collect {
                soundEngine.muted = !it.soundEnabled
                musicEngine.setEnabled(it.musicEnabled)
            }
        }
        setContent {
            val settings by settingsFlow.collectAsState()
            From0toLambaTheme(themeMode = settings.themeMode) {
                CompositionLocalProvider(
                    LocalLanguage provides settings.language,
                    LocalSoundEngine provides soundEngine
                ) {
                    NavGraph()
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        musicEngine.onForeground()
    }

    override fun onStop() {
        super.onStop()
        // Сворачивание/блокировка экрана — глушим фоновую тему (как в TG
        // при visibilitychange).
        musicEngine.onBackground()
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isFinishing) musicEngine.release()
    }
}
