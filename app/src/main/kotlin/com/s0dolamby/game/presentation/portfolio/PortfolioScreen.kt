package com.s0dolamby.game.presentation.portfolio

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.Warning

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PortfolioScreen(
    onBack: () -> Unit,
    onProjectClick: (String) -> Unit = {},
    viewModel: PortfolioViewModel = hiltViewModel()
) {
    val activeProjects by viewModel.activeProjects.collectAsState()
    val closedProjects by viewModel.closedProjects.collectAsState()
    val actionResult by viewModel.actionResult.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    actionResult?.let { msg ->
        LaunchedEffect(msg) {
            snackbarHostState.showSnackbar(msg, duration = SnackbarDuration.Short)
            viewModel.clearActionResult()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
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
                        onExit = { viewModel.exitProject(project.id) },
                        onAddFunds = { amount -> viewModel.addFunds(project.id, amount) },
                        onWithdraw = { amount -> viewModel.partialWithdraw(project.id, amount) }
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PortfolioProjectCard(
    project: Project,
    onClick: () -> Unit,
    onExit: () -> Unit,
    onAddFunds: (Double) -> Unit,
    onWithdraw: (Double) -> Unit
) {
    val pnl = project.currentValueTON - project.investedAmountTON
    var showAddFunds by remember { mutableStateOf(false) }
    var showWithdraw by remember { mutableStateOf(false) }

    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Text(project.claimedName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (project.isWithdrawalLocked) {
                        Icon(Icons.Default.Lock, contentDescription = "Вывод заблокирован",
                            tint = Warning, modifier = Modifier.size(16.dp))
                    }
                    Text("%.2f TON".format(project.currentValueTON),
                        style = MaterialTheme.typography.titleMedium,
                        color = if (pnl >= 0) Success else Error)
                }
            }
            Text("Вложено: %.2f TON • День ${project.daysSinceJoined}".format(project.investedAmountTON),
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("P&L: %+.2f TON".format(pnl), style = MaterialTheme.typography.bodyMedium,
                color = if (pnl >= 0) Success else Error)

            if (project.isWithdrawalLocked) {
                Surface(color = Warning.copy(alpha = 0.15f), shape = MaterialTheme.shapes.small) {
                    Text("Вывод временно заблокирован — проект испытывает трудности",
                        style = MaterialTheme.typography.labelSmall,
                        color = Warning,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = { showAddFunds = true },
                    modifier = Modifier.weight(1f),
                    enabled = !project.isWithdrawalLocked
                ) { Text("Довложить") }
                OutlinedButton(
                    onClick = { showWithdraw = true },
                    modifier = Modifier.weight(1f),
                    enabled = !project.isWithdrawalLocked
                ) { Text("Вывести часть") }
            }
            OutlinedButton(onClick = onExit, modifier = Modifier.fillMaxWidth(),
                enabled = !project.isWithdrawalLocked) {
                Text("Выйти из проекта")
            }
        }
    }

    if (showAddFunds) {
        FundsBottomSheet(
            title = "Довложить в проект",
            confirmLabel = "Довложить",
            maxAmount = null,
            onDismiss = { showAddFunds = false },
            onConfirm = { amount -> onAddFunds(amount); showAddFunds = false }
        )
    }
    if (showWithdraw) {
        FundsBottomSheet(
            title = "Вывести часть средств",
            confirmLabel = "Вывести",
            maxAmount = project.currentValueTON,
            onDismiss = { showWithdraw = false },
            onConfirm = { amount -> onWithdraw(amount); showWithdraw = false }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FundsBottomSheet(
    title: String,
    confirmLabel: String,
    maxAmount: Double?,
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit
) {
    var amountText by remember { mutableStateOf("") }
    val amount = amountText.toDoubleOrNull()
    val isValid = amount != null && amount >= 0.1 && (maxAmount == null || amount <= maxAmount)

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier.padding(horizontal = 24.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(
                value = amountText,
                onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                label = { Text("Сумма в TON") },
                suffix = { Text("TON") },
                modifier = Modifier.fillMaxWidth()
            )
            if (maxAmount != null) {
                Text("Доступно: %.2f TON".format(maxAmount),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Button(
                onClick = { amount?.let { onConfirm(it) } },
                enabled = isValid,
                modifier = Modifier.fillMaxWidth()
            ) { Text(confirmLabel) }
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
