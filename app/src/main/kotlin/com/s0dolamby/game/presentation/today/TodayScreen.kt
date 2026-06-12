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
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.common.theme.Success

/** Лестница серии — пороги бонусов как в TG todayService. */
private val MILESTONES = listOf(3 to 50, 5 to 70, 7 to 100, 10 to 150, 15 to 300, 20 to 500, 30 to 1000)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen() {
    // Phase 1 — заглушка с правильной структурой. Логика стрика + claim
    // подключается отдельным коммитом (TodayService + GameState поля
    // loginStreak/lastDailyClaim уже частично в БД).
    val streak = 0
    val canClaim = false
    val todayReward = 30

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
                            Text("Сегодня", fontWeight = FontWeight.Bold, color = Color.White)
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
                        "Дневной ритуал, награды за серию и купеческий рейтинг",
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
                            Text("Ты на ярмарке", color = Color.White.copy(alpha = 0.65f), fontSize = 13.sp)
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
                                if (streak == 1) "день подряд" else "дней подряд",
                                color = Color.White.copy(alpha = 0.65f),
                                fontSize = 13.sp
                            )
                            OrnamentDivider()
                            if (canClaim) {
                                Button(
                                    onClick = { /* TODO Phase 2: claim */ },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = FairyGold)
                                ) {
                                    Text("🎁  Забрать $todayReward г", color = NightBlue, fontWeight = FontWeight.Bold)
                                }
                            } else {
                                Surface(
                                    color = Success.copy(alpha = 0.18f),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        "Награда сегодня уже забрана",
                                        color = Success,
                                        fontSize = 13.sp,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 10.dp)
                                    )
                                }
                            }
                            Text(
                                "Логика стрика и наград подключится отдельным шагом.",
                                color = Color.White.copy(alpha = 0.4f),
                                fontSize = 11.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }

                // Лестница серии
                item {
                    FairyCard(modifier = Modifier.fillMaxWidth()) {
                        Text("Лестница серии", color = FairyGold, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
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
