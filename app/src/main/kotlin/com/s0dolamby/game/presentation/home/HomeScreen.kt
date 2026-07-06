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
import com.s0dolamby.game.presentation.onboarding.TourTarget
import com.s0dolamby.game.presentation.onboarding.tourAnchor
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
import com.s0dolamby.game.presentation.common.components.PersonaAvatar
import com.s0dolamby.game.presentation.common.components.ProvideOnCardColors
import com.s0dolamby.game.presentation.common.components.SparklesOverlay
import com.s0dolamby.game.presentation.common.components.WobblyEmoji
import com.s0dolamby.game.presentation.common.format.formatGroshes
import com.s0dolamby.game.presentation.common.format.formatGroshesCompact
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.Warning
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard

private data class IntroCard(val icon: String, val titleKey: String, val textKey: String)

private val INTRO_CARDS = listOf(
    IntroCard("📜", "intro.howToPlay.title", "intro.howToPlay.body"),
    IntroCard("🎲", "intro.minigame.title", "intro.minigame.body"),
    IntroCard("💬", "intro.chat.title", "intro.chat.body"),
    IntroCard("💰", "intro.invest.title", "intro.invest.body")
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
    val dealsTaken by viewModel.dealsTakenCount.collectAsState()
    val nickname by viewModel.nickname.collectAsState()

    // Когда тур подсвечивает «Следующий день» (кнопка внизу списка) —
    // прокручиваем список к ней, чтобы спотлайт попал в видимую область.
    val listState = androidx.compose.foundation.lazy.rememberLazyListState()
    val tourTarget by com.s0dolamby.game.presentation.onboarding.TourAnchors.activeTarget
    LaunchedEffect(tourTarget) {
        if (tourTarget == com.s0dolamby.game.presentation.onboarding.TourTarget.NEXT_DAY) {
            val last = (listState.layoutInfo.totalItemsCount - 1).coerceAtLeast(0)
            listState.animateScrollToItem(last)
        }
    }

    // Единый темозависимый фон (HOME_01 / HOME_01_LIGHT + оверлей из палитры)
    // — как у всех остальных экранов, никаких локальных градиентов.
    com.s0dolamby.game.presentation.common.components.ScreenBackground(
        com.s0dolamby.game.presentation.common.components.AppBg.HOME
    ) {
    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            containerColor = Color.Transparent
        ) { padding ->
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                // bottom = 90dp оставляет место под AppBottomNav, который рисуется
                // поверх контента на уровне NavGraph (одной плашкой для всех 5 табов).
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 32.dp, bottom = 90.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    val rankI18n = gameState?.investorRank?.let { rank ->
                        when (rank.name) {
                            "NEWBIE" -> Strings.t("rank.skomoroh")
                            "AMBASSADOR" -> Strings.t("rank.kupec")
                            "ANALYST" -> Strings.t("rank.mudrec")
                            "SHARK" -> Strings.t("rank.boyarin")
                            "LAMBO_SENSEI" -> Strings.t("rank.knyaz")
                            else -> Strings.t("rank.skomoroh")
                        }
                    } ?: Strings.t("rank.skomoroh")
                    HomeHeader(
                        day = gameState?.currentDay ?: 1,
                        rank = rankI18n,
                        nickname = nickname,
                        onSettingsClick = onSettingsClick
                    )
                }

                if (gameState?.isOnboardingComplete == false) {
                    item { IntroCardsRow() }
                }

                item {
                    Box(Modifier.tourAnchor(TourTarget.HOME_MAIN)) {
                        BalanceCard(
                            balance = gameState?.balance ?: 0.0,
                            invested = gameState?.totalInvested ?: 0.0,
                            returned = gameState?.totalReturned ?: 0.0,
                            roi = roi(gameState),
                            dealsTaken = dealsTaken
                        )
                    }
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

                // На главной кнопка остаётся обычной (внутри LazyColumn) —
                // вести после advance-day уходят в глобальный DayNewsStore
                // и рисуются колодой на уровне NavGraph. Глобальная FAB
                // прячется на маршруте Home, чтобы не дублировать UI.
                item {
                    Spacer(Modifier.height(4.dp))
                    Box(Modifier.tourAnchor(TourTarget.NEXT_DAY)) {
                        AdvanceDayButton(
                            isLoading = isLoading,
                            onClick = viewModel::advanceDay
                        )
                    }
                }

            }
        }

        gameState?.pendingRankUp?.let { rank ->
            RankUpCelebrationOverlay(
                rank = rank,
                onDismiss = viewModel::clearRankUpNotification
            )
        }

        // Ярмарочная сцена на время advance-day — маскирует генерацию новых дел
        com.s0dolamby.game.presentation.common.components.DayTransitionOverlay(visible = isLoading)
    }
    } // ScreenBackground
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
                // Текст лежит на фоне экрана (тёмный в обеих темах) —
                // фиксированный светлый, а не карточная локаль.
                color = Color.White.copy(alpha = 0.75f)
            )
        }
        IconButton(
            onClick = onSettingsClick,
            modifier = Modifier.align(Alignment.TopEnd)
        ) {
            Icon(
                Icons.Default.Settings,
                contentDescription = Strings.t("settings.title"),
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
        val palette = com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current
        INTRO_CARDS.forEach { card ->
            Column(
                modifier = Modifier
                    .width(220.dp)
                    .height(120.dp)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(palette.cardTop, palette.cardBottom)
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
                // Кастомная карточка на palette.cardTop/Bottom-градиенте —
                // без провайдера LocalAccentOnCard возвращал бы дефолтное
                // золото, которое сливается с пергаментом тёплой темы.
                ProvideOnCardColors {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(card.icon, fontSize = 16.sp)
                        Text(
                            Strings.t(card.titleKey),
                            color = LocalAccentOnCard.current,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        Strings.t(card.textKey),
                        color = palette.onCardSecondary,
                        fontSize = 11.sp,
                        lineHeight = 15.sp
                    )
                }
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
                            com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current.cardTop,
                            // background = NightBlue в DARK, deep chocolate в WARM
                            com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current.cardBottom
                        )
                    )
                )
        ) {
            com.s0dolamby.game.presentation.common.components.ProvideOnCardColors {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    Strings.t("home.balance.free"),
                    color = LocalContentColorMuted.current,
                    fontSize = 12.sp
                )
                Spacer(Modifier.height(4.dp))
                // Плавный перебор цифр от старого баланса к новому — как CountUp в TG
                val animatedBalance by com.s0dolamby.game.presentation.common.components.rememberCountUp(balance)
                Text(
                    formatGroshes(animatedBalance),
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                OrnamentDivider()
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    MetricColumn(Strings.t("home.metric.invested"), formatGroshesCompact(invested), LocalContentColor.current)
                    MetricColumn(Strings.t("home.metric.received"), formatGroshesCompact(returned), LocalContentColor.current)
                    MetricColumn(Strings.t("home.metric.total"), "%+.1f%%".format(roi), if (roi >= 0) Success else Error)
                    MetricColumn(Strings.t("home.metric.dealsTaken"), "$dealsTaken", LocalContentColor.current)
                }
            }
            } // ProvideOnCardColors
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
                            com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current.cardTop,
                            com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current.cardBottom
                        )
                    )
                )
        ) {
            com.s0dolamby.game.presentation.common.components.ProvideOnCardColors {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        Strings.t("home.relations.title"),
                        color = LocalAccentOnCard.current,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Surface(
                        color = LocalAccentOnCard.current.copy(alpha = 0.18f),
                        shape = CircleShape,
                        border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.4f))
                    ) {
                        Text(
                            "$seenArchetypeCount / ${archetypes.size}",
                            color = LocalAccentOnCard.current,
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
            } // ProvideOnCardColors
            CardCornerOrnaments(modifier = Modifier.matchParentSize())
        }
    }
}

@Composable
private fun ArchetypeChip(
    archetype: com.s0dolamby.game.domain.model.PersonaArchetype,
    tokens: Int
) {
    Box(contentAlignment = Alignment.TopEnd) {
        PersonaAvatar(archetype, size = 36.dp)
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
    val palette = com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current
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
                    Brush.verticalGradient(listOf(palette.cardTop, palette.cardBottom))
                )
                .border(1.dp, palette.cardBorder.copy(alpha = 0.55f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center
        ) {
            com.s0dolamby.game.presentation.common.components.ProvideOnCardColors {
                Row(
                    modifier = Modifier.padding(vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    WobblyEmoji("📖", fontSize = 18.sp, amplitudeDeg = 5f, periodMs = 2000)
                    Text(Strings.t("home.letopis"), color = LocalAccentOnCard.current, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text("($count)", color = LocalContentColorMuted.current, fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
private fun MetricColumn(label: String, value: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            label,
            color = LocalContentColorMuted.current,
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
        color = LocalAccentOnCard.current,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(start = 4.dp)
    )
}

// ─── Active project card (TG-стиль: узкий баннер + компактный низ) ────────

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
                            com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current.cardTop,
                            com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current.cardBottom
                        )
                    )
                )
        ) {
            com.s0dolamby.game.presentation.common.components.ProvideOnCardColors {
            Column {
            // Узкая полоса-обложка сверху — как на активных делах в TG
            com.s0dolamby.game.presentation.common.components.rememberBannerUrl(
                project.personaArchetype, project.type, project.id
            )?.let { url ->
                coil.compose.AsyncImage(
                    model = url,
                    contentDescription = null,
                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                    // Родной аспект баннера 1408×768 — раньше фикс-высота 96dp
                    // обрезала картинку (головы дельцов «срезались»).
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1408f / 768f)
                )
            }
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            project.claimedName,
                            color = LocalContentColor.current,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            "${project.developerName} · ${project.daysSinceJoined} дн.",
                            color = LocalContentColorMuted.current,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            formatGroshes(project.currentValueRubles),
                            color = LocalAccentOnCard.current,
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
                        color = LocalAccentOnCard.current.copy(alpha = 0.12f),
                        shape = RoundedCornerShape(6.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.4f))
                    ) {
                        Text(
                            "+ Довложить",
                            color = LocalAccentOnCard.current,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }
            }
            } // Column (banner + content)
            } // ProvideOnCardColors
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
                            com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current.cardTop,
                            com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current.cardBottom
                        )
                    )
                )
        ) {
            com.s0dolamby.game.presentation.common.components.ProvideOnCardColors {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    WobblyEmoji("📜", fontSize = 28.sp)
                    Column {
                        Text(
                            Strings.t("home.inboxPromo"),
                            color = LocalContentColor.current,
                            fontSize = 14.sp
                        )
                        Text(
                            Strings.t("home.inboxPromo.sub"),
                            color = LocalContentColorMuted.current,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
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
                // Фон этой карточки всегда тёмно-фиолетовый (обе темы) —
                // цвета фиксированные светлые, не из onCard-локалей
                WobblyEmoji("✦", color = FairyGold.copy(alpha = 0.5f), fontSize = 28.sp)
                Text(
                    Strings.t("home.inbox.empty"),
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    Strings.t("home.inbox.empty.hint"),
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 13.sp
                )
                Button(
                    onClick = onInboxClick,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = FairyGold,
                        contentColor = Color(0xFF1A0A00)
                    )
                ) { Text(Strings.t("home.inbox.openCharters"), fontWeight = FontWeight.SemiBold) }
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
                phraseIndex = (phraseIndex + 1) % LOADING_PHRASE_COUNT
            }
        }
    }

    // Кнопка живёт в теме: тёмный фиолет + золото ночью, пергамент +
    // бронза на тёплой ярмарке (раньше была фиксированно тёмной и в
    // светлой теме выглядела чужой).
    val palette = com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current
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
            contentColor = palette.accentOnCard,
            disabledContentColor = palette.accentOnCard.copy(alpha = 0.5f)
        ),
        contentPadding = PaddingValues(0.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        listOf(palette.cardTop, palette.cardBottom)
                    ),
                    shape = RoundedCornerShape(12.dp)
                )
                .border(1.dp, palette.cardBorderBright.copy(alpha = 0.7f), RoundedCornerShape(12.dp)),
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
                        Strings.t("loading.$idx"),
                        fontSize = 13.sp,
                        color = palette.accentOnCard.copy(alpha = 0.8f)
                    )
                }
            } else {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    WobblyEmoji("🌅", fontSize = 16.sp, amplitudeDeg = 5f, periodMs = 2200)
                    Text(Strings.t("home.nextDay"), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

// ─── BottomNav вынесен в presentation/navigation/AppBottomNav.kt ──────────

// ─── helpers ─────────────────────────────────────────────────────────────

private fun totalWealth(state: com.s0dolamby.game.domain.model.GameState?): Double =
    if (state == null) 0.0
    else state.balance + state.activeProjects.sumOf { it.currentValueRubles }

private fun roi(state: com.s0dolamby.game.domain.model.GameState?): Double {
    if (state == null || state.totalInvested <= 0) return 0.0
    return (state.totalReturned - state.totalInvested) / state.totalInvested * 100.0
}

// Число фраз loading.0..loading.N-1 в словаре — крутятся на кнопке дня
private const val LOADING_PHRASE_COUNT = 20
