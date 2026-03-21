package com.s0dolamby.game.presentation.inbox

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.R
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.model.ProjectType
import com.s0dolamby.game.presentation.common.components.ScreenBackground

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(
    onBack: () -> Unit,
    onProjectClick: (String) -> Unit,
    viewModel: InboxViewModel = hiltViewModel()
) {
    val projects by viewModel.inboxProjects.collectAsState()

    ScreenBackground(R.drawable.inbox_bg) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Входящие предложения") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Назад")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (projects.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 64.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text("🤷", style = MaterialTheme.typography.displayMedium)
                            Text(
                                "Возвращайся завтра,\nпока проектов нет",
                                style = MaterialTheme.typography.titleMedium,
                                textAlign = TextAlign.Center
                            )
                            Text(
                                "Нажми «Следующий день» на главной —\nновые предложения появятся в inbox",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }
            items(projects) { project ->
                InboxProjectCard(project = project, onClick = { onProjectClick(project.id) })
            }
        }
    }
    } // ScreenBackground
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InboxProjectCard(project: Project, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {

            // Genre badge + developer name on same row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = MaterialTheme.colorScheme.secondaryContainer,
                    shape = MaterialTheme.shapes.extraSmall
                ) {
                    Text(
                        project.type.displayName(),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
                Text(
                    "от ${project.developerName}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Project name
            Text(project.claimedName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

            // Description — italic, muted
            Text(
                project.description,
                style = MaterialTheme.typography.bodySmall,
                fontStyle = FontStyle.Italic,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 3
            )

            // Stats
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatChip(label = "APY", value = "${project.claimedAPY.toInt()}%")
                StatChip(label = "Юзеры", value = formatCount(project.claimedUserCount))
                StatChip(label = "Команда", value = "${project.claimedTeamSize}")
            }

            Button(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
                Text("Провести AMA →")
            }
        }
    }
}

private fun ProjectType.displayName(): String = when (this) {
    ProjectType.CARD_GAME -> "Азартная игра"
    ProjectType.TREASURE_HUNT -> "Поиск клада"
    ProjectType.POTION_BREW -> "Зелейное дело"
    ProjectType.GUILD_SCHEME -> "Артель / Гильдия"
    ProjectType.HONEST_TRADE -> "Честная торговля"
}

@Composable
private fun StatChip(label: String, value: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.small
    ) {
        Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)) {
            Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
        }
    }
}

private fun formatCount(count: Int): String = when {
    count >= 1_000_000 -> "%.1fM".format(count / 1_000_000.0)
    count >= 1_000 -> "%.0fK".format(count / 1_000.0)
    else -> "$count"
}
