package com.s0dolamby.game.presentation.ama

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.data.minigame.MinigameUnlockStore
import com.s0dolamby.game.domain.model.AmaSession
import com.s0dolamby.game.domain.model.LieTopic
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.domain.usecase.InvestUseCase
import com.s0dolamby.game.domain.usecase.SendAmaMessageUseCase
import com.s0dolamby.game.domain.usecase.StartAmaSessionUseCase
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class IntuitionResult(
    val deltaPoints: Int,
    val correct: List<LieTopic>,
    val falseAccusations: List<LieTopic>
)

data class AmaUiState(
    val project: Project? = null,
    val session: AmaSession? = null,
    val isLoading: Boolean = false,
    val isSending: Boolean = false,
    val error: String? = null,
    val showInvestSheet: Boolean = false,
    val investResult: String? = null,
    val selectedLieTopics: Set<LieTopic> = emptySet(),
    val intuitionResult: IntuitionResult? = null,
    val freeBalance: Double = 0.0,
    /** Уже пройдена мини-игра этого дела (любой не-проигрыш). */
    val minigameUnlocked: Boolean = false,
    val minigamePerfect: Boolean = false,
    /** Куда вести при попытке инвеста, если игра ещё не пройдена. */
    val pendingMinigameArchetype: PersonaArchetype? = null
)

@HiltViewModel
class AmaViewModel @Inject constructor(
    private val startAmaSessionUseCase: StartAmaSessionUseCase,
    private val sendAmaMessageUseCase: SendAmaMessageUseCase,
    private val investUseCase: InvestUseCase,
    private val projectRepository: ProjectRepository,
    private val amaRepository: AmaRepository,
    private val gameStateRepository: GameStateRepository,
    private val minigameUnlockStore: MinigameUnlockStore,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val projectId: String = checkNotNull(savedStateHandle["projectId"])

    init {
        // Подписываемся на изменения unlock-стора, чтобы кнопка инвеста
        // мгновенно превратилась из «Сыграть в игру дельца» в «Вложить рубли»
        // после возврата из gate-экрана.
        viewModelScope.launch {
            minigameUnlockStore.outcomes.collect { map ->
                val outcome: MinigameOutcome? = map[projectId]
                _uiState.update { it.copy(
                    minigameUnlocked = outcome?.isWin == true,
                    minigamePerfect = outcome?.isPerfect == true
                ) }
            }
        }
    }

    private val _uiState = MutableStateFlow(AmaUiState(isLoading = true))
    val uiState: StateFlow<AmaUiState> = _uiState.asStateFlow()

    init {
        loadSession()
        viewModelScope.launch {
            gameStateRepository.observeGameState().collect { state ->
                _uiState.update { it.copy(freeBalance = state.balance) }
            }
        }
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

    fun toggleLieTopic(topic: LieTopic) {
        _uiState.update { state ->
            val current = state.selectedLieTopics
            state.copy(selectedLieTopics = if (topic in current) current - topic else current + topic)
        }
    }

    fun evaluateIntuition() {
        val project = _uiState.value.project ?: return
        val sessionId = _uiState.value.session?.id ?: return
        if (_uiState.value.session?.isIntuitionEvaluated == true) return
        val selected = _uiState.value.selectedLieTopics
        val actualLies = project.lieTopics.toSet()

        val correct = selected.filter { it in actualLies }
        val falseAccusations = selected.filter { it !in actualLies }
        val delta = correct.size - falseAccusations.size

        viewModelScope.launch {
            gameStateRepository.recordIntuitionPoints(delta)
            gameStateRepository.updateRankIfNeeded()
            amaRepository.markIntuitionEvaluated(sessionId)
            _uiState.update { it.copy(intuitionResult = IntuitionResult(delta, correct, falseAccusations)) }
        }
    }

    fun clearIntuitionResult() = _uiState.update { it.copy(intuitionResult = null) }

    /**
     * Кнопка «Вложиться». Если мини-игра дельца ещё не пройдена — попросим
     * UI отправить пользователя в [MinigameGate], запомнив архетип. Если
     * пройдена — открываем sheet для ввода суммы.
     */
    fun requestInvest() {
        val state = _uiState.value
        if (state.minigameUnlocked) {
            _uiState.update { it.copy(showInvestSheet = true) }
        } else {
            val arch = state.project?.personaArchetype ?: return
            _uiState.update { it.copy(pendingMinigameArchetype = arch) }
        }
    }

    /** UI прочитал [pendingMinigameArchetype] и навигировал — забываем запрос. */
    fun clearPendingMinigame() = _uiState.update { it.copy(pendingMinigameArchetype = null) }

    fun showInvestSheet() = _uiState.update { it.copy(showInvestSheet = true) }
    fun hideInvestSheet() = _uiState.update { it.copy(showInvestSheet = false) }

    fun invest(amountRubles: Double) {
        viewModelScope.launch {
            investUseCase(projectId, amountRubles)
                .onSuccess {
                    _uiState.update { it.copy(
                        showInvestSheet = false,
                        investResult = "Вложено %.0f ₽".format(amountRubles)
                    ) }
                }
                .onFailure { err ->
                    _uiState.update { it.copy(error = err.message) }
                }
        }
    }

    fun clearError() = _uiState.update { it.copy(error = null) }
    fun clearInvestResult() = _uiState.update { it.copy(investResult = null) }
}
