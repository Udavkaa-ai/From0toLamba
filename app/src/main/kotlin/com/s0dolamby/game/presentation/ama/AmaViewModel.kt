package com.s0dolamby.game.presentation.ama

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.data.minigame.MinigameUnlockStore
import com.s0dolamby.game.domain.model.AmaSession
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.domain.usecase.InvestUseCase
import com.s0dolamby.game.domain.usecase.MaxProjectsReachedException
import com.s0dolamby.game.domain.usecase.SendAmaMessageUseCase
import com.s0dolamby.game.domain.usecase.StartAmaSessionUseCase
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Структурированная ошибка беседы — модель не пишет русский текст
 * руками, экран превращает в i18n-строку через Strings.t(ama.err.*).
 */
sealed class AmaError {
    object KeyInvalid : AmaError()
    object NoCredit : AmaError()
    object Throttled : AmaError()
    object Offline : AmaError()
    data class Unknown(val raw: String) : AmaError()
}

data class AmaUiState(
    val project: Project? = null,
    val session: AmaSession? = null,
    val isLoading: Boolean = false,
    val isSending: Boolean = false,
    val error: AmaError? = null,
    val showInvestSheet: Boolean = false,
    val investedAmount: Double? = null,
    val freeBalance: Double = 0.0,
    /** Уже пройдена мини-игра этого дела (любой не-проигрыш). */
    val minigameUnlocked: Boolean = false,
    val minigamePerfect: Boolean = false,
    /** Куда вести при попытке инвеста, если игра ещё не пройдена. */
    val pendingMinigameArchetype: PersonaArchetype? = null,
    /**
     * Все 5 слотов заняты — предлагаем купить дополнительный за 1000 г.
     * Значение = сумма отложенного вклада, null = оффер не показан.
     */
    val extraSlotOfferAmount: Double? = null
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
    private val soundEngine: com.s0dolamby.game.data.sound.SoundEngine,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val projectId: String = checkNotNull(savedStateHandle["projectId"])

    private val _uiState = MutableStateFlow(AmaUiState(isLoading = true))
    val uiState: StateFlow<AmaUiState> = _uiState.asStateFlow()

    init {
        loadSession()
        viewModelScope.launch {
            gameStateRepository.observeGameState().collect { state ->
                _uiState.update { it.copy(freeBalance = state.balance) }
            }
        }
        // Подписка на unlock-стор: кнопка инвеста мгновенно превращается из
        // «Испытать» в «Вложить» после возврата из gate-экрана.
        // ВАЖНО: init идёт ПОСЛЕ объявления _uiState — viewModelScope работает
        // на Main.immediate и StateFlow.collect синхронно отдаёт первое
        // значение прямо в конструкторе.
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

    private fun loadSession() {
        viewModelScope.launch {
            val project = projectRepository.getProjectById(projectId)
            val sessionResult = startAmaSessionUseCase(projectId)
            sessionResult.onSuccess { session ->
                // update, а не замена всего state — иначе сотрём minigameUnlocked
                // и freeBalance, выставленные параллельными collect'ами
                _uiState.update { it.copy(
                    project = project,
                    session = session,
                    isLoading = false,
                    error = null
                ) }
                observeSession(session.id)
            }.onFailure {
                _uiState.update { s -> s.copy(isLoading = false, error = it.toAmaError()) }
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
                .onFailure { err -> _uiState.update { it.copy(error = err.toAmaError()) } }
            _uiState.update { it.copy(isSending = false) }
        }
    }

    /** Классификация сетевой/HTTP-ошибки в структурированный AmaError. */
    private fun Throwable.toAmaError(): AmaError {
        val msg = message.orEmpty()
        return when {
            msg.contains("401") -> AmaError.KeyInvalid
            msg.contains("402") -> AmaError.NoCredit
            msg.contains("429") -> AmaError.Throttled
            msg.contains("Unable to resolve host") || msg.contains("timeout") -> AmaError.Offline
            else -> AmaError.Unknown(msg)
        }
    }

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

    fun invest(amountRubles: Double, buyExtraSlot: Boolean = false) {
        viewModelScope.launch {
            investUseCase(projectId, amountRubles, buyExtraSlot)
                .onSuccess {
                    soundEngine.play(com.s0dolamby.game.data.sound.SoundName.INVEST)
                    _uiState.update { it.copy(
                        showInvestSheet = false,
                        investedAmount = amountRubles,
                        extraSlotOfferAmount = null
                    ) }
                }
                .onFailure { err ->
                    if (err is MaxProjectsReachedException) {
                        // Слоты кончились — вместо ошибки предлагаем купить
                        // дополнительный (порт TG ExtraSlotModal).
                        _uiState.update { it.copy(
                            showInvestSheet = false,
                            extraSlotOfferAmount = amountRubles
                        ) }
                    } else {
                        _uiState.update { it.copy(error = err.toAmaError()) }
                    }
                }
        }
    }

    /** Кнопка «Открыть слот · 1000 г» в оффере дополнительного слота. */
    fun investWithExtraSlot() {
        val amount = _uiState.value.extraSlotOfferAmount ?: return
        invest(amount, buyExtraSlot = true)
    }

    fun dismissExtraSlotOffer() = _uiState.update { it.copy(extraSlotOfferAmount = null) }

    fun clearError() = _uiState.update { it.copy(error = null) }
    fun clearInvestResult() = _uiState.update { it.copy(investedAmount = null) }
}
