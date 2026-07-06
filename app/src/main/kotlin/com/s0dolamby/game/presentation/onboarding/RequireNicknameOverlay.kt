package com.s0dolamby.game.presentation.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
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
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.LeaderboardRepository
import com.s0dolamby.game.domain.repository.SettingsRepository
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class RequireNicknameViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository,
    private val leaderboardRepository: LeaderboardRepository,
    gameStateRepository: GameStateRepository
) : ViewModel() {

    /**
     * Показывать гейт, если онбординг пройден, а ник так и не задан.
     * Ловит и старых игроков, обновившихся без ника, и новичков сразу
     * после онбординга. Пока null (грузимся) — ничего не показываем.
     */
    val needsNickname: StateFlow<Boolean> = combine(
        gameStateRepository.observeGameState().map { it.isOnboardingComplete },
        settingsRepository.observeSettings().map { it.nickname }
    ) { onboardingDone, nickname ->
        onboardingDone && nickname.isBlank()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    fun save(nickname: String) {
        val clean = nickname.take(20).trim()
        if (clean.length < 2) return
        viewModelScope.launch {
            val current = settingsRepository.getSettings()
            settingsRepository.updateSettings(current.copy(nickname = clean))
            // Сразу заявляемся в купеческий рейтинг с новым именем.
            leaderboardRepository.submitStanding()
        }
    }
}

/**
 * Обязательный ввод прозвища. Полноэкранный блокирующий оверлей: без
 * прозвища дальше не пройти (закрыть нельзя). Нужен, чтобы у каждого
 * купца было имя — для «Ярмарки недели», обращений дельцов и фидбека.
 */
@Composable
fun RequireNicknameOverlay(
    viewModel: RequireNicknameViewModel = hiltViewModel()
) {
    val needsNickname by viewModel.needsNickname.collectAsState()
    if (!needsNickname) return

    var text by remember { mutableStateOf("") }
    val valid = text.trim().length in 2..20

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xF00A0620))
            // Глотаем все тапы по фону, чтобы нельзя было ткнуть по экрану
            // под гейтом (нав, язычок тестеров) в обход обязательного ника.
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {},
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .padding(24.dp)
                .widthIn(max = 360.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Brush.verticalGradient(listOf(EnchantedPurple, NightBlue)))
                .border(1.dp, FairyGold.copy(alpha = 0.45f), RoundedCornerShape(20.dp))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("📜", fontSize = 32.sp)
            Spacer(Modifier.height(8.dp))
            Text(
                Strings.t("nick.require.title"),
                color = FairyGold,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(8.dp))
            Text(
                Strings.t("nick.require.body"),
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 13.sp,
                lineHeight = 18.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = text,
                onValueChange = { text = it.take(20) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text(Strings.t("nick.require.placeholder")) },
                // Оверлей на фиксированно-тёмной поверхности — цвета фиксированные
                // (белый текст / золото), не карточные локали.
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedBorderColor = FairyGold,
                    unfocusedBorderColor = FairyGold.copy(alpha = 0.5f),
                    cursorColor = FairyGold,
                    focusedPlaceholderColor = Color.White.copy(alpha = 0.5f),
                    unfocusedPlaceholderColor = Color.White.copy(alpha = 0.5f)
                )
            )
            Spacer(Modifier.height(6.dp))
            Text(
                Strings.t("nick.require.hint"),
                color = Color.White.copy(alpha = 0.55f),
                fontSize = 11.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { viewModel.save(text) },
                enabled = valid,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = FairyGold,
                    contentColor = NightBlue,
                    disabledContainerColor = FairyGold.copy(alpha = 0.35f),
                    disabledContentColor = NightBlue.copy(alpha = 0.5f)
                )
            ) {
                Text(Strings.t("nick.require.save"), fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
