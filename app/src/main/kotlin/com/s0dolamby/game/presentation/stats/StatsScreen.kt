package com.s0dolamby.game.presentation.stats

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.GameState
import com.s0dolamby.game.domain.repository.GameStateRepository
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

    Scaffold(
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
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item { RankCard(state = state) }
            item { FinancialStats(state = state) }
            item { ScamStats(state = state) }
        }
    }
}

@Composable
private fun RankCard(state: GameState?) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(
            modifier = Modifier.padding(24.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text("Ранг инвестора", style = MaterialTheme.typography.labelSmall)
            Text(
                state?.investorRank?.displayName ?: "—",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Text("День ${state?.currentDay ?: 1} • Стрик ${state?.dayStreak ?: 0} дн.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun FinancialStats(state: GameState?) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Финансы", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            StatRow("Баланс", "%.2f TON".format(state?.balance ?: 0.0))
            StatRow("Всего вложено", "%.2f TON".format(state?.totalInvested ?: 0.0))
            StatRow("Всего получено", "%.2f TON".format(state?.totalReturned ?: 0.0))
            val roi = if ((state?.totalInvested ?: 0.0) > 0) {
                ((state!!.totalReturned - state.totalInvested) / state.totalInvested * 100)
            } else 0.0
            StatRow("ROI", "%+.1f%%".format(roi))
        }
    }
}

@Composable
private fun ScamStats(state: GameState?) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Детекция скама", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            StatRow("Скамов распознано", "${state?.scamsDetected ?: 0}")
            StatRow("Скамов пропущено", "${state?.scamsMissed ?: 0}")
            val total = (state?.scamsDetected ?: 0) + (state?.scamsMissed ?: 0)
            val accuracy = if (total > 0) state!!.scamsDetected.toFloat() / total * 100 else 0f
            StatRow("Точность", "%.0f%%".format(accuracy))
        }
    }
}

@Composable
private fun StatRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}
