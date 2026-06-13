package com.s0dolamby.game.presentation.stats

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
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
import com.s0dolamby.game.domain.achievements.AchievementCatalog
import com.s0dolamby.game.domain.achievements.AchievementCategory
import com.s0dolamby.game.domain.model.GameState
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.Warning
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import javax.inject.Inject

@HiltViewModel
class StatsViewModel @Inject constructor(
    gameStateRepository: GameStateRepository,
    projectRepository: com.s0dolamby.game.domain.repository.ProjectRepository
) : ViewModel() {
    val gameState = gameStateRepository.observeGameState()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    /** Снимок закрытых дел — для зала славы (лучшая сделка / худшая потеря). */
    val closedProjects = projectRepository.getClosedProjects()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatsScreen(
    onBack: () -> Unit,
    onRegistryClick: () -> Unit = {},
    viewModel: StatsViewModel = hiltViewModel()
) {
    val state by viewModel.gameState.collectAsState()
    val closed by viewModel.closedProjects.collectAsState()

    ScreenBackground(R.drawable.stats_bg) {
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
                        Text("Успехи купца", fontWeight = FontWeight.Bold)
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                    }
                },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
                actions = {
                    TextButton(onClick = onRegistryClick) {
                        Text("Летопись", color = FairyGold)
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
            item { RankCard(state = state) }
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
            "🏆 Зал славы",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Spacer(Modifier.height(6.dp))
        if (closedWithMoney.isEmpty() && (bestTie?.value ?: 0) == 0 && streak == 0) {
            Text(
                "Закрой первое дело и заведи связь — здесь появятся твои достижения.",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.55f)
            )
        } else {
            bestDeal?.let { p ->
                val profit = p.currentValueRubles - p.investedAmountRubles
                HallRow(
                    icon = "🥇",
                    title = "Лучшая сделка",
                    value = "%+.0f г".format(profit),
                    body = "${p.claimedName} · ${p.developerName}",
                    color = Success
                )
            }
            worstDeal?.let { p ->
                val loss = p.currentValueRubles - p.investedAmountRubles
                if (loss < 0) {
                    HallRow(
                        icon = "💸",
                        title = "Худшая потеря",
                        value = "%+.0f г".format(loss),
                        body = "${p.claimedName} · ${p.developerName}",
                        color = Error
                    )
                }
            }
            bestTie?.takeIf { it.value > 0 }?.let { entry ->
                val (arch, level) = entry
                HallRow(
                    icon = "🤝",
                    title = "Близкий товарищ",
                    value = "$level / 10",
                    body = archetypeName(arch),
                    color = FairyGold
                )
            }
            if (streak > 0) {
                HallRow(
                    icon = "🔥",
                    title = "Серия на ярмарке",
                    value = "$streak дн.",
                    body = "Каждый день увеличивает дневную награду",
                    color = FairyGold
                )
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
            Text(title, style = MaterialTheme.typography.bodyMedium, color = Color.White, fontWeight = FontWeight.SemiBold)
            Text(body, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.55f))
        }
        Text(value, style = MaterialTheme.typography.titleSmall, color = color, fontWeight = FontWeight.Bold)
    }
}

private fun archetypeName(arch: com.s0dolamby.game.domain.model.PersonaArchetype): String = when (arch) {
    com.s0dolamby.game.domain.model.PersonaArchetype.BURATINO -> "🪆 Буратино"
    com.s0dolamby.game.domain.model.PersonaArchetype.BOYARIN -> "👑 Боярин"
    com.s0dolamby.game.domain.model.PersonaArchetype.KOLOBOK -> "🤗 Колобок"
    com.s0dolamby.game.domain.model.PersonaArchetype.KOSCHEI -> "💀 Кощей"
    com.s0dolamby.game.domain.model.PersonaArchetype.ZOLUSHKA -> "👠 Золушка"
    com.s0dolamby.game.domain.model.PersonaArchetype.BABA_YAGA -> "🧙 Баба-Яга"
    com.s0dolamby.game.domain.model.PersonaArchetype.IVAN_DURAK -> "🃏 Иван-дурак"
}

// ─── Подвиги ─────────────────────────────────────────────────────────────────

@Composable
private fun AchievementsCard(unlocked: Set<String>) {
    var expandedCategory by remember { mutableStateOf<AchievementCategory?>(null) }
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
                "🏅 Подвиги — $totalUnlocked из $totalAll",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            LinearProgressIndicator(
                progress = { if (totalAll == 0) 0f else totalUnlocked.toFloat() / totalAll },
                modifier = Modifier.width(90.dp).height(6.dp),
                color = FairyGold,
                trackColor = Color.White.copy(alpha = 0.1f)
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
                        cat.title,
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White
                    )
                }
                Text(
                    "$catUnlocked / ${items.size}",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (catUnlocked == items.size && items.isNotEmpty()) Success else FairyGold.copy(alpha = 0.7f),
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
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.Top,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                if (isUnlocked) ach.emoji else "🔒",
                                fontSize = 18.sp
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    ach.title,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = if (isUnlocked) Color.White else Color.White.copy(alpha = 0.5f),
                                    fontWeight = if (isUnlocked) FontWeight.SemiBold else FontWeight.Normal
                                )
                                Text(
                                    ach.description,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color.White.copy(alpha = if (isUnlocked) 0.7f else 0.4f)
                                )
                            }
                            if (isUnlocked) {
                                Text("✓", color = Success, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
            HorizontalDivider(color = FairyGold.copy(alpha = 0.08f))
        }
    }
}

// ─── Rank card ────────────────────────────────────────────────────────────────

private data class RankTier(
    val rankName: String,
    val emoji: String,
    val displayName: String,
    val requirement: String
)

private val rankTiers = listOf(
    RankTier("NEWBIE",       "🐣", "Скоморох",  "Начало пути — взято 0 дел"),
    RankTier("AMBASSADOR",   "📣", "Купец",      "Взято ≥ 5 дел"),
    RankTier("ANALYST",      "🔍", "Мудрец",     "Взято ≥ 20 дел"),
    RankTier("SHARK",        "🦈", "Боярин",     "Взято ≥ 50 дел"),
    RankTier("LAMBO_SENSEI", "👑", "Князь",      "Взято ≥ 100 дел"),
)

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
                    "Чин",
                    style = MaterialTheme.typography.labelSmall,
                    color = FairyGold.copy(alpha = 0.7f)
                )
                Text(
                    state?.investorRank?.displayName ?: "—",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    "День ${state?.currentDay ?: 1} • Стрик ${state?.dayStreak ?: 0} дн.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.6f)
                )
                Text(
                    "Баланс: %.0f г".format(state?.balance ?: 0.0),
                    style = MaterialTheme.typography.bodySmall,
                    color = FairyGold.copy(alpha = 0.7f)
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(currentEmoji, style = MaterialTheme.typography.displaySmall)
                Icon(
                    Icons.Default.ExpandMore,
                    contentDescription = if (expanded) "Свернуть" else "Развернуть иерархию чинов",
                    tint = FairyGold.copy(alpha = 0.6f),
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
                    color = FairyGold.copy(alpha = 0.2f),
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
                                tier.displayName,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                                color = when {
                                    isCurrent -> FairyGold
                                    isPast    -> Color.White.copy(alpha = 0.45f)
                                    else      -> Color.White.copy(alpha = 0.75f)
                                }
                            )
                            Text(
                                tier.requirement,
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = if (isCurrent) 0.8f else 0.4f)
                            )
                        }
                        if (isCurrent) {
                            Surface(
                                color = FairyGold.copy(alpha = 0.18f),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    "сейчас",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = FairyGold,
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
                "Ведомость казны",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White
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
                        "Пройди несколько дней —\nведомость появится здесь",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.6f)
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
                Text("День 1", style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.5f))
                Text("День $n", style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.5f))
            }
            // Legend
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                LegendDot(color = FairyGold, label = "Казна")
                LegendDot(color = Color(0xFF6B4FCB), label = "Вложено")
            }
        }
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(modifier = Modifier.size(8.dp).background(color, shape = RoundedCornerShape(2.dp)))
        Text(label, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.6f))
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
    val barColor = FairyGold
    val investedColor = Color(0xFF6B4FCB)

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
                    color = Color.White.copy(alpha = 0.45f),
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

            val gridColor = Color.White.copy(alpha = 0.06f)
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
        Text("Злато", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)

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

        HorizontalDivider(color = Color.White.copy(alpha = 0.10f))
        StatRow("Баланс", "%.0f г".format(state?.balance ?: 0.0))
        StatRow("Всего вложено", "%.0f г".format(state?.totalInvested ?: 0.0))
        StatRow("Всего получено", "%.0f г".format(state?.totalReturned ?: 0.0))
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
            "Распознавание обманщиков",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Точность", style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.7f))
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
                trackColor = Color.White.copy(alpha = 0.10f)
            )
        }

        HorizontalDivider(color = Color.White.copy(alpha = 0.10f))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ScamStatBox(label = "Распознано", value = "$detected", color = Success, modifier = Modifier.weight(1f))
            ScamStatBox(label = "Пропущено", value = "$missed", color = Error, modifier = Modifier.weight(1f))
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
            Text(label, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.6f))
        }
    }
}

@Composable
private fun StatRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.6f))
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = Color.White)
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
        Text(
            "Логи",
            style = MaterialTheme.typography.labelSmall,
            color = Color.White.copy(alpha = 0.25f)
        )
        TextButton(
            onClick = onShowLog,
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
        ) {
            Text(
                "просмотр",
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.25f)
            )
        }
        TextButton(
            onClick = { AppLogger.share(context) },
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
        ) {
            Text(
                "поделиться",
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.25f)
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
        title = { Text("Журнал приложения") },
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
        confirmButton = { TextButton(onClick = onDismiss) { Text("Закрыть") } },
        dismissButton = {
            TextButton(onClick = {
                clipboard.setText(AnnotatedString(log))
                copied = true
            }) { Text(if (copied) "Скопировано ✓" else "Копировать") }
        }
    )
}
