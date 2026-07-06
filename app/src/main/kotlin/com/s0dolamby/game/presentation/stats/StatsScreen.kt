package com.s0dolamby.game.presentation.stats

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.R
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.achievements.Achievement
import com.s0dolamby.game.domain.achievements.AchievementCatalog
import com.s0dolamby.game.domain.achievements.AchievementCategory
import com.s0dolamby.game.presentation.achievements.LoreBlock
import com.s0dolamby.game.domain.model.GameState
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.components.ProvideOnCardColors
import com.s0dolamby.game.presentation.common.components.AppBg
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.components.WobblyEmoji
import com.s0dolamby.game.presentation.onboarding.TourTarget
import com.s0dolamby.game.presentation.onboarding.tourAnchor
import com.s0dolamby.game.presentation.common.format.formatGroshes
import com.s0dolamby.game.presentation.common.format.formatGroshesSigned
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.i18n.localizedDescription
import com.s0dolamby.game.presentation.common.i18n.localizedTitle
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.Warning
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import javax.inject.Inject
import com.s0dolamby.game.presentation.common.theme.LocalAppPalette
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import com.s0dolamby.game.presentation.common.theme.LocalContentColorSecondary
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard

@HiltViewModel
class StatsViewModel @Inject constructor(
    gameStateRepository: GameStateRepository,
    projectRepository: com.s0dolamby.game.domain.repository.ProjectRepository,
    scienceUnlockStore: com.s0dolamby.game.data.science.ScienceUnlockStore
) : ViewModel() {
    val gameState = gameStateRepository.observeGameState()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    /** Снимок закрытых дел — для зала славы (лучшая сделка / худшая потеря). */
    val closedProjects = projectRepository.getClosedProjects()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Открытые карты «Науки старца» — для чипа-прогресса. */
    val scienceUnlocked = scienceUnlockStore.unlockedIds
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatsScreen(
    onBack: () -> Unit,
    onRegistryClick: () -> Unit = {},
    onScienceClick: () -> Unit = {},
    onTrainingClick: () -> Unit = {},
    viewModel: StatsViewModel = hiltViewModel()
) {
    val state by viewModel.gameState.collectAsState()
    val closed by viewModel.closedProjects.collectAsState()
    val scienceUnlocked by viewModel.scienceUnlocked.collectAsState()

    ScreenBackground(AppBg.STATS) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        // TopAppBar лежит на тёмном фоне экрана в обеих темах —
                        // фиксированное золото, не карточная локаль.
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                        Text(Strings.t("stats.title"), fontWeight = FontWeight.Bold)
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                    }
                },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, Strings.t("btn.back")) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
                actions = {
                    TextButton(onClick = onRegistryClick) {
                        Text(Strings.t("stats.letopis.action"), color = FairyGold)
                    }
                }
            )
        }
    ) { padding ->
        var showLog by remember { mutableStateOf(false) }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 90.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Box(Modifier.tourAnchor(TourTarget.STATS_MAIN)) {
                    RankCard(state = state)
                }
            }
            item { ChuykaCard(state = state) }
            item {
                ScienceEntryCard(
                    unlockedCount = scienceUnlocked.size,
                    onClick = onScienceClick
                )
            }
            item { TrainingEntryCard(onClick = onTrainingClick) }
            item { OrnamentDivider() }
            item { BalanceChartCard(state = state) }
            item { FinancialStats(state = state) }
            item { OrnamentDivider() }
            item { HallOfFameCard(state = state, closed = closed) }
            item { OrnamentDivider() }
            item { AchievementsCard(unlocked = state?.unlockedAchievements ?: emptySet()) }
            item { OrnamentDivider() }
            item { ScamStats(state = state) }
            item { LogCard(onShowLog = { showLog = true }) }
        }

        if (showLog) {
            LogDialog(onDismiss = { showLog = false })
        }
    }
    } // ScreenBackground
}

// ─── Зал славы — лучшая сделка / худшая потеря / лучшая связь ────────────────

@Composable
private fun HallOfFameCard(state: GameState?, closed: List<com.s0dolamby.game.domain.model.Project>) {
    val closedWithMoney = closed.filter { it.investedAmountRubles > 0 }
    val bestDeal = closedWithMoney.maxByOrNull {
        it.currentValueRubles - it.investedAmountRubles
    }
    val worstDeal = closedWithMoney.minByOrNull {
        it.currentValueRubles - it.investedAmountRubles
    }
    val bestTie = state?.tieLevels?.maxByOrNull { it.value }
    val streak = state?.loginStreak ?: 0

    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Text(
            Strings.t("stats.hof.title"),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = LocalContentColor.current
        )
        Spacer(Modifier.height(6.dp))
        if (closedWithMoney.isEmpty() && (bestTie?.value ?: 0) == 0 && streak == 0) {
            Text(
                Strings.t("stats.hof.empty"),
                style = MaterialTheme.typography.bodySmall,
                color = LocalContentColorMuted.current
            )
        } else {
            bestDeal?.let { p ->
                val profit = p.currentValueRubles - p.investedAmountRubles
                HallRow("🥇", Strings.t("stats.hof.bestDeal"), formatGroshesSigned(profit),
                    "${p.claimedName} · ${p.developerName}", Success)
            }
            worstDeal?.let { p ->
                val loss = p.currentValueRubles - p.investedAmountRubles
                if (loss < 0) {
                    HallRow("💸", Strings.t("stats.hof.worstLoss"), formatGroshesSigned(loss),
                        "${p.claimedName} · ${p.developerName}", Error)
                }
            }
            bestTie?.takeIf { it.value > 0 }?.let { entry ->
                val (arch, level) = entry
                HallRow("🤝", Strings.t("stats.hof.closeFriend"), "$level / 10",
                    archetypeName(arch), LocalAccentOnCard.current)
            }
            if (streak > 0) {
                HallRow("🔥", Strings.t("stats.hof.streak"), Strings.t("stats.streak.daysShort", streak),
                    Strings.t("stats.streak.body"), LocalAccentOnCard.current)
            }
        }
    }
}

@Composable
private fun HallRow(icon: String, title: String, value: String, body: String, color: Color) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(icon, fontSize = 20.sp)
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyMedium, color = LocalContentColor.current, fontWeight = FontWeight.SemiBold)
            Text(body, style = MaterialTheme.typography.labelSmall, color = LocalContentColorMuted.current)
        }
        Text(value, style = MaterialTheme.typography.titleSmall, color = color, fontWeight = FontWeight.Bold)
    }
}

@Composable
@androidx.compose.runtime.ReadOnlyComposable
private fun archetypeName(arch: com.s0dolamby.game.domain.model.PersonaArchetype): String {
    val emoji = when (arch) {
        com.s0dolamby.game.domain.model.PersonaArchetype.BURATINO -> "🪆"
        com.s0dolamby.game.domain.model.PersonaArchetype.BOYARIN -> "👑"
        com.s0dolamby.game.domain.model.PersonaArchetype.KOLOBOK -> "🤗"
        com.s0dolamby.game.domain.model.PersonaArchetype.KOSCHEI -> "💀"
        com.s0dolamby.game.domain.model.PersonaArchetype.ZOLUSHKA -> "👠"
        com.s0dolamby.game.domain.model.PersonaArchetype.BABA_YAGA -> "🧙"
        com.s0dolamby.game.domain.model.PersonaArchetype.IVAN_DURAK -> "🃏"
    }
    return "$emoji ${Strings.t("persona.${arch.name}")}"
}

// ─── Подвиги ─────────────────────────────────────────────────────────────────

@Composable
private fun AchievementsCard(unlocked: Set<String>) {
    var expandedCategory by remember { mutableStateOf<AchievementCategory?>(null) }
    var openedAchievement by remember { mutableStateOf<Achievement?>(null) }
    val byCategory = remember { AchievementCatalog.ALL.groupBy { it.category } }
    val totalUnlocked = AchievementCatalog.ALL.count { it.id in unlocked }
    val totalAll = AchievementCatalog.ALL.size

    FairyCard(modifier = Modifier.fillMaxWidth().animateContentSize()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                Strings.t("stats.feats.header", totalUnlocked, totalAll),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = LocalContentColor.current
            )
            LinearProgressIndicator(
                progress = { if (totalAll == 0) 0f else totalUnlocked.toFloat() / totalAll },
                modifier = Modifier.width(90.dp).height(6.dp),
                color = LocalAccentOnCard.current,
                trackColor = LocalContentColor.current.copy(alpha = 0.1f)
            )
        }
        Spacer(Modifier.height(6.dp))
        AchievementCategory.values().forEach { cat ->
            val items = byCategory[cat].orEmpty()
            val catUnlocked = items.count { it.id in unlocked }
            val isExpanded = expandedCategory == cat
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expandedCategory = if (isExpanded) null else cat }
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(cat.icon, fontSize = 16.sp)
                    Text(
                        cat.localizedTitle(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = LocalContentColor.current
                    )
                }
                Text(
                    "$catUnlocked / ${items.size}",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (catUnlocked == items.size && items.isNotEmpty()) Success else LocalAccentOnCard.current.copy(alpha = 0.7f),
                    fontWeight = FontWeight.SemiBold
                )
            }
            AnimatedVisibility(
                visible = isExpanded,
                enter = expandVertically(tween(220)) + fadeIn(tween(180)),
                exit = shrinkVertically(tween(180)) + fadeOut(tween(120))
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(bottom = 8.dp)) {
                    items.forEach { ach ->
                        val isUnlocked = ach.id in unlocked
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { openedAchievement = ach },
                            verticalAlignment = Alignment.Top,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                if (isUnlocked) ach.emoji else "🔒",
                                fontSize = 18.sp
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    ach.localizedTitle(),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = if (isUnlocked) LocalContentColor.current else LocalContentColorMuted.current,
                                    fontWeight = if (isUnlocked) FontWeight.SemiBold else FontWeight.Normal
                                )
                                Text(
                                    ach.localizedDescription(),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (isUnlocked) LocalContentColorSecondary.current else LocalContentColorMuted.current
                                )
                            }
                            if (isUnlocked) {
                                Text("✓", color = Success, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
            HorizontalDivider(color = LocalAccentOnCard.current.copy(alpha = 0.08f))
        }
    }

    openedAchievement?.let { ach ->
        AchievementDetailDialog(
            achievement = ach,
            isUnlocked = ach.id in unlocked,
            onDismiss = { openedAchievement = null }
        )
    }
}

/**
 * Детали подвига: условие получения, а для справочных подвигов
 * (Achievement.revealTopic) после разблокировки — запись летописи
 * о породе дела / личине хозяина / судьбе (как модалка в TG StatsPage).
 */
@Composable
private fun AchievementDetailDialog(
    achievement: Achievement,
    isUnlocked: Boolean,
    onDismiss: () -> Unit
) {
    // Карточный (пергаментный в тёплой теме) фон + on-card локали, иначе
    // LoreBlock внутри дефолтного тёмного диалога в тёплой теме давал
    // тёмную сепию на тёмном.
    val palette = LocalAppPalette.current
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = palette.cardMid,
        iconContentColor = palette.onCard,
        titleContentColor = palette.onCard,
        textContentColor = palette.onCard,
        icon = { Text(if (isUnlocked) achievement.emoji else "🔒", fontSize = 44.sp) },
        title = {
            Text(
                achievement.localizedTitle(),
                fontWeight = FontWeight.Bold,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        },
        text = {
            ProvideOnCardColors {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (isUnlocked) {
                        Text(
                            Strings.t("ach.detail.done"),
                            color = Success,
                            style = MaterialTheme.typography.labelMedium,
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    } else {
                        Text(
                            Strings.t("ach.detail.how"),
                            style = MaterialTheme.typography.labelSmall,
                            color = LocalContentColorMuted.current
                        )
                    }
                    Text(
                        achievement.localizedDescription(),
                        style = MaterialTheme.typography.bodyMedium
                    )
                    // Летопись раскрывается только после получения подвига
                    if (isUnlocked) {
                        achievement.revealTopic?.let { LoreBlock(it) }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text(Strings.t("btn.gotIt"), color = palette.accentOnCard) }
        }
    )
}

// ─── Rank card ────────────────────────────────────────────────────────────────

private data class RankTier(
    val rankName: String,
    val emoji: String,
    val displayNameKey: String,
    val requirementKey: String
)

private val rankTiers = listOf(
    RankTier("NEWBIE",       "🐣", "rank.skomoroh", "stats.rank.req.NEWBIE"),
    RankTier("AMBASSADOR",   "📣", "rank.kupec",    "stats.rank.req.AMBASSADOR"),
    RankTier("ANALYST",      "🔍", "rank.mudrec",   "stats.rank.req.ANALYST"),
    RankTier("SHARK",        "🦈", "rank.boyarin",  "stats.rank.req.SHARK"),
    RankTier("LAMBO_SENSEI", "👑", "rank.knyaz",    "stats.rank.req.LAMBO_SENSEI"),
)

// ─── «Наука старца» — вход в коллекцию приёмов ───────────────────────────

@Composable
private fun ScienceEntryCard(unlockedCount: Int, onClick: () -> Unit) {
    FairyCard(modifier = Modifier.fillMaxWidth().clickable { onClick() }) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            WobblyEmoji("🧙", fontSize = 26.sp, amplitudeDeg = 5f, periodMs = 2600)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    Strings.t("science.entry.title"),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = LocalAccentOnCard.current
                )
                Text(
                    Strings.t(
                        "science.entry.sub",
                        unlockedCount,
                        com.s0dolamby.game.domain.science.ScienceCatalog.ALL.size
                    ),
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalContentColorMuted.current
                )
            }
            Text("›", color = LocalAccentOnCard.current, fontSize = 20.sp)
        }
    }
}

// ─── «Тренировочный зал» — вход в обучающие мини-игры ────────────────────

@Composable
private fun TrainingEntryCard(onClick: () -> Unit) {
    FairyCard(modifier = Modifier.fillMaxWidth().clickable { onClick() }) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            WobblyEmoji("🎯", fontSize = 26.sp, amplitudeDeg = 5f, periodMs = 2400)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    Strings.t("training.entry.title"),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = LocalAccentOnCard.current
                )
                Text(
                    Strings.t("training.entry.sub"),
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalContentColorMuted.current
                )
            }
            Text("›", color = LocalAccentOnCard.current, fontSize = 20.sp)
        }
    }
}

// ─── Чуйка («Верю — не верю») ────────────────────────────────────────────

@Composable
private fun ChuykaCard(state: GameState?) {
    val total = state?.chuykaTotal ?: 0
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.weight(1f)) {
                Text(
                    Strings.t("stats.chuyka.title"),
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalAccentOnCard.current.copy(alpha = 0.7f)
                )
                if (total == 0) {
                    Text(
                        Strings.t("stats.chuyka.empty"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = LocalContentColorMuted.current
                    )
                } else {
                    val s = state!!
                    Text(
                        "${s.chuykaPoints}",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = LocalContentColor.current
                    )
                    Text(
                        Strings.t(
                            "stats.chuyka.sub",
                            com.s0dolamby.game.domain.chuyka.ChuykaScoring
                                .accuracyPercent(s.chuykaCorrect, s.chuykaTotal),
                            s.chuykaTotal
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = LocalContentColorMuted.current
                    )
                    if (s.chuykaStreak > 1 || s.chuykaBestStreak > 1) {
                        Text(
                            Strings.t("stats.chuyka.streak", s.chuykaStreak, s.chuykaBestStreak),
                            style = MaterialTheme.typography.bodySmall,
                            color = LocalAccentOnCard.current.copy(alpha = 0.8f)
                        )
                    }
                }
            }
            WobblyEmoji("🔮", fontSize = 36.sp, amplitudeDeg = 5f, periodMs = 2400)
        }
    }
}

@Composable
private fun RankCard(state: GameState?) {
    var expanded by remember { mutableStateOf(false) }
    val chevronRotation by animateFloatAsState(
        targetValue = if (expanded) 180f else 0f,
        animationSpec = tween(250),
        label = "chevron"
    )
    val currentRankName = state?.investorRank?.name ?: "NEWBIE"
    val currentEmoji = rankTiers.find { it.rankName == currentRankName }?.emoji ?: "🐣"

    FairyCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { expanded = !expanded }
            .animateContentSize()
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.weight(1f)) {
                Text(
                    Strings.t("stats.chin"),
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalAccentOnCard.current.copy(alpha = 0.7f)
                )
                // Золотой блик пробегает по имени чина — «мерцание титула»
                val shimmer = rememberInfiniteTransition(label = "rank-shimmer")
                val shimmerX by shimmer.animateFloat(
                    initialValue = -1f, targetValue = 2f,
                    animationSpec = infiniteRepeatable(
                        tween(2800, easing = LinearEasing), RepeatMode.Restart
                    ),
                    label = "rank-shimmer-x"
                )
                val baseColor = LocalContentColor.current
                Text(
                    state?.investorRank?.let { Strings.t(rankTiers.first { t -> t.rankName == it.name }.displayNameKey) } ?: "—",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        brush = androidx.compose.ui.graphics.Brush.linearGradient(
                            colors = listOf(baseColor, FairyGold, baseColor),
                            start = Offset(shimmerX * 500f, 0f),
                            end = Offset(shimmerX * 500f + 220f, 60f)
                        )
                    ),
                    fontWeight = FontWeight.Bold
                )
                Text(
                    Strings.t("stats.dayStreak", state?.currentDay ?: 1, state?.dayStreak ?: 0),
                    style = MaterialTheme.typography.bodyMedium,
                    color = LocalContentColorMuted.current
                )
                Text(
                    Strings.t("stats.balance.short", formatGroshes(state?.balance ?: 0.0)),
                    style = MaterialTheme.typography.bodySmall,
                    color = LocalAccentOnCard.current.copy(alpha = 0.7f)
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                WobblyEmoji(currentEmoji, fontSize = 36.sp, amplitudeDeg = 5f, periodMs = 2000)
                Icon(
                    Icons.Default.ExpandMore,
                    contentDescription = if (expanded) Strings.t("stats.rank.collapse") else Strings.t("stats.rank.expand"),
                    tint = LocalAccentOnCard.current.copy(alpha = 0.6f),
                    modifier = Modifier.size(20.dp).rotate(chevronRotation)
                )
            }
        }

        AnimatedVisibility(
            visible = expanded,
            enter = expandVertically(tween(280)) + fadeIn(tween(200)),
            exit = shrinkVertically(tween(220)) + fadeOut(tween(150))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
                verticalArrangement = Arrangement.spacedBy(0.dp)
            ) {
                HorizontalDivider(
                    color = LocalAccentOnCard.current.copy(alpha = 0.2f),
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                rankTiers.forEach { tier ->
                    val isCurrent = tier.rankName == currentRankName
                    val isPast    = rankTiers.indexOfFirst { it.rankName == currentRankName }
                                        .let { cur -> rankTiers.indexOf(tier) < cur }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            tier.emoji,
                            fontSize = 20.sp,
                            modifier = Modifier.width(28.dp)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                Strings.t(tier.displayNameKey),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                                color = when {
                                    isCurrent -> LocalAccentOnCard.current
                                    isPast    -> LocalContentColorMuted.current
                                    else      -> LocalContentColorSecondary.current
                                }
                            )
                            Text(
                                Strings.t(tier.requirementKey),
                                style = MaterialTheme.typography.labelSmall,
                                color = if (isCurrent) LocalContentColorSecondary.current else LocalContentColorMuted.current
                            )
                        }
                        if (isCurrent) {
                            Surface(
                                color = LocalAccentOnCard.current.copy(alpha = 0.18f),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    Strings.t("stats.rank.now"),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = LocalAccentOnCard.current,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ─── Balance chart ────────────────────────────────────────────────────────────

@Composable
private fun BalanceChartCard(state: GameState?) {
    val freeHistory = state?.balanceHistory ?: emptyList()
    val investedHistory = state?.investedHistory ?: emptyList()
    val n = minOf(freeHistory.size, investedHistory.size)
    val hasBoth = n >= 2

    FairyCard(modifier = Modifier.fillMaxWidth()) {
        // Title + legend
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                Strings.t("stats.balance.ledger"),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = LocalContentColor.current
            )
            if (hasBoth) {
                val totalFirst = freeHistory[freeHistory.size - n] + investedHistory[investedHistory.size - n]
                val totalLast = freeHistory.last() + investedHistory.last()
                val delta = totalLast - totalFirst
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(
                        if (delta >= 0) Icons.Default.TrendingUp else Icons.Default.TrendingDown,
                        contentDescription = null,
                        tint = if (delta >= 0) Success else Error,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        "%+.0f г".format(delta),
                        style = MaterialTheme.typography.labelMedium,
                        color = if (delta >= 0) Success else Error,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        if (!hasBoth) {
            Box(
                modifier = Modifier.fillMaxWidth().height(140.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("📊", style = MaterialTheme.typography.displaySmall)
                    Text(
                        Strings.t("stats.balance.placeholder"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = LocalContentColorMuted.current
                    )
                }
            }
        } else {
            val freeSlice = freeHistory.takeLast(n)
            val investedSlice = investedHistory.takeLast(n)
            StackedBarChart(
                freeHistory = freeSlice,
                investedHistory = investedSlice,
                modifier = Modifier.fillMaxWidth().height(160.dp)
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(Strings.t("stats.balance.day1"), style = MaterialTheme.typography.labelSmall, color = LocalContentColorMuted.current)
                Text(Strings.t("detail.day", n), style = MaterialTheme.typography.labelSmall, color = LocalContentColorMuted.current)
            }
            // Legend
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                LegendDot(color = LocalAccentOnCard.current, label = Strings.t("stats.balance.legend.treasury"))
                LegendDot(color = Color(0xFF6B4FCB), label = Strings.t("stats.balance.legend.invested"))
            }
        }
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(modifier = Modifier.size(8.dp).background(color, shape = RoundedCornerShape(2.dp)))
        Text(label, style = MaterialTheme.typography.labelSmall, color = LocalContentColorMuted.current)
    }
}

@Composable
private fun StackedBarChart(
    freeHistory: List<Double>,
    investedHistory: List<Double>,
    modifier: Modifier = Modifier
) {
    val totals = freeHistory.zip(investedHistory).map { (f, i) -> f + i }
    val maxTotal = totals.max().coerceAtLeast(1.0)
    // График лежит на карточном фоне (пергамент в тёплой теме) —
    // цвета столбцов и сетки берём из on-card локалей.
    val barColor = LocalAccentOnCard.current
    val investedColor = Color(0xFF6B4FCB)
    val gridColor = LocalContentColor.current.copy(alpha = 0.06f)

    // Format compact ruble label: 1 234 → "1.2к", 500 → "500"
    fun fmtRub(v: Double): String = when {
        v >= 1_000_000 -> "%.1fм".format(v / 1_000_000)
        v >= 1_000     -> "%.1fк".format(v / 1_000)
        else           -> "%.0f".format(v)
    }

    val yLabels = listOf(maxTotal, maxTotal / 2.0, 0.0)
    val labelWidth = 40.dp

    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        // Y-axis labels column
        Box(modifier = Modifier.width(labelWidth).fillMaxHeight()) {
            yLabels.forEachIndexed { idx, value ->
                val fraction = when (idx) { 0 -> 0f; 1 -> 0.5f; else -> 1f }
                Text(
                    text = fmtRub(value),
                    style = MaterialTheme.typography.labelSmall,
                    fontSize = 9.sp,
                    color = LocalContentColorMuted.current,
                    modifier = Modifier.align(
                        when (idx) {
                            0    -> Alignment.TopEnd
                            1    -> Alignment.CenterEnd
                            else -> Alignment.BottomEnd
                        }
                    )
                )
            }
        }
        Spacer(Modifier.width(4.dp))

        Canvas(modifier = Modifier.weight(1f).fillMaxHeight()) {
            val w = size.width
            val h = size.height
            val padTop = 8f
            val padBottom = 8f
            val chartH = h - padTop - padBottom
            val n = freeHistory.size
            val barWidth = (w / n * 0.65f)
            val gap = w / n

            for (i in 0..2) {
                val y = padTop + chartH / 2 * i
                drawLine(gridColor, Offset(0f, y), Offset(w, y), strokeWidth = 1f)
            }

            freeHistory.indices.forEach { i ->
                val cx = gap * i + gap / 2f
                val left = cx - barWidth / 2f
                val freeVal = freeHistory[i].coerceAtLeast(0.0).toFloat()
                val investedVal = investedHistory[i].coerceAtLeast(0.0).toFloat()
                val totalVal = (freeVal + investedVal).coerceAtLeast(0.001f)

                val totalBarH = (totalVal / maxTotal.toFloat() * chartH).coerceAtLeast(2f)
                val freeBarH = (freeVal / totalVal * totalBarH).coerceAtLeast(0f)
                val investedBarH = (totalBarH - freeBarH).coerceAtLeast(0f)

                val barBottom = h - padBottom
                if (investedBarH > 0f) {
                    drawRect(
                        color = investedColor,
                        topLeft = Offset(left, barBottom - investedBarH),
                        size = androidx.compose.ui.geometry.Size(barWidth, investedBarH)
                    )
                }
                if (freeBarH > 0f) {
                    drawRect(
                        color = barColor,
                        topLeft = Offset(left, barBottom - investedBarH - freeBarH),
                        size = androidx.compose.ui.geometry.Size(barWidth, freeBarH)
                    )
                }
            }
        }
    }
}

// ─── Financial stats ─────────────────────────────────────────────────────────

@Composable
private fun FinancialStats(state: GameState?) {
    val roi = if (state != null && state.totalInvested > 0) {
        (state.totalReturned - state.totalInvested) / state.totalInvested * 100
    } else 0.0
    val roiPositive = roi >= 0

    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Text(Strings.t("stats.gold.title"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = LocalContentColor.current)

        Surface(
            color = if (roiPositive) Success.copy(alpha = 0.15f) else Error.copy(alpha = 0.15f),
            shape = RoundedCornerShape(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("ROI", style = MaterialTheme.typography.titleSmall, color = if (roiPositive) Success else Error)
                Text(
                    "%+.1f%%".format(roi),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (roiPositive) Success else Error
                )
            }
        }

        HorizontalDivider(color = LocalContentColor.current.copy(alpha = 0.10f))
        StatRow(Strings.t("stats.gold.balance"), formatGroshes(state?.balance ?: 0.0))
        StatRow(Strings.t("stats.gold.invested"), formatGroshes(state?.totalInvested ?: 0.0))
        StatRow(Strings.t("stats.gold.received"), formatGroshes(state?.totalReturned ?: 0.0))
    }
}

// ─── Scam stats ───────────────────────────────────────────────────────────────

@Composable
private fun ScamStats(state: GameState?) {
    val detected = state?.scamsDetected ?: 0
    val missed = state?.scamsMissed ?: 0
    val total = detected + missed
    val accuracy = if (total > 0) detected.toFloat() / total else 0f

    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Text(
            Strings.t("stats.scam.title"),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = LocalContentColor.current
        )

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(Strings.t("stats.scam.accuracy"), style = MaterialTheme.typography.bodyMedium, color = LocalContentColorSecondary.current)
                Text(
                    "%.0f%%".format(accuracy * 100),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = when {
                        accuracy >= 0.7f -> Success
                        accuracy >= 0.4f -> Warning
                        else -> Error
                    }
                )
            }
            LinearProgressIndicator(
                progress = { accuracy },
                modifier = Modifier.fillMaxWidth().height(8.dp),
                color = when {
                    accuracy >= 0.7f -> Success
                    accuracy >= 0.4f -> Warning
                    else -> Error
                },
                trackColor = LocalContentColor.current.copy(alpha = 0.10f)
            )
        }

        HorizontalDivider(color = LocalContentColor.current.copy(alpha = 0.10f))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ScamStatBox(label = Strings.t("stats.scam.detected"), value = "$detected", color = Success, modifier = Modifier.weight(1f))
            ScamStatBox(label = Strings.t("stats.scam.missed"), value = "$missed", color = Error, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun ScamStatBox(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Surface(color = color.copy(alpha = 0.12f), shape = RoundedCornerShape(8.dp), modifier = modifier) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(value, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = color)
            Text(label, style = MaterialTheme.typography.labelSmall, color = LocalContentColorMuted.current)
        }
    }
}

@Composable
private fun StatRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = LocalContentColorMuted.current)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = LocalContentColor.current)
    }
}

@Composable
private fun LogCard(onShowLog: () -> Unit) {
    val context = LocalContext.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Ряд лежит прямо на тёмном фоне экрана — фиксированный светлый,
        // alpha не ниже 0.6, иначе не читается.
        Text(
            Strings.t("stats.log.title"),
            style = MaterialTheme.typography.labelSmall,
            color = Color.White.copy(alpha = 0.6f)
        )
        TextButton(
            onClick = onShowLog,
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
        ) {
            Text(
                Strings.t("stats.log.view"),
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.6f)
            )
        }
        TextButton(
            onClick = { AppLogger.share(context) },
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
        ) {
            Text(
                Strings.t("stats.log.share"),
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.6f)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LogDialog(onDismiss: () -> Unit) {
    val log = remember { AppLogger.readLog() }
    val scrollState = rememberScrollState(Int.MAX_VALUE)
    val clipboard = LocalClipboardManager.current
    var copied by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(Strings.t("stats.log.dialog")) },
        text = {
            Box(modifier = Modifier.fillMaxWidth().heightIn(max = 400.dp)) {
                Text(
                    text = log,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .verticalScroll(scrollState)
                )
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(Strings.t("stats.log.close")) } },
        dismissButton = {
            TextButton(onClick = {
                clipboard.setText(AnnotatedString(log))
                copied = true
            }) { Text(if (copied) Strings.t("stats.log.copied") else Strings.t("stats.log.copy")) }
        }
    )
}
