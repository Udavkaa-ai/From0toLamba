package com.s0dolamby.game.presentation.minigame.gate

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.data.minigame.MinigameUnlockStore
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.minigame.babayaga.BabaYagaCauldronScreen
import com.s0dolamby.game.presentation.minigame.boyarin.BoyarinCharterScreen
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import com.s0dolamby.game.presentation.minigame.goldenkey.GoldenKeyScreen
import com.s0dolamby.game.presentation.minigame.ivandurak.IvanDurakMapScreen
import com.s0dolamby.game.presentation.minigame.kolobok.KolobokNoraScreen
import com.s0dolamby.game.presentation.minigame.koschei.KoscheiMemoryScreen
import com.s0dolamby.game.presentation.minigame.zolushka.ZolushkaCoinsScreen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MinigameGateViewModel @Inject constructor(
    private val store: MinigameUnlockStore,
    private val gameStateRepository: GameStateRepository,
    private val settingsRepository: com.s0dolamby.game.domain.repository.SettingsRepository
) : ViewModel() {

    val archetypeTokens: StateFlow<Map<PersonaArchetype, Int>> =
        gameStateRepository.observeGameState()
            .map { it.archetypeTokens }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    /** Дело по id — чтобы на экране результата показать раскрытые параметры
     *  (тип за победу, посул за идеал) без захода в беседу. */
    fun projectFlow(projectId: String): StateFlow<com.s0dolamby.game.domain.model.Project?> =
        gameStateRepository.observeGameState()
            .map { st -> (st.pendingInbox + st.activeProjects).firstOrNull { it.id == projectId } }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    /** null — грузим флаг; true — показать мини-тур первого дела; false — уже видели. */
    private val _firstDealTourPending = MutableStateFlow<Boolean?>(null)
    val firstDealTourPending: StateFlow<Boolean?> = _firstDealTourPending.asStateFlow()

    init {
        viewModelScope.launch {
            _firstDealTourPending.value = !settingsRepository.getSettings().firstDealTourShown
        }
    }

    fun markFirstDealTourShown() {
        _firstDealTourPending.value = false
        viewModelScope.launch {
            val s = settingsRepository.getSettings()
            if (!s.firstDealTourShown) {
                settingsRepository.updateSettings(s.copy(firstDealTourShown = true))
            }
        }
    }

    /** Уже сохранённый результат мини-игры этого дела (если игра прошла раньше). */
    fun storedOutcome(projectId: String): MinigameOutcome? = store.outcomeFor(projectId)

    fun record(projectId: String, outcome: MinigameOutcome) {
        viewModelScope.launch { store.record(projectId, outcome) }
    }

    /**
     * Списать жетон архетипа и отметить дело как «прошедшее мини-игру»
     * без идеала. Возвращает true в [onSuccess], если списание прошло.
     */
    fun spendToken(
        archetype: PersonaArchetype,
        projectId: String,
        onSuccess: () -> Unit,
        onFailure: () -> Unit = {}
    ) {
        viewModelScope.launch {
            if (gameStateRepository.spendArchetypeToken(archetype)) {
                // isWin = errorCount <= 1 && !timeoutReached. Делаем «победу
                // не-идеал»: errorCount = 1, timeoutReached = false.
                store.record(projectId, MinigameOutcome(errorCount = 1, timeoutReached = false))
                onSuccess()
            } else {
                onFailure()
            }
        }
    }
}

private enum class GatePhase { INTRO, PLAYING, FINISHED }

/**
 * Обёртка-«gate» вокруг конкретной мини-игры. Берёт архетип и projectId,
 * показывает intro если есть жетон архетипа (даёт выбор: сыграть или
 * заплатить жетоном). После завершения пишет outcome в [MinigameUnlockStore]
 * и показывает экран «Что дальше».
 */
@Composable
fun MinigameGateScreen(
    archetype: PersonaArchetype,
    projectId: String,
    onBack: () -> Unit,
    onContinueToInvest: () -> Unit,
    onGoToChat: () -> Unit = {},
    viewModel: MinigameGateViewModel = hiltViewModel()
) {
    // Мини-тур первого дела — показываем ПЕРЕД гейтом, чтобы таймер мини-игры
    // не бежал под ним. Пока флаг грузится (null) — ничего не рисуем.
    val firstDealTour by viewModel.firstDealTourPending.collectAsState()
    when (firstDealTour) {
        null -> return
        true -> {
            FirstDealMiniTour(onDone = viewModel::markFirstDealTourShown)
            return
        }
        else -> Unit
    }

    val tokens by viewModel.archetypeTokens.collectAsState()
    val tokenCount = tokens[archetype] ?: 0
    val previousOutcome = viewModel.storedOutcome(projectId)

    // Если игра уже была сыграна — С ЛЮБЫМ исходом — сразу к экрану
    // результата: делец второго испытания не даёт (после провала инфу
    // можно добирать только в беседе). Иначе: жетон → выбор, нет → игра.
    var phase by remember(projectId) {
        mutableStateOf(when {
            previousOutcome != null -> GatePhase.FINISHED
            tokenCount > 0 -> GatePhase.INTRO
            else -> GatePhase.PLAYING
        })
    }
    var finished by remember(projectId) {
        mutableStateOf<MinigameOutcome?>(previousOutcome)
    }

    val handleOutcome: (MinigameOutcome) -> Unit = remember(projectId) {
        { outcome ->
            if (finished == null) {
                viewModel.record(projectId, outcome)
                finished = outcome
                phase = GatePhase.FINISHED
            }
        }
    }

    when (phase) {
        GatePhase.INTRO -> IntroChoiceScreen(
            archetype = archetype,
            tokenCount = tokenCount,
            onPlayMinigame = { phase = GatePhase.PLAYING },
            onSpendToken = {
                viewModel.spendToken(
                    archetype = archetype,
                    projectId = projectId,
                    onSuccess = { onContinueToInvest() }
                )
            },
            onBack = onBack
        )

        GatePhase.PLAYING -> when (archetype) {
            PersonaArchetype.BURATINO ->
                GoldenKeyScreen(onBack = onBack, onComplete = handleOutcome)
            PersonaArchetype.BOYARIN ->
                BoyarinCharterScreen(onBack = onBack, onComplete = handleOutcome)
            PersonaArchetype.KOSCHEI ->
                KoscheiMemoryScreen(onBack = onBack, onComplete = handleOutcome)
            PersonaArchetype.KOLOBOK ->
                KolobokNoraScreen(onBack = onBack, onComplete = handleOutcome)
            PersonaArchetype.ZOLUSHKA ->
                ZolushkaCoinsScreen(onBack = onBack, onComplete = handleOutcome)
            PersonaArchetype.BABA_YAGA ->
                BabaYagaCauldronScreen(onBack = onBack, onComplete = handleOutcome)
            PersonaArchetype.IVAN_DURAK ->
                IvanDurakMapScreen(onBack = onBack, onComplete = handleOutcome)
        }

        GatePhase.FINISHED -> finished?.let { outcome ->
            val projectFlow = remember(projectId) { viewModel.projectFlow(projectId) }
            val project by projectFlow.collectAsState()
            GateResultScreen(
                outcome = outcome,
                archetype = archetype,
                project = project,
                onBack = onBack,
                onContinueToInvest = onContinueToInvest,
                onGoToChat = onGoToChat
            )
        }
    }
}

@Composable
private fun IntroChoiceScreen(
    archetype: PersonaArchetype,
    tokenCount: Int,
    onPlayMinigame: () -> Unit,
    onSpendToken: () -> Unit,
    onBack: () -> Unit
) {
    val short = archetype.shortName()
    Box(
        modifier = Modifier.fillMaxSize().background(NightBlue),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .padding(24.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Brush.verticalGradient(listOf(EnchantedPurple, NightBlue)))
                .border(1.dp, FairyGold.copy(alpha = 0.4f), RoundedCornerShape(20.dp))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                Strings.t("gate.intro.title"),
                color = FairyGold,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(8.dp))
            Text(
                Strings.t("gate.intro.body", short, tokenCount),
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 13.sp,
                lineHeight = 18.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.widthIn(max = 280.dp)
            )
            Spacer(Modifier.height(20.dp))
            Button(
                onClick = onSpendToken,
                colors = ButtonDefaults.buttonColors(containerColor = FairyGold, contentColor = NightBlue),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(Strings.t("gate.intro.payToken", short), fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                onClick = onPlayMinigame,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(Strings.t("gate.intro.playGame"), color = FairyGold)
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
                Text(Strings.t("btn.back"), color = Color.White.copy(alpha = 0.7f))
            }
        }
    }
}

@Composable
private fun GateResultScreen(
    outcome: MinigameOutcome,
    archetype: PersonaArchetype,
    project: com.s0dolamby.game.domain.model.Project?,
    onBack: () -> Unit,
    onContinueToInvest: () -> Unit,
    onGoToChat: () -> Unit
) {
    val title = when {
        outcome.isPerfect -> Strings.t("gate.result.perfect.title")
        outcome.isWin -> Strings.t("gate.result.win.title")
        else -> Strings.t("gate.result.lose.title")
    }
    val body = when {
        outcome.isPerfect -> Strings.t("gate.result.perfect.body", archetype.shortName())
        outcome.isWin -> Strings.t("gate.result.win.body")
        else -> Strings.t("gate.result.lose.body")
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(NightBlue),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .padding(24.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(
                    Brush.verticalGradient(listOf(EnchantedPurple, NightBlue))
                )
                .border(1.dp, FairyGold.copy(alpha = 0.4f), RoundedCornerShape(20.dp))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                title,
                color = FairyGold,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(10.dp))
            Text(
                body,
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 13.sp,
                lineHeight = 18.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.widthIn(max = 260.dp)
            )
            // Раскрытые параметры дела прямо здесь: победа открывает тип,
            // идеал — ещё и посул. В беседу за этим идти не обязательно.
            if (outcome.isWin && project != null) {
                Spacer(Modifier.height(16.dp))
                GateRevealedParams(project = project, perfect = outcome.isPerfect)
            }
            Spacer(Modifier.height(22.dp))
            // Ретрая после провала НЕТ — делец второго испытания не даёт.
            // Вложиться можно всегда (после провала — вслепую), а беседа
            // остаётся способом выведать инфу и заработать «уговор».
            Button(
                onClick = onContinueToInvest,
                colors = ButtonDefaults.buttonColors(
                    containerColor = FairyGold,
                    contentColor = NightBlue
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    if (outcome.isWin) Strings.t("gate.btn.investNow")
                    else Strings.t("gate.btn.investBlind"),
                    fontWeight = FontWeight.SemiBold
                )
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                onClick = onGoToChat,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(Strings.t("gate.btn.chat"), color = FairyGold, maxLines = 1)
            }
            // Подпись про уговор — отдельной строкой, чтобы кнопка не переносилась
            Text(
                Strings.t("gate.chat.hint"),
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 11.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp)
            )
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
                Text(Strings.t("btn.back"), color = Color.White.copy(alpha = 0.7f))
            }
        }
    }
}

/** Раскрытые параметры дела на экране результата (с плавным появлением). */
@Composable
private fun GateRevealedParams(
    project: com.s0dolamby.game.domain.model.Project,
    perfect: Boolean
) {
    var show by remember { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(Unit) { show = true }
    androidx.compose.animation.AnimatedVisibility(
        visible = show,
        enter = androidx.compose.animation.fadeIn(androidx.compose.animation.core.tween(500)) +
            androidx.compose.animation.expandVertically(androidx.compose.animation.core.tween(400))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(FairyGold.copy(alpha = 0.08f))
                .border(1.dp, FairyGold.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                .padding(12.dp)
        ) {
            Text(
                Strings.t("gate.reveal.title"),
                color = FairyGold,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(6.dp))
            GateRevealRow(Strings.t("gate.reveal.type"), project.type.displayName)
            if (perfect) {
                Spacer(Modifier.height(4.dp))
                GateRevealRow(Strings.t("gate.reveal.apy"), "${project.claimedAPY.toInt()}%")
            }
        }
    }
}

@Composable
private fun GateRevealRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = Color.White.copy(alpha = 0.65f), fontSize = 12.sp)
        Text(value, color = FairyGold, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
@androidx.compose.runtime.ReadOnlyComposable
private fun PersonaArchetype.shortName(): String =
    Strings.t("gate.shortName.${this.name}")
