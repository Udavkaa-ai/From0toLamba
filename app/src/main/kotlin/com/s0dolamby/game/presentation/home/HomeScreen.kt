package com.s0dolamby.game.presentation.home

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.model.PayoutStatus
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.presentation.common.components.ProjectBannerImage
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.TonBlue
import com.s0dolamby.game.presentation.common.theme.Warning
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onInboxClick: () -> Unit,
    onPortfolioClick: () -> Unit,
    onNewsClick: () -> Unit,
    onStatsClick: () -> Unit,
    onProjectClick: (String) -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val gameState by viewModel.gameState.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val pendingUpdateCards by viewModel.pendingUpdateCards.collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("С 0 до Ламбы", fontWeight = FontWeight.Bold) },
                    actions = {
                        IconButton(onClick = onStatsClick) {
                            Icon(Icons.Default.BarChart, contentDescription = "Статистика")
                        }
                    }
                )
            },
            bottomBar = {
                NavigationBar {
                    NavigationBarItem(
                        selected = true,
                        onClick = {},
                        icon = { Icon(Icons.Default.Home, null) },
                        label = { Text("Главная") }
                    )
                    NavigationBarItem(
                        selected = false,
                        onClick = onInboxClick,
                        icon = {
                            BadgedBox(badge = {
                                val count = gameState?.pendingInbox?.size ?: 0
                                if (count > 0) Badge { Text("$count") }
                            }) { Icon(Icons.Default.Email, null) }
                        },
                        label = { Text("Входящие") }
                    )
                    NavigationBarItem(
                        selected = false,
                        onClick = onPortfolioClick,
                        icon = { Icon(Icons.Default.AccountBalance, null) },
                        label = { Text("Портфель") }
                    )
                    NavigationBarItem(
                        selected = false,
                        onClick = onNewsClick,
                        icon = { Icon(Icons.Default.Newspaper, null) },
                        label = { Text("Новости") }
                    )
                }
            }
        ) { padding ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    BalanceCard(
                        balance = gameState?.balance ?: 0.0,
                        day = gameState?.currentDay ?: 1,
                        rank = gameState?.investorRank?.displayName ?: "Новичок",
                        onAdvanceDayClick = viewModel::advanceDay,
                        isLoading = isLoading
                    )
                }

                val activeProjects = gameState?.activeProjects ?: emptyList()
                if (activeProjects.isNotEmpty()) {
                    item {
                        Text(
                            "Активные проекты (${activeProjects.size}/5)",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    items(activeProjects) { project ->
                        ActiveProjectCard(project = project, onClick = { onProjectClick(project.id) })
                    }
                } else {
                    item {
                        EmptyProjectsCard(onInboxClick = onInboxClick)
                    }
                }
            }
        }

        // Daily update cards overlay
        AnimatedVisibility(
            visible = pendingUpdateCards.isNotEmpty(),
            enter = fadeIn(tween(300)),
            exit = fadeOut(tween(200))
        ) {
            UpdateCardDeck(
                updates = pendingUpdateCards,
                onDismiss = { update -> viewModel.dismissUpdateCard(update) },
                onOpenProject = { update ->
                    viewModel.dismissUpdateCard(update)
                    onProjectClick(update.projectId)
                }
            )
        }
    }
}

@Composable
private fun UpdateCardDeck(
    updates: List<DailyUpdate>,
    onDismiss: (DailyUpdate) -> Unit,
    onOpenProject: (DailyUpdate) -> Unit
) {
    val current = updates.firstOrNull() ?: return
    val remaining = updates.size

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.6f))
    ) {
        // Stack depth hint (cards behind)
        if (remaining > 1) {
            Card(
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth()
                    .padding(horizontal = 36.dp)
                    .offset(y = 8.dp),
            ) { Box(Modifier.height(40.dp)) }
        }
        if (remaining > 2) {
            Card(
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth()
                    .padding(horizontal = 48.dp)
                    .offset(y = 16.dp),
            ) { Box(Modifier.height(40.dp)) }
        }

        // Top card with swipe
        SwipeableUpdateCard(
            update = current,
            modifier = Modifier.align(Alignment.Center),
            onSwipeLeft = { onDismiss(current) },
            onSwipeRight = { onOpenProject(current) }
        )

        // Counter
        Text(
            "${remaining} ${updateCountWord(remaining)}",
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 48.dp),
            style = MaterialTheme.typography.labelMedium,
            color = Color.White
        )

        // Swipe hints
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 48.dp)
                .fillMaxWidth()
                .padding(horizontal = 40.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("← Пропустить", color = Color.White.copy(alpha = 0.7f),
                style = MaterialTheme.typography.labelMedium)
            Text("В портфель →", color = Color.White.copy(alpha = 0.7f),
                style = MaterialTheme.typography.labelMedium)
        }
    }
}

@Composable
private fun SwipeableUpdateCard(
    update: DailyUpdate,
    modifier: Modifier = Modifier,
    onSwipeLeft: () -> Unit,
    onSwipeRight: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val density = LocalDensity.current
    val screenWidthPx = with(density) { 380.dp.toPx() }
    val swipeThreshold = with(density) { 100.dp.toPx() }

    val offsetX = remember(update.id) { Animatable(0f) }
    val rotation = remember(update.id) { Animatable(0f) }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .graphicsLayer {
                translationX = offsetX.value
                rotationZ = rotation.value
            }
            .pointerInput(update.id) {
                detectHorizontalDragGestures(
                    onDragEnd = {
                        coroutineScope.launch {
                            when {
                                offsetX.value > swipeThreshold -> {
                                    launch { offsetX.animateTo(screenWidthPx * 1.5f, tween(250)) }
                                    onSwipeRight()
                                }
                                offsetX.value < -swipeThreshold -> {
                                    launch { offsetX.animateTo(-screenWidthPx * 1.5f, tween(250)) }
                                    onSwipeLeft()
                                }
                                else -> {
                                    launch { offsetX.animateTo(0f, spring()) }
                                    launch { rotation.animateTo(0f, spring()) }
                                }
                            }
                        }
                    },
                    onHorizontalDrag = { _, dragAmount ->
                        coroutineScope.launch {
                            offsetX.snapTo(offsetX.value + dragAmount)
                            rotation.snapTo(offsetX.value / screenWidthPx * 12f)
                        }
                    }
                )
            }
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    update.projectName,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    "День ${update.day}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Text(update.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(update.body, style = MaterialTheme.typography.bodyMedium)

            if (update.payoutStatus == PayoutStatus.DELAYED) {
                Surface(
                    color = Error.copy(alpha = 0.15f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        "⚠ Выплаты задержаны",
                        style = MaterialTheme.typography.labelSmall,
                        color = Error,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            } else if (update.payoutStatus == PayoutStatus.BOOSTED) {
                Surface(
                    color = Success.copy(alpha = 0.15f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        "↑ Выплаты ускорены",
                        style = MaterialTheme.typography.labelSmall,
                        color = Success,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            if (update.redFlags.isNotEmpty()) {
                update.redFlags.take(2).forEach { flag ->
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Default.Warning, null, tint = Warning, modifier = Modifier.size(14.dp))
                        Text(flag, style = MaterialTheme.typography.labelSmall, color = Warning)
                    }
                }
            }

            Spacer(Modifier.height(4.dp))
            Text(
                "Смахни вправо, чтобы перейти в портфель",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
            )
        }
    }
}

private fun updateCountWord(count: Int): String = when {
    count % 10 == 1 && count % 100 != 11 -> "обновление"
    count % 10 in 2..4 && count % 100 !in 12..14 -> "обновления"
    else -> "обновлений"
}

private val loadingPhrases = listOf(
    "Экономика делает свой ход...",
    "Финансовые манипуляции в процессе...",
    "Улучшаем код на фрилансе...",
    "Ищем спонсоров в Дубае...",
    "Считаем скамы за тебя...",
    "Разраб пишет апдейт в 3 ночи...",
    "Листинг вот-вот, обещаем...",
    "Закрываем токсичных инвесторов...",
    "Аудит почти готов (нет)...",
    "Пампим метрики для отчёта...",
    "Команда из 50 человек работает...",
    "Ребалансируем пулы ликвидности...",
    "CEO летит из Дубая на конференцию...",
    "Тестируем зкпруфы в продакшне...",
    "Биржа ждёт нашего листинга...",
    "Инвесторы довольны (публично)...",
    "Смотрим графики и не паникуем...",
    "Пишем whitepaper на 80 страниц...",
    "Считаем комиссии за вывод...",
    "DAO голосует за наш бюджет..."
)

@Composable
private fun BalanceCard(
    balance: Double,
    day: Int,
    rank: String,
    onAdvanceDayClick: () -> Unit,
    isLoading: Boolean
) {
    var phraseIndex by remember { mutableIntStateOf(0) }

    LaunchedEffect(isLoading) {
        if (isLoading) {
            while (true) {
                delay(2000)
                phraseIndex = (phraseIndex + 1) % loadingPhrases.size
            }
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Баланс", style = MaterialTheme.typography.labelSmall)
                    Text(
                        "%.2f TON".format(balance),
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold,
                        color = TonBlue
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("День $day", style = MaterialTheme.typography.bodyMedium)
                    Text(rank, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Button(
                onClick = onAdvanceDayClick,
                enabled = !isLoading,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isLoading) {
                    AnimatedContent(
                        targetState = phraseIndex,
                        transitionSpec = {
                            slideInVertically { it } togetherWith slideOutVertically { -it }
                        },
                        label = "loadingPhrase"
                    ) { idx ->
                        Text(
                            loadingPhrases[idx],
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                } else {
                    Text("Следующий день →")
                }
            }
        }
    }
}

@Composable
private fun ActiveProjectCard(project: Project, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ProjectBannerImage(bannerUrl = project.bannerImageUrl, projectName = project.claimedName)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(project.claimedName, style = MaterialTheme.typography.titleMedium)
                    Text(project.developerName, style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        "%.2f TON".format(project.currentValueTON),
                        style = MaterialTheme.typography.titleMedium,
                        color = if (project.currentValueTON >= project.investedAmountTON) Success else MaterialTheme.colorScheme.error
                    )
                    Text("День ${project.daysSinceJoined}", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
private fun EmptyProjectsCard(onInboxClick: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(24.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Нет активных проектов", style = MaterialTheme.typography.titleMedium)
            Text(
                "Зайди во Входящие, проведи AMA с разработчиком и реши, стоит ли инвестировать",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            OutlinedButton(onClick = onInboxClick) { Text("Открыть входящие") }
        }
    }
}
