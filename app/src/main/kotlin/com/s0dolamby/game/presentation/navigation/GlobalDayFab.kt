package com.s0dolamby.game.presentation.navigation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.data.sound.SoundEngine
import com.s0dolamby.game.data.sound.SoundName
import com.s0dolamby.game.domain.usecase.AdvanceDayUseCase
import com.s0dolamby.game.presentation.common.theme.LocalAppPalette
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.onboarding.tourAnchor
import com.s0dolamby.game.domain.model.ThemeMode
import com.s0dolamby.game.presentation.common.theme.LocalThemeMode
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class GlobalDayFabViewModel @Inject constructor(
    private val advanceDayUseCase: AdvanceDayUseCase,
    private val soundEngine: SoundEngine,
    private val dayNewsStore: com.s0dolamby.game.data.news.DayNewsStore,
    private val investUseCase: com.s0dolamby.game.domain.usecase.InvestUseCase,
    private val reactToBadNewsUseCase: com.s0dolamby.game.domain.usecase.ReactToBadNewsUseCase,
    projectRepository: com.s0dolamby.game.domain.repository.ProjectRepository,
    gameStateRepository: com.s0dolamby.game.domain.repository.GameStateRepository
) : ViewModel() {
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    /** Очередь «Вестей дня» — колода рисуется в NavGraph поверх любого экрана. */
    val pendingNews = dayNewsStore.pending

    /** Вести, на которые уже отреагировали «Сечением». */
    val reactedNewsIds = dayNewsStore.reactedIds

    /** Активные дела целиком — из их экономики строятся задания «Сечения». */
    val activeProjects: StateFlow<List<com.s0dolamby.game.domain.model.Project>> =
        projectRepository.getActiveProjects()
            .stateIn(viewModelScope, kotlinx.coroutines.flow.SharingStarted.WhileSubscribed(5000), emptyList())

    val freeBalance: StateFlow<Double> = gameStateRepository.observeGameState()
        .map { it.balance }
        .stateIn(viewModelScope, kotlinx.coroutines.flow.SharingStarted.WhileSubscribed(5000), 0.0)

    /** Текущий игровой день — из него выводится день недели и переход недели. */
    val currentDay: StateFlow<Int> = gameStateRepository.observeGameState()
        .map { it.currentDay }
        .stateIn(viewModelScope, kotlinx.coroutines.flow.SharingStarted.WhileSubscribed(5000), 1)

    /** Сколько входящих грамот ещё не рассмотрено — для предупреждения при листании дня. */
    val pendingInboxCount: StateFlow<Int> = gameStateRepository.observeGameState()
        .map { it.pendingInbox.size }
        .stateIn(viewModelScope, kotlinx.coroutines.flow.SharingStarted.WhileSubscribed(5000), 0)

    /** Чин — задаёт потолок суммарного вложения в одно дело. */
    val investorRank: StateFlow<com.s0dolamby.game.domain.model.InvestorRank> =
        gameStateRepository.observeGameState()
            .map { it.investorRank }
            .stateIn(
                viewModelScope,
                kotlinx.coroutines.flow.SharingStarted.WhileSubscribed(5000),
                com.s0dolamby.game.domain.model.InvestorRank.NEWBIE
            )

    /** Результат довложения по реакции — для снэкбара/ошибки в UI. */
    private val _reactionInvestResult = MutableStateFlow<String?>(null)
    val reactionInvestResult: StateFlow<String?> = _reactionInvestResult.asStateFlow()

    fun advanceDay() {
        if (_isLoading.value) return
        viewModelScope.launch {
            _isLoading.value = true
            soundEngine.play(SoundName.DAY)
            advanceDayUseCase().onSuccess { updates ->
                dayNewsStore.push(updates)
            }
            _isLoading.value = false
        }
    }

    fun dismissNews(update: com.s0dolamby.game.domain.model.DailyUpdate) {
        dayNewsStore.dismiss(update)
    }

    fun markReacted(updateId: String) = dayNewsStore.markReacted(updateId)

    /** Довложение с бонусом за меткое «Сечение». */
    fun investWithReactionBonus(projectId: String, amount: Double, bonusPercent: Int) {
        viewModelScope.launch {
            investUseCase(projectId, amount, reactionBonusPercent = bonusPercent)
                .onSuccess {
                    soundEngine.play(SoundName.INVEST)
                    _reactionInvestResult.value = "ok:$amount"
                }
                .onFailure { _reactionInvestResult.value = "err:${it.message.orEmpty()}" }
        }
    }

    /** Применить исход «Зоркого счёта» к делу из тревожной вести. */
    fun applyBadNewsOutcome(
        update: com.s0dolamby.game.domain.model.DailyUpdate,
        outcome: com.s0dolamby.game.domain.usecase.BadNewsOutcome
    ) {
        viewModelScope.launch {
            reactToBadNewsUseCase(update.projectId, update.eventDeltaRubles, outcome)
                .onSuccess { effect ->
                    when (effect) {
                        is com.s0dolamby.game.domain.usecase.BadNewsEffect.Recovered -> {
                            soundEngine.play(SoundName.WIN)
                            _reactionInvestResult.value = "win:${effect.amountRubles}"
                        }
                        is com.s0dolamby.game.domain.usecase.BadNewsEffect.Frozen -> {
                            soundEngine.play(SoundName.LOSE)
                            _reactionInvestResult.value = "freeze"
                        }
                        com.s0dolamby.game.domain.usecase.BadNewsEffect.Unlocked -> {
                            soundEngine.play(SoundName.WIN)
                            _reactionInvestResult.value = "unlocked"
                        }
                        com.s0dolamby.game.domain.usecase.BadNewsEffect.LockStays -> {
                            soundEngine.play(SoundName.LOSE)
                            _reactionInvestResult.value = "lockstay"
                        }
                    }
                }
                .onFailure { _reactionInvestResult.value = "err:${it.message.orEmpty()}" }
        }
    }

    fun clearReactionInvestResult() { _reactionInvestResult.value = null }
}

/**
 * Плавающая кнопка листания дня. По умолчанию — круглая (🔄); первый тап
 * разворачивает её в пилюлю «Следующий день» / «Новая неделя», второй тап
 * листает день. Если не тапнуть повторно — через пару секунд сворачивается.
 * При листании с нерассмотренными грамотами спрашивает подтверждение.
 * Скрывается на экранах, где мешает (мини-игры, AMA-чат, gate, онбординг).
 */
@Composable
fun GlobalDayFab(
    visible: Boolean,
    modifier: Modifier = Modifier,
    viewModel: GlobalDayFabViewModel = hiltViewModel()
) {
    val isLoading by viewModel.isLoading.collectAsState()
    val currentDay by viewModel.currentDay.collectAsState()
    val pendingInbox by viewModel.pendingInboxCount.collectAsState()
    val palette = LocalAppPalette.current
    val themeMode = LocalThemeMode.current
    val gradient = when (themeMode) {
        ThemeMode.WARM_FAIRY -> Brush.linearGradient(
            listOf(Color(0xFFFFD660), Color(0xFFFFB800), Color(0xFFB07400))
        )
        ThemeMode.DARK_FAIRY -> Brush.linearGradient(listOf(palette.enchantedPurple, palette.nightBlue))
    }
    val borderColor = when (themeMode) {
        ThemeMode.WARM_FAIRY -> Color(0xCC784C24)
        ThemeMode.DARK_FAIRY -> FairyGold.copy(alpha = 0.5f)
    }
    val textColor = when (themeMode) {
        ThemeMode.WARM_FAIRY -> Color(0xFF3A2010)
        ThemeMode.DARK_FAIRY -> FairyGold
    }

    var expanded by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    var confirmAdvance by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    val newWeek = com.s0dolamby.game.domain.week.GameWeek.crossesIntoNewWeek(currentDay)

    // Свернуть, если по развёрнутой кнопке не тапнули повторно
    androidx.compose.runtime.LaunchedEffect(expanded, isLoading) {
        if (expanded && !isLoading) {
            kotlinx.coroutines.delay(3000)
            expanded = false
        }
    }

    fun doAdvance() {
        expanded = false
        confirmAdvance = false
        viewModel.advanceDay()
    }

    fun onTap() {
        when {
            isLoading -> Unit
            !expanded -> expanded = true
            pendingInbox > 0 -> confirmAdvance = true   // предупредим о грамотах
            else -> doAdvance()
        }
    }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn() + scaleIn(initialScale = 0.85f),
        exit = fadeOut() + scaleOut(targetScale = 0.85f),
        modifier = modifier
    ) {
        Row(
            modifier = Modifier
                .padding(end = 16.dp, bottom = 96.dp)
                .tourAnchor(com.s0dolamby.game.presentation.onboarding.TourTarget.NEXT_DAY)
                .shadow(12.dp, RoundedCornerShape(28.dp))
                .clip(RoundedCornerShape(28.dp))
                .background(gradient)
                .border(1.5.dp, borderColor, RoundedCornerShape(28.dp))
                .clickable(enabled = !isLoading) { onTap() }
                .animateContentSize()
                .padding(horizontal = if (expanded || isLoading) 18.dp else 15.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                when {
                    isLoading -> "⏳"
                    expanded && newWeek -> "🌅"
                    expanded -> "🌅"
                    else -> "🔄"
                },
                fontSize = 16.sp
            )
            AnimatedVisibility(visible = expanded || isLoading) {
                Text(
                    when {
                        isLoading -> "  Течёт время..."
                        newWeek -> "  Новая неделя"
                        else -> "  Следующий день"
                    },
                    color = textColor,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }

    if (confirmAdvance) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { confirmAdvance = false },
            icon = { Text("📜", fontSize = 34.sp) },
            title = { Text("Ещё есть грамоты") },
            text = {
                Text(
                    "Не рассмотрено грамот: $pendingInbox. С новым днём они истекут. " +
                        "Всё равно листать?"
                )
            },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = { doAdvance() }) {
                    Text(if (newWeek) "Новая неделя" else "Листать день")
                }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { confirmAdvance = false }) {
                    Text("Ещё гляну")
                }
            }
        )
    }
}
