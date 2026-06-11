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
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Help
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.R
import com.s0dolamby.game.domain.model.AmaMessage
import com.s0dolamby.game.domain.model.LieTopic
import com.s0dolamby.game.domain.model.MessageRole
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.Success

// ─── LieTopic display helpers ────────────────────────────────────────────────

private val LieTopic.emoji: String get() = when (this) {
    LieTopic.PATRON_COUNT      -> "👥"
    LieTopic.DAILY_PROFIT      -> "💰"
    LieTopic.PAYOUT_DATE       -> "📅"
    LieTopic.GUILD_SIZE        -> "🏰"
    LieTopic.ELDER_BLESSING    -> "🔍"
    LieTopic.NOBLE_BACKING     -> "🤝"
    LieTopic.WITHDRAWAL_LIMITS -> "🔒"
}

private val LieTopic.label: String get() = when (this) {
    LieTopic.PATRON_COUNT      -> "Участники"
    LieTopic.DAILY_PROFIT      -> "Доход"
    LieTopic.PAYOUT_DATE       -> "Выплаты"
    LieTopic.GUILD_SIZE        -> "Артель"
    LieTopic.ELDER_BLESSING    -> "Проверка"
    LieTopic.NOBLE_BACKING     -> "Покровитель"
    LieTopic.WITHDRAWAL_LIMITS -> "Вывод"
}

private val LieTopic.legendHint: String get() = when (this) {
    LieTopic.PATRON_COUNT      -> "Врёт о числе вкладчиков"
    LieTopic.DAILY_PROFIT      -> "Завышает дневной доход"
    LieTopic.PAYOUT_DATE       -> "Называет ложные сроки выплат"
    LieTopic.GUILD_SIZE        -> "Приукрашивает размер команды"
    LieTopic.ELDER_BLESSING    -> "Выдуманная проверка старейшин"
    LieTopic.NOBLE_BACKING     -> "Несуществующие покровители"
    LieTopic.WITHDRAWAL_LIMITS -> "Скрывает ограничения на вывод"
}

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

// ─── Question pool ────────────────────────────────────────────────────────────

private val allQuestions = listOf(
    // Доходность
    "Сколько реально зарабатывают участники в день?",
    "Назови конкретную цифру дохода — сколько рублей в день на сотню вложенных?",
    "Откуда берётся такая высокая доходность?",
    "Почему у вас выгоднее, чем у конкурентов?",
    "Есть ли участник, готовый подтвердить свой доход?",
    // Вкладчики
    "Сколько сейчас вкладчиков в деле?",
    "Как давно самый первый вкладчик с тобой работает?",
    "Сколько человек вышло из дела за последний месяц и почему?",
    "Как быстро растёт число участников?",
    // Выплаты
    "Когда точно будут первые выплаты?",
    "Как выглядит процесс вывода рублей — шаги, сроки?",
    "Были ли когда-нибудь задержки выплат? По какой причине?",
    "Можно вывести рубли прямо сейчас, не дожидаясь срока?",
    // Команда
    "Кто в артели? Можно проверить их имена?",
    "Где можно найти информацию об основателях дела?",
    "Сколько человек работает над делом?",
    // Проверки и документы
    "Дело проверено старейшинами или воеводой?",
    "Есть ли какой-то официальный документ или грамота о деле?",
    "Покажи книгу учёта доходов и расходов",
    "Кто проверял ваши расчёты и подтвердил честность?",
    // Вывод и ограничения
    "Есть ли ограничения на вывод рублей?",
    "Почему нельзя вывести всё сразу?",
    "Что случится, если я захочу выйти из дела раньше срока?",
    // Покровители
    "Кто ваши покровители и партнёры?",
    "С кем из известных купцов или бояр вы работаете?",
    "Есть ли у дела поддержка от торговой гильдии или государства?",
    // Риски
    "Что будет, если дело не пойдёт?",
    "Как вы вернёте мои деньги, если что-то пойдёт не так?",
    "Были ли у тебя дела, которые провалились? Расскажи.",
    "Почему я должен тебе доверять?"
)

/** Per-session random subset — stays stable during one AMA session */
private fun pickSessionQuestions(sessionId: String?): List<String> {
    val seed = sessionId?.hashCode()?.toLong() ?: System.currentTimeMillis()
    val rng = java.util.Random(seed)
    return allQuestions.shuffled(rng).take(10)
}

// ─── Screen ──────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AmaScreen(
    onBack: () -> Unit,
    onOpenRegistry: () -> Unit = {},
    onPlayMinigame: (archetypeName: String, projectId: String) -> Unit = { _, _ -> },
    viewModel: AmaViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var inputText by remember { mutableStateOf("") }
    var usedTemplates by remember { mutableStateOf(emptySet<String>()) }
    val listState = rememberLazyListState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Реагируем на запрос инвеста при ещё не пройденной мини-игре
    LaunchedEffect(uiState.pendingMinigameArchetype) {
        val arch = uiState.pendingMinigameArchetype
        val pid = uiState.project?.id
        if (arch != null && pid != null) {
            onPlayMinigame(arch.name, pid)
            viewModel.clearPendingMinigame()
        }
    }

    val messages = uiState.session?.messages ?: emptyList()
    val questionCount = uiState.session?.questionCount ?: 0
    val sessionEnded = questionCount >= GameConfig.AMA_MAX_QUESTIONS

    val sessionQuestions = remember(uiState.session?.id) {
        pickSessionQuestions(uiState.session?.id)
    }

    LaunchedEffect(messages.size, sessionEnded) {
        if (messages.isNotEmpty()) {
            kotlinx.coroutines.delay(100)
            val trailingSpacerIndex = messages.size + (if (sessionEnded) 1 else 0)
            listState.scrollToItem(trailingSpacerIndex)
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
                        TextButton(onClick = viewModel::requestInvest) {
                            Text(
                                if (uiState.minigameUnlocked) "Вложить" else "🎲 Испытать",
                                color = FairyGold, fontWeight = FontWeight.SemiBold
                            )
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
                    if (!sessionEnded && !uiState.isSending) {
                        QuestionTemplateRow(
                            questions = sessionQuestions,
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
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // ── Чуйка strip — always visible ──────────────────────────────────
            IntuitionStrip(
                selectedTopics = uiState.selectedLieTopics,
                onToggle = viewModel::toggleLieTopic
            )

            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f),
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
                            onInvest = viewModel::requestInvest,
                            onEvaluate = viewModel::evaluateIntuition,
                            onBack = onBack,
                            intuitionEvaluated = uiState.session?.isIntuitionEvaluated == true
                        )
                    }
                }
                item { Spacer(Modifier.height(160.dp)) }
            }
        }
    }

    // Invest bottom sheet
    if (uiState.showInvestSheet) {
        InvestBottomSheet(
            freeBalance = uiState.freeBalance,
            onDismiss = viewModel::hideInvestSheet,
            onInvest = { amount -> viewModel.invest(amount) }
        )
    }

    // IntuitionResult dialog
    uiState.intuitionResult?.let { result ->
        IntuitionResultDialog(
            result = result,
            onDismiss = {
                viewModel.clearIntuitionResult()
                onBack()
            }
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

// ─── Intuition strip ──────────────────────────────────────────────────────────

@Composable
private fun IntuitionStrip(
    selectedTopics: Set<LieTopic>,
    onToggle: (LieTopic) -> Unit
) {
    var showLegend by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.Black.copy(alpha = 0.30f))
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                "👁 Чуйка",
                style = MaterialTheme.typography.labelSmall,
                color = FairyGold.copy(alpha = 0.8f),
                fontWeight = FontWeight.SemiBold
            )
            Text(
                "— в чём врёт делец?",
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.45f)
            )
            Spacer(Modifier.weight(1f))
            Icon(
                imageVector = Icons.Default.Help,
                contentDescription = "Легенда чуйки",
                tint = FairyGold.copy(alpha = 0.55f),
                modifier = Modifier
                    .size(16.dp)
                    .clickable { showLegend = true }
            )
        }
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            LieTopic.entries.forEach { topic ->
                val selected = topic in selectedTopics
                FilterChip(
                    selected = selected,
                    onClick = { onToggle(topic) },
                    label = {
                        Text(
                            topic.emoji,
                            style = MaterialTheme.typography.labelSmall
                        )
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Error.copy(alpha = 0.25f),
                        selectedLabelColor = Error,
                        containerColor = Color.White.copy(alpha = 0.06f),
                        labelColor = Color.White.copy(alpha = 0.55f)
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = selected,
                        selectedBorderColor = Error.copy(alpha = 0.5f),
                        borderColor = Color.White.copy(alpha = 0.15f)
                    )
                )
            }
        }
    }

    if (showLegend) {
        IntuitionLegendDialog(onDismiss = { showLegend = false })
    }
}

// ─── Intuition legend dialog ──────────────────────────────────────────────────

@Composable
private fun IntuitionLegendDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("👁 Чуйка — как работает", fontWeight = FontWeight.Bold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Отмечай пункты, в которых подозреваешь ложь. После беседы нажми «Оценить чуйку».",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.8f)
                )
                LieTopic.entries.forEach { topic ->
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Text(topic.emoji, style = MaterialTheme.typography.bodySmall)
                        Column {
                            Text(
                                topic.label,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White
                            )
                            Text(
                                topic.legendHint,
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.55f)
                            )
                        }
                    }
                }
                Text(
                    "✓ Угадал — +1 очко чуйки\n✗ Обвинил напрасно — −1 очко чуйки",
                    style = MaterialTheme.typography.bodySmall,
                    color = FairyGold.copy(alpha = 0.85f)
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Понятно") }
        }
    )
}

// ─── Intuition result dialog ──────────────────────────────────────────────────

@Composable
private fun IntuitionResultDialog(result: IntuitionResult, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                when {
                    result.deltaPoints > 0 -> "⚡ Чуйка не подвела!"
                    result.deltaPoints < 0 -> "💸 Чуйка подвела"
                    else -> "🤔 Без изменений"
                },
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Score delta
                val scoreColor = when {
                    result.deltaPoints > 0 -> Success
                    result.deltaPoints < 0 -> Error
                    else -> Color.White
                }
                Text(
                    "%+d очков чуйки".format(result.deltaPoints),
                    fontWeight = FontWeight.Bold,
                    color = scoreColor,
                    fontSize = 18.sp
                )

                if (result.correct.isNotEmpty()) {
                    Text(
                        "✓ Угадал: " + result.correct.joinToString(", ") { "${it.emoji} ${it.label}" },
                        style = MaterialTheme.typography.bodySmall,
                        color = Success
                    )
                }
                if (result.falseAccusations.isNotEmpty()) {
                    Text(
                        "✗ Напрасно обвинил: " + result.falseAccusations.joinToString(", ") { "${it.emoji} ${it.label}" },
                        style = MaterialTheme.typography.bodySmall,
                        color = Error
                    )
                    Text(
                        "Ты навредил доброму имени честного дельца.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.Gray
                    )
                }
                if (result.correct.isEmpty() && result.falseAccusations.isEmpty()) {
                    Text(
                        "Ты ничего не отметил — чуйка не получила ни испытания, ни оценки.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.Gray
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Понял") }
        }
    )
}

// ─── Question template row ────────────────────────────────────────────────────

@Composable
private fun QuestionTemplateRow(
    questions: List<String>,
    usedTemplates: Set<String>,
    onTemplateClick: (String) -> Unit
) {
    val remaining = questions.filter { it !in usedTemplates }
    if (remaining.isEmpty()) return

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
        Spacer(Modifier.height(4.dp))
        Text(
            "Отмечай в полоске «Чуйка» вверху, в чём подозреваешь ложь — и проверь себя в конце.",
            style = MaterialTheme.typography.bodySmall,
            color = FairyGold.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun SessionEndBanner(
    onInvest: () -> Unit,
    onEvaluate: () -> Unit,
    onBack: () -> Unit,
    intuitionEvaluated: Boolean
) {
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("✦", color = FairyGold, fontSize = 16.sp)
            Text("Беседа окончена", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
        }
        Text(
            "Что делаешь дальше?",
            style = MaterialTheme.typography.bodySmall,
            color = Color.White.copy(alpha = 0.7f)
        )
        Spacer(Modifier.height(4.dp))
        Button(
            onClick = onInvest,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = FairyGold)
        ) {
            Text("💰 Вложить рубли", color = NightBlue, fontWeight = FontWeight.Bold)
        }
        Button(
            onClick = onEvaluate,
            modifier = Modifier.fillMaxWidth(),
            enabled = !intuitionEvaluated,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF4A1A8A),
                disabledContainerColor = Color(0xFF4A1A8A).copy(alpha = 0.35f)
            )
        ) {
            Text(
                if (intuitionEvaluated) "👁 Чуйка уже оценена" else "👁 Оценить чуйку",
                color = if (intuitionEvaluated) Color.White.copy(alpha = 0.4f) else Color.White,
                fontWeight = FontWeight.Bold
            )
        }
        OutlinedButton(
            onClick = onBack,
            modifier = Modifier.fillMaxWidth(),
            border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.5f))
        ) {
            Text("Уйти", color = FairyGold)
        }
    }
}

private fun formatRubles(amount: Double): String = when {
    amount >= 1_000_000 -> "%.1fМ ₽".format(amount / 1_000_000)
    amount >= 1_000 -> "%.1fТ ₽".format(amount / 1_000)
    else -> "%.0f ₽".format(amount)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InvestBottomSheet(freeBalance: Double, onDismiss: () -> Unit, onInvest: (Double) -> Unit) {
    var amountText by remember { mutableStateOf("") }
    val amount = amountText.toDoubleOrNull()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier.padding(horizontal = 24.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Вложить рубли", style = MaterialTheme.typography.titleLarge)
                Surface(
                    color = FairyGold.copy(alpha = 0.15f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        "Свободно: ${formatRubles(freeBalance)}",
                        style = MaterialTheme.typography.labelMedium,
                        color = FairyGold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }
            OutlinedTextField(
                value = amountText,
                onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                label = { Text("Сумма в рублях") },
                suffix = { Text("₽") },
                modifier = Modifier.fillMaxWidth()
            )
            Text(
                "Минимум 5 ₽",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Button(
                onClick = { amount?.let { onInvest(it) } },
                enabled = amount != null && amount >= 5.0,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Вложить")
            }
        }
    }
}
