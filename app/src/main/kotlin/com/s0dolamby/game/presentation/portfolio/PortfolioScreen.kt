package com.s0dolamby.game.presentation.portfolio

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import com.s0dolamby.game.domain.model.ProjectType
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.R
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.Warning

fun Project.displayName() = claimedName

private enum class SheetType { ADD_FUNDS, WITHDRAW }
private data class ActiveSheet(val project: Project, val type: SheetType)

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

    // Sheet state hoisted outside LazyColumn to avoid ModalBottomSheet-in-LazyColumn crash
    var activeSheet by remember { mutableStateOf<ActiveSheet?>(null) }

    actionResult?.let { msg ->
        LaunchedEffect(msg) {
            snackbarHostState.showSnackbar(msg, duration = SnackbarDuration.Short)
            viewModel.clearActionResult()
        }
    }

    ScreenBackground(R.drawable.portfolio_bg) {
    Scaffold(
        containerColor = Color.Transparent,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                        Text("Казна", fontWeight = FontWeight.Bold)
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                    }
                },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (activeProjects.isEmpty() && closedProjects.isEmpty()) {
                item {
                    FairyCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text("✦", color = FairyGold.copy(alpha = 0.4f), fontSize = 28.sp)
                            Text(
                                "Казна пуста",
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                "Поговори с Дельцами во Входящих грамотах и вложи рубли",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White.copy(alpha = 0.65f)
                            )
                        }
                    }
                }
            }
            if (activeProjects.isNotEmpty()) {
                item {
                    OrnamentDivider()
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Текущие вложения",
                        style = MaterialTheme.typography.titleMedium,
                        color = FairyGold.copy(alpha = 0.85f),
                        fontWeight = FontWeight.SemiBold
                    )
                }
                items(activeProjects) { project ->
                    PortfolioProjectCard(
                        project = project,
                        onClick = { onProjectClick(project.id) },
                        onExit = { viewModel.exitProject(project.id) },
                        onAddFunds = { activeSheet = ActiveSheet(project, SheetType.ADD_FUNDS) },
                        onWithdraw = { activeSheet = ActiveSheet(project, SheetType.WITHDRAW) }
                    )
                }
            }
            if (closedProjects.isNotEmpty()) {
                item {
                    OrnamentDivider()
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Летопись сделок",
                        style = MaterialTheme.typography.titleMedium,
                        color = FairyGold.copy(alpha = 0.85f),
                        fontWeight = FontWeight.SemiBold
                    )
                }
                items(closedProjects) { project ->
                    ClosedProjectCard(project = project, onClick = { onProjectClick(project.id) })
                }
            }
        }
    }

    // Bottom sheets rendered outside LazyColumn
    activeSheet?.let { sheet ->
        when (sheet.type) {
            SheetType.ADD_FUNDS -> FundsBottomSheet(
                title = "Довложить в проект",
                confirmLabel = "Довложить",
                maxAmount = null,
                onDismiss = { activeSheet = null },
                onConfirm = { amount ->
                    viewModel.addFunds(sheet.project.id, amount)
                    activeSheet = null
                }
            )
            SheetType.WITHDRAW -> WithdrawBottomSheet(
                project = sheet.project,
                onDismiss = { activeSheet = null },
                onConfirm = { amount ->
                    viewModel.partialWithdraw(sheet.project.id, amount)
                    activeSheet = null
                }
            )
        }
    }
    } // ScreenBackground
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PortfolioProjectCard(
    project: Project,
    onClick: () -> Unit,
    onExit: () -> Unit,
    onAddFunds: () -> Unit,
    onWithdraw: () -> Unit
) {
    val pnl = project.currentValueRubles - project.investedAmountRubles

    FairyCard(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(project.claimedName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (project.isWithdrawalLocked) {
                    Icon(Icons.Default.Lock, contentDescription = "Вывод заблокирован",
                        tint = Warning, modifier = Modifier.size(16.dp))
                }
                Text(
                    "%.0f ₽".format(project.currentValueRubles),
                    style = MaterialTheme.typography.titleMedium,
                    color = if (pnl >= 0) Success else Error,
                    fontWeight = FontWeight.Bold
                )
            }
        }
        Text(
            "Вложено: %.0f ₽ • День ${project.daysSinceJoined}".format(project.investedAmountRubles),
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(alpha = 0.6f)
        )
        Text(
            "П&У: %+.0f ₽".format(pnl),
            style = MaterialTheme.typography.bodyMedium,
            color = if (pnl >= 0) Success else Error,
            fontWeight = FontWeight.Medium
        )

        if (project.isWithdrawalLocked) {
            Surface(color = Warning.copy(alpha = 0.15f), shape = MaterialTheme.shapes.small) {
                Text(
                    "Вывод заблокирован — проект испытывает трудности",
                    style = MaterialTheme.typography.labelSmall,
                    color = Warning,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }

        Spacer(Modifier.height(4.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = onAddFunds,
                modifier = Modifier.weight(1f),
                enabled = !project.isWithdrawalLocked,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = FairyGold),
                border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.4f))
            ) { Text("Довложить") }
            OutlinedButton(
                onClick = onWithdraw,
                modifier = Modifier.weight(1f),
                enabled = !project.isWithdrawalLocked,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = FairyGold),
                border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.4f))
            ) { Text("Вывести") }
        }
        OutlinedButton(
            onClick = onExit,
            modifier = Modifier.fillMaxWidth(),
            enabled = !project.isWithdrawalLocked,
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Error),
            border = androidx.compose.foundation.BorderStroke(1.dp, Error.copy(alpha = 0.4f))
        ) { Text("Покинуть дело") }
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
    val isValid = amount != null && amount >= 5.0 && (maxAmount == null || amount <= maxAmount)
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier.padding(horizontal = 24.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(
                value = amountText,
                onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                label = { Text("Сумма в рублях") },
                suffix = { Text("₽") },
                modifier = Modifier.fillMaxWidth()
            )
            if (maxAmount != null) {
                Text(
                    "Доступно: %.0f ₽".format(maxAmount),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Button(
                onClick = { amount?.let { onConfirm(it) } },
                enabled = isValid,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = FairyGold, contentColor = Color(0xFF1A0A00))
            ) { Text(confirmLabel, fontWeight = FontWeight.SemiBold) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WithdrawBottomSheet(
    project: Project,
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit
) {
    var amountText by remember { mutableStateOf("") }
    val amount = amountText.toDoubleOrNull()

    // Per-type limits
    val withdrawLimit: Double? = when (project.type) {
        ProjectType.POTION_BREW, ProjectType.GUILD_SCHEME -> project.investedAmountRubles * 0.25
        else -> project.currentValueRubles
    }
    val hasFee = project.type == ProjectType.CARD_GAME || project.type == ProjectType.TREASURE_HUNT
    val effectiveMax = (withdrawLimit ?: project.currentValueRubles).coerceAtLeast(0.0)
    val isValid = amount != null && amount >= 5.0 && amount <= effectiveMax
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier.padding(horizontal = 24.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Вывести из дела", style = MaterialTheme.typography.titleLarge)

            // Limit/fee info
            when (project.type) {
                ProjectType.POTION_BREW, ProjectType.GUILD_SCHEME -> {
                    Surface(
                        color = Warning.copy(alpha = 0.12f),
                        shape = MaterialTheme.shapes.small
                    ) {
                        Text(
                            "⚠ Лимит: не более 25% от вложенного за раз (%.0f ₽). Остаток выводится частями.".format(effectiveMax),
                            style = MaterialTheme.typography.labelSmall,
                            color = Warning,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        )
                    }
                }
                ProjectType.CARD_GAME, ProjectType.TREASURE_HUNT -> {
                    Surface(
                        color = Error.copy(alpha = 0.12f),
                        shape = MaterialTheme.shapes.small
                    ) {
                        Text(
                            "⚠ Комиссия за срочный вывод — 25%. Получишь %.0f%% от суммы.".format(75.0),
                            style = MaterialTheme.typography.labelSmall,
                            color = Error,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        )
                    }
                }
                else -> {}
            }

            OutlinedTextField(
                value = amountText,
                onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                label = { Text("Сумма в рублях") },
                suffix = { Text("₽") },
                modifier = Modifier.fillMaxWidth()
            )

            // Available / max hint
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "Доступно: %.0f ₽".format(project.currentValueRubles),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    "Лимит: %.0f ₽".format(effectiveMax),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (effectiveMax < project.currentValueRubles) Warning
                            else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Preview of what they'll actually receive
            if (hasFee && amount != null && amount >= 5.0) {
                Text(
                    "Получишь на руки: %.0f ₽".format(amount * 0.75),
                    style = MaterialTheme.typography.bodySmall,
                    color = FairyGold,
                    fontWeight = FontWeight.Medium
                )
            }

            Button(
                onClick = { amount?.let { onConfirm(it) } },
                enabled = isValid,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = FairyGold, contentColor = Color(0xFF1A0A00))
            ) { Text("Вывести", fontWeight = FontWeight.SemiBold) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ClosedProjectCard(project: Project, onClick: () -> Unit) {
    val pnl = project.currentValueRubles - project.investedAmountRubles
    FairyCard(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(modifier = Modifier.weight(1f)) {
                Text(project.claimedName, style = MaterialTheme.typography.titleMedium, color = Color.White, fontWeight = FontWeight.Bold)
                Text(
                    project.closureReason ?: "Закрыто",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.6f)
                )
            }
            Text(
                "%+.0f ₽".format(pnl),
                style = MaterialTheme.typography.titleMedium,
                color = if (pnl >= 0) Success else Error,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
