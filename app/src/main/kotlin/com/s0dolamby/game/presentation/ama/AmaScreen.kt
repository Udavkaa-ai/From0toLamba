package com.s0dolamby.game.presentation.ama

import androidx.compose.foundation.background
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.domain.model.AmaMessage
import com.s0dolamby.game.domain.model.LieTopic
import com.s0dolamby.game.domain.model.MessageRole
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.Warning

// ─── Question templates ───────────────────────────────────────────────────────

private val questionTemplates = listOf(
    "Сколько реально зарабатывают пользователи в день?",
    "Сколько сейчас активных пользователей?",
    "Когда точно будет листинг и на какой бирже?",
    "Кто в команде? Можно проверить?",
    "Проект прошёл аудит смарт-контракта?",
    "Есть ли ограничения на вывод средств?",
    "Кто ваши партнёры и инвесторы?",
    "Почему доходность такая высокая?",
    "Что если экономика не взлетит?",
    "Где можно проверить смарт-контракт?"
)

// ─── LieTopic helpers ────────────────────────────────────────────────────────

private val LieTopic.displayName: String get() = when (this) {
    LieTopic.USER_COUNT -> "Кол-во пользователей"
    LieTopic.DAILY_YIELD -> "Доходность"
    LieTopic.LISTING_DATE -> "Дата листинга"
    LieTopic.TEAM_SIZE -> "Размер команды"
    LieTopic.AUDIT_STATUS -> "Аудит"
    LieTopic.PARTNER_STATUS -> "Партнёры"
    LieTopic.WITHDRAWAL_LIMITS -> "Лимиты вывода"
}

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

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(uiState.project?.developerName ?: "AMA сессия")
                        Text(
                            "${uiState.project?.claimedName} • вопрос $questionCount/${GameConfig.AMA_MAX_QUESTIONS}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") }
                },
                actions = {
                    TextButton(onClick = viewModel::showInvestSheet) {
                        Text("Инвестировать")
                    }
                }
            )
        },
        bottomBar = {
            Surface(tonalElevation = 2.dp) {
                Column {
                    // Question templates — visible only when session is active
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
                            .padding(8.dp)
                            .navigationBarsPadding()
                            .imePadding(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = inputText,
                            onValueChange = { inputText = it },
                            modifier = Modifier.weight(1f),
                            placeholder = { Text("Задайте вопрос...") },
                            maxLines = 3,
                            enabled = !uiState.isSending && !sessionEnded,
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                            keyboardActions = KeyboardActions(onSend = {
                                if (inputText.isNotBlank()) {
                                    viewModel.sendMessage(inputText.trim())
                                    inputText = ""
                                }
                            })
                        )
                        Spacer(Modifier.width(8.dp))
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
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.Send, "Отправить")
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
                        onSkip = viewModel::showLieGuessSheet
                    )
                }
            }

        }
    }

    // Invest bottom sheet
    if (uiState.showInvestSheet) {
        InvestBottomSheet(
            onDismiss = viewModel::hideInvestSheet,
            onInvest = { amount -> viewModel.invest(amount) }
        )
    }

    // Lie guess sheet
    if (uiState.showLieGuessSheet) {
        LieGuessSheet(
            result = uiState.lieGuessResult,
            onSubmit = { guesses -> viewModel.submitLieGuess(guesses) },
            onClose = {
                viewModel.closeLieGuessSheet()
                onBack()
            },
            onOpenRegistry = {
                viewModel.closeLieGuessSheet()
                onOpenRegistry()
            },
            onDismiss = viewModel::closeLieGuessSheet
        )
    }

    // Error snackbar
    uiState.error?.let { error ->
        LaunchedEffect(error) {
            snackbarHostState.showSnackbar(message = error, duration = SnackbarDuration.Short)
            viewModel.clearError()
        }
    }

    // Invest result snackbar
    uiState.investResult?.let { result ->
        LaunchedEffect(result) {
            snackbarHostState.showSnackbar(message = result, duration = SnackbarDuration.Short)
            viewModel.clearInvestResult()
        }
    }
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
                question.take(34).let { if (question.length > 34) "$it…" else it },
                style = MaterialTheme.typography.labelSmall
            )
        }
    )
}

// ─── Lie guess sheet ─────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun LieGuessSheet(
    result: LieGuessResult?,
    onSubmit: (Set<LieTopic>) -> Unit,
    onClose: () -> Unit,
    onOpenRegistry: () -> Unit = {},
    onDismiss: () -> Unit
) {
    var selectedTopics by remember { mutableStateOf(emptySet<LieTopic>()) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .padding(horizontal = 24.dp)
                .padding(bottom = 40.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (result == null) {
                // ── Selection mode ──
                Text("В чём соврал разраб?", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(
                    "Выбери темы, по которым тебя обманули. Угадаешь — получишь достижение.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    LieTopic.entries.forEach { topic ->
                        FilterChip(
                            selected = topic in selectedTopics,
                            onClick = {
                                selectedTopics = if (topic in selectedTopics)
                                    selectedTopics - topic
                                else
                                    selectedTopics + topic
                            },
                            label = { Text(topic.displayName) }
                        )
                    }
                }

                Button(
                    onClick = { onSubmit(selectedTopics) },
                    enabled = selectedTopics.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Проверить") }

                OutlinedButton(
                    onClick = onClose,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Пропустить") }

            } else {
                // ── Result mode ──
                val isSuccess = result.isSuccess
                Text(
                    if (isSuccess) "Отличный анализ!" else "Неплохо, но не всё",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (isSuccess) Success else MaterialTheme.colorScheme.onSurface
                )

                if (isSuccess) {
                    Surface(
                        color = Success.copy(alpha = 0.12f),
                        shape = MaterialTheme.shapes.medium
                    ) {
                        Text(
                            "Архетип разработчика добавлен в Энциклопедию!",
                            style = MaterialTheme.typography.bodySmall,
                            color = Success,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }

                // Correct guesses
                if (result.correct.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Угадал:", style = MaterialTheme.typography.labelMedium, color = Success)
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            result.correct.forEach { topic ->
                                Surface(
                                    color = Success.copy(alpha = 0.15f),
                                    shape = RoundedCornerShape(16.dp)
                                ) {
                                    Text(
                                        topic.displayName,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Success,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                // Missed (actual lies not guessed)
                if (result.missed.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Пропустил:", style = MaterialTheme.typography.labelMedium, color = Error)
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            result.missed.forEach { topic ->
                                Surface(
                                    color = Error.copy(alpha = 0.15f),
                                    shape = RoundedCornerShape(16.dp)
                                ) {
                                    Text(
                                        topic.displayName,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Error,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                // False positives
                if (result.falsePositives.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Лишнее:", style = MaterialTheme.typography.labelMedium, color = Warning)
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            result.falsePositives.forEach { topic ->
                                Surface(
                                    color = Warning.copy(alpha = 0.15f),
                                    shape = RoundedCornerShape(16.dp)
                                ) {
                                    Text(
                                        topic.displayName,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Warning,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                if (result.isSuccess) {
                    Button(
                        onClick = onOpenRegistry,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Открыть в энциклопедии") }
                    OutlinedButton(
                        onClick = onClose,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Закрыть") }
                } else {
                    Button(
                        onClick = onClose,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Закрыть") }
                }
            }
        }
    }
}

// ─── Supporting composables ───────────────────────────────────────────────────

@Composable
private fun MessageBubble(message: AmaMessage) {
    val isUser = message.role == MessageRole.USER
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .background(
                    color = if (isUser) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(
                        topStart = 16.dp, topEnd = 16.dp,
                        bottomStart = if (isUser) 16.dp else 4.dp,
                        bottomEnd = if (isUser) 4.dp else 16.dp
                    )
                )
                .padding(12.dp)
        ) {
            Text(
                text = message.content,
                style = MaterialTheme.typography.bodyMedium,
                color = if (isUser) MaterialTheme.colorScheme.onPrimary
                else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun WelcomeMessage(projectName: String, devName: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Text(
            "Привет! Это AMA-сессия с разработчиком проекта «$projectName».\n" +
                    "Разработчик: $devName\n\n" +
                    "У тебя есть ${GameConfig.AMA_MAX_QUESTIONS} вопросов, чтобы понять — стоит ли инвестировать.",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(16.dp)
        )
    }
}

@Composable
private fun SessionEndBanner(onInvest: () -> Unit, onSkip: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("AMA завершена. Ваш вердикт?", style = MaterialTheme.typography.titleMedium)
            Text(
                "Инвестируй TON или скипни — и попробуй угадать, в чём соврал разраб.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Button(onClick = onInvest, modifier = Modifier.fillMaxWidth()) {
                Text("Инвестировать")
            }
            OutlinedButton(onClick = onSkip, modifier = Modifier.fillMaxWidth()) {
                Text("Скипнуть → угадать обман")
            }
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
            Text("Инвестировать TON", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(
                value = amountText,
                onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                label = { Text("Сумма в TON") },
                suffix = { Text("TON") },
                modifier = Modifier.fillMaxWidth()
            )
            Text(
                "Минимум 0.1 TON • Максимум 50 TON",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Button(
                onClick = { amount?.let { onInvest(it) } },
                enabled = amount != null && amount >= 0.1 && amount <= 50.0,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Подтвердить инвестицию")
            }
        }
    }
}
