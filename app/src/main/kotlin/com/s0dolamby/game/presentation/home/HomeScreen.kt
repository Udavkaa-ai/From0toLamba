package com.s0dolamby.game.presentation.home

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.presentation.common.components.ProjectBannerImage
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.TonBlue

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onInboxClick: () -> Unit,
    onPortfolioClick: () -> Unit,
    onNewsClick: () -> Unit,
    onStatsClick: () -> Unit,
    onProjectClick: (String) -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val gameState by viewModel.gameState.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("С 0 до Ламбы", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = onStatsClick) {
                        Icon(Icons.Default.BarChart, contentDescription = "Статистика")
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = true,
                    onClick = {},
                    icon = { Icon(Icons.Default.Home, null) },
                    label = { Text("Главная") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onInboxClick,
                    icon = {
                        BadgedBox(badge = {
                            val count = gameState?.pendingInbox?.size ?: 0
                            if (count > 0) Badge { Text("$count") }
                        }) { Icon(Icons.Default.Email, null) }
                    },
                    label = { Text("Входящие") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onPortfolioClick,
                    icon = { Icon(Icons.Default.AccountBalance, null) },
                    label = { Text("Портфель") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNewsClick,
                    icon = { Icon(Icons.Default.Newspaper, null) },
                    label = { Text("Новости") }
                )
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                BalanceCard(
                    balance = gameState?.balance ?: 0.0,
                    day = gameState?.currentDay ?: 1,
                    rank = gameState?.investorRank?.displayName ?: "Новичок",
                    onAdvanceDayClick = viewModel::advanceDay,
                    isLoading = isLoading
                )
            }

            val activeProjects = gameState?.activeProjects ?: emptyList()
            if (activeProjects.isNotEmpty()) {
                item {
                    Text(
                        "Активные проекты (${activeProjects.size}/5)",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                items(activeProjects) { project ->
                    ActiveProjectCard(project = project, onClick = { onProjectClick(project.id) })
                }
            } else {
                item {
                    EmptyProjectsCard(onInboxClick = onInboxClick)
                }
            }
        }
    }
}

@Composable
private fun BalanceCard(
    balance: Double,
    day: Int,
    rank: String,
    onAdvanceDayClick: () -> Unit,
    isLoading: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Баланс", style = MaterialTheme.typography.labelSmall)
                    Text(
                        "%.2f TON".format(balance),
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold,
                        color = TonBlue
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("День $day", style = MaterialTheme.typography.bodyMedium)
                    Text(rank, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Button(
                onClick = onAdvanceDayClick,
                enabled = !isLoading,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                }
                Text("Следующий день →")
            }
        }
    }
}

@Composable
private fun ActiveProjectCard(project: Project, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ProjectBannerImage(bannerUrl = project.bannerImageUrl, projectName = project.claimedName)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(project.claimedName, style = MaterialTheme.typography.titleMedium)
                    Text(project.developerName, style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        "%.2f TON".format(project.currentValueTON),
                        style = MaterialTheme.typography.titleMedium,
                        color = if (project.currentValueTON >= project.investedAmountTON) Success else MaterialTheme.colorScheme.error
                    )
                    Text("День ${project.daysSinceJoined}", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
private fun EmptyProjectsCard(onInboxClick: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(24.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Нет активных проектов", style = MaterialTheme.typography.titleMedium)
            Text(
                "Зайди во Входящие, проведи AMA с разработчиком и реши, стоит ли инвестировать",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            OutlinedButton(onClick = onInboxClick) { Text("Открыть входящие") }
        }
    }
}
