package com.s0dolamby.game.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.data.db.AppDatabase
import com.s0dolamby.game.data.sound.MusicEngine
import com.s0dolamby.game.data.sound.SoundEngine
import com.s0dolamby.game.data.sound.SoundName
import com.s0dolamby.game.domain.model.AppSettings
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val settings: AppSettings = AppSettings(),
    val isLoading: Boolean = true,
    val resetDone: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository,
    private val gameStateRepository: GameStateRepository,
    private val soundEngine: SoundEngine,
    private val musicEngine: MusicEngine,
    private val minigameUnlockStore: com.s0dolamby.game.data.minigame.MinigameUnlockStore,
    private val achievementUnlockStore: com.s0dolamby.game.data.achievements.AchievementUnlockStore,
    private val dayNewsStore: com.s0dolamby.game.data.news.DayNewsStore,
    private val db: AppDatabase
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            _uiState.value = SettingsUiState(settings = settings, isLoading = false)
        }
    }

    fun setTextModel(modelId: String) {
        val updated = _uiState.value.settings.copy(textModel = modelId)
        _uiState.value = _uiState.value.copy(settings = updated)
        viewModelScope.launch { settingsRepository.updateSettings(updated) }
    }

    fun setNickname(value: String) {
        val updated = _uiState.value.settings.copy(nickname = value.take(20))
        _uiState.value = _uiState.value.copy(settings = updated)
        viewModelScope.launch { settingsRepository.updateSettings(updated) }
    }

    fun setThemeMode(mode: com.s0dolamby.game.domain.model.ThemeMode) {
        val updated = _uiState.value.settings.copy(themeMode = mode)
        _uiState.value = _uiState.value.copy(settings = updated)
        viewModelScope.launch { settingsRepository.updateSettings(updated) }
    }

    fun setLanguage(lang: String) {
        val updated = _uiState.value.settings.copy(language = lang)
        _uiState.value = _uiState.value.copy(settings = updated)
        viewModelScope.launch { settingsRepository.updateSettings(updated) }
    }

    fun setSoundEnabled(enabled: Boolean) {
        val updated = _uiState.value.settings.copy(soundEnabled = enabled)
        _uiState.value = _uiState.value.copy(settings = updated)
        viewModelScope.launch { settingsRepository.updateSettings(updated) }
        // Мгновенный отклик + демонстрация звука при включении.
        soundEngine.muted = !enabled
        if (enabled) soundEngine.play(SoundName.TAP)
    }

    fun setMusicEnabled(enabled: Boolean) {
        val updated = _uiState.value.settings.copy(musicEnabled = enabled)
        _uiState.value = _uiState.value.copy(settings = updated)
        viewModelScope.launch { settingsRepository.updateSettings(updated) }
        // Room-флоу донесёт до MusicEngine через MainActivity, но включаем
        // сразу — чтобы тема заиграла без задержки на запись в БД.
        musicEngine.setEnabled(enabled)
    }

    // setImageGenerationEnabled удалён — обложки теперь из стока, переключать нечего.

    fun resetGame() {
        viewModelScope.launch {
            // clearAllTables НЕЛЬЗЯ звать на главном потоке — Room кидает
            // IllegalStateException и приложение падает (баг «сброс крашит»).
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                db.clearAllTables()
            }
            // In-memory синглтоны переживают чистку БД — сбрасываем явно,
            // иначе старые unlock'и/вести/поздравления доживают до ребута.
            minigameUnlockStore.clearAll()
            achievementUnlockStore.clearAll()
            dayNewsStore.clear()
            gameStateRepository.initializeGameState()
            _uiState.value = _uiState.value.copy(resetDone = true)
        }
    }

    fun resetDoneHandled() {
        _uiState.value = _uiState.value.copy(resetDone = false)
    }
}
