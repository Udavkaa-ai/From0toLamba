package com.s0dolamby.game.presentation.news

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.s0dolamby.game.R
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.domain.model.*
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

    ScreenBackground(R.drawable.news_bg) {
    Scaffold(
        containerColor = Color.Transparent,
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
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(top = 48.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("📭", style = MaterialTheme.typography.displaySmall)
                            Text(
                                "Новостей пока нет",
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                "Нажми «Следующий день» — проекты начнут публиковать апдейты",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
            items(updates) { update ->
                NewsCard(update = update)
            }
        }
    }
    } // ScreenBackground
}

@Composable
private fun NewsCard(update: DailyUpdate) {
    val source = update.computedSource()
    val (cardColor, borderColor) = newsCardColors(update)

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {

            // ── Header: source badge + project name + day ──
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                SourceBadge(source = source)
                Text(
                    "День ${update.day}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // ── Project name ──
            Text(
                update.projectName,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.SemiBold
            )

            // ── Title ──
            Text(
                update.title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            // ── Body (styled per source) ──
            Text(
                update.body,
                style = when (source) {
                    NewsSource.TAVERN_RUMOR, NewsSource.MYSTERIOUS_TRAVELER ->
                        MaterialTheme.typography.bodyMedium.copy(fontStyle = FontStyle.Italic)
                    NewsSource.ROYAL_DECREE ->
                        MaterialTheme.typography.bodySmall.copy(fontFamily = null)
                    else -> MaterialTheme.typography.bodyMedium
                }
            )

            // ── Payout status banner ──
            when (update.payoutStatus) {
                PayoutStatus.DELAYED -> StatusBanner(
                    text = "⚠ Выплаты задержаны",
                    color = Error
                )
                PayoutStatus.BOOSTED -> StatusBanner(
                    text = "↑ Выплаты ускорены",
                    color = Success
                )
                PayoutStatus.NORMAL -> {}
            }

            // ── Announcement chip ──
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

            // ── Red flags ──
            if (update.redFlags.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    update.redFlags.forEach { flag ->
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Warning, null, tint = Warning, modifier = Modifier.size(14.dp))
                            Text(
                                flag.cleanRedFlag(),
                                style = MaterialTheme.typography.labelSmall,
                                color = Warning
                            )
                        }
                    }
                }
            }

            // ── User count delta (if significant) ──
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
                        "%+d пользователей".format(update.userCountDelta),
                        style = MaterialTheme.typography.labelSmall,
                        color = if (update.userCountDelta > 0) Success else Error
                    )
                }
            }
        }
    }
}

@Composable
private fun SourceBadge(source: NewsSource) {
    val (bg, fg) = when (source) {
        NewsSource.GUARD_WARNING -> Error.copy(alpha = 0.15f) to Error
        NewsSource.MYSTERIOUS_TRAVELER -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
        NewsSource.ROYAL_DECREE, NewsSource.CHRONICLE ->
            MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
        NewsSource.MERCHANT_NOTICE ->
            MaterialTheme.colorScheme.secondaryContainer to MaterialTheme.colorScheme.onSecondaryContainer
        NewsSource.TAVERN_RUMOR, NewsSource.MARKET_SQUARE ->
            Warning.copy(alpha = 0.12f) to Warning
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
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
    Surface(color = color.copy(alpha = 0.12f), shape = RoundedCornerShape(6.dp)) {
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

@Composable
private fun newsCardColors(update: DailyUpdate): Pair<Color, Color> {
    val base = MaterialTheme.colorScheme.surface
    val gold = Color(0xFFFFD700)
    val purple = Color(0xFF9C27B0)
    return when (update.announcement) {
        AnnouncementType.LISTING -> gold.copy(alpha = 0.12f) to gold.copy(alpha = 0.35f)
        AnnouncementType.VIP_COLLAB -> purple.copy(alpha = 0.09f) to purple.copy(alpha = 0.28f)
        AnnouncementType.CRIMINAL_CASE -> Error.copy(alpha = 0.13f) to Error.copy(alpha = 0.45f)
        AnnouncementType.HACK -> Error.copy(alpha = 0.10f) to Error.copy(alpha = 0.38f)
        AnnouncementType.BAD_RUMOR -> Warning.copy(alpha = 0.09f) to Warning.copy(alpha = 0.28f)
        else -> when {
            update.payoutStatus == PayoutStatus.DELAYED && update.redFlags.isNotEmpty() ->
                Error.copy(alpha = 0.07f) to Error.copy(alpha = 0.3f)
            update.payoutStatus == PayoutStatus.DELAYED ->
                Warning.copy(alpha = 0.06f) to Warning.copy(alpha = 0.2f)
            update.payoutStatus == PayoutStatus.BOOSTED ->
                Success.copy(alpha = 0.06f) to Success.copy(alpha = 0.2f)
            update.redFlags.isNotEmpty() ->
                Warning.copy(alpha = 0.05f) to Warning.copy(alpha = 0.15f)
            else -> base to Color.Transparent
        }
    }
}

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

/** Chip background / text color pair per announcement type. */
/**
 * Приводит строку флага к читаемому виду:
 * snake_case → слова с пробелами, первая буква заглавная.
 */
private fun String.cleanRedFlag(): String =
    replace('_', ' ')
        .replace(Regex("([a-z])([A-Z])"), "$1 $2")
        .lowercase()
        .replaceFirstChar { it.uppercaseChar() }
        .trimEnd('.')
        .let { if (!it.endsWith('.') && !it.endsWith('!')) "$it." else it }

private val AnnouncementType.chipColors: Pair<Color, Color> get() {
    val gold = Color(0xFFFFD700)
    val purple = Color(0xFF9C27B0)
    return when (this) {
        AnnouncementType.LISTING -> gold.copy(alpha = 0.25f) to Color(0xFF7A6000)
        AnnouncementType.VIP_COLLAB -> purple.copy(alpha = 0.20f) to Color(0xFF6A0DAD)
        AnnouncementType.CRIMINAL_CASE -> Error.copy(alpha = 0.20f) to Error
        AnnouncementType.HACK -> Error.copy(alpha = 0.18f) to Error
        AnnouncementType.BAD_RUMOR -> Warning.copy(alpha = 0.20f) to Warning
        else -> Success.copy(alpha = 0.18f) to Success
    }
}
