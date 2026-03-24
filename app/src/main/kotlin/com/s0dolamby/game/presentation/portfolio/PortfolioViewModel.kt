package com.s0dolamby.game.presentation.portfolio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.Project
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

@HiltViewModel
class PortfolioViewModel @Inject constructor(
    private val projectRepository: ProjectRepository,
    private val exitProjectUseCase: ExitProjectUseCase,
    private val investUseCase: InvestUseCase,
    private val partialWithdrawUseCase: PartialWithdrawUseCase
) : ViewModel() {

    val activeProjects: StateFlow<List<Project>> = projectRepository.getActiveProjects()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val closedProjects: StateFlow<List<Project>> = projectRepository.getClosedProjects()
        .map { list -> list.filter { it.closureReason != "Предложение не принято" } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _actionResult = MutableStateFlow<String?>(null)
    val actionResult: StateFlow<String?> = _actionResult.asStateFlow()

    fun exitProject(projectId: String) {
        viewModelScope.launch {
            exitProjectUseCase(projectId)
                .onSuccess { returned -> _actionResult.value = "Получено %.0f ₽".format(returned) }
                .onFailure { _actionResult.value = "Ошибка: ${it.message}" }
        }
    }

    fun addFunds(projectId: String, amountRubles: Double) {
        viewModelScope.launch {
            investUseCase(projectId, amountRubles)
                .onSuccess { _actionResult.value = "Довложено %.0f ₽".format(amountRubles) }
                .onFailure { _actionResult.value = "Ошибка: ${it.message}" }
        }
    }

    fun partialWithdraw(projectId: String, amountRubles: Double) {
        val handler = CoroutineExceptionHandler { _, e ->
            _actionResult.value = "Ошибка: ${e.message}"
        }
        viewModelScope.launch(handler) {
            runCatching { partialWithdrawUseCase(projectId, amountRubles) }
                .getOrElse { Result.failure(it) }
                .onSuccess { amount -> _actionResult.value = "Выведено %.0f ₽".format(amount) }
                .onFailure { _actionResult.value = "Ошибка: ${it.message}" }
        }
    }

    fun clearActionResult() { _actionResult.value = null }
}
