package com.s0dolamby.game.presentation.portfolio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.domain.usecase.ExitProjectUseCase
import com.s0dolamby.game.domain.usecase.InvestUseCase
import com.s0dolamby.game.domain.usecase.PartialWithdrawUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Полу-структурированный результат действия — модель не знает про
 * Compose/i18n, она отдаёт «что произошло и сколько грошей»; экран
 * превращает в локализованную snackbar-строку через Strings.t.
 */
sealed class PortfolioActionResult {
    data class Received(val amount: Double) : PortfolioActionResult()
    data class AddedFunds(val amount: Double) : PortfolioActionResult()
    data class Withdrawn(val amount: Double) : PortfolioActionResult()
    data class Failure(val message: String) : PortfolioActionResult()
}

@HiltViewModel
class PortfolioViewModel @Inject constructor(
    private val projectRepository: ProjectRepository,
    private val gameStateRepository: GameStateRepository,
    private val exitProjectUseCase: ExitProjectUseCase,
    private val investUseCase: InvestUseCase,
    private val partialWithdrawUseCase: PartialWithdrawUseCase,
    private val soundEngine: com.s0dolamby.game.data.sound.SoundEngine
) : ViewModel() {

    val freeBalance: StateFlow<Double> = gameStateRepository.observeGameState()
        .map { it.balance }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val activeProjects: StateFlow<List<Project>> = projectRepository.getActiveProjects()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val closedProjects: StateFlow<List<Project>> = projectRepository.getClosedProjects()
        .map { list -> list.filter { it.closureReason != "Предложение не принято" } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _actionResult = MutableStateFlow<PortfolioActionResult?>(null)
    val actionResult: StateFlow<PortfolioActionResult?> = _actionResult.asStateFlow()

    fun exitProject(projectId: String) {
        viewModelScope.launch {
            // Вложенное запоминаем ДО выхода — после closeProject уже не сравнить
            val invested = projectRepository.getProjectById(projectId)?.investedAmountRubles ?: 0.0
            exitProjectUseCase(projectId)
                .onSuccess { returned ->
                    // Как в TG HomePage: перезвон при выходе в плюс, стук — в минус
                    soundEngine.play(
                        if (returned >= invested) com.s0dolamby.game.data.sound.SoundName.WIN
                        else com.s0dolamby.game.data.sound.SoundName.LOSE
                    )
                    _actionResult.value = PortfolioActionResult.Received(returned)
                }
                .onFailure { _actionResult.value = PortfolioActionResult.Failure(it.message ?: "") }
        }
    }

    fun addFunds(projectId: String, amountRubles: Double) {
        viewModelScope.launch {
            investUseCase(projectId, amountRubles)
                .onSuccess {
                    soundEngine.play(com.s0dolamby.game.data.sound.SoundName.INVEST)
                    _actionResult.value = PortfolioActionResult.AddedFunds(amountRubles)
                }
                .onFailure { _actionResult.value = PortfolioActionResult.Failure(it.message ?: "") }
        }
    }

    fun partialWithdraw(projectId: String, amountRubles: Double) {
        val handler = CoroutineExceptionHandler { _, e ->
            _actionResult.value = PortfolioActionResult.Failure(e.message ?: "")
        }
        viewModelScope.launch(handler) {
            runCatching { partialWithdrawUseCase(projectId, amountRubles) }
                .getOrElse { Result.failure(it) }
                .onSuccess { amount -> _actionResult.value = PortfolioActionResult.Withdrawn(amount) }
                .onFailure { _actionResult.value = PortfolioActionResult.Failure(it.message ?: "") }
        }
    }

    fun clearActionResult() { _actionResult.value = null }
}
