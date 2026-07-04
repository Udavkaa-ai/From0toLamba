package com.s0dolamby.game.presentation.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.today.TodayRewards
import com.s0dolamby.game.domain.week.WeeklyFair
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TodayUiState(
    val loginStreak: Int = 0,
    val canClaim: Boolean = true,
    val todayReward: Int = TodayRewards.totalReward(1),
    val claimedTodayReward: Int? = null,
    val error: String? = null,
    // «Ярмарка недели»
    val weekNumber: Int = 0,
    val weekDaysLeft: Int = 7,
    /** Прирост богатства с начала недели в %; null — неделя ещё не начата. */
    val weekGrowthPercent: Double? = null,
    val weekChuykaCorrect: Int = 0,
    val weekChuykaTotal: Int = 0,
    val investorRank: com.s0dolamby.game.domain.model.InvestorRank? = null,
    val weekModifier: com.s0dolamby.game.domain.week.WeekModifier =
        com.s0dolamby.game.domain.week.WeekModifier.NONE
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
        val currentWeek = WeeklyFair.weekKey()
        val wealth = state.balance + state.activeProjects.sumOf { it.currentValueRubles }
        TodayUiState(
            loginStreak = effectiveStreak,
            canClaim = state.lastDailyClaim != today,
            todayReward = TodayRewards.totalReward(effectiveStreak),
            claimedTodayReward = claimedReward,
            error = error,
            weekNumber = WeeklyFair.weekNumber(currentWeek),
            weekDaysLeft = WeeklyFair.daysLeft(),
            weekGrowthPercent = if (state.weekKey == currentWeek && state.weekStartWealth > 0) {
                (wealth - state.weekStartWealth) / state.weekStartWealth * 100.0
            } else null,
            weekChuykaCorrect = (state.chuykaCorrect - state.weekStartChuykaCorrect).coerceAtLeast(0),
            weekChuykaTotal = (state.chuykaTotal - state.weekStartChuykaTotal).coerceAtLeast(0),
            investorRank = state.investorRank,
            weekModifier = WeeklyFair.modifierFor(currentWeek)
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), TodayUiState())

    init {
        // Обновляем стрик при заходе на экран — атомарно через репо.
        viewModelScope.launch { gameStateRepository.ensureDailyVisit() }
        // «Ярмарка недели»: если наступила новая неделя — фиксируем снапшот
        // богатства прямо при заходе, не дожидаясь первого advance-day.
        viewModelScope.launch {
            val s = gameStateRepository.getGameState()
            gameStateRepository.ensureWeeklyFair(
                s.balance + s.activeProjects.sumOf { it.currentValueRubles }
            )
        }
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
