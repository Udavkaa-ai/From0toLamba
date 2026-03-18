package com.s0dolamby.game.presentation.news

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.model.PayoutStatus
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.Warning

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewsScreen(
    onBack: () -> Unit,
    viewModel: NewsViewModel = hiltViewModel()
) {
    val updates by viewModel.updates.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Новости проектов") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") } }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (updates.isEmpty()) {
                item {
                    Text("Новостей пока нет. Начни следующий день.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 32.dp))
                }
            }
            items(updates) { update ->
                UpdateCard(update = update)
            }
        }
    }
}

@Composable
private fun UpdateCard(update: DailyUpdate) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(update.projectName, style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("День ${update.day}", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(update.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(update.body, style = MaterialTheme.typography.bodyMedium)

            if (update.payoutStatus == PayoutStatus.DELAYED) {
                Surface(color = Error.copy(alpha = 0.15f), shape = MaterialTheme.shapes.small) {
                    Text("⚠️ Выплаты задержаны", style = MaterialTheme.typography.labelSmall,
                        color = Error, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                }
            }

            if (update.redFlags.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    update.redFlags.forEach { flag ->
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(Icons.Default.Warning, null, tint = Warning, modifier = Modifier.size(14.dp))
                            Text(flag, style = MaterialTheme.typography.labelSmall, color = Warning)
                        }
                    }
                }
            }
        }
    }
}
