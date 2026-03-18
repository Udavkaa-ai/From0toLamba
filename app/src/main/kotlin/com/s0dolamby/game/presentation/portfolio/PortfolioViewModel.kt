package com.s0dolamby.game.presentation.portfolio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.domain.usecase.ExitProjectUseCase
import com.s0dolamby.game.domain.usecase.InvestUseCase
import com.s0dolamby.game.domain.usecase.PartialWithdrawUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
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
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _actionResult = MutableStateFlow<String?>(null)
    val actionResult: StateFlow<String?> = _actionResult.asStateFlow()

    fun exitProject(projectId: String) {
        viewModelScope.launch {
            exitProjectUseCase(projectId)
                .onSuccess { returned -> _actionResult.value = "Получено %.2f TON".format(returned) }
                .onFailure { _actionResult.value = "Ошибка: ${it.message}" }
        }
    }

    fun addFunds(projectId: String, amountTON: Double) {
        viewModelScope.launch {
            investUseCase(projectId, amountTON)
                .onSuccess { _actionResult.value = "Довложено %.2f TON".format(amountTON) }
                .onFailure { _actionResult.value = "Ошибка: ${it.message}" }
        }
    }

    fun partialWithdraw(projectId: String, amountTON: Double) {
        viewModelScope.launch {
            partialWithdrawUseCase(projectId, amountTON)
                .onSuccess { amount -> _actionResult.value = "Выведено %.2f TON".format(amount) }
                .onFailure { _actionResult.value = "Ошибка: ${it.message}" }
        }
    }

    fun clearActionResult() { _actionResult.value = null }
}
