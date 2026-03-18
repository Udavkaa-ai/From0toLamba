package com.s0dolamby.game.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.GameState
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.usecase.AdvanceDayUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val advanceDayUseCase: AdvanceDayUseCase
) : ViewModel() {

    val gameState: StateFlow<GameState?> = gameStateRepository.observeGameState()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        viewModelScope.launch {
            gameStateRepository.initializeGameState()
        }
    }

    fun advanceDay() {
        viewModelScope.launch {
            _isLoading.value = true
            advanceDayUseCase()
            _isLoading.value = false
        }
    }
}
