package com.s0dolamby.game.presentation.ama

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.AmaMessage
import com.s0dolamby.game.domain.model.AmaSession
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.domain.usecase.InvestUseCase
import com.s0dolamby.game.domain.usecase.SendAmaMessageUseCase
import com.s0dolamby.game.domain.usecase.StartAmaSessionUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AmaUiState(
    val project: Project? = null,
    val session: AmaSession? = null,
    val isLoading: Boolean = false,
    val isSending: Boolean = false,
    val error: String? = null,
    val showInvestSheet: Boolean = false,
    val investResult: String? = null
)

@HiltViewModel
class AmaViewModel @Inject constructor(
    private val startAmaSessionUseCase: StartAmaSessionUseCase,
    private val sendAmaMessageUseCase: SendAmaMessageUseCase,
    private val investUseCase: InvestUseCase,
    private val projectRepository: ProjectRepository,
    private val amaRepository: AmaRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val projectId: String = checkNotNull(savedStateHandle["projectId"])

    private val _uiState = MutableStateFlow(AmaUiState(isLoading = true))
    val uiState: StateFlow<AmaUiState> = _uiState.asStateFlow()

    init {
        loadSession()
    }

    private fun loadSession() {
        viewModelScope.launch {
            val project = projectRepository.getProjectById(projectId)
            val sessionResult = startAmaSessionUseCase(projectId)
            sessionResult.onSuccess { session ->
                _uiState.value = AmaUiState(project = project, session = session)
                observeSession(session.id)
            }.onFailure {
                _uiState.update { s -> s.copy(isLoading = false, error = it.message) }
            }
        }
    }

    private fun observeSession(sessionId: String) {
        viewModelScope.launch {
            amaRepository.observeSession(sessionId).collect { session ->
                _uiState.update { it.copy(session = session, isLoading = false) }
            }
        }
    }

    fun sendMessage(text: String) {
        val sessionId = _uiState.value.session?.id ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isSending = true) }
            sendAmaMessageUseCase(sessionId, text)
                .onFailure { err -> _uiState.update { it.copy(error = err.message) } }
            _uiState.update { it.copy(isSending = false) }
        }
    }

    fun showInvestSheet() = _uiState.update { it.copy(showInvestSheet = true) }
    fun hideInvestSheet() = _uiState.update { it.copy(showInvestSheet = false) }

    fun invest(amountTON: Double) {
        viewModelScope.launch {
            investUseCase(projectId, amountTON)
                .onSuccess {
                    _uiState.update { it.copy(showInvestSheet = false, investResult = "Инвестировано %.2f TON".format(amountTON)) }
                }
                .onFailure { err ->
                    _uiState.update { it.copy(error = err.message) }
                }
        }
    }

    fun clearError() = _uiState.update { it.copy(error = null) }
}
