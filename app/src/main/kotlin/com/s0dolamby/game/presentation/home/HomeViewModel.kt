package com.s0dolamby.game.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.model.GameState
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.domain.repository.SettingsRepository
import com.s0dolamby.game.domain.usecase.AdvanceDayUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val projectRepository: ProjectRepository,
    private val advanceDayUseCase: AdvanceDayUseCase,
    private val soundEngine: com.s0dolamby.game.data.sound.SoundEngine,
    settingsRepository: SettingsRepository
) : ViewModel() {

    val gameState: StateFlow<GameState?> = gameStateRepository.observeGameState()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    /** Прозвище игрока — для шапки главной (по умолчанию «Гость»). */
    val nickname: StateFlow<String> = settingsRepository.observeSettings()
        .map { it.nickname }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "")

    /** Кумулятивное «Дел взято» — активные + закрытые с инвестицией. */
    val dealsTakenCount: StateFlow<Int> = combine(
        projectRepository.getActiveProjects(),
        projectRepository.getClosedProjects()
    ) { active, closed ->
        active.size + closed.count { it.investedAmountRubles > 0 || it.closureReason != "Предложение не принято" }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _pendingUpdateCards = MutableStateFlow<List<DailyUpdate>>(emptyList())
    val pendingUpdateCards: StateFlow<List<DailyUpdate>> = _pendingUpdateCards.asStateFlow()

    init {
        viewModelScope.launch {
            gameStateRepository.initializeGameState()
        }
    }

    fun advanceDay() {
        viewModelScope.launch {
            _isLoading.value = true
            soundEngine.play(com.s0dolamby.game.data.sound.SoundName.DAY)
            advanceDayUseCase().onSuccess { updates ->
                _pendingUpdateCards.value = updates
            }
            _isLoading.value = false
        }
    }

    fun dismissUpdateCard(update: DailyUpdate) {
        _pendingUpdateCards.update { cards -> cards.filter { it.id != update.id } }
    }

    fun clearRankUpNotification() {
        viewModelScope.launch {
            gameStateRepository.clearRankUpNotification()
        }
    }
}
