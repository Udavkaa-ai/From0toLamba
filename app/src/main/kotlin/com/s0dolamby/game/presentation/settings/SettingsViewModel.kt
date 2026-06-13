package com.s0dolamby.game.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.data.db.AppDatabase
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

    // setImageGenerationEnabled удалён — обложки теперь из стока, переключать нечего.

    fun resetGame() {
        viewModelScope.launch {
            db.clearAllTables()
            gameStateRepository.initializeGameState()
            _uiState.value = _uiState.value.copy(resetDone = true)
        }
    }

    fun resetDoneHandled() {
        _uiState.value = _uiState.value.copy(resetDone = false)
    }
}
