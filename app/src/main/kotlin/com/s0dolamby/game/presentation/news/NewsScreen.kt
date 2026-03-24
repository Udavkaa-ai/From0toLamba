package com.s0dolamby.game.presentation.news

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.R
import com.s0dolamby.game.domain.model.*
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.Warning

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewsScreen(
    onBack: () -> Unit,
    viewModel: NewsViewModel = hiltViewModel()
) {
    val updates by viewModel.updates.collectAsState()

    ScreenBackground(R.drawable.news_bg) {
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
                        Text("Вести с ярмарки", fontWeight = FontWeight.Bold)
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
            if (updates.isEmpty()) {
                item {
                    FairyCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text("✦", color = FairyGold.copy(alpha = 0.4f), fontSize = 28.sp)
                            Text(
                                "Вестей пока нет",
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                "Нажми «Следующий день» — дела начнут посылать вести",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White.copy(alpha = 0.65f)
                            )
                        }
                    }
                }
            } else {
                item { OrnamentDivider() }
            }
            items(updates) { update ->
                NewsCard(update = update)
            }
        }
    }
    } // ScreenBackground
}

// Important announcements that start expanded
private fun AnnouncementType.isImportant() = this == AnnouncementType.LISTING ||
        this == AnnouncementType.CRIMINAL_CASE || this == AnnouncementType.HACK

@Composable
private fun NewsCard(update: DailyUpdate) {
    val source = update.computedSource()
    val startExpanded = update.announcement?.isImportant() == true
    var expanded by remember { mutableStateOf(startExpanded) }
    val chevronRotation by animateFloatAsState(
        targetValue = if (expanded) 180f else 0f,
        animationSpec = tween(200),
        label = "chevron"
    )

    FairyCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { expanded = !expanded }
    ) {
        // ── Header: source badge + day + chevron ──
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            SourceBadge(source = source)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    "День ${update.day}",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.5f)
                )
                Icon(
                    Icons.Default.ExpandMore,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.35f),
                    modifier = Modifier.size(16.dp).rotate(chevronRotation)
                )
            }
        }

        Spacer(Modifier.height(4.dp))

        // ── Project name + title (always visible) ──
        Text(
            update.projectName,
            style = MaterialTheme.typography.labelMedium,
            color = FairyGold,
            fontWeight = FontWeight.SemiBold
        )

        Text(
            update.title,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )

        // ── Announcement chip (always visible) ──
        update.announcement?.let { announcement ->
            val (chipBg, chipFg) = announcement.chipColors
            Surface(color = chipBg, shape = RoundedCornerShape(16.dp)) {
                Text(
                    announcement.displayText,
                    style = MaterialTheme.typography.labelSmall,
                    color = chipFg,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                )
            }
        }

        // ── Expandable body ──
        AnimatedVisibility(
            visible = expanded,
            enter = expandVertically(tween(260)) + fadeIn(tween(200)),
            exit = shrinkVertically(tween(220)) + fadeOut(tween(150))
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Spacer(Modifier.height(4.dp))

                Text(
                    update.body,
                    style = when (source) {
                        NewsSource.TAVERN_RUMOR, NewsSource.MYSTERIOUS_TRAVELER ->
                            MaterialTheme.typography.bodyMedium.copy(fontStyle = FontStyle.Italic)
                        else -> MaterialTheme.typography.bodyMedium
                    },
                    color = Color.White.copy(alpha = 0.85f)
                )

                // ── Payout status ──
                when (update.payoutStatus) {
                    PayoutStatus.DELAYED -> StatusBanner(text = "⚠ Выплаты задержаны", color = Error)
                    PayoutStatus.BOOSTED -> StatusBanner(text = "↑ Выплаты ускорены", color = Success)
                    PayoutStatus.NORMAL -> {}
                }

                // ── Red flags ──
                if (update.redFlags.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        update.redFlags.forEach { flag ->
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Warning, null, tint = Warning, modifier = Modifier.size(14.dp))
                                Text(flag.cleanRedFlag(), style = MaterialTheme.typography.labelSmall, color = Warning)
                            }
                        }
                    }
                }

                // ── User count delta ──
                if (update.userCountDelta != 0) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.TrendingUp, null,
                            tint = if (update.userCountDelta > 0) Success else Error,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            "%+d участников".format(update.userCountDelta),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (update.userCountDelta > 0) Success else Error
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SourceBadge(source: NewsSource) {
    val (bg, fg) = when (source) {
        NewsSource.GUARD_WARNING -> Error.copy(alpha = 0.20f) to Error
        NewsSource.MYSTERIOUS_TRAVELER -> Color.White.copy(alpha = 0.08f) to Color.White.copy(alpha = 0.7f)
        NewsSource.ROYAL_DECREE, NewsSource.CHRONICLE ->
            FairyGold.copy(alpha = 0.15f) to FairyGold
        NewsSource.MERCHANT_NOTICE ->
            Color.White.copy(alpha = 0.10f) to Color.White.copy(alpha = 0.8f)
        NewsSource.TAVERN_RUMOR, NewsSource.MARKET_SQUARE ->
            Warning.copy(alpha = 0.15f) to Warning
        else -> Color.White.copy(alpha = 0.08f) to Color.White.copy(alpha = 0.6f)
    }
    Surface(color = bg, shape = RoundedCornerShape(12.dp)) {
        Text(
            "${source.emoji} ${source.label}",
            style = MaterialTheme.typography.labelSmall,
            color = fg,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@Composable
private fun StatusBanner(text: String, color: Color) {
    Surface(color = color.copy(alpha = 0.18f), shape = RoundedCornerShape(6.dp)) {
        Text(
            text,
            style = MaterialTheme.typography.labelSmall,
            color = color,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 5.dp)
        )
    }
}

private fun String.cleanRedFlag(): String =
    replace('_', ' ')
        .replace(Regex("([a-z])([A-Z])"), "$1 $2")
        .lowercase()
        .replaceFirstChar { it.uppercaseChar() }
        .trimEnd('.')
        .let { if (!it.endsWith('.') && !it.endsWith('!')) "$it." else it }

private val AnnouncementType.displayText: String get() = when (this) {
    AnnouncementType.LISTING -> "🏦 Анонс листинга"
    AnnouncementType.NEW_SEASON -> "🎮 Новый сезон"
    AnnouncementType.COLLAB -> "🤝 Партнёрство"
    AnnouncementType.AUDIT -> "🔍 Аудит"
    AnnouncementType.BAD_RUMOR -> "📉 Слухи о проблемах"
    AnnouncementType.VIP_COLLAB -> "⭐ VIP-коллаб"
    AnnouncementType.CRIMINAL_CASE -> "⚖️ Уголовное дело"
    AnnouncementType.HACK -> "💀 Взлом"
}

private val AnnouncementType.chipColors: Pair<Color, Color> get() {
    val gold = FairyGold
    return when (this) {
        AnnouncementType.LISTING -> gold.copy(alpha = 0.20f) to gold
        AnnouncementType.VIP_COLLAB -> Color(0xFF9C27B0).copy(alpha = 0.20f) to Color(0xFFCE93D8)
        AnnouncementType.CRIMINAL_CASE -> Error.copy(alpha = 0.20f) to Error
        AnnouncementType.HACK -> Error.copy(alpha = 0.18f) to Error
        AnnouncementType.BAD_RUMOR -> Warning.copy(alpha = 0.20f) to Warning
        else -> Success.copy(alpha = 0.18f) to Success
    }
}
