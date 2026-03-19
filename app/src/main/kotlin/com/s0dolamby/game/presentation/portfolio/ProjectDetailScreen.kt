package com.s0dolamby.game.presentation.portfolio

import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.*
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.domain.repository.UpdateRepository
import com.s0dolamby.game.presentation.common.components.ProjectBannerImage
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.Warning
import com.s0dolamby.game.presentation.registry.displayName
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProjectDetailUiState(
    val project: Project? = null,
    val updates: List<DailyUpdate> = emptyList(),
    val postMortem: PostMortemReport? = null,
    val isLoading: Boolean = true
)

@HiltViewModel
class ProjectDetailViewModel @Inject constructor(
    private val projectRepository: ProjectRepository,
    private val updateRepository: UpdateRepository,
    private val amaRepository: AmaRepository,
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
                    _uiState.value = ProjectDetailUiState(
                        project = project,
                        updates = updates,
                        postMortem = postMortem,
                        isLoading = false
                    )
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
                title = { Text(project?.claimedName ?: "Проект") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") } }
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
                ProjectBannerImage(bannerUrl = project.bannerImageUrl, projectName = project.claimedName)
            }

            item { ProjectInfoCard(project = project) }

            if (project.isClosed) {
                item { PostMortemCard(project = project, postMortem = uiState.postMortem) }
            } else {
                item { LiveStatsCard(project = project, onManageClick = onManageClick) }
                // Show charts only when we have enough history
                if (project.userCountHistory.size >= 2 || project.apyHistory.size >= 2) {
                    item { DynamicsCard(project = project) }
                }
            }

            if (uiState.updates.isNotEmpty()) {
                item {
                    Text("История апдейтов", style = MaterialTheme.typography.titleMedium)
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
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Динамика", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

            if (project.userCountHistory.size >= 2) {
                val first = project.userCountHistory.first()
                val last = project.userCountHistory.last()
                val delta = last - first
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically) {
                    Text("Пользователи", style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("%+d за период".format(delta), style = MaterialTheme.typography.labelSmall,
                        color = if (delta >= 0) Success else Error)
                }
                SparklineChart(
                    values = project.userCountHistory.map { it.toFloat() },
                    color = if (delta >= 0) Success else Error,
                    modifier = Modifier.fillMaxWidth().height(60.dp)
                )
            }

            if (project.apyHistory.size >= 2) {
                val avgApy = project.apyHistory.average().toFloat()
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically) {
                    Text("Доходность в день", style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("~%.2f%% / день".format(avgApy), style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary)
                }
                SparklineChart(
                    values = project.apyHistory,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.fillMaxWidth().height(60.dp)
                )
            }
        }
    }
}

@Composable
private fun SparklineChart(
    values: List<Float>,
    color: Color,
    modifier: Modifier = Modifier
) {
    if (values.size < 2) return
    Canvas(modifier = modifier) {
        val min = values.min()
        val max = values.max()
        val range = (max - min).coerceAtLeast(0.0001f)
        val path = Path()
        values.forEachIndexed { i, v ->
            val x = i.toFloat() / (values.size - 1) * size.width
            val y = (1f - (v - min) / range) * size.height
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path, color, style = Stroke(width = 2.dp.toPx()))
        // Fill under the line
        val fillPath = Path().apply {
            addPath(path)
            lineTo(size.width, size.height)
            lineTo(0f, size.height)
            close()
        }
        drawPath(fillPath, color.copy(alpha = 0.15f))
    }
}

@Composable
private fun ProjectInfoCard(project: Project) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(project.claimedName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("от ${project.developerName}", style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        project.type.displayName,
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
            Text(project.description, style = MaterialTheme.typography.bodyMedium)
            Divider()
            Text("Дорожная карта", style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            project.roadmap.forEachIndexed { index, milestone ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${index + 1}.", style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(milestone, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
private fun LiveStatsCard(project: Project, onManageClick: (() -> Unit)?) {
    val pnl = project.currentValueTON - project.investedAmountTON
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Text("Текущее состояние", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                if (project.isWithdrawalLocked) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Default.Lock, null, tint = Warning, modifier = Modifier.size(14.dp))
                        Text("Вывод закрыт", style = MaterialTheme.typography.labelSmall, color = Warning)
                    }
                }
            }
            StatRow("Вложено", "%.2f TON".format(project.investedAmountTON))
            StatRow("Текущая стоимость", "%.2f TON".format(project.currentValueTON))
            StatRow("P&L", "%+.2f TON".format(pnl), color = if (pnl >= 0) Success else Error)
            StatRow("Дней в портфеле", "${project.daysSinceJoined}")
            StatRow("Заявленный APY", "${project.claimedAPY.toInt()}%")
            StatRow("Юзеров (заявлено)", formatCount(project.claimedUserCount))
            if (project.currentUserCount > 0) {
                StatRow("Юзеров (сейчас)", formatCount(project.currentUserCount))
            }
            if (onManageClick != null && project.investedAmountTON > 0) {
                Spacer(Modifier.height(4.dp))
                Button(
                    onClick = onManageClick,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !project.isWithdrawalLocked
                ) {
                    Text("Управление инвестицией →")
                }
                if (project.isWithdrawalLocked) {
                    Text(
                        "Вывод и пополнение временно недоступны",
                        style = MaterialTheme.typography.labelSmall,
                        color = Warning
                    )
                }
            }
        }
    }
}

@Composable
private fun PostMortemCard(project: Project, postMortem: PostMortemReport?) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("PostMortem — Разбор", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

            Surface(color = MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.medium) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("Архетип разработчика", style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        project.personaArchetype.displayName,   // fixed: use Russian display name
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Surface(color = MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.medium) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("Судьба проекта", style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        project.fate.displayName,
                        style = MaterialTheme.typography.titleMedium,
                        color = project.fate.color,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            if (project.lieTopics.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Темы лжи", style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    project.lieTopics.forEach { topic ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Warning, null, tint = Error, modifier = Modifier.size(14.dp))
                            Text(topic.displayName, style = MaterialTheme.typography.bodyMedium, color = Error)
                        }
                    }
                }
            }

            postMortem?.let { pm ->
                Divider()
                Text("Анализ", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(pm.analysis, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun UpdateHistoryItem(update: DailyUpdate) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(update.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Text("День ${update.day}", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(update.body, style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3)
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
private fun StatRow(label: String, value: String, color: Color = MaterialTheme.colorScheme.onSurface) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = color)
    }
}

private fun formatCount(count: Int): String = when {
    count >= 1_000_000 -> "%.1fM".format(count / 1_000_000.0)
    count >= 1_000 -> "%.0fK".format(count / 1_000.0)
    else -> "$count"
}

val ProjectType.displayName: String get() = when (this) {
    ProjectType.CLICKER -> "Кликер"
    ProjectType.P2E_RPG -> "P2E RPG"
    ProjectType.FARMING_BOT -> "Фарм-бот"
    ProjectType.REFERRAL_PYRAMID -> "Реферальная пирамида"
    ProjectType.HONEST_GAMEFI -> "Честный GameFi"
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
    ProjectFate.HONEST_FAIL -> MaterialTheme.colorScheme.onSurfaceVariant
    ProjectFate.SURVIVOR -> Success
    ProjectFate.UNICORN -> androidx.compose.ui.graphics.Color(0xFF9933FF)
}

val LieTopic.displayName: String get() = when (this) {
    LieTopic.USER_COUNT -> "Количество пользователей"
    LieTopic.DAILY_YIELD -> "Дневная доходность"
    LieTopic.LISTING_DATE -> "Дата листинга"
    LieTopic.TEAM_SIZE -> "Размер команды"
    LieTopic.AUDIT_STATUS -> "Статус аудита"
    LieTopic.PARTNER_STATUS -> "Партнёрства"
    LieTopic.WITHDRAWAL_LIMITS -> "Лимиты вывода"
}
