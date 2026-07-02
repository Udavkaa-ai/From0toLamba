package com.s0dolamby.game.presentation.inbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.data.minigame.MinigameUnlockStore
import com.s0dolamby.game.data.sound.SoundEngine
import com.s0dolamby.game.data.sound.SoundName
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.domain.usecase.InvestUseCase
import com.s0dolamby.game.domain.usecase.MaxProjectsReachedException
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Состояние вложения прямо из грамот — после мини-игры заходить в беседу
 * НЕ обязательно (чат генерирует AI-приветствие и тратит токены, поэтому
 * открывается только по явному желанию игрока).
 */
data class InboxInvestState(
    /** Дело, для которого открыт шит вложения. */
    val sheetProjectId: String? = null,
    /** Процент «уговора» этого дела (0..10, по вопросам в беседе). */
    val ugovorPercent: Int = 0,
    /** Все 5 слотов заняты — сумма отложенного вклада для оффера слота. */
    val extraSlotOfferAmount: Double? = null,
    /** Успешное вложение — сумма для снэкбара. */
    val investedAmount: Double? = null,
    /** Ошибка вложения (текст из use-case). */
    val error: String? = null
)

@HiltViewModel
class InboxViewModel @Inject constructor(
    private val projectRepository: ProjectRepository,
    private val unlockStore: MinigameUnlockStore,
    private val investUseCase: InvestUseCase,
    private val amaRepository: AmaRepository,
    private val soundEngine: SoundEngine,
    gameStateRepository: GameStateRepository
) : ViewModel() {

    val inboxProjects: StateFlow<List<Project>> = projectRepository.getInboxProjects()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Map projectId → MinigameOutcome для уже пройденных дел. */
    val unlockOutcomes: StateFlow<Map<String, MinigameOutcome>> = unlockStore.outcomes
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    val freeBalance: StateFlow<Double> = gameStateRepository.observeGameState()
        .map { it.balance }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    private val _investState = MutableStateFlow(InboxInvestState())
    val investState: StateFlow<InboxInvestState> = _investState.asStateFlow()

    fun openInvestSheet(projectId: String) {
        viewModelScope.launch {
            val questions = amaRepository.getSessionByProjectId(projectId)?.questionCount ?: 0
            _investState.update { it.copy(
                sheetProjectId = projectId,
                ugovorPercent = InvestUseCase.ugovorPercent(questions)
            ) }
        }
    }

    fun closeInvestSheet() = _investState.update { it.copy(sheetProjectId = null) }

    fun invest(amountRubles: Double, buyExtraSlot: Boolean = false) {
        val projectId = _investState.value.sheetProjectId ?: return
        viewModelScope.launch {
            investUseCase(projectId, amountRubles, buyExtraSlot)
                .onSuccess {
                    soundEngine.play(SoundName.INVEST)
                    _investState.update { it.copy(
                        sheetProjectId = null,
                        extraSlotOfferAmount = null,
                        investedAmount = amountRubles
                    ) }
                }
                .onFailure { err ->
                    if (err is MaxProjectsReachedException) {
                        _investState.update { it.copy(extraSlotOfferAmount = amountRubles) }
                    } else {
                        _investState.update { it.copy(error = err.message ?: "") }
                    }
                }
        }
    }

    fun investWithExtraSlot() {
        val amount = _investState.value.extraSlotOfferAmount ?: return
        invest(amount, buyExtraSlot = true)
    }

    fun dismissExtraSlotOffer() = _investState.update { it.copy(extraSlotOfferAmount = null) }
    fun clearInvestResult() = _investState.update { it.copy(investedAmount = null) }
    fun clearError() = _investState.update { it.copy(error = null) }
}
