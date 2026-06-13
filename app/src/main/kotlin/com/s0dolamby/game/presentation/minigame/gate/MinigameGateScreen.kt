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
    private val gameStateRepository: GameStateRepository
) : ViewModel() {

    val archetypeTokens: StateFlow<Map<PersonaArchetype, Int>> =
        gameStateRepository.observeGameState()
            .map { it.archetypeTokens }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

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
                store.record(projectId, MinigameOutcome(isWin = true, isPerfect = false))
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
    viewModel: MinigameGateViewModel = hiltViewModel()
) {
    val tokens by viewModel.archetypeTokens.collectAsState()
    val tokenCount = tokens[archetype] ?: 0

    // Если есть жетон — стартуем с экрана выбора. Иначе сразу в игру.
    var phase by remember(projectId) {
        mutableStateOf(if (tokenCount > 0) GatePhase.INTRO else GatePhase.PLAYING)
    }
    var finished by remember(projectId) { mutableStateOf<MinigameOutcome?>(null) }

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
            GateResultScreen(
                outcome = outcome,
                archetype = archetype,
                onBack = onBack,
                onContinueToInvest = onContinueToInvest,
                onPlayAgain = {
                    finished = null
                    phase = GatePhase.PLAYING
                }
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
                "🤝  Знакомый делец",
                color = FairyGold,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "У тебя есть жетон $short — ${tokenCount} шт. " +
                    "Можно сыграть в его мини-игру или заплатить 1 жетон, " +
                    "чтобы дельца уважить и сразу подойти к делу.",
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
                Text("🪙  Заплатить 1 жетон $short", fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                onClick = onPlayMinigame,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("🎲  Сыграть в мини-игру", color = FairyGold)
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
                Text("Назад", color = Color.White.copy(alpha = 0.7f))
            }
        }
    }
}

@Composable
private fun GateResultScreen(
    outcome: MinigameOutcome,
    archetype: PersonaArchetype,
    onBack: () -> Unit,
    onContinueToInvest: () -> Unit,
    onPlayAgain: () -> Unit
) {
    val title = when {
        outcome.isPerfect -> "✨ Идеально"
        outcome.isWin -> "✓ Можно вкладываться"
        else -> "✗ Дельца раскусить не вышло"
    }
    val body = when {
        outcome.isPerfect ->
            "Делец восхищён — раскрыл тебе и посул, и тип дела. " +
                "Жетон ${archetype.shortName()} в копилку."
        outcome.isWin ->
            "Делец позволяет вложиться, но карт не раскрывает. Решай по чуйке."
        else ->
            "Делец отказывает в сделке. Тут позже появится «Смотреть рекламу — обойти»."
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
            Spacer(Modifier.height(22.dp))
            if (outcome.isWin) {
                Button(
                    onClick = onContinueToInvest,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = FairyGold,
                        contentColor = NightBlue
                    )
                ) { Text("Вложить гроши", fontWeight = FontWeight.SemiBold) }
                Spacer(Modifier.height(8.dp))
            } else {
                Button(
                    onClick = onPlayAgain,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = FairyGold,
                        contentColor = NightBlue
                    )
                ) { Text("Сыграть ещё раз", fontWeight = FontWeight.SemiBold) }
                Spacer(Modifier.height(8.dp))
            }
            OutlinedButton(onClick = onBack) { Text("Назад") }
        }
    }
}

private fun PersonaArchetype.shortName(): String = when (this) {
    PersonaArchetype.BURATINO -> "Буратино"
    PersonaArchetype.BOYARIN -> "Боярина"
    PersonaArchetype.KOSCHEI -> "Кощея"
    PersonaArchetype.KOLOBOK -> "Колобка"
    PersonaArchetype.ZOLUSHKA -> "Золушки"
    PersonaArchetype.BABA_YAGA -> "Бабы-Яги"
    PersonaArchetype.IVAN_DURAK -> "Ивана"
}
