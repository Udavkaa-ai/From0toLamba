package com.s0dolamby.game.presentation.home

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.R
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.model.PayoutStatus
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.presentation.common.components.CardCornerOrnaments
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.components.ProjectBannerImage
import com.s0dolamby.game.presentation.common.components.SparklesOverlay
import com.s0dolamby.game.presentation.common.theme.Background
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
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
    onRegistryClick: () -> Unit,
    onProjectClick: (String) -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val gameState by viewModel.gameState.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val pendingUpdateCards by viewModel.pendingUpdateCards.collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
        // Фоновая картинка кабака
        androidx.compose.foundation.Image(
            painter = painterResource(id = R.drawable.home_bg),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
        // Тёмный оверлей для читаемости UI
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colorStops = arrayOf(
                            0f to Color(0xD9060412),
                            0.4f to Color(0xBF0A0818),
                            1f to Color(0xF0060412)
                        )
                    )
                )
        )
        // Мерцающие искры в верхней части фона
        SparklesOverlay(
            modifier = Modifier
                .fillMaxWidth()
                .height(320.dp)
        )

        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                TopAppBar(
                    title = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                            Text("Из грязи в князи", fontWeight = FontWeight.Bold)
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Transparent
                    ),
                    actions = {
                        IconButton(onClick = onStatsClick) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(TonBlue.copy(alpha = 0.18f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.BarChart,
                                    contentDescription = "Статистика",
                                    tint = TonBlue,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                    }
                )
            },
            bottomBar = {
                NavigationBar {
                    NavigationBarItem(
                        selected = true,
                        onClick = {},
                        icon = { Icon(Icons.Default.Home, null, modifier = Modifier.size(26.dp)) },
                        label = { Text("Главная") }
                    )
                    NavigationBarItem(
                        selected = false,
                        onClick = onInboxClick,
                        icon = {
                            BadgedBox(badge = {
                                val count = gameState?.pendingInbox?.size ?: 0
                                if (count > 0) Badge { Text("$count") }
                            }) { Icon(Icons.Default.Email, null, modifier = Modifier.size(26.dp)) }
                        },
                        label = { Text("Грамоты") }
                    )
                    NavigationBarItem(
                        selected = false,
                        onClick = onPortfolioClick,
                        icon = { Icon(Icons.Default.AccountBalance, null, modifier = Modifier.size(26.dp)) },
                        label = { Text("Казна") }
                    )
                    NavigationBarItem(
                        selected = false,
                        onClick = onNewsClick,
                        icon = { Icon(Icons.Default.Newspaper, null, modifier = Modifier.size(26.dp)) },
                        label = { Text("Вести") }
                    )
                    NavigationBarItem(
                        selected = false,
                        onClick = onRegistryClick,
                        icon = { Icon(Icons.Default.MenuBook, null, modifier = Modifier.size(26.dp)) },
                        label = { Text("Летопись", fontWeight = FontWeight.Bold) },
                        colors = NavigationBarItemDefaults.colors(
                            unselectedIconColor = Error,
                            unselectedTextColor = Error,
                            indicatorColor = Error.copy(alpha = 0.15f)
                        )
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
                        OrnamentDivider()
                        Spacer(Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                "Активные владения",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                "${activeProjects.size}/5",
                                style = MaterialTheme.typography.labelSmall,
                                color = FairyGold.copy(alpha = 0.7f)
                            )
                        }
                    }
                    itemsIndexed(activeProjects) { index, project ->
                        var visible by remember(project.id) { mutableStateOf(false) }
                        LaunchedEffect(project.id) {
                            delay(index * 80L)
                            visible = true
                        }
                        AnimatedVisibility(
                            visible = visible,
                            enter = slideInVertically(
                                animationSpec = spring(
                                    dampingRatio = Spring.DampingRatioMediumBouncy,
                                    stiffness = Spring.StiffnessMedium
                                ),
                                initialOffsetY = { it }
                            ) + fadeIn(tween(280))
                        ) {
                            ActiveProjectCard(project = project, onClick = { onProjectClick(project.id) })
                        }
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
                        Text(flag.cleanRedFlag(), style = MaterialTheme.typography.labelSmall, color = Warning)
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

private fun String.cleanRedFlag(): String =
    replace('_', ' ')
        .replace(Regex("([a-z])([A-Z])"), "$1 $2")
        .lowercase()
        .replaceFirstChar { it.uppercaseChar() }
        .trimEnd('.')
        .let { if (!it.endsWith('.') && !it.endsWith('!')) "$it." else it }

private fun updateCountWord(count: Int): String = when {
    count % 10 == 1 && count % 100 != 11 -> "обновление"
    count % 10 in 2..4 && count % 100 !in 12..14 -> "обновления"
    else -> "обновлений"
}

private val loadingPhrases = listOf(
    "Домовой пересчитывает монеты в казне...",
    "Жар-Птица летит с новостями с ярмарки...",
    "Кот учёный обходит дуб кругом...",
    "Кощей прячет свои рубли в игле...",
    "Баба Яга читает книгу учёта...",
    "Колобок катится за новым вкладчиком...",
    "Водяной замораживает чужие рубли...",
    "Зеркальце ищет честных хозяев...",
    "Хитрая лиса считает долги в кабаке...",
    "Буратино закапывает монеты на Поле Чудес...",
    "Иван ищет третью попытку...",
    "Боярин составляет пышную грамоту...",
    "Карабас гарантирует выплаты лично...",
    "Леший путает следы должников...",
    "Мудрый старец разбирает кейс...",
    "Глашатай кричит о новом деле...",
    "Стражники допрашивают хозяина...",
    "Купцы торгуются на площади...",
    "Кузнец кует новые монеты...",
    "Странник шепчет страшные слухи..."
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
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(EnchantedPurple, NightBlue)
                    )
                )
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Декоративная верхняя строка
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("✦", color = FairyGold.copy(alpha = 0.25f), fontSize = 10.sp)
                    Text("✦  ✦  ✦", color = FairyGold.copy(alpha = 0.15f), fontSize = 10.sp)
                    Text("✦", color = FairyGold.copy(alpha = 0.25f), fontSize = 10.sp)
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                Icons.Default.AccountBalanceWallet,
                                contentDescription = null,
                                tint = FairyGold.copy(alpha = 0.7f),
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                "Казна",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.65f)
                            )
                        }
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .clip(CircleShape)
                                    .background(FairyGold.copy(alpha = 0.8f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    "₽",
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 12.sp),
                                    color = Color(0xFF1A0A00),
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            // Balance scrolls up/down when value changes
                            AnimatedContent(
                                targetState = "%.0f".format(balance),
                                transitionSpec = {
                                    slideInVertically(tween(350)) { it } + fadeIn(tween(250)) togetherWith
                                        slideOutVertically(tween(250)) { -it } + fadeOut(tween(200))
                                },
                                label = "balance_counter"
                            ) { balanceText ->
                                Text(
                                    balanceText,
                                    style = MaterialTheme.typography.headlineLarge,
                                    fontWeight = FontWeight.Bold,
                                    color = FairyGold
                                )
                            }
                            Text(
                                "₽",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Medium,
                                color = FairyGold.copy(alpha = 0.65f)
                            )
                        }
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            "День $day",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.White
                        )
                        Text(
                            rank,
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White.copy(alpha = 0.55f)
                        )
                    }
                }

                Button(
                    onClick = onAdvanceDayClick,
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
                        Text("Следующая страница  ✦")
                    }
                }
            }
            // Угловые орнаменты поверх содержимого карточки
            CardCornerOrnaments(modifier = Modifier.matchParentSize())
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
                    Text(
                        project.developerName,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        "%.0f ₽".format(project.currentValueRubles),
                        style = MaterialTheme.typography.titleMedium,
                        color = if (project.currentValueRubles >= project.investedAmountRubles) Success
                                else MaterialTheme.colorScheme.error
                    )
                    Text("День ${project.daysSinceJoined}", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
private fun EmptyProjectsCard(onInboxClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            EnchantedPurple.copy(alpha = 0.5f),
                            NightBlue.copy(alpha = 0.8f)
                        )
                    )
                )
        ) {
            Column(
                modifier = Modifier
                    .padding(28.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    "✦",
                    color = FairyGold.copy(alpha = 0.4f),
                    fontSize = 28.sp
                )
                Text(
                    "Казна пуста",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    "Загляни во Входящие грамоты — там ждут новые Дельцы. Поговори с каждым, разгадай кто из них мошенник, и реши, достойно ли дело твоих рублей.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.65f)
                )
                OutlinedButton(
                    onClick = onInboxClick,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = FairyGold),
                    border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.5f))
                ) {
                    Text("Открыть входящие")
                }
            }
        }
    }
}
