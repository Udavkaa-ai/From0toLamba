package com.s0dolamby.game.presentation.portfolio

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.Success

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PortfolioScreen(
    onBack: () -> Unit,
    onProjectClick: (String) -> Unit = {},
    viewModel: PortfolioViewModel = hiltViewModel()
) {
    val activeProjects by viewModel.activeProjects.collectAsState()
    val closedProjects by viewModel.closedProjects.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Портфель") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") } }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (activeProjects.isNotEmpty()) {
                item { Text("Активные", style = MaterialTheme.typography.titleMedium) }
                items(activeProjects) { project ->
                    PortfolioProjectCard(
                        project = project,
                        onClick = { onProjectClick(project.id) },
                        onExit = { viewModel.exitProject(project.id) }
                    )
                }
            }
            if (closedProjects.isNotEmpty()) {
                item { Text("История", style = MaterialTheme.typography.titleMedium) }
                items(closedProjects) { project ->
                    ClosedProjectCard(project = project, onClick = { onProjectClick(project.id) })
                }
            }
        }
    }
}

@Composable
private fun PortfolioProjectCard(project: Project, onClick: () -> Unit, onExit: () -> Unit) {
    val pnl = project.currentValueTON - project.investedAmountTON
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(project.claimedName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("%.2f TON".format(project.currentValueTON), style = MaterialTheme.typography.titleMedium,
                    color = if (pnl >= 0) Success else Error)
            }
            Text("Вложено: %.2f TON • День ${project.daysSinceJoined}".format(project.investedAmountTON),
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("P&L: %+.2f TON".format(pnl), style = MaterialTheme.typography.bodyMedium,
                color = if (pnl >= 0) Success else Error)
            OutlinedButton(onClick = onExit, modifier = Modifier.fillMaxWidth()) {
                Text("Выйти из проекта")
            }
        }
    }
}

@Composable
private fun ClosedProjectCard(project: Project, onClick: () -> Unit) {
    val pnl = project.currentValueTON - project.investedAmountTON
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(project.claimedName, style = MaterialTheme.typography.titleMedium)
            Text(project.closureReason ?: "Закрыт", style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("P&L: %+.2f TON".format(pnl), style = MaterialTheme.typography.bodyMedium,
                color = if (pnl >= 0) Success else Error, fontWeight = FontWeight.Medium)
        }
    }
}
