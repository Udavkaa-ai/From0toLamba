package com.s0dolamby.game.presentation.onboarding

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.R
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.usecase.GenerateProjectUseCase
import com.s0dolamby.game.domain.usecase.InvestUseCase
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.theme.FairyGold
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val gameStateRepository: GameStateRepository,
    private val generateProjectUseCase: GenerateProjectUseCase,
    private val investUseCase: InvestUseCase
) : ViewModel() {

    private val _step = MutableStateFlow(0)
    val step: StateFlow<Int> = _step.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun nextStep() = _step.update { it + 1 }

    fun finishOnboarding(onDone: () -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            val state = gameStateRepository.getGameState()
            gameStateRepository.updateBalance(state.balance + GameConfig.ONBOARDING_BONUS_RUBLES)
            gameStateRepository.completeOnboarding()
            _isLoading.value = false
            onDone()
        }
    }
}

@Composable
fun OnboardingScreen(
    onDone: () -> Unit,
    viewModel: OnboardingViewModel = hiltViewModel()
) {
    val step by viewModel.step.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    val steps = listOf(
        OnboardingStep(
            title = "Добро пожаловать!",
            body = "Ты — прохожий с пустым кошелём. Вокруг — дельцы с предложениями вложить рубли в их дела.\n\nБольшинство из них — мошенники. Твоя задача — научиться отличать честное дело от обмана и приумножить своё состояние.",
            emoji = "🍺"
        ),
        OnboardingStep(
            title = "Беседа с Дельцом",
            body = "Прежде чем вложить рубли, поговори с Дельцом — хозяином дела.\n\nУ тебя до 10 вопросов. Делец знает судьбу своего дела заранее, но скрывает это. Читай между строк — ищи красные флаги и противоречия.",
            emoji = "💬"
        ),
        OnboardingStep(
            title = "Как растёт купеческий чин",
            body = "Твой чин — мера опыта и удачи:\n\n🐣 Скоморох → начало пути\n📣 Купец → первые вложения\n🔍 Мудрец → 5 дней + 2 раза разоблачил обман\n🦈 Богатырь → 10 дней + 4 разоблачения\n👑 Царь → 20 дней + 8 разоблачений\n\nЦель — дойти до чина Царя.",
            emoji = "🏆"
        ),
        OnboardingStep(
            title = "Первый заработок!",
            body = "За участие в первой беседе тебе выплачивается ${GameConfig.ONBOARDING_BONUS_RUBLES.toInt()} рублей — вне зависимости от того, вложил ли ты их.\n\nВпереди десятки дел. Каждый Делец обещает золотые горы. Приумножай казну и иди к чину Царя!",
            emoji = "🎉"
        )
    )

    ScreenBackground(R.drawable.onboarding_bg) {
    Scaffold(containerColor = Color.Transparent) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            Spacer(Modifier.height(40.dp))

            // Step indicator dots
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                steps.indices.forEach { i ->
                    Box(modifier = Modifier.size(if (i == step) 12.dp else 8.dp).padding(2.dp)) {
                        Surface(
                            modifier = Modifier.fillMaxSize(),
                            shape = RoundedCornerShape(50),
                            color = if (i == step) FairyGold else Color.White.copy(alpha = 0.25f)
                        ) {}
                    }
                }
            }

            if (step < steps.size) {
                val current = steps[step]

                // Re-key on step so animations replay on every step change
                key(step) {
                    var emojiVisible  by remember { mutableStateOf(false) }
                    var titleVisible  by remember { mutableStateOf(false) }
                    var cardVisible   by remember { mutableStateOf(false) }

                    LaunchedEffect(Unit) {
                        emojiVisible = true
                        delay(100)
                        titleVisible = true
                        delay(100)
                        cardVisible = true
                    }

                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Emoji — bounces down from above
                        AnimatedVisibility(
                            visible = emojiVisible,
                            enter = slideInVertically(
                                animationSpec = spring(
                                    dampingRatio = Spring.DampingRatioMediumBouncy,
                                    stiffness = Spring.StiffnessMediumLow
                                ),
                                initialOffsetY = { -it * 2 }
                            ) + fadeIn(tween(200))
                        ) {
                            Text(
                                current.emoji,
                                style = MaterialTheme.typography.headlineLarge,
                                modifier = Modifier.padding(top = 24.dp)
                            )
                        }

                        OrnamentDivider()

                        // Title — fades in
                        AnimatedVisibility(
                            visible = titleVisible,
                            enter = fadeIn(tween(280))
                        ) {
                            Text(
                                current.title,
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center,
                                color = Color.White
                            )
                        }

                        // Card — slides up from below
                        AnimatedVisibility(
                            visible = cardVisible,
                            enter = slideInVertically(
                                animationSpec = spring(
                                    dampingRatio = Spring.DampingRatioMediumBouncy,
                                    stiffness = Spring.StiffnessMedium
                                ),
                                initialOffsetY = { it / 2 }
                            ) + fadeIn(tween(320))
                        ) {
                            FairyCard(modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    current.body,
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = Color.White.copy(alpha = 0.9f)
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.weight(1f))

                Button(
                    onClick = {
                        if (step < steps.size - 1) viewModel.nextStep()
                        else viewModel.finishOnboarding(onDone)
                    },
                    enabled = !isLoading,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = FairyGold,
                        contentColor = Color(0xFF1A0A00),
                        disabledContainerColor = FairyGold.copy(alpha = 0.35f),
                        disabledContentColor = Color(0xFF1A0A00).copy(alpha = 0.5f)
                    )
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color(0xFF1A0A00))
                        Spacer(Modifier.width(8.dp))
                    }
                    Text(
                        if (step < steps.size - 1) "Далее  ✦" else "Войти в кабак  ✦",
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
    } // ScreenBackground
}

private data class OnboardingStep(val title: String, val body: String, val emoji: String)
