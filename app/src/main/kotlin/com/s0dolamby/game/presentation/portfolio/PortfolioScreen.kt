package com.s0dolamby.game.presentation.portfolio

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import com.s0dolamby.game.presentation.common.components.rememberBannerUrl
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
import com.s0dolamby.game.presentation.common.format.formatGroshes
import com.s0dolamby.game.presentation.common.format.formatGroshesSigned
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.Warning
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import com.s0dolamby.game.presentation.common.theme.LocalContentColorSecondary
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard

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
    val freeBalance by viewModel.freeBalance.collectAsState()
    val activeProjects by viewModel.activeProjects.collectAsState()
    val closedProjects by viewModel.closedProjects.collectAsState()
    val actionResult by viewModel.actionResult.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Sheet state hoisted outside LazyColumn to avoid ModalBottomSheet-in-LazyColumn crash
    var activeSheet by remember { mutableStateOf<ActiveSheet?>(null) }

    // Show last crash from log on screen open (diagnostic only).
    val crashPrefix = Strings.t("portfolio.snack.crash", "")
    LaunchedEffect(Unit) {
        val log = AppLogger.readLog()
        val lastCrash = log.substringAfterLast("CRASH/UncaughtException:", "").trim()
        if (lastCrash.isNotEmpty()) {
            snackbarHostState.showSnackbar(
                crashPrefix + lastCrash.take(120),
                duration = SnackbarDuration.Indefinite
            )
        }
    }

    actionResult?.let { result ->
        val msg = when (result) {
            is PortfolioActionResult.Received -> Strings.t("portfolio.snack.received", formatGroshes(result.amount))
            is PortfolioActionResult.AddedFunds -> Strings.t("portfolio.snack.added", formatGroshes(result.amount))
            is PortfolioActionResult.Withdrawn -> Strings.t("portfolio.snack.withdrawn", formatGroshes(result.amount))
            is PortfolioActionResult.Failure -> Strings.t("portfolio.snack.error", result.message)
        }
        LaunchedEffect(result) {
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
                        Text("✦", color = LocalAccentOnCard.current, fontSize = 12.sp)
                        Text(Strings.t("portfolio.title"), fontWeight = FontWeight.Bold)
                        Text("✦", color = LocalAccentOnCard.current, fontSize = 12.sp)
                    }
                },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, Strings.t("btn.back")) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 90.dp),
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
                            Text("✦", color = LocalAccentOnCard.current.copy(alpha = 0.4f), fontSize = 28.sp)
                            Text(
                                Strings.t("portfolio.empty.title"),
                                style = MaterialTheme.typography.titleMedium,
                                color = LocalContentColor.current,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                Strings.t("portfolio.empty.hint"),
                                style = MaterialTheme.typography.bodyMedium,
                                color = LocalContentColorMuted.current
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
                        Strings.t("portfolio.section.active"),
                        style = MaterialTheme.typography.titleMedium,
                        color = LocalAccentOnCard.current.copy(alpha = 0.85f),
                        fontWeight = FontWeight.SemiBold
                    )
                }
                items(activeProjects, key = { it.id }) { project ->
                    PortfolioProjectCard(
                        project = project,
                        onClick = { onProjectClick(project.id) },
                        onExit = { viewModel.exitProject(project.id) },
                        onAddFunds = { activeSheet = ActiveSheet(project, SheetType.ADD_FUNDS) },
                        onWithdraw = {
                            AppLogger.i("Portfolio", "Вывести pressed: id=${project.id} type=${project.type} val=${project.currentValueRubles} inv=${project.investedAmountRubles}")
                            activeSheet = ActiveSheet(project, SheetType.WITHDRAW)
                        }
                    )
                }
            }
            if (closedProjects.isNotEmpty()) {
                item {
                    OrnamentDivider()
                    Spacer(Modifier.height(4.dp))
                    Text(
                        Strings.t("portfolio.section.closed"),
                        style = MaterialTheme.typography.titleMedium,
                        color = LocalAccentOnCard.current.copy(alpha = 0.85f),
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
                title = Strings.t("portfolio.addSheet.title"),
                confirmLabel = Strings.t("portfolio.addSheet.confirm"),
                maxAmount = null,
                freeBalance = freeBalance,
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
    val profitPercent = if (project.investedAmountRubles > 0) {
        (project.currentValueRubles - project.investedAmountRubles) / project.investedAmountRubles * 100.0
    } else 0.0
    val hasFee = project.type == ProjectType.CARD_GAME || project.type == ProjectType.TREASURE_HUNT
    val bannerUrl = rememberBannerUrl(project.personaArchetype, project.type, project.id)

    FairyCard(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        // Баннер дела — full-width картинка как в TG.
        if (bannerUrl != null) {
            AsyncImage(
                model = bannerUrl,
                contentDescription = project.claimedName,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp)
                    .clip(RoundedCornerShape(10.dp))
            )
            Spacer(Modifier.height(10.dp))
        }
        // Заголовок + текущая стоимость / профит%
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    project.claimedName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = LocalAccentOnCard.current
                )
                Text(
                    "${project.developerName} · ${project.daysSinceJoined} дн.",
                    style = MaterialTheme.typography.labelMedium,
                    color = LocalContentColorMuted.current
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (project.isWithdrawalLocked) {
                        Icon(Icons.Default.Lock, Strings.t("portfolio.card.locked"), tint = Warning, modifier = Modifier.size(14.dp))
                    }
                    Text(Strings.t("portfolio.card.invested"), color = LocalContentColorMuted.current, fontSize = 10.sp)
                }
                Text(
                    formatGroshes(project.investedAmountRubles),
                    color = LocalContentColorSecondary.current,
                    fontSize = 12.sp
                )
                Text(
                    formatGroshes(project.currentValueRubles),
                    color = LocalAccentOnCard.current,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    "%+.1f%%".format(profitPercent),
                    color = if (pnl >= 0) Success else Error,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        // Спарклайн стоимости (через apyHistory как прокси) — рисуем
        // только если есть ≥2 точек истории.
        if (project.apyHistory.size >= 2 || project.userCountHistory.size >= 2) {
            Spacer(Modifier.height(8.dp))
            Text(
                Strings.t("portfolio.card.history"),
                style = MaterialTheme.typography.labelSmall,
                color = LocalContentColorMuted.current
            )
            Spacer(Modifier.height(4.dp))
            DualSparkline(
                primary = project.apyHistory.map { it.toFloat() },
                secondary = project.userCountHistory.map { it.toFloat() },
                modifier = Modifier.fillMaxWidth().height(54.dp)
            )
            if (project.currentUserCount > 0) {
                Text(
                    Strings.t("portfolio.card.investors", formatCountShort(project.currentUserCount)),
                    color = LocalContentColorMuted.current,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }

        if (project.isWithdrawalLocked) {
            Surface(color = Warning.copy(alpha = 0.15f), shape = MaterialTheme.shapes.small) {
                Text(
                    Strings.t("portfolio.card.locked"),
                    style = MaterialTheme.typography.labelSmall,
                    color = Warning,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }

        Spacer(Modifier.height(4.dp))
        // Три кнопки одной плиткой как в TG: Довложить / Вывести часть / Покинуть.
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            Button(
                onClick = onAddFunds,
                modifier = Modifier.weight(1f),
                enabled = !project.isWithdrawalLocked,
                colors = ButtonDefaults.buttonColors(
                    containerColor = FairyGold,
                    contentColor = Color(0xFF1A0A00),
                    disabledContainerColor = FairyGold.copy(alpha = 0.35f)
                ),
                contentPadding = PaddingValues(vertical = 6.dp)
            ) { Text(Strings.t("portfolio.btn.addFunds"), fontSize = 12.sp, fontWeight = FontWeight.SemiBold) }
            OutlinedButton(
                onClick = onWithdraw,
                modifier = Modifier.weight(1f),
                enabled = !project.isWithdrawalLocked,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = LocalContentColor.current),
                border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.7f)),
                contentPadding = PaddingValues(vertical = 6.dp)
            ) { Text(Strings.t("portfolio.btn.withdrawPart"), fontSize = 12.sp) }
            OutlinedButton(
                onClick = onExit,
                modifier = Modifier.weight(1f),
                enabled = !project.isWithdrawalLocked,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Error),
                border = androidx.compose.foundation.BorderStroke(1.dp, Error.copy(alpha = 0.5f)),
                contentPadding = PaddingValues(vertical = 6.dp)
            ) { Text(Strings.t("portfolio.btn.leave"), fontSize = 12.sp) }
        }
        if (hasFee) {
            Text(
                Strings.t("portfolio.card.fee"),
                color = LocalContentColorMuted.current,
                fontSize = 10.sp
            )
        }
    }
}

@Composable
private fun DualSparkline(
    primary: List<Float>,
    secondary: List<Float>,
    modifier: Modifier = Modifier
) {
    val primaryNorm = primary.normalize()
    val secondaryNorm = secondary.normalize()
    val primaryColor = Success
    val secondaryColor = FairyGold.copy(alpha = 0.6f)
    Canvas(modifier = modifier) {
        if (primaryNorm.size >= 2) drawPolyline(primaryNorm, primaryColor, dashed = false)
        if (secondaryNorm.size >= 2) drawPolyline(secondaryNorm, secondaryColor, dashed = true)
    }
}

private fun List<Float>.normalize(): List<Float> {
    if (isEmpty()) return emptyList()
    val mn = minOrNull()!!
    val mx = maxOrNull()!!
    val range = (mx - mn).takeIf { it > 0.0001f } ?: 1f
    return map { (it - mn) / range }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawPolyline(
    values: List<Float>,
    color: Color,
    dashed: Boolean
) {
    val path = Path()
    values.forEachIndexed { i, v ->
        val x = i.toFloat() / (values.size - 1) * size.width
        val y = (1f - v) * size.height
        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
    }
    val pathEffect = if (dashed) {
        androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(8f, 8f))
    } else null
    drawPath(path, color, style = Stroke(width = 2.5.dp.toPx(), pathEffect = pathEffect))
}

private fun formatCountShort(count: Int): String = when {
    count >= 1_000_000 -> "%.1fM".format(count / 1_000_000.0)
    count >= 1_000 -> "%.1fk".format(count / 1_000.0)
    else -> "$count"
}

private fun formatRubles(amount: Double): String = when {
    amount >= 1_000_000 -> "%.1fМ г".format(amount / 1_000_000)
    amount >= 1_000 -> "%.1fТ г".format(amount / 1_000)
    else -> "%.0f г".format(amount)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FundsBottomSheet(
    title: String,
    confirmLabel: String,
    maxAmount: Double?,
    freeBalance: Double,
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit
) {
    var amountText by remember { mutableStateOf("") }
    val amount = amountText.toDoubleOrNull()
    val isValid = amount != null && amount >= 5.0 && (maxAmount == null || amount <= maxAmount)
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val palette = com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = palette.cardMid,
        contentColor = palette.onCard
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 24.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(title, style = MaterialTheme.typography.titleLarge)
                Surface(
                    color = LocalAccentOnCard.current.copy(alpha = 0.15f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        Strings.t("portfolio.addSheet.free", formatRubles(freeBalance)),
                        style = MaterialTheme.typography.labelMedium,
                        color = LocalAccentOnCard.current,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }
            OutlinedTextField(
                value = amountText,
                onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                label = { Text(Strings.t("portfolio.addSheet.amountLabel")) },
                suffix = { Text("г") },
                modifier = Modifier.fillMaxWidth()
            )
            if (maxAmount != null) {
                Text(
                    "Доступно: %.0f г".format(maxAmount),
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.onCardMuted
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

@Composable
private fun WithdrawBottomSheet(
    project: Project,
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit
) {
    AppLogger.i("Portfolio", "WithdrawBottomSheet composing: type=${project.type}")
    val palette = com.s0dolamby.game.presentation.common.theme.LocalAppPalette.current
    var amountText by remember { mutableStateOf("") }
    val amount = amountText.toDoubleOrNull()

    AppLogger.i("Portfolio", "isLongTerm check")
    val isLongTerm = project.type == ProjectType.POTION_BREW || project.type == ProjectType.GUILD_SCHEME
    val hasFee = project.type == ProjectType.CARD_GAME || project.type == ProjectType.TREASURE_HUNT
    val effectiveMax = if (isLongTerm) {
        (project.investedAmountRubles * 0.25).coerceAtLeast(0.0)
    } else {
        project.currentValueRubles.coerceAtLeast(0.0)
    }
    val isValid = amount != null && amount >= 5.0 && amount <= effectiveMax

    AppLogger.i("Portfolio", "AlertDialog about to compose: effectiveMax=$effectiveMax isLongTerm=$isLongTerm hasFee=$hasFee")
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = palette.cardMid,
        titleContentColor = palette.onCard,
        textContentColor = palette.onCard,
        title = { Text(Strings.t("portfolio.withdraw.title")) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                when {
                    isLongTerm -> Text(
                        Strings.t("portfolio.withdraw.warnLong", effectiveMax),
                        style = MaterialTheme.typography.bodySmall,
                        color = Warning
                    )
                    hasFee -> Text(
                        Strings.t("portfolio.withdraw.warnFee"),
                        style = MaterialTheme.typography.bodySmall,
                        color = Error
                    )
                }
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text(Strings.t("portfolio.addSheet.amountLabel")) },
                    suffix = { Text("г") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Text(
                    Strings.t("portfolio.withdraw.availLimit", project.currentValueRubles, effectiveMax),
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.onCardMuted
                )
                if (hasFee && amount != null && amount >= 5.0) {
                    Text(
                        Strings.t("portfolio.withdraw.netGain", amount * 0.75),
                        style = MaterialTheme.typography.bodySmall,
                        color = LocalAccentOnCard.current,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { amount?.let { onConfirm(it) } },
                enabled = isValid,
                colors = ButtonDefaults.buttonColors(containerColor = FairyGold, contentColor = Color(0xFF1A0A00))
            ) { Text(Strings.t("portfolio.withdraw.confirm"), fontWeight = FontWeight.SemiBold) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(Strings.t("btn.cancel")) }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ClosedProjectCard(project: Project, onClick: () -> Unit) {
    val pnl = project.currentValueRubles - project.investedAmountRubles
    FairyCard(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(modifier = Modifier.weight(1f)) {
                Text(project.claimedName, style = MaterialTheme.typography.titleMedium, color = LocalContentColor.current, fontWeight = FontWeight.Bold)
                Text(
                    project.closureReason ?: Strings.t("portfolio.closed.fallback"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = LocalContentColorMuted.current
                )
            }
            Text(
                "%+.0f г".format(pnl),
                style = MaterialTheme.typography.titleMedium,
                color = if (pnl >= 0) Success else Error,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
