package com.s0dolamby.game.presentation.home

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.R
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.model.PayoutStatus
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.presentation.common.components.CardCornerOrnaments
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.components.SparklesOverlay
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.Warning
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private data class IntroCard(val icon: String, val title: String, val text: String)

private val INTRO_CARDS = listOf(
    IntroCard("📜", "Как играть",
        "Каждый день в «Грамотах» появляются новые предложения от дельцов. Большинство — обман. Твоя задача — разобраться кто есть кто."),
    IntroCard("🎲", "Испытание дельца",
        "Перед инвестом — мини-игра по архетипу хозяина. Прошёл — открывается «Вложить». Можно зайти и через беседу за просмотр рекламы."),
    IntroCard("💬", "Беседа",
        "Задай до 10 вопросов хозяину дела. Честный отвечает одинаково, лжец путается. Слушай внимательно."),
    IntroCard("💰", "Вложения",
        "Вложи гроши → они растут каждый день. Потерял — не беда, учись на ошибках. Начни с малого.")
)

@Composable
fun HomeScreen(
    onInboxClick: () -> Unit,
    onPortfolioClick: () -> Unit,
    onTodayClick: () -> Unit,
    onStatsClick: () -> Unit,
    onRelationshipsClick: () -> Unit,
    onRegistryClick: () -> Unit,
    onProjectClick: (String) -> Unit,
    onSettingsClick: () -> Unit = {},
    viewModel: HomeViewModel = hiltViewModel()
) {
    val gameState by viewModel.gameState.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val pendingUpdateCards by viewModel.pendingUpdateCards.collectAsState()
    val dealsTaken by viewModel.dealsTakenCount.collectAsState()
    val nickname by viewModel.nickname.collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
        // ── фон + оверлей + искры ──────────────────────────────────────────
        androidx.compose.foundation.Image(
            painter = painterResource(id = R.drawable.home_bg),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
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
        SparklesOverlay(
            modifier = Modifier
                .fillMaxWidth()
                .height(320.dp)
        )

        Scaffold(
            containerColor = Color.Transparent
        ) { padding ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                // bottom = 90dp оставляет место под AppBottomNav, который рисуется
                // поверх контента на уровне NavGraph (одной плашкой для всех 5 табов).
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 32.dp, bottom = 90.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    HomeHeader(
                        day = gameState?.currentDay ?: 1,
                        rank = gameState?.investorRank?.displayName ?: "Скоморох",
                        nickname = nickname,
                        onSettingsClick = onSettingsClick
                    )
                }

                if (gameState?.isOnboardingComplete == false) {
                    item { IntroCardsRow() }
                }

                item {
                    BalanceCard(
                        balance = gameState?.balance ?: 0.0,
                        invested = gameState?.totalInvested ?: 0.0,
                        returned = gameState?.totalReturned ?: 0.0,
                        roi = roi(gameState),
                        dealsTaken = dealsTaken
                    )
                }

                // Плитка «Отношения с дельцами» — 7 архетипов, тап → отдельный экран.
                val seenArchetypes = gameState?.let { s ->
                    com.s0dolamby.game.domain.model.PersonaArchetype.values()
                        .count { (s.tieLevels[it] ?: 0) > 0 || (s.archetypeTokens[it] ?: 0) > 0 }
                } ?: 0
                item {
                    MerchantRelationsCard(
                        seenArchetypeCount = seenArchetypes,
                        archetypeTokens = gameState?.archetypeTokens ?: emptyMap(),
                        onClick = onRelationshipsClick
                    )
                }

                // Кнопка «Летопись (N)» — N = число встреченных типажей.
                item {
                    LetopisChip(
                        count = seenArchetypes,
                        onClick = onRegistryClick
                    )
                }

                val active = gameState?.activeProjects ?: emptyList()
                if (active.isNotEmpty()) {
                    item {
                        SectionTitle(Strings.t("home.section.active", active.size))
                    }
                    itemsIndexed(active) { index, project ->
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
                            ActiveProjectCardCompact(
                                project = project,
                                onClick = { onProjectClick(project.id) },
                                onAddInvestment = onPortfolioClick
                            )
                        }
                    }
                }

                val inbox = gameState?.pendingInbox ?: emptyList()
                if (inbox.isNotEmpty()) {
                    item {
                        Spacer(Modifier.height(4.dp))
                        SectionTitle(Strings.t("home.section.inbox", inbox.size))
                    }
                    item {
                        InboxPromoCard(onClick = onInboxClick)
                    }
                }

                if (active.isEmpty() && inbox.isEmpty()) {
                    item { EmptyHomeCard(onInboxClick = onInboxClick) }
                }

                // На главной кнопка остаётся обычной (внутри LazyColumn) — она
                // дёргает HomeViewModel.advanceDay() и подбирает pendingUpdateCards
                // для свайп-стопки. Глобальная FAB прячется на маршруте Home,
                // чтобы не дублировать UI.
                item {
                    Spacer(Modifier.height(4.dp))
                    AdvanceDayButton(
                        isLoading = isLoading,
                        onClick = viewModel::advanceDay
                    )
                }

            }
        }

        // ── Daily update cards overlay ─────────────────────────────────────
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

        gameState?.pendingRankUp?.let { rank ->
            RankUpCelebrationOverlay(
                rank = rank,
                onDismiss = viewModel::clearRankUpNotification
            )
        }
    }
}

// ─── Header (TG-стиль: центральный заголовок + шестерёнка справа) ─────────

@Composable
private fun HomeHeader(
    day: Int,
    rank: String,
    nickname: String,
    onSettingsClick: () -> Unit
) {
    Box(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                Strings.t("home.title"),
                fontSize = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                // primary — переключаемый акцент темы; в DARK_FAIRY = FairyGold,
                // в WARM_FAIRY = более светлый медовый. Делает переключатель
                // тем визуально заметным на главной.
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(Modifier.height(4.dp))
            val inner = if (nickname.isNotBlank()) {
                Strings.t("home.subtitle.nickedDay", nickname, day, rank)
            } else {
                Strings.t("home.subtitle.day", day, rank)
            }
            Text(
                Strings.t("home.subtitle", inner),
                fontSize = 12.sp,
                color = Color.White.copy(alpha = 0.55f)
            )
        }
        IconButton(
            onClick = onSettingsClick,
            modifier = Modifier.align(Alignment.TopEnd)
        ) {
            Icon(
                Icons.Default.Settings,
                contentDescription = "Настройки",
                tint = Color.White.copy(alpha = 0.6f),
                modifier = Modifier.size(22.dp)
            )
        }
    }
}

// ─── Intro cards (горизонтальный скролл, до завершения онбординга) ────────

@Composable
private fun IntroCardsRow() {
    val scrollState = rememberScrollState()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(scrollState),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        INTRO_CARDS.forEach { card ->
            Column(
                modifier = Modifier
                    .width(220.dp)
                    .height(120.dp)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(
                                EnchantedPurple.copy(alpha = 0.88f),
                                NightBlue.copy(alpha = 0.95f)
                            )
                        ),
                        shape = RoundedCornerShape(14.dp)
                    )
                    .border(
                        1.dp,
                        FairyGold.copy(alpha = 0.18f),
                        RoundedCornerShape(14.dp)
                    )
                    .padding(14.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(card.icon, fontSize = 16.sp)
                    Text(
                        card.title,
                        color = FairyGold,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    card.text,
                    color = Color.White.copy(alpha = 0.75f),
                    fontSize = 11.sp,
                    lineHeight = 15.sp
                )
            }
        }
    }
}

// ─── Balance card (TG-стиль: «Свободные гроши» + 3 метрики) ───────────────

@Composable
private fun BalanceCard(
    balance: Double,
    invested: Double,
    returned: Double,
    roi: Double,
    dealsTaken: Int
) {
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
                        colors = listOf(
                            // primaryContainer = EnchantedPurple в DARK, warm wood в WARM
                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.88f),
                            // background = NightBlue в DARK, deep chocolate в WARM
                            MaterialTheme.colorScheme.background.copy(alpha = 0.95f)
                        )
                    )
                )
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    Strings.t("home.balance.free"),
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 12.sp
                )
                Spacer(Modifier.height(4.dp))
                AnimatedContent(
                    targetState = "%.0f г".format(balance),
                    transitionSpec = {
                        slideInVertically(tween(350)) { it } + fadeIn(tween(250)) togetherWith
                            slideOutVertically(tween(250)) { -it } + fadeOut(tween(200))
                    },
                    label = "balance_counter"
                ) { text ->
                    Text(
                        text,
                        color = MaterialTheme.colorScheme.primary,
                        fontSize = 36.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
                OrnamentDivider()
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    MetricColumn(Strings.t("home.metric.invested"), "%.0f г".format(invested), Color.White)
                    MetricColumn(Strings.t("home.metric.received"), "%.0f г".format(returned), Color.White)
                    MetricColumn(Strings.t("home.metric.total"), "%+.1f%%".format(roi), if (roi >= 0) Success else Error)
                    MetricColumn(Strings.t("home.metric.dealsTaken"), "$dealsTaken", Color.White)
                }
            }
            CardCornerOrnaments(modifier = Modifier.matchParentSize())
        }
    }
}

// ─── Отношения с дельцами — плитка из 7 архетипов с переходом на экран ──

@Composable
private fun MerchantRelationsCard(
    seenArchetypeCount: Int,
    archetypeTokens: Map<com.s0dolamby.game.domain.model.PersonaArchetype, Int>,
    onClick: () -> Unit
) {
    val archetypes = com.s0dolamby.game.domain.model.PersonaArchetype.values()
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.88f),
                            MaterialTheme.colorScheme.background.copy(alpha = 0.95f)
                        )
                    )
                )
        ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        Strings.t("home.relations.title"),
                        color = FairyGold,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Surface(
                        color = FairyGold.copy(alpha = 0.18f),
                        shape = CircleShape,
                        border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.4f))
                    ) {
                        Text(
                            "$seenArchetypeCount / ${archetypes.size}",
                            color = FairyGold,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                        )
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    archetypes.forEach { arch ->
                        ArchetypeChip(arch, tokens = archetypeTokens[arch] ?: 0)
                    }
                }
            }
            CardCornerOrnaments(modifier = Modifier.matchParentSize())
        }
    }
}

@Composable
private fun ArchetypeChip(
    archetype: com.s0dolamby.game.domain.model.PersonaArchetype,
    tokens: Int
) {
    val emoji = when (archetype) {
        com.s0dolamby.game.domain.model.PersonaArchetype.BURATINO -> "🪆"
        com.s0dolamby.game.domain.model.PersonaArchetype.BOYARIN -> "👑"
        com.s0dolamby.game.domain.model.PersonaArchetype.KOLOBOK -> "🤗"
        com.s0dolamby.game.domain.model.PersonaArchetype.KOSCHEI -> "💀"
        com.s0dolamby.game.domain.model.PersonaArchetype.ZOLUSHKA -> "👠"
        com.s0dolamby.game.domain.model.PersonaArchetype.BABA_YAGA -> "🧙"
        com.s0dolamby.game.domain.model.PersonaArchetype.IVAN_DURAK -> "🃏"
    }
    Box(contentAlignment = Alignment.TopEnd) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(FairyGold.copy(alpha = if (tokens > 0) 0.18f else 0.08f))
                .border(
                    1.dp,
                    FairyGold.copy(alpha = if (tokens > 0) 0.45f else 0.18f),
                    CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(emoji, fontSize = 18.sp)
        }
        if (tokens > 0) {
            Box(
                modifier = Modifier
                    .offset(x = 4.dp, y = (-4).dp)
                    .clip(CircleShape)
                    .background(FairyGold)
                    .padding(horizontal = 4.dp, vertical = 0.dp)
            ) {
                Text(
                    "×$tokens",
                    color = NightBlue,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

// ─── «Летопись (N)» — крупный CTA как в TG ───────────────────────────────

@Composable
private fun LetopisChip(count: Int, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        color = Color.Transparent
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(
                    Brush.verticalGradient(
                        listOf(
                            EnchantedPurple.copy(alpha = 0.65f),
                            NightBlue.copy(alpha = 0.85f)
                        )
                    )
                )
                .border(1.dp, FairyGold.copy(alpha = 0.35f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center
        ) {
            Row(
                modifier = Modifier.padding(vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("📖", fontSize = 18.sp)
                Text(Strings.t("home.letopis"), color = FairyGold, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                Text("($count)", color = Color.White.copy(alpha = 0.5f), fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun MetricColumn(label: String, value: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            label,
            color = Color.White.copy(alpha = 0.5f),
            fontSize = 11.sp
        )
        Spacer(Modifier.height(2.dp))
        Text(
            value,
            color = color,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

// ─── Section title ───────────────────────────────────────────────────────

@Composable
private fun SectionTitle(text: String) {
    Text(
        text,
        color = FairyGold,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(start = 4.dp)
    )
}

// ─── Active project card (TG-компактный стиль, без баннера) ──────────────

@Composable
private fun ActiveProjectCardCompact(
    project: Project,
    onClick: () -> Unit,
    onAddInvestment: () -> Unit
) {
    val profit = if (project.investedAmountRubles > 0)
        (project.currentValueRubles - project.investedAmountRubles) / project.investedAmountRubles * 100.0
    else 0.0

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.88f),
                            MaterialTheme.colorScheme.background.copy(alpha = 0.95f)
                        )
                    )
                )
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            project.claimedName,
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            "${project.developerName} · ${project.daysSinceJoined} дн.",
                            color = Color.White.copy(alpha = 0.55f),
                            fontSize = 11.sp,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            "%.0f г".format(project.currentValueRubles),
                            color = FairyGold,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "%+.1f%%".format(profit),
                            color = if (profit >= 0) Success else Error,
                            fontSize = 11.sp
                        )
                    }
                }
                if (project.isWithdrawalLocked) {
                    Text(
                        "🔒 Вывод заблокирован",
                        color = Warning,
                        fontSize = 11.sp
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    Surface(
                        modifier = Modifier.clickable { onAddInvestment() },
                        color = FairyGold.copy(alpha = 0.12f),
                        shape = RoundedCornerShape(6.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.4f))
                    ) {
                        Text(
                            "+ Довложить",
                            color = FairyGold,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }
            }
            CardCornerOrnaments(modifier = Modifier.matchParentSize())
        }
    }
}

// ─── Inbox promo card («Новые предложения ждут») ─────────────────────────

@Composable
private fun InboxPromoCard(onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.88f),
                            MaterialTheme.colorScheme.background.copy(alpha = 0.95f)
                        )
                    )
                )
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    Strings.t("home.inboxPromo"),
                    color = Color.White,
                    fontSize = 14.sp
                )
                Text(
                    Strings.t("home.inboxPromo.sub"),
                    color = Color.White.copy(alpha = 0.55f),
                    fontSize = 12.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            CardCornerOrnaments(modifier = Modifier.matchParentSize())
        }
    }
}

// ─── Empty home (когда нет ни активных дел, ни инбокса) ──────────────────

@Composable
private fun EmptyHomeCard(onInboxClick: () -> Unit) {
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
                Text("✦", color = FairyGold.copy(alpha = 0.4f), fontSize = 28.sp)
                Text(
                    Strings.t("home.inbox.empty"),
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    Strings.t("home.inbox.empty.hint"),
                    color = Color.White.copy(alpha = 0.65f),
                    fontSize = 13.sp
                )
                OutlinedButton(
                    onClick = onInboxClick,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = FairyGold),
                    border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.5f))
                ) { Text(Strings.t("home.inbox.openCharters")) }
            }
        }
    }
}

// ─── «🌅 Следующий день» button (TG-стиль) ───────────────────────────────

@Composable
private fun AdvanceDayButton(isLoading: Boolean, onClick: () -> Unit) {
    var phraseIndex by remember { mutableIntStateOf(0) }
    LaunchedEffect(isLoading) {
        if (isLoading) {
            while (true) {
                delay(2000)
                phraseIndex = (phraseIndex + 1) % loadingPhrases.size
            }
        }
    }

    Button(
        onClick = onClick,
        enabled = !isLoading,
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.Transparent,
            disabledContainerColor = Color.Transparent,
            contentColor = FairyGold,
            disabledContentColor = FairyGold.copy(alpha = 0.5f)
        ),
        contentPadding = PaddingValues(0.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        listOf(EnchantedPurple, NightBlue)
                    ),
                    shape = RoundedCornerShape(12.dp)
                )
                .border(1.dp, FairyGold.copy(alpha = 0.4f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center
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
                        fontSize = 13.sp,
                        color = FairyGold.copy(alpha = 0.75f)
                    )
                }
            } else {
                Text(Strings.t("home.nextDay"), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

// ─── BottomNav вынесен в presentation/navigation/AppBottomNav.kt ──────────

// ─── Update card deck (TG DayNewsOverlay стиль) ──────────────────────────

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
            .background(Color(0xE1060412))
    ) {
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

        SwipeableUpdateCard(
            update = current,
            modifier = Modifier.align(Alignment.Center),
            onSwipeLeft = { onDismiss(current) },
            onSwipeRight = { onOpenProject(current) }
        )

        Text(
            "📜 Вести дня ${1} / ${remaining}",
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 48.dp),
            style = MaterialTheme.typography.labelMedium,
            color = FairyGold
        )

        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 48.dp)
                .fillMaxWidth()
                .padding(horizontal = 40.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("← пропустить", color = Color.White.copy(alpha = 0.5f), fontSize = 10.sp)
            Text("к делу →", color = FairyGold.copy(alpha = 0.7f), fontSize = 10.sp)
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

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .graphicsLayer {
                translationX = offsetX.value
                rotationZ = rotation.value
            }
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.linearGradient(
                    listOf(Color(0xFF2A1960), NightBlue)
                )
            )
            .border(1.dp, FairyGold.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
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
                Text(update.projectName, color = Color.White.copy(alpha = 0.7f), fontSize = 11.sp)
                Text("День ${update.day}", color = Color.White.copy(alpha = 0.5f), fontSize = 10.sp)
            }

            Text(update.title, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text(update.body, color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp)

            when (update.payoutStatus) {
                PayoutStatus.DELAYED -> Surface(
                    color = Error.copy(alpha = 0.15f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text("⚠ Выплаты задержаны", color = Error, fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                }
                PayoutStatus.BOOSTED -> Surface(
                    color = Success.copy(alpha = 0.15f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text("↑ Выплаты ускорены", color = Success, fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                }
                else -> Unit
            }

            if (update.redFlags.isNotEmpty()) {
                update.redFlags.take(2).forEach { flag ->
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Default.Warning, null, tint = Warning, modifier = Modifier.size(14.dp))
                        Text(flag.cleanRedFlag(), color = Warning, fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

// ─── helpers ─────────────────────────────────────────────────────────────

private fun totalWealth(state: com.s0dolamby.game.domain.model.GameState?): Double =
    if (state == null) 0.0
    else state.balance + state.activeProjects.sumOf { it.currentValueRubles }

private fun roi(state: com.s0dolamby.game.domain.model.GameState?): Double {
    if (state == null || state.totalInvested <= 0) return 0.0
    return (state.totalReturned - state.totalInvested) / state.totalInvested * 100.0
}

private fun String.cleanRedFlag(): String =
    replace('_', ' ')
        .replace(Regex("([a-z])([A-Z])"), "$1 $2")
        .lowercase()
        .replaceFirstChar { it.uppercaseChar() }
        .trimEnd('.')
        .let { if (!it.endsWith('.') && !it.endsWith('!')) "$it." else it }

private val loadingPhrases = listOf(
    "Домовой пересчитывает монеты в казне...",
    "Жар-Птица летит с новостями с ярмарки...",
    "Кот учёный обходит дуб кругом...",
    "Кощей прячет свои гроши в игле...",
    "Баба Яга читает книгу учёта...",
    "Колобок катится за новым вкладчиком...",
    "Водяной замораживает чужие гроши...",
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
