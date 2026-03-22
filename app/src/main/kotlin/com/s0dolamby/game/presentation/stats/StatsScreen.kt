package com.s0dolamby.game.presentation.stats

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
    gameStateRepository: GameStateRepository
) : ViewModel() {
    val gameState = gameStateRepository.observeGameState()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatsScreen(
    onBack: () -> Unit,
    onRegistryClick: () -> Unit = {},
    viewModel: StatsViewModel = hiltViewModel()
) {
    val state by viewModel.gameState.collectAsState()

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
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item { RankCard(state = state) }
            item { OrnamentDivider() }
            item { BalanceChartCard(state = state) }
            item { FinancialStats(state = state) }
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

// ─── Rank card ────────────────────────────────────────────────────────────────

@Composable
private fun RankCard(state: GameState?) {
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
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
            }
            val emoji = when (state?.investorRank?.name) {
                "NEWBIE" -> "🐣"
                "AMBASSADOR" -> "📣"
                "ANALYST" -> "🔍"
                "SHARK" -> "🦈"
                "LAMBO_SENSEI" -> "🏎️"
                else -> "🐣"
            }
            Text(emoji, style = MaterialTheme.typography.displaySmall)
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
                        "%+.0f ₽".format(delta),
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
        StatRow("Баланс", "%.0f ₽".format(state?.balance ?: 0.0))
        StatRow("Всего вложено", "%.0f ₽".format(state?.totalInvested ?: 0.0))
        StatRow("Всего получено", "%.0f ₽".format(state?.totalReturned ?: 0.0))
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
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Журнал приложения",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                modifier = Modifier.weight(1f)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = onShowLog,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = FairyGold),
                    border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.4f))
                ) { Text("Просмотр") }
                Button(
                    onClick = { AppLogger.share(context) },
                    colors = ButtonDefaults.buttonColors(containerColor = FairyGold, contentColor = Color(0xFF1A0A00))
                ) { Text("Поделиться") }
            }
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
