package com.s0dolamby.game.presentation.portfolio

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.*
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.domain.repository.UpdateRepository
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.ProjectBannerImage
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.Warning
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted

data class ProjectDetailUiState(
    val project: Project? = null,
    val updates: List<DailyUpdate> = emptyList(),
    val postMortem: PostMortemReport? = null,
    val isLoading: Boolean = true,
    val isGeneratingPostMortem: Boolean = false
)

@HiltViewModel
class ProjectDetailViewModel @Inject constructor(
    private val projectRepository: ProjectRepository,
    private val updateRepository: UpdateRepository,
    private val amaRepository: AmaRepository,
    private val generatePostMortemUseCase: com.s0dolamby.game.domain.usecase.GeneratePostMortemUseCase,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val projectId: String = checkNotNull(savedStateHandle["projectId"])

    private val _uiState = MutableStateFlow(ProjectDetailUiState())
    val uiState: StateFlow<ProjectDetailUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            projectRepository.getActiveProjects()
                .combine(projectRepository.getClosedProjects()) { active, closed -> active + closed }
                .collect { all ->
                    val project = all.find { it.id == projectId }
                        ?: projectRepository.getProjectById(projectId)
                    val updates = updateRepository.getUpdatesForProject(projectId)
                    val postMortem = if (project?.isClosed == true) amaRepository.getPostMortem(projectId) else null
                    _uiState.update {
                        it.copy(
                            project = project,
                            updates = updates,
                            postMortem = postMortem,
                            isLoading = false
                        )
                    }
                    // Lazy generation: дело закрыто, отчёта нет — старец пишет.
                    if (project?.isClosed == true && postMortem == null && !_uiState.value.isGeneratingPostMortem) {
                        _uiState.update { it.copy(isGeneratingPostMortem = true) }
                        val result = generatePostMortemUseCase(projectId)
                        _uiState.update {
                            it.copy(
                                postMortem = result.getOrNull(),
                                isGeneratingPostMortem = false
                            )
                        }
                    }
                }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectDetailScreen(
    onBack: () -> Unit,
    onManageClick: (() -> Unit)? = null,
    viewModel: ProjectDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val project = uiState.project

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(project?.claimedName ?: Strings.t("detail.title.fallback")) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, Strings.t("btn.back")) } }
            )
        }
    ) { padding ->
        if (uiState.isLoading || project == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                ProjectBannerImage(project = project)
            }

            item { ProjectInfoCard(project = project) }

            if (project.isClosed) {
                item {
                    PostMortemCard(
                        project = project,
                        postMortem = uiState.postMortem,
                        isGenerating = uiState.isGeneratingPostMortem
                    )
                }
            } else {
                item { LiveStatsCard(project = project, onManageClick = onManageClick) }
                // Show charts only when we have enough history
                if (project.userCountHistory.size >= 2 || project.apyHistory.size >= 2) {
                    item { DynamicsCard(project = project) }
                }
            }

            if (uiState.updates.isNotEmpty()) {
                item {
                    Text(Strings.t("detail.section.history"), style = MaterialTheme.typography.titleMedium)
                }
                items(uiState.updates.reversed()) { update ->
                    UpdateHistoryItem(update = update)
                }
            }
        }
    }
}

@Composable
private fun DynamicsCard(project: Project) {
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(Strings.t("detail.section.dynamics"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                Strings.t("chart.tapHint"),
                style = MaterialTheme.typography.labelSmall,
                color = LocalContentColorMuted.current
            )

            // История хранит последние 30 дней — первый видимый день кривой
            val historyStartDay = { size: Int -> (project.daysSinceJoined - size + 1).coerceAtLeast(1) }

            if (project.userCountHistory.size >= 2) {
                val first = project.userCountHistory.first()
                val last = project.userCountHistory.last()
                val delta = last - first
                SparklineChart(
                    values = project.userCountHistory.map { it.toFloat() },
                    color = if (delta >= 0) Success else Error,
                    legend = Strings.t("detail.dyn.users"),
                    trailing = Strings.t("detail.dyn.usersDelta", delta),
                    trailingColor = if (delta >= 0) Success else Error,
                    startDay = historyStartDay(project.userCountHistory.size),
                    valueFormatter = { "%,.0f".format(it) },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            if (project.apyHistory.size >= 2) {
                val avgApy = project.apyHistory.average().toFloat()
                SparklineChart(
                    values = project.apyHistory,
                    color = LocalAccentOnCard.current,
                    legend = Strings.t("detail.dyn.dailyYield"),
                    trailing = Strings.t("detail.dyn.dailyYieldVal", avgApy),
                    trailingColor = LocalAccentOnCard.current,
                    startDay = historyStartDay(project.apyHistory.size),
                    valueFormatter = { "%.1f%%".format(it) },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

/**
 * График с легендой, подписями осей и интерактивом: тап или ведение пальцем
 * по полотну подсвечивает точку и показывает «день N · значение».
 */
@Composable
private fun SparklineChart(
    values: List<Float>,
    color: Color,
    legend: String,
    trailing: String,
    trailingColor: Color,
    startDay: Int,
    valueFormatter: (Float) -> String,
    modifier: Modifier = Modifier
) {
    if (values.size < 2) return
    var selectedIdx by remember(values) { mutableStateOf<Int?>(null) }
    val textMeasurer = androidx.compose.ui.text.rememberTextMeasurer()
    val axisLabelColor = LocalContentColorMuted.current
    val axisLabelStyle = androidx.compose.ui.text.TextStyle(
        fontSize = 9.sp,
        color = axisLabelColor
    )
    val bubbleTextStyle = androidx.compose.ui.text.TextStyle(
        fontSize = 11.sp,
        color = Color.White,
        fontWeight = FontWeight.SemiBold
    )
    val min = values.min()
    val max = values.max()
    // Шаблон плашки — Strings.t только из composable-скоупа, не из Canvas
    val pointTemplate = Strings.t("chart.point")

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        // Легенда: цветной маркер + подпись ряда, справа — сводка
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .background(color, MaterialTheme.shapes.extraSmall)
                )
                Text(legend, style = MaterialTheme.typography.bodyMedium, color = LocalContentColorMuted.current)
            }
            Text(trailing, style = MaterialTheme.typography.labelSmall, color = trailingColor)
        }

        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(84.dp)
                .pointerInput(values) {
                    // Тап — выбрать/снять точку
                    detectTapGestures { offset ->
                        val idx = ((offset.x / size.width) * (values.size - 1)).toInt()
                            .coerceIn(0, values.size - 1)
                        selectedIdx = if (selectedIdx == idx) null else idx
                    }
                }
                .pointerInput(values) {
                    // Ведение пальцем — скраббинг по точкам
                    detectHorizontalDragGestures { change, _ ->
                        val idx = ((change.position.x / size.width) * (values.size - 1)).toInt()
                            .coerceIn(0, values.size - 1)
                        selectedIdx = idx
                    }
                }
        ) {
            val range = (max - min).coerceAtLeast(0.0001f)
            fun xAt(i: Int) = i.toFloat() / (values.size - 1) * size.width
            fun yAt(v: Float) = (1f - (v - min) / range) * size.height

            // Сетка: верхняя/средняя/нижняя направляющие
            val gridColor = axisLabelColor.copy(alpha = 0.15f)
            for (frac in listOf(0f, 0.5f, 1f)) {
                val y = size.height * frac
                drawLine(gridColor, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
            }

            val path = Path()
            values.forEachIndexed { i, v ->
                if (i == 0) path.moveTo(xAt(i), yAt(v)) else path.lineTo(xAt(i), yAt(v))
            }
            drawPath(path, color, style = Stroke(width = 2.dp.toPx()))
            val fillPath = Path().apply {
                addPath(path)
                lineTo(size.width, size.height)
                lineTo(0f, size.height)
                close()
            }
            drawPath(fillPath, color.copy(alpha = 0.15f))

            // Подписи оси Y: max сверху, min снизу (размерность из formatter'а)
            drawText(
                textMeasurer.measure(valueFormatter(max), axisLabelStyle),
                topLeft = Offset(2.dp.toPx(), 1.dp.toPx())
            )
            drawText(
                textMeasurer.measure(valueFormatter(min), axisLabelStyle),
                topLeft = Offset(2.dp.toPx(), size.height - 12.sp.toPx())
            )

            // Выбранная точка: вертикаль + маркер + плашка «день N · значение»
            selectedIdx?.let { idx ->
                val px = xAt(idx)
                val py = yAt(values[idx])
                drawLine(
                    color.copy(alpha = 0.6f),
                    Offset(px, 0f), Offset(px, size.height),
                    strokeWidth = 1.5f
                )
                drawCircle(color, radius = 4.dp.toPx(), center = Offset(px, py))
                drawCircle(Color.White, radius = 2.dp.toPx(), center = Offset(px, py))

                val label = pointTemplate.format(startDay + idx, valueFormatter(values[idx]))
                val measured = textMeasurer.measure(label, bubbleTextStyle)
                val pad = 6.dp.toPx()
                val bw = measured.size.width + pad * 2
                val bh = measured.size.height + pad
                val bx = (px - bw / 2f).coerceIn(0f, size.width - bw)
                val by = (py - bh - 8.dp.toPx()).coerceAtLeast(0f)
                drawRoundRect(
                    Color(0xE6060412),
                    topLeft = Offset(bx, by),
                    size = androidx.compose.ui.geometry.Size(bw, bh),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(6.dp.toPx())
                )
                drawText(measured, topLeft = Offset(bx + pad, by + pad / 2f))
            }
        }

        // Ось X: диапазон дней
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                Strings.t("chart.day", startDay),
                style = MaterialTheme.typography.labelSmall,
                color = LocalContentColorMuted.current
            )
            Text(
                Strings.t("chart.day", startDay + values.size - 1),
                style = MaterialTheme.typography.labelSmall,
                color = LocalContentColorMuted.current
            )
        }
    }
}

@Composable
private fun ProjectInfoCard(project: Project) {
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(project.claimedName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text(Strings.t("detail.info.byOwner", project.developerName), style = MaterialTheme.typography.bodyMedium,
                        color = LocalContentColorMuted.current)
                }
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.small
                ) {
                    // surfaceVariant ТЁМНЫЙ в обеих темах — без явного цвета
                    // текст наследовал onCard (тёмная сепия в тёплой теме)
                    // и пропадал на тёмном чипе.
                    Text(
                        project.type.displayName,
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
            Text(project.description, style = MaterialTheme.typography.bodyMedium)
            Divider()
            Text(Strings.t("detail.info.roadmap"), style = MaterialTheme.typography.labelSmall,
                color = LocalContentColorMuted.current)
            project.roadmap.forEachIndexed { index, milestone ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${index + 1}.", style = MaterialTheme.typography.bodyMedium,
                        color = LocalContentColorMuted.current)
                    Text(milestone, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
private fun LiveStatsCard(project: Project, onManageClick: (() -> Unit)?) {
    val pnl = project.currentValueRubles - project.investedAmountRubles
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Text(Strings.t("detail.section.live"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                if (project.isWithdrawalLocked) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Default.Lock, null, tint = Warning, modifier = Modifier.size(14.dp))
                        Text(Strings.t("detail.withdrawal.closed"), style = MaterialTheme.typography.labelSmall, color = Warning)
                    }
                }
            }
            StatRow(Strings.t("detail.stat.invested"), com.s0dolamby.game.presentation.common.format.formatGroshes(project.investedAmountRubles))
            StatRow(Strings.t("detail.stat.current"), com.s0dolamby.game.presentation.common.format.formatGroshes(project.currentValueRubles))
            StatRow(Strings.t("detail.stat.pnl"), "%+.0f г".format(pnl), color = if (pnl >= 0) Success else Error)
            StatRow(Strings.t("detail.stat.days"), "${project.daysSinceJoined}")
            StatRow(Strings.t("detail.stat.apy"), "${project.claimedAPY.toInt()}%")
            StatRow(Strings.t("detail.stat.usersClaimed"), formatCount(project.claimedUserCount))
            if (project.currentUserCount > 0) {
                StatRow(Strings.t("detail.stat.usersNow"), formatCount(project.currentUserCount))
            }
            if (onManageClick != null && project.investedAmountRubles > 0) {
                Spacer(Modifier.height(4.dp))
                Button(
                    onClick = onManageClick,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !project.isWithdrawalLocked
                ) {
                    Text(Strings.t("detail.btn.manage"))
                }
                if (project.isWithdrawalLocked) {
                    Text(
                        Strings.t("detail.withdrawal.tempUnavail"),
                        style = MaterialTheme.typography.labelSmall,
                        color = Warning
                    )
                }
            }
        }
    }
}

@Composable
private fun PostMortemCard(project: Project, postMortem: PostMortemReport?, isGenerating: Boolean = false) {
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(Strings.t("detail.postmortem.title"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

            // Раскрытие личины — с портретом дельца и приметами из летописи,
            // чтобы игрок учился распознавать архетип в следующих делах
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                com.s0dolamby.game.presentation.common.components.PersonaAvatar(
                    archetype = project.personaArchetype,
                    size = 52.dp
                )
                Column {
                    Text(Strings.t("detail.postmortem.archetype"), style = MaterialTheme.typography.labelSmall,
                        color = LocalContentColorMuted.current)
                    Text(
                        Strings.t("persona.${project.personaArchetype.name}"),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            com.s0dolamby.game.presentation.common.i18n.loreFor(
                com.s0dolamby.game.domain.achievements.RevealTopic(
                    com.s0dolamby.game.domain.achievements.RevealKind.ARCHETYPE,
                    project.personaArchetype.name
                )
            )?.let { lore ->
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    lore.hints.forEach { hint ->
                        Text(
                            "• $hint",
                            style = MaterialTheme.typography.labelMedium,
                            color = LocalContentColorMuted.current
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.padding(vertical = 4.dp)) {
                    Text(Strings.t("detail.postmortem.fate"), style = MaterialTheme.typography.labelSmall,
                        color = LocalContentColorMuted.current)
                    Text(
                        project.fate.displayName,
                        style = MaterialTheme.typography.titleMedium,
                        color = project.fate.color,
                        fontWeight = FontWeight.Bold
                    )
                }
                Column(modifier = Modifier.padding(vertical = 4.dp), horizontalAlignment = Alignment.End) {
                    Text(Strings.t("detail.postmortem.pnl"), style = MaterialTheme.typography.labelSmall,
                        color = LocalContentColorMuted.current)
                    val pnl = project.currentValueRubles - project.investedAmountRubles
                    Text(
                        com.s0dolamby.game.presentation.common.format.formatGroshesSigned(pnl),
                        style = MaterialTheme.typography.titleMedium,
                        color = if (pnl >= 0) Success else Error,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Divider(color = LocalContentColor.current.copy(alpha = 0.15f))
            Text(Strings.t("detail.postmortem.analysis"), style = MaterialTheme.typography.labelSmall,
                color = LocalContentColorMuted.current)
            when {
                postMortem != null -> Text(postMortem.analysis, style = MaterialTheme.typography.bodyMedium)
                isGenerating -> Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(14.dp),
                        strokeWidth = 2.dp
                    )
                    Text(
                        Strings.t("detail.postmortem.thinking"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = LocalContentColorMuted.current
                    )
                }
                else -> Text(
                    Strings.t("detail.postmortem.unavailable"),
                    style = MaterialTheme.typography.bodySmall,
                    color = LocalContentColorMuted.current
                )
            }
        }
    }
}

@Composable
private fun UpdateHistoryItem(update: DailyUpdate) {
    FairyCard(modifier = Modifier.fillMaxWidth(), innerPadding = 12) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(update.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Text(Strings.t("detail.day", update.day), style = MaterialTheme.typography.labelSmall,
                    color = LocalContentColorMuted.current)
            }
            Text(update.body, style = MaterialTheme.typography.bodyMedium,
                color = LocalContentColorMuted.current, maxLines = 3)
            if (update.redFlags.isNotEmpty()) {
                update.redFlags.forEach { flag ->
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Warning, null, tint = Warning, modifier = Modifier.size(12.dp))
                        Text(flag, style = MaterialTheme.typography.labelSmall, color = Warning)
                    }
                }
            }
        }
    }
}

@Composable
private fun StatRow(label: String, value: String, color: Color = LocalContentColor.current) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = LocalContentColorMuted.current)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = color)
    }
}

private fun formatCount(count: Int): String = when {
    count >= 1_000_000 -> "%.1fM".format(count / 1_000_000.0)
    count >= 1_000 -> "%.0fK".format(count / 1_000.0)
    else -> "$count"
}

val ProjectType.displayName: String get() = when (this) {
    ProjectType.CARD_GAME -> "Азартная игра"
    ProjectType.TREASURE_HUNT -> "Поиск клада"
    ProjectType.POTION_BREW -> "Зелейное дело"
    ProjectType.GUILD_SCHEME -> "Артель / Гильдия"
    ProjectType.HONEST_TRADE -> "Честная торговля"
}

val ProjectFate.displayName: String get() = when (this) {
    ProjectFate.INSTANT_SCAM -> "Мгновенный скам"
    ProjectFate.SLOW_DRAIN -> "Медленный слив"
    ProjectFate.HONEST_FAIL -> "Честный провал"
    ProjectFate.SURVIVOR -> "Выживший"
    ProjectFate.UNICORN -> "Единорог"
}

val ProjectFate.color: androidx.compose.ui.graphics.Color @Composable get() = when (this) {
    ProjectFate.INSTANT_SCAM -> Error
    ProjectFate.SLOW_DRAIN -> Warning
    ProjectFate.HONEST_FAIL -> LocalContentColorMuted.current
    ProjectFate.SURVIVOR -> Success
    ProjectFate.UNICORN -> androidx.compose.ui.graphics.Color(0xFF9933FF)
}

val PersonaArchetype.displayName: String get() = when (this) {
    PersonaArchetype.BURATINO -> "Буратино"
    PersonaArchetype.BOYARIN -> "Боярин"
    PersonaArchetype.KOLOBOK -> "Колобок"
    PersonaArchetype.KOSCHEI -> "Кощей"
    PersonaArchetype.ZOLUSHKA -> "Золушка"
    PersonaArchetype.BABA_YAGA -> "Баба-Яга"
    PersonaArchetype.IVAN_DURAK -> "Иван-дурак"
}
