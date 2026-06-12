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
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MinigameGateViewModel @Inject constructor(
    private val store: MinigameUnlockStore
) : ViewModel() {
    fun record(projectId: String, outcome: MinigameOutcome) {
        viewModelScope.launch {
            store.record(projectId, outcome)
        }
    }
}

/**
 * Обёртка-«gate» вокруг конкретной мини-игры. Берёт архетип и projectId,
 * диспатчит нужный экран, при завершении пишет outcome в [MinigameUnlockStore]
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
    var finished by remember { mutableStateOf<MinigameOutcome?>(null) }

    val handleOutcome: (MinigameOutcome) -> Unit = remember(projectId) {
        { outcome ->
            if (finished == null) {
                viewModel.record(projectId, outcome)
                finished = outcome
            }
        }
    }

    finished?.let { outcome ->
        // Игра уже завершена — показываем экран перехода. На «Ещё раз» внутри
        // самой игры outcome поменяется и мы перепишем поверх.
        GateResultScreen(
            outcome = outcome,
            archetype = archetype,
            onBack = onBack,
            onContinueToInvest = onContinueToInvest,
            onPlayAgain = { finished = null }
        )
        return
    }

    when (archetype) {
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
