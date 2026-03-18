package com.s0dolamby.game.presentation.portfolio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.domain.usecase.ExitProjectUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PortfolioViewModel @Inject constructor(
    private val projectRepository: ProjectRepository,
    private val exitProjectUseCase: ExitProjectUseCase
) : ViewModel() {

    val activeProjects: StateFlow<List<Project>> = projectRepository.getActiveProjects()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val closedProjects: StateFlow<List<Project>> = projectRepository.getClosedProjects()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _exitResult = MutableStateFlow<String?>(null)
    val exitResult: StateFlow<String?> = _exitResult.asStateFlow()

    fun exitProject(projectId: String) {
        viewModelScope.launch {
            exitProjectUseCase(projectId)
                .onSuccess { returned -> _exitResult.value = "Получено %.2f TON".format(returned) }
                .onFailure { _exitResult.value = "Ошибка: ${it.message}" }
        }
    }
}
