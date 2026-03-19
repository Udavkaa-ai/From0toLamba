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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.presentation.common.components.ProjectBannerImage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(
    onBack: () -> Unit,
    onProjectClick: (String) -> Unit,
    viewModel: InboxViewModel = hiltViewModel()
) {
    val projects by viewModel.inboxProjects.collectAsState()

    Scaffold(
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
}

@Composable
private fun InboxProjectCard(project: Project, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            ProjectBannerImage(bannerUrl = project.bannerImageUrl, projectName = project.claimedName)

            Text(project.claimedName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text("от ${project.developerName}", style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(project.description, style = MaterialTheme.typography.bodyMedium,
                maxLines = 2)

            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
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

@Composable
private fun StatChip(label: String, value: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.small
    ) {
        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
        }
    }
}

private fun formatCount(count: Int): String = when {
    count >= 1_000_000 -> "%.1fM".format(count / 1_000_000.0)
    count >= 1_000 -> "%.0fK".format(count / 1_000.0)
    else -> "$count"
}
