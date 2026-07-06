package com.s0dolamby.game.presentation.onboarding

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
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
    /** Куда перейти для этого шага (route экрана). */
    val route: String,
    /** Какой блок подсветить на этом экране; null — без спотлайта. */
    val target: TourTarget?
)

/**
 * Входной тур: сам ОТКРЫВАЕТ нужный экран на каждом шаге и подсвечивает на
 * нём конкретный блок (спотлайт — «дыра» в затемнении ровно по границам
 * реального элемента, их сообщают элементы через [tourAnchor]). Показывается
 * один раз после онбординга и ввода имени; повтор — из настроек.
 *
 * @param onNavigate переход по route (реализует NavGraph поверх navController).
 */
@Composable
fun InterfaceTourOverlay(
    onNavigate: (String) -> Unit,
    viewModel: InterfaceTourViewModel = hiltViewModel()
) {
    val show by viewModel.shouldShow.collectAsState()
    if (!show) return

    val steps = listOf(
        TourStep("🏠", Strings.t("tour.home.title"), Strings.t("tour.home.body"), "home", TourTarget.HOME_MAIN),
        TourStep("🌅", Strings.t("tour.nextday.title"), Strings.t("tour.nextday.body"), "home", TourTarget.NEXT_DAY),
        TourStep("🐞", Strings.t("tour.feedback.title"), Strings.t("tour.feedback.body"), "home", TourTarget.FEEDBACK),
        TourStep("📜", Strings.t("tour.inbox.title"), Strings.t("tour.inbox.body"), "inbox", TourTarget.INBOX_MAIN),
        TourStep("💰", Strings.t("tour.portfolio.title"), Strings.t("tour.portfolio.body"), "portfolio", TourTarget.PORTFOLIO_MAIN),
        TourStep("📊", Strings.t("tour.stats.title"), Strings.t("tour.stats.body"), "stats", TourTarget.STATS_MAIN),
        TourStep("🔥", Strings.t("tour.today.title"), Strings.t("tour.today.body"), "today", TourTarget.TODAY_MAIN),
        TourStep("⚙️", Strings.t("tour.settings.title"), Strings.t("tour.settings.body"), "settings", TourTarget.SETTINGS_PREFS),
        TourStep("♻️", Strings.t("tour.reset.title"), Strings.t("tour.reset.body"), "settings", TourTarget.SETTINGS_RESET),
        TourStep("🎉", Strings.t("tour.outro.title"), Strings.t("tour.outro.body"), "home", null)
    )

    var step by remember { mutableStateOf(0) }
    val current = steps[step]
    val isLast = step == steps.lastIndex
    val rect = current.target?.let { TourAnchors.bounds[it] }

    // Открываем экран текущего шага (эффект срабатывает при смене route).
    LaunchedEffect(current.route) { onNavigate(current.route) }

    val finish = {
        onNavigate("home")
        viewModel.markShown()
    }

    // Пульсация рамки вокруг подсвеченного элемента
    val pulse by rememberInfiniteTransition(label = "tourPulse").animateFloat(
        initialValue = 0.35f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "tourPulseAlpha"
    )

    val scrim = Color(0xF00A0620)

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {}
    ) {
        val screenH = constraints.maxHeight.toFloat()

        // Затемнение с «дырой» по элементу (четыре полосы вокруг — надёжнее
        // блендов и одинаково работает на всех устройствах) + золотая рамка.
        Canvas(modifier = Modifier.fillMaxSize()) {
            if (rect == null) {
                drawRect(scrim)
                return@Canvas
            }
            val pad = 8.dp.toPx()
            val l = (rect.left - pad).coerceAtLeast(0f)
            val t = (rect.top - pad).coerceAtLeast(0f)
            val r = (rect.right + pad).coerceAtMost(size.width)
            val b = (rect.bottom + pad).coerceAtMost(size.height)
            drawRect(scrim, Offset(0f, 0f), Size(size.width, t))
            drawRect(scrim, Offset(0f, b), Size(size.width, size.height - b))
            drawRect(scrim, Offset(0f, t), Size(l, b - t))
            drawRect(scrim, Offset(r, t), Size(size.width - r, b - t))
            drawRoundRect(
                color = FairyGold.copy(alpha = pulse),
                topLeft = Offset(l, t),
                size = Size(r - l, b - t),
                cornerRadius = CornerRadius(14.dp.toPx()),
                style = Stroke(width = 3.dp.toPx())
            )
        }

        // Карточка-пояснение — с противоположной от элемента стороны экрана.
        val alignment = when {
            rect == null -> Alignment.Center
            rect.center.y > screenH * 0.5f -> Alignment.TopCenter
            else -> Alignment.BottomCenter
        }
        Column(
            modifier = Modifier
                .align(alignment)
                .padding(horizontal = 24.dp, vertical = 44.dp)
                .widthIn(max = 360.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Brush.verticalGradient(listOf(EnchantedPurple, NightBlue)))
                .border(1.dp, FairyGold.copy(alpha = 0.45f), RoundedCornerShape(20.dp))
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(current.emoji, fontSize = 30.sp)
            Spacer(Modifier.height(6.dp))
            Text(
                current.title,
                color = FairyGold,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(6.dp))
            Text(
                current.body,
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 14.sp,
                lineHeight = 19.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                steps.indices.forEach { i ->
                    Box(
                        modifier = Modifier
                            .size(if (i == step) 8.dp else 5.dp)
                            .clip(CircleShape)
                            .background(if (i == step) FairyGold else Color.White.copy(alpha = 0.25f))
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (step > 0) {
                    OutlinedButton(onClick = { step-- }, modifier = Modifier.weight(1f)) {
                        Text(Strings.t("tour.back"), color = Color.White.copy(alpha = 0.8f))
                    }
                }
                Button(
                    onClick = { if (isLast) finish() else step++ },
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
                Spacer(Modifier.height(2.dp))
                Text(
                    Strings.t("tour.skip"),
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp,
                    modifier = Modifier.clickable { finish() }.padding(6.dp)
                )
            }
        }
    }
}
