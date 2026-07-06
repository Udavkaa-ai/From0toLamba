package com.s0dolamby.game.presentation.today

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.domain.today.TodayRewards
import com.s0dolamby.game.R
import com.s0dolamby.game.presentation.common.components.CoinShowerOverlay
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.onboarding.TourTarget
import com.s0dolamby.game.presentation.onboarding.tourAnchor
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.components.AppBg
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard

/** Лестница серии — пороги бонусов из TG todayService. */
private val MILESTONES = TodayRewards.MILESTONES.toList().sortedBy { it.first }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(
    onLeaderboardClick: () -> Unit = {},
    viewModel: TodayViewModel = hiltViewModel()
) {
    val ui by viewModel.uiState.collectAsState()
    val streak = ui.loginStreak
    val canClaim = ui.canClaim
    val todayReward = ui.todayReward
    val snackbarHostState = remember { SnackbarHostState() }

    // Сообщаем игроку, что награда забрана.
    val claimed = ui.claimedTodayReward
    val claimedMessage = claimed?.let { Strings.t("today.snack.claimSuccess", it) }
    LaunchedEffect(claimed) {
        if (claimed != null && claimedMessage != null) {
            snackbarHostState.showSnackbar(claimedMessage)
            viewModel.clearClaimedReward()
        }
    }
    val error = ui.error
    val errorFallback = Strings.t("today.snack.claimError")
    LaunchedEffect(error) {
        if (error != null) {
            snackbarHostState.showSnackbar(error.ifBlank { errorFallback })
            viewModel.clearError()
        }
    }

    ScreenBackground(AppBg.TAVERN) {
        // Золотой дождь при успешном claim — seed = размер награды, чтобы
        // повторный заход в тот же день не запускал анимацию заново.
        CoinShowerOverlay(seed = ui.claimedTodayReward)

        Scaffold(
            containerColor = Color.Transparent,
            snackbarHost = { com.s0dolamby.game.presentation.common.components.FairySnackbarHost(snackbarHostState) },
            topBar = {
                TopAppBar(
                    title = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            // TopAppBar лежит на тёмном фоне экрана в обеих
                            // темах — фиксированные светлые, не карточные локали.
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                            Text(Strings.t("today.title"), fontWeight = FontWeight.Bold, color = Color.White)
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
                )
            }
        ) { padding ->
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 90.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    // Подпись прямо на тёмном фоне экрана — фиксированный светлый.
                    Text(
                        Strings.t("today.subtitle"),
                        color = Color.White.copy(alpha = 0.75f),
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // «Ярмарка недели» — соревновательное окно с общим сидом
                item { WeeklyFairCard(ui) }

                // Карточка стрика
                item {
                    FairyCard(modifier = Modifier.fillMaxWidth().tourAnchor(TourTarget.TODAY_MAIN)) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(Strings.t("today.youAtFair"), color = LocalContentColorMuted.current, fontSize = 13.sp)
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text("🔥", fontSize = 44.sp)
                                Text(
                                    "$streak",
                                    fontSize = 56.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = LocalAccentOnCard.current
                                )
                            }
                            Text(
                                Strings.t(if (streak == 1) "today.dayOne" else "today.dayMany"),
                                color = LocalContentColorMuted.current,
                                fontSize = 13.sp
                            )
                            OrnamentDivider()
                            if (canClaim) {
                                val milestoneBonus = TodayRewards.milestoneBonus(streak)
                                Button(
                                    onClick = viewModel::claim,
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = FairyGold)
                                ) {
                                    Text(Strings.t("today.claim", todayReward), color = NightBlue, fontWeight = FontWeight.Bold)
                                }
                                if (milestoneBonus > 0) {
                                    Text(
                                        "🎉 +$milestoneBonus г бонус за серию $streak дней",
                                        color = LocalAccentOnCard.current,
                                        fontSize = 11.sp,
                                        textAlign = TextAlign.Center
                                    )
                                }
                                val nextMilestone = MILESTONES.firstOrNull { it.first > streak }
                                if (nextMilestone != null) {
                                    Text(
                                        Strings.t("today.nextMilestone", nextMilestone.first, nextMilestone.second, nextMilestone.first - streak),
                                        color = LocalContentColorMuted.current,
                                        fontSize = 11.sp,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            } else {
                                Surface(
                                    color = Success.copy(alpha = 0.18f),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        Strings.t("today.claimed"),
                                        color = Success,
                                        fontSize = 13.sp,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 10.dp)
                                    )
                                }
                                Text(
                                    Strings.t("today.claimed.hint"),
                                    color = LocalContentColorMuted.current,
                                    fontSize = 11.sp,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }
                }

                // Лестница серии
                item {
                    FairyCard(modifier = Modifier.fillMaxWidth()) {
                        Text(Strings.t("today.ladder"), color = LocalAccentOnCard.current, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Spacer(Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            MILESTONES.forEach { (day, bonus) ->
                                val passed = streak >= day
                                MilestoneCell(day = day, bonus = bonus, passed = passed)
                            }
                        }
                    }
                }

                // Купеческий рейтинг — облачная таблица всех купцов
                item {
                    FairyCard(modifier = Modifier.fillMaxWidth().clickable { onLeaderboardClick() }) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(Strings.t("today.leaderboard"), color = LocalAccentOnCard.current, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text("🏆 ›", color = LocalAccentOnCard.current, fontSize = 15.sp)
                        }
                        Spacer(Modifier.height(8.dp))
                        Text(
                            Strings.t("today.leaderboard.hint"),
                            color = LocalContentColorMuted.current,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MilestoneCell(day: Int, bonus: Int, passed: Boolean) {
    Box(
        modifier = Modifier
            .size(width = 42.dp, height = 56.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(
                if (passed) Success.copy(alpha = 0.22f) else EnchantedPurple.copy(alpha = 0.35f)
            )
            .border(
                1.dp,
                if (passed) Success.copy(alpha = 0.5f) else FairyGold.copy(alpha = 0.2f),
                RoundedCornerShape(8.dp)
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                if (passed) "✓" else "$day",
                color = if (passed) Success else LocalContentColor.current,
                fontSize = if (passed) 18.sp else 16.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                "+$bonus г",
                color = LocalContentColorMuted.current,
                fontSize = 9.sp
            )
        }
    }
}

// ─── «Ярмарка недели» — счёт и шаринг ────────────────────────────────────

@Composable
private fun WeeklyFairCard(ui: TodayUiState) {
    val context = androidx.compose.ui.platform.LocalContext.current
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            com.s0dolamby.game.presentation.common.components.WobblyEmoji(
                ui.weekModifier.emoji, fontSize = 22.sp, amplitudeDeg = 5f, periodMs = 2600
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    Strings.t("today.week.title", ui.weekNumber),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = LocalAccentOnCard.current
                )
                Text(
                    Strings.t("today.week.daysLeft", ui.weekDaysLeft),
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalContentColorMuted.current
                )
            }
        }
        // Сезонный модификатор — чем эта неделя отличается от обычной
        if (ui.weekModifier != com.s0dolamby.game.domain.week.WeekModifier.NONE) {
            Spacer(Modifier.height(6.dp))
            Column {
                Text(
                    Strings.t("week.mod.${ui.weekModifier.stringKey}.title"),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = LocalAccentOnCard.current
                )
                Text(
                    Strings.t("week.mod.${ui.weekModifier.stringKey}.desc"),
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalContentColorMuted.current
                )
            }
        }
        Spacer(Modifier.height(8.dp))

        val growth = ui.weekGrowthPercent
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    Strings.t("today.week.growth"),
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalContentColorMuted.current
                )
                Text(
                    growth?.let { "%+.0f%%".format(it) } ?: "—",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = when {
                        growth == null -> LocalContentColorMuted.current
                        growth >= 0 -> Success
                        else -> com.s0dolamby.game.presentation.common.theme.Error
                    }
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    Strings.t("today.week.chuyka"),
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalContentColorMuted.current
                )
                Text(
                    if (ui.weekChuykaTotal > 0)
                        Strings.t("today.week.chuykaVal", ui.weekChuykaCorrect, ui.weekChuykaTotal)
                    else "—",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = LocalAccentOnCard.current
                )
            }
        }
        Spacer(Modifier.height(10.dp))

        // Итог недели — в мир: обычный share-текст, как решётка Wordle
        val rankName = ui.investorRank?.let { Strings.t(rankKeyFor(it)) } ?: ""
        val shareText = Strings.t(
            "today.week.shareText",
            ui.weekNumber,
            growth?.let { "%+.0f%%".format(it) } ?: "—",
            ui.weekChuykaCorrect, ui.weekChuykaTotal,
            rankName
        )
        // Кнопка лежит на карточном фоне (пергамент в тёплой теме) —
        // цвета из карточных локалей, не фиксированное золото.
        val shareAccent = LocalAccentOnCard.current
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(shareAccent.copy(alpha = 0.14f))
                .border(1.dp, shareAccent.copy(alpha = 0.6f), RoundedCornerShape(10.dp))
                .clickable {
                    val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(android.content.Intent.EXTRA_TEXT, shareText)
                    }
                    context.startActivity(android.content.Intent.createChooser(intent, null))
                }
        ) {
            Text(
                Strings.t("today.week.shareBtn"),
                color = shareAccent,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(vertical = 9.dp)
            )
        }
    }
}

/** Соответствие чина ключу словаря (rank.skomoroh … rank.knyaz). */
private fun rankKeyFor(rank: com.s0dolamby.game.domain.model.InvestorRank): String = when (rank) {
    com.s0dolamby.game.domain.model.InvestorRank.NEWBIE -> "rank.skomoroh"
    com.s0dolamby.game.domain.model.InvestorRank.AMBASSADOR -> "rank.kupec"
    com.s0dolamby.game.domain.model.InvestorRank.ANALYST -> "rank.mudrec"
    com.s0dolamby.game.domain.model.InvestorRank.SHARK -> "rank.boyarin"
    com.s0dolamby.game.domain.model.InvestorRank.LAMBO_SENSEI -> "rank.knyaz"
}
