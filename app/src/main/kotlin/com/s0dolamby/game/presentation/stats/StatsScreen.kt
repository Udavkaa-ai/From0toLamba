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
import com.s0dolamby.game.R
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
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
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.GameState
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.TonBlue
import com.s0dolamby.game.presentation.common.theme.Warning
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import javax.inject.Inject
import kotlin.math.roundToInt

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
                title = { Text("Статистика") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") } },
                actions = {
                    TextButton(onClick = onRegistryClick) { Text("Энциклопедия") }
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
            item { BalanceChartCard(state = state) }
            item { FinancialStats(state = state) }
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
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Row(
            modifier = Modifier.padding(20.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Ранг инвестора", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    state?.investorRank?.displayName ?: "—",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    "День ${state?.currentDay ?: 1} • Стрик ${state?.dayStreak ?: 0} дн.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            // Rank emoji badge
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
    val history = state?.balanceHistory ?: emptyList()

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Text("График баланса", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                if (history.size >= 2) {
                    val delta = history.last() - history.first()
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

            if (history.size < 2) {
                Box(
                    modifier = Modifier.fillMaxWidth().height(140.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("📈", style = MaterialTheme.typography.displaySmall)
                        Text(
                            "Пройди несколько дней —\nграфик появится здесь",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                BalanceLineChart(
                    history = history,
                    modifier = Modifier.fillMaxWidth().height(160.dp)
                )
                // X-axis labels
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("День 1", style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("День ${history.size}", style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun BalanceLineChart(history: List<Double>, modifier: Modifier = Modifier) {
    val minVal = history.min()
    val maxVal = history.max()
    val range = (maxVal - minVal).coerceAtLeast(0.01)
    val isPositive = history.last() >= history.first()
    val lineColor = if (isPositive) Success else Error
    val gradientColors = if (isPositive) {
        listOf(Success.copy(alpha = 0.35f), Success.copy(alpha = 0.0f))
    } else {
        listOf(Error.copy(alpha = 0.35f), Error.copy(alpha = 0.0f))
    }

    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val padTop = 12f
        val padBottom = 12f
        val chartH = h - padTop - padBottom
        val stepX = if (history.size > 1) w / (history.size - 1).toFloat() else w

        fun xAt(i: Int) = i * stepX
        fun yAt(v: Double) = padTop + ((maxVal - v) / range * chartH).toFloat()

        // Gradient fill under the curve
        val fillPath = Path().apply {
            moveTo(xAt(0), h)
            lineTo(xAt(0), yAt(history[0]))
            for (i in 1 until history.size) {
                val x0 = xAt(i - 1); val y0 = yAt(history[i - 1])
                val x1 = xAt(i);     val y1 = yAt(history[i])
                val cx = (x0 + x1) / 2f
                cubicTo(cx, y0, cx, y1, x1, y1)
            }
            lineTo(xAt(history.size - 1), h)
            close()
        }
        drawPath(
            fillPath,
            brush = Brush.verticalGradient(gradientColors, startY = padTop, endY = h)
        )

        // Grid lines (3 horizontal)
        val gridColor = Color.White.copy(alpha = 0.06f)
        for (i in 0..2) {
            val y = padTop + chartH / 2 * i
            drawLine(gridColor, Offset(0f, y), Offset(w, y), strokeWidth = 1f)
        }

        // Line
        val linePath = Path().apply {
            moveTo(xAt(0), yAt(history[0]))
            for (i in 1 until history.size) {
                val x0 = xAt(i - 1); val y0 = yAt(history[i - 1])
                val x1 = xAt(i);     val y1 = yAt(history[i])
                val cx = (x0 + x1) / 2f
                cubicTo(cx, y0, cx, y1, x1, y1)
            }
        }
        drawPath(linePath, color = lineColor, style = Stroke(width = 3f, cap = StrokeCap.Round))

        // Dot at last point
        val lastX = xAt(history.size - 1)
        val lastY = yAt(history.last())
        drawCircle(color = lineColor, radius = 6f, center = Offset(lastX, lastY))
        drawCircle(color = Color.White, radius = 3f, center = Offset(lastX, lastY))
    }
}

// ─── Financial stats ─────────────────────────────────────────────────────────

@Composable
private fun FinancialStats(state: GameState?) {
    val roi = if (state != null && state.totalInvested > 0) {
        (state.totalReturned - state.totalInvested) / state.totalInvested * 100
    } else 0.0
    val roiPositive = roi >= 0

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Финансы", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

            // ROI highlighted
            Surface(
                color = if (roiPositive) Success.copy(alpha = 0.12f) else Error.copy(alpha = 0.12f),
                shape = RoundedCornerShape(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("ROI", style = MaterialTheme.typography.titleSmall,
                        color = if (roiPositive) Success else Error)
                    Text(
                        "%+.1f%%".format(roi),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = if (roiPositive) Success else Error
                    )
                }
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
            StatRow("Баланс", "%.0f ₽".format(state?.balance ?: 0.0))
            StatRow("Всего вложено", "%.0f ₽".format(state?.totalInvested ?: 0.0))
            StatRow("Всего получено", "%.0f ₽".format(state?.totalReturned ?: 0.0))
        }
    }
}

// ─── Scam stats ───────────────────────────────────────────────────────────────

@Composable
private fun ScamStats(state: GameState?) {
    val detected = state?.scamsDetected ?: 0
    val missed = state?.scamsMissed ?: 0
    val total = detected + missed
    val accuracy = if (total > 0) detected.toFloat() / total else 0f

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Детекция скама", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

            // Accuracy progress bar
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Точность", style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("%.0f%%".format(accuracy * 100), style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = when {
                            accuracy >= 0.7f -> Success
                            accuracy >= 0.4f -> Warning
                            else -> Error
                        })
                }
                LinearProgressIndicator(
                    progress = { accuracy },
                    modifier = Modifier.fillMaxWidth().height(8.dp),
                    color = when {
                        accuracy >= 0.7f -> Success
                        accuracy >= 0.4f -> Warning
                        else -> Error
                    },
                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                )
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                ScamStatBox(label = "Распознано", value = "$detected", color = Success,
                    modifier = Modifier.weight(1f))
                ScamStatBox(label = "Пропущено", value = "$missed", color = Error,
                    modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun ScamStatBox(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Surface(
        color = color.copy(alpha = 0.10f),
        shape = RoundedCornerShape(8.dp),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(value, style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold, color = color)
            Text(label, style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

@Composable
private fun StatRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun LogCard(onShowLog: () -> Unit) {
    val context = LocalContext.current
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Логи приложения", style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onShowLog) { Text("Просмотр") }
                Button(onClick = { AppLogger.share(context) }) { Text("Поделиться") }
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
        title = { Text("Лог приложения") },
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
