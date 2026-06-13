package com.s0dolamby.game.presentation.today

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import com.s0dolamby.game.presentation.common.components.CoinShowerOverlay
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.common.theme.Success

/** Лестница серии — пороги бонусов из TG todayService. */
private val MILESTONES = TodayRewards.MILESTONES.toList().sortedBy { it.first }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(viewModel: TodayViewModel = hiltViewModel()) {
    val ui by viewModel.uiState.collectAsState()
    val streak = ui.loginStreak
    val canClaim = ui.canClaim
    val todayReward = ui.todayReward
    val snackbarHostState = remember { SnackbarHostState() }

    // Сообщаем игроку, что награда забрана.
    val claimed = ui.claimedTodayReward
    LaunchedEffect(claimed) {
        if (claimed != null) {
            snackbarHostState.showSnackbar("🎁 +$claimed г — награда дня")
            viewModel.clearClaimedReward()
        }
    }
    val error = ui.error
    LaunchedEffect(error) {
        if (error != null) {
            snackbarHostState.showSnackbar(error)
            viewModel.clearError()
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(NightBlue)) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colorStops = arrayOf(
                            0f to Color(0xD9060412),
                            0.4f to Color(0xBF0A0818),
                            1f to Color(0xF0060412)
                        )
                    )
                )
        )

        // Золотой дождь при успешном claim — seed = размер награды, чтобы
        // повторный заход в тот же день не запускал анимацию заново.
        CoinShowerOverlay(seed = ui.claimedTodayReward)

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
                    Text(
                        Strings.t("today.subtitle"),
                        color = Color.White.copy(alpha = 0.65f),
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // Карточка стрика
                item {
                    FairyCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(Strings.t("today.youAtFair"), color = Color.White.copy(alpha = 0.65f), fontSize = 13.sp)
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text("🔥", fontSize = 44.sp)
                                Text(
                                    "$streak",
                                    fontSize = 56.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = FairyGold
                                )
                            }
                            Text(
                                Strings.t(if (streak == 1) "today.dayOne" else "today.dayMany"),
                                color = Color.White.copy(alpha = 0.65f),
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
                                        color = FairyGold,
                                        fontSize = 11.sp,
                                        textAlign = TextAlign.Center
                                    )
                                }
                                val nextMilestone = MILESTONES.firstOrNull { it.first > streak }
                                if (nextMilestone != null) {
                                    Text(
                                        "До следующей вешки (день ${nextMilestone.first}, +${nextMilestone.second} г) — " +
                                            "${nextMilestone.first - streak} дн.",
                                        color = Color.White.copy(alpha = 0.5f),
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
                                    color = Color.White.copy(alpha = 0.45f),
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
                        Text(Strings.t("today.ladder"), color = FairyGold, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
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

                // Купеческий рейтинг — заглушка
                item {
                    FairyCard(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("👑 Купеческий рейтинг", color = FairyGold, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text("скоро", color = Color.White.copy(alpha = 0.4f), fontSize = 11.sp)
                        }
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Здесь появятся вкладки «Злато» и «Связи» с топом купцов по общему состоянию и сумме отношений.",
                            color = Color.White.copy(alpha = 0.6f),
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
                color = if (passed) Success else Color.White.copy(alpha = 0.85f),
                fontSize = if (passed) 18.sp else 16.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                "+$bonus г",
                color = Color.White.copy(alpha = 0.55f),
                fontSize = 9.sp
            )
        }
    }
}
