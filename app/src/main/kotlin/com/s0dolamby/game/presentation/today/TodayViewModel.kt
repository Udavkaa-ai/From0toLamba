package com.s0dolamby.game.presentation.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.today.TodayRewards
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TodayUiState(
    val loginStreak: Int = 0,
    val canClaim: Boolean = true,
    val todayReward: Int = TodayRewards.totalReward(1),
    val claimedTodayReward: Int? = null,
    val error: String? = null
)

@HiltViewModel
class TodayViewModel @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val soundEngine: com.s0dolamby.game.data.sound.SoundEngine
) : ViewModel() {

    private val _claimedTodayReward = MutableStateFlow<Int?>(null)
    private val _error = MutableStateFlow<String?>(null)

    val uiState: StateFlow<TodayUiState> = combine(
        gameStateRepository.observeGameState(),
        _claimedTodayReward,
        _error
    ) { state, claimedReward, error ->
        val today = TodayRewards.todayKey()
        val effectiveStreak = state.loginStreak.coerceAtLeast(1)
        TodayUiState(
            loginStreak = effectiveStreak,
            canClaim = state.lastDailyClaim != today,
            todayReward = TodayRewards.totalReward(effectiveStreak),
            claimedTodayReward = claimedReward,
            error = error
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), TodayUiState())

    init {
        // Обновляем стрик при заходе на экран — атомарно через репо.
        viewModelScope.launch { gameStateRepository.ensureDailyVisit() }
    }

    fun claim() {
        viewModelScope.launch {
            gameStateRepository.claimDailyReward()
                .onSuccess { reward ->
                    // Монета падает на стол — как playSound('invest') в TG TodayPage
                    soundEngine.play(com.s0dolamby.game.data.sound.SoundName.INVEST)
                    _claimedTodayReward.value = reward
                }
                // Пустая строка — сигнал «дефолтная ошибка, бери из словаря».
                // Использовать i18n-ключ напрямую в ViewModel нельзя — там нет
                // Compose-контекста; экран превратит "" → Strings.t(...).
                .onFailure { err -> _error.value = err.message ?: "" }
        }
    }

    fun clearError() { _error.value = null }
    fun clearClaimedReward() { _claimedTodayReward.value = null }
}
