package com.s0dolamby.game.presentation.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
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
import com.s0dolamby.game.domain.repository.SettingsRepository
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.navigation.AppTab
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class InterfaceTourViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository,
    gameStateRepository: GameStateRepository
) : ViewModel() {

    /** Показывать тур, когда онбординг пройден, ник задан, а тур ещё не видели. */
    val shouldShow: StateFlow<Boolean> = combine(
        gameStateRepository.observeGameState().map { it.isOnboardingComplete },
        settingsRepository.observeSettings()
    ) { onboardingDone, s ->
        onboardingDone && s.nickname.isNotBlank() && !s.tourShown
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    fun markShown() {
        viewModelScope.launch {
            val cur = settingsRepository.getSettings()
            if (!cur.tourShown) settingsRepository.updateSettings(cur.copy(tourShown = true))
        }
    }
}

private data class TourStep(
    val emoji: String,
    val title: String,
    val body: String,
    /** Какую вкладку подсветить в макете нижней навигации; null — без подсветки. */
    val highlight: AppTab?
)

/**
 * Входной тур по интерфейсу: пошаговый спотлайт по вкладкам нижней
 * навигации. Показывается один раз после онбординга и ввода имени —
 * новичкам, чтобы понять «что куда зачем». Повторно можно запустить из
 * настроек. Рисует собственный макет нижней панели (реальную панель
 * закрывает затемнение), подсвечивая нужную вкладку на каждом шаге.
 */
@Composable
fun InterfaceTourOverlay(viewModel: InterfaceTourViewModel = hiltViewModel()) {
    val show by viewModel.shouldShow.collectAsState()
    if (!show) return

    val steps = listOf(
        TourStep("🗺", Strings.t("tour.intro.title"), Strings.t("tour.intro.body"), null),
        TourStep("🏠", Strings.t("tour.home.title"), Strings.t("tour.home.body"), AppTab.HOME),
        TourStep("📜", Strings.t("tour.inbox.title"), Strings.t("tour.inbox.body"), AppTab.INBOX),
        TourStep("💰", Strings.t("tour.portfolio.title"), Strings.t("tour.portfolio.body"), AppTab.PORTFOLIO),
        TourStep("📊", Strings.t("tour.stats.title"), Strings.t("tour.stats.body"), AppTab.STATS),
        TourStep("🔥", Strings.t("tour.today.title"), Strings.t("tour.today.body"), AppTab.TODAY),
        TourStep("🌅", Strings.t("tour.outro.title"), Strings.t("tour.outro.body"), null)
    )

    var step by remember { mutableStateOf(0) }
    val current = steps[step]
    val isLast = step == steps.lastIndex

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xF00A0620))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {},
        contentAlignment = Alignment.Center
    ) {
        // Макет нижней панели с подсветкой текущей вкладки — внизу, как настоящая.
        Box(modifier = Modifier.align(Alignment.BottomCenter)) {
            TourNavReplica(highlight = current.highlight)
        }

        // Карточка-пояснение
        Column(
            modifier = Modifier
                .align(Alignment.Center)
                .padding(horizontal = 24.dp)
                .widthIn(max = 360.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Brush.verticalGradient(listOf(EnchantedPurple, NightBlue)))
                .border(1.dp, FairyGold.copy(alpha = 0.45f), RoundedCornerShape(20.dp))
                .padding(22.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(current.emoji, fontSize = 34.sp)
            Spacer(Modifier.height(8.dp))
            Text(
                current.title,
                color = FairyGold,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(8.dp))
            Text(
                current.body,
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 14.sp,
                lineHeight = 19.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(16.dp))

            // Точки-прогресс
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                steps.indices.forEach { i ->
                    Box(
                        modifier = Modifier
                            .size(if (i == step) 9.dp else 6.dp)
                            .clip(CircleShape)
                            .background(if (i == step) FairyGold else Color.White.copy(alpha = 0.25f))
                    )
                }
            }
            Spacer(Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (step > 0) {
                    OutlinedButton(onClick = { step-- }, modifier = Modifier.weight(1f)) {
                        Text(Strings.t("tour.back"), color = Color.White.copy(alpha = 0.8f))
                    }
                }
                Button(
                    onClick = { if (isLast) viewModel.markShown() else step++ },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = FairyGold, contentColor = NightBlue)
                ) {
                    Text(
                        if (isLast) Strings.t("tour.done") else Strings.t("tour.next"),
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
            if (!isLast) {
                Spacer(Modifier.height(4.dp))
                Text(
                    Strings.t("tour.skip"),
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp,
                    modifier = Modifier
                        .clickable { viewModel.markShown() }
                        .padding(6.dp)
                )
            }
        }
    }
}

/** Копия нижней панели для тура: подсвечивает [highlight], остальные приглушены. */
@Composable
private fun TourNavReplica(highlight: AppTab?) {
    val items = listOf(
        Triple(AppTab.HOME, "🏠", Strings.t("nav.home")),
        Triple(AppTab.INBOX, "📜", Strings.t("nav.inbox")),
        Triple(AppTab.PORTFOLIO, "💰", Strings.t("nav.portfolio")),
        Triple(AppTab.STATS, "📊", Strings.t("nav.stats")),
        Triple(AppTab.TODAY, "🔥", Strings.t("nav.today"))
    )
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF060412))
            .padding(top = 8.dp, bottom = 10.dp)
    ) {
        items.forEach { (tab, emoji, label) ->
            val on = tab == highlight
            Box(
                modifier = Modifier.weight(1f).padding(vertical = 4.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    if (on) {
                        Box(
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(FairyGold.copy(alpha = 0.22f))
                                .border(2.dp, FairyGold, CircleShape)
                                .padding(7.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(emoji, fontSize = 22.sp)
                        }
                    } else {
                        Text(emoji, fontSize = 20.sp, modifier = Modifier.alpha(0.3f))
                    }
                    Spacer(Modifier.height(3.dp))
                    Text(
                        label,
                        fontSize = 10.sp,
                        color = if (on) FairyGold else Color.White.copy(alpha = 0.35f),
                        fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal
                    )
                }
            }
        }
    }
}
