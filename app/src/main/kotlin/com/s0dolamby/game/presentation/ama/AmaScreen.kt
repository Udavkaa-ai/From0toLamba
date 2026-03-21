package com.s0dolamby.game.presentation.ama

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.runtime.getValue
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.R
import com.s0dolamby.game.domain.model.AmaMessage
import com.s0dolamby.game.domain.model.MessageRole
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue

// ─── Background selection ─────────────────────────────────────────────────────

private fun besedaBackground(archetype: PersonaArchetype?): Int = when (archetype) {
    PersonaArchetype.BURATINO   -> R.drawable.beseda_buratino
    PersonaArchetype.BOYARIN    -> R.drawable.beseda_boyarin
    PersonaArchetype.KOLOBOK    -> R.drawable.beseda_kolobok
    PersonaArchetype.KOSCHEI    -> R.drawable.beseda_koschei
    PersonaArchetype.ZOLUSHKA   -> R.drawable.beseda_zolushka
    PersonaArchetype.BABA_YAGA  -> R.drawable.beseda_baba_yaga
    PersonaArchetype.IVAN_DURAK -> R.drawable.beseda_ivan_durak
    null                        -> R.drawable.beseda_buratino
}

// ─── Question templates ───────────────────────────────────────────────────────

private val questionTemplates = listOf(
    "Сколько реально зарабатывают участники в день?",
    "Сколько сейчас вкладчиков в деле?",
    "Когда точно будут первые выплаты?",
    "Кто в артели? Можно проверить?",
    "Дело проверено старейшинами или воеводой?",
    "Есть ли ограничения на вывод рублей?",
    "Кто ваши покровители и партнёры?",
    "Почему доходность такая высокая?",
    "Что будет, если дело не пойдёт?",
    "Покажи книгу учёта доходов и расходов?"
)

// ─── Screen ──────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AmaScreen(
    onBack: () -> Unit,
    onOpenRegistry: () -> Unit = {},
    viewModel: AmaViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var inputText by remember { mutableStateOf("") }
    var usedTemplates by remember { mutableStateOf(emptySet<String>()) }
    val listState = rememberLazyListState()
    val snackbarHostState = remember { SnackbarHostState() }

    val messages = uiState.session?.messages ?: emptyList()
    val questionCount = uiState.session?.questionCount ?: 0
    val sessionEnded = questionCount >= GameConfig.AMA_MAX_QUESTIONS

    // Scroll so the latest message is visible above the bottom bar
    LaunchedEffect(messages.size, sessionEnded) {
        if (messages.isNotEmpty()) {
            // items layout: [messages..., sessionEndBanner? (if ended), trailingSpacer]
            val targetIndex = messages.size // spacer after last message (or banner when ended)
            listState.animateScrollToItem(targetIndex)
        }
    }

    val bgRes = besedaBackground(uiState.project?.personaArchetype)

    Box(modifier = Modifier.fillMaxSize()) {
        Image(
            painter = painterResource(bgRes),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(colorStops = arrayOf(
                    0f to Color(0xD9060412), 0.4f to Color(0xBF0A0818), 1f to Color(0xF0060412)
                ))
            )
        )

    Scaffold(
        containerColor = Color.Transparent,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            uiState.project?.developerName ?: "Беседа",
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "«${uiState.project?.claimedName}» • вопрос $questionCount/${GameConfig.AMA_MAX_QUESTIONS}",
                            style = MaterialTheme.typography.labelSmall,
                            color = FairyGold.copy(alpha = 0.8f)
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Назад", tint = Color.White)
                    }
                },
                actions = {
                    if (!sessionEnded) {
                        TextButton(onClick = viewModel::showInvestSheet) {
                            Text("Вложить", color = FairyGold, fontWeight = FontWeight.SemiBold)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        },
        bottomBar = {
            Box(
                modifier = Modifier.background(
                    Brush.verticalGradient(listOf(Color.Transparent, Color(0xF0060412)))
                )
            ) {
                Column {
                    // Question templates
                    if (!sessionEnded && !uiState.isSending) {
                        QuestionTemplateRow(
                            usedTemplates = usedTemplates,
                            onTemplateClick = { question ->
                                usedTemplates = usedTemplates + question
                                viewModel.sendMessage(question)
                            }
                        )
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                            .navigationBarsPadding()
                            .imePadding(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = inputText,
                            onValueChange = { inputText = it },
                            modifier = Modifier.weight(1f),
                            placeholder = { Text("Задайте вопрос...", color = Color.White.copy(alpha = 0.4f)) },
                            maxLines = 3,
                            enabled = !uiState.isSending && !sessionEnded,
                            shape = RoundedCornerShape(20.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = FairyGold,
                                unfocusedBorderColor = Color.White.copy(alpha = 0.25f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                cursorColor = FairyGold,
                                focusedContainerColor = Color.White.copy(alpha = 0.06f),
                                unfocusedContainerColor = Color.White.copy(alpha = 0.04f)
                            ),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                            keyboardActions = KeyboardActions(onSend = {
                                if (inputText.isNotBlank()) {
                                    viewModel.sendMessage(inputText.trim())
                                    inputText = ""
                                }
                            })
                        )
                        Spacer(Modifier.width(8.dp))
                        val sendScale by animateFloatAsState(
                            targetValue = if (inputText.isNotBlank() && !uiState.isSending) 1f else 0.85f,
                            animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
                            label = "send_scale"
                        )
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .background(
                                    if (inputText.isNotBlank() && !uiState.isSending)
                                        Brush.radialGradient(listOf(FairyGold, FairyGold.copy(alpha = 0.7f)))
                                    else
                                        Brush.radialGradient(listOf(Color.White.copy(0.15f), Color.White.copy(0.1f))),
                                    shape = RoundedCornerShape(50)
                                )
                                .then(Modifier.graphicsLayer(scaleX = sendScale, scaleY = sendScale)),
                            contentAlignment = Alignment.Center
                        ) {
                            IconButton(
                                onClick = {
                                    if (inputText.isNotBlank()) {
                                        viewModel.sendMessage(inputText.trim())
                                        inputText = ""
                                    }
                                },
                                enabled = inputText.isNotBlank() && !uiState.isSending
                            ) {
                                if (uiState.isSending) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(20.dp),
                                        strokeWidth = 2.dp,
                                        color = FairyGold
                                    )
                                } else {
                                    Icon(
                                        Icons.Default.Send,
                                        "Отправить",
                                        tint = if (inputText.isNotBlank()) NightBlue else Color.White.copy(0.4f)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    ) { padding ->
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (messages.isEmpty()) {
                item {
                    WelcomeMessage(
                        projectName = uiState.project?.claimedName ?: "",
                        devName = uiState.project?.developerName ?: ""
                    )
                }
            }
            items(messages) { msg ->
                MessageBubble(message = msg)
            }
            if (sessionEnded) {
                item {
                    SessionEndBanner(
                        onInvest = viewModel::showInvestSheet,
                        onBack = onBack
                    )
                }
            }
            // Trailing spacer — ensures last message stays above the bottom bar
            item { Spacer(Modifier.height(24.dp)) }
        }
    }

    // Invest bottom sheet
    if (uiState.showInvestSheet) {
        InvestBottomSheet(
            onDismiss = viewModel::hideInvestSheet,
            onInvest = { amount -> viewModel.invest(amount) }
        )
    }

    // Error snackbar
    uiState.error?.let { error ->
        LaunchedEffect(error) {
            snackbarHostState.showSnackbar(message = error, duration = SnackbarDuration.Short)
            viewModel.clearError()
        }
    }

    // Invest result: show snackbar then close screen
    uiState.investResult?.let { result ->
        LaunchedEffect(result) {
            snackbarHostState.showSnackbar(message = result, duration = SnackbarDuration.Short)
            viewModel.clearInvestResult()
            onBack()
        }
    }
    } // Box background
}

// ─── Question template row ────────────────────────────────────────────────────

@Composable
private fun QuestionTemplateRow(
    usedTemplates: Set<String>,
    onTemplateClick: (String) -> Unit
) {
    val remaining = questionTemplates.filter { it !in usedTemplates }
    if (remaining.isEmpty()) return

    // Split into two rows: even indices top, odd indices bottom
    val topRow = remaining.filterIndexed { i, _ -> i % 2 == 0 }
    val bottomRow = remaining.filterIndexed { i, _ -> i % 2 == 1 }

    Column(
        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            topRow.forEach { question -> TemplateChip(question, onTemplateClick) }
        }
        if (bottomRow.isNotEmpty()) {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                bottomRow.forEach { question -> TemplateChip(question, onTemplateClick) }
            }
        }
    }
}

@Composable
private fun TemplateChip(question: String, onClick: (String) -> Unit) {
    SuggestionChip(
        onClick = { onClick(question) },
        label = {
            Text(
                question.take(36).let { if (question.length > 36) "$it…" else it },
                style = MaterialTheme.typography.labelSmall,
                color = FairyGold.copy(alpha = 0.9f)
            )
        },
        border = SuggestionChipDefaults.suggestionChipBorder(
            enabled = true,
            borderColor = FairyGold.copy(alpha = 0.4f)
        ),
        colors = SuggestionChipDefaults.suggestionChipColors(
            containerColor = FairyGold.copy(alpha = 0.08f)
        )
    )
}

// ─── Supporting composables ───────────────────────────────────────────────────

@Composable
private fun MessageBubble(message: AmaMessage) {
    val isUser = message.role == MessageRole.USER
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(200)) + slideInVertically(tween(200)) { it / 2 }
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
        ) {
            val bubbleShape = RoundedCornerShape(
                topStart = 18.dp, topEnd = 18.dp,
                bottomStart = if (isUser) 18.dp else 4.dp,
                bottomEnd = if (isUser) 4.dp else 18.dp
            )
            if (isUser) {
                Box(
                    modifier = Modifier
                        .widthIn(max = 280.dp)
                        .background(
                            Brush.linearGradient(listOf(FairyGold.copy(alpha = 0.85f), FairyGold.copy(alpha = 0.65f))),
                            shape = bubbleShape
                        )
                        .padding(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    Text(
                        text = message.content,
                        style = MaterialTheme.typography.bodyMedium,
                        color = NightBlue,
                        fontWeight = FontWeight.Medium
                    )
                }
            } else {
                Box(
                    modifier = Modifier
                        .widthIn(max = 280.dp)
                        .background(
                            Brush.linearGradient(listOf(EnchantedPurple.copy(0.90f), NightBlue.copy(0.95f))),
                            shape = bubbleShape
                        )
                        .border(1.dp, FairyGold.copy(alpha = 0.18f), bubbleShape)
                        .padding(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    Text(
                        text = message.content,
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.92f)
                    )
                }
            }
        }
    }
}

@Composable
private fun WelcomeMessage(projectName: String, devName: String) {
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("✦", color = FairyGold, fontSize = 16.sp)
            Text("Начало беседы", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = FairyGold)
            Text("✦", color = FairyGold, fontSize = 16.sp)
        }
        Spacer(Modifier.height(6.dp))
        OrnamentDivider()
        Spacer(Modifier.height(8.dp))
        Text(
            "Тебя ждёт Делец, хозяин дела «$projectName».\nЗовут его: $devName",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "У тебя ${GameConfig.AMA_MAX_QUESTIONS} вопросов — узнай правду и реши, стоит ли вкладывать рубли.",
            style = MaterialTheme.typography.bodySmall,
            color = Color.White.copy(alpha = 0.65f)
        )
    }
}

@Composable
private fun SessionEndBanner(onInvest: () -> Unit, onBack: () -> Unit) {
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("✦", color = FairyGold, fontSize = 16.sp)
            Text("Беседа окончена", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
        }
        Text(
            "Ваш вердикт? Вложите рубли или откажитесь.",
            style = MaterialTheme.typography.bodySmall,
            color = Color.White.copy(alpha = 0.7f)
        )
        Spacer(Modifier.height(4.dp))
        Button(
            onClick = onInvest,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = FairyGold)
        ) {
            Text("Вложить рубли", color = NightBlue, fontWeight = FontWeight.Bold)
        }
        OutlinedButton(
            onClick = onBack,
            modifier = Modifier.fillMaxWidth(),
            border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.5f))
        ) {
            Text("Не вкладывать", color = FairyGold)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InvestBottomSheet(onDismiss: () -> Unit, onInvest: (Double) -> Unit) {
    var amountText by remember { mutableStateOf("") }
    val amount = amountText.toDoubleOrNull()

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier.padding(horizontal = 24.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("Вложить рубли", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(
                value = amountText,
                onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                label = { Text("Сумма в рублях") },
                suffix = { Text("₽") },
                modifier = Modifier.fillMaxWidth()
            )
            Text(
                "Минимум 5 ₽ • Максимум 5 000 ₽",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Button(
                onClick = { amount?.let { onInvest(it) } },
                enabled = amount != null && amount >= 5.0 && amount <= 5000.0,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Вложить")
            }
        }
    }
}
