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
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.R
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.model.ProjectType
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.theme.FairyGold

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
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                        Text("Входящие грамоты", fontWeight = FontWeight.Bold)
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Назад")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
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
                    FairyCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text("✦", color = FairyGold.copy(alpha = 0.4f), fontSize = 28.sp)
                            Text(
                                "Возвращайся завтра,\nпока грамот нет",
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold,
                                textAlign = TextAlign.Center
                            )
                            Text(
                                "Нажми «Следующая страница» на главной —\nновые грамоты появятся утром",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White.copy(alpha = 0.65f),
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            } else {
                item {
                    OrnamentDivider()
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
    FairyCard(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        // Genre badge + developer name
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                color = FairyGold.copy(alpha = 0.15f),
                shape = MaterialTheme.shapes.extraSmall
            ) {
                Text(
                    project.type.displayName(),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = FairyGold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                )
            }
            Text(
                "от ${project.developerName}",
                style = MaterialTheme.typography.labelMedium,
                color = Color.White.copy(alpha = 0.55f)
            )
        }

        Spacer(Modifier.height(6.dp))

        Text(
            project.claimedName,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )

        Text(
            project.description,
            style = MaterialTheme.typography.bodySmall,
            fontStyle = FontStyle.Italic,
            color = Color.White.copy(alpha = 0.65f),
            maxLines = 3
        )

        Spacer(Modifier.height(4.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatChip(label = "Доход", value = "${project.claimedAPY.toInt()}%")
            StatChip(label = "Участники", value = formatCount(project.claimedUserCount))
            StatChip(label = "Артель", value = "${project.claimedTeamSize}")
        }

        Spacer(Modifier.height(4.dp))

        Button(
            onClick = onClick,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = FairyGold,
                contentColor = Color(0xFF1A0A00)
            )
        ) {
            Text("Поговорить в кабаке →", fontWeight = FontWeight.SemiBold)
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
        color = Color.White.copy(alpha = 0.08f),
        shape = MaterialTheme.shapes.small
    ) {
        Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)) {
            Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                color = FairyGold.copy(alpha = 0.7f)
            )
            Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = Color.White)
        }
    }
}

private fun formatCount(count: Int): String = when {
    count >= 1_000_000 -> "%.1fM".format(count / 1_000_000.0)
    count >= 1_000 -> "%.0fK".format(count / 1_000.0)
    else -> "$count"
}
