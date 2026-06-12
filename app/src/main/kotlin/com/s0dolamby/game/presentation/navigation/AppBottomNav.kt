package com.s0dolamby.game.presentation.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.FairyGold

/** 5-табовый низ как в TG: Главная / Грамоты / Казна / Успехи / Сегодня. */
enum class AppTab { HOME, INBOX, PORTFOLIO, STATS, TODAY }

@Composable
fun AppBottomNav(
    current: AppTab,
    pendingInboxCount: Int,
    onHomeClick: () -> Unit,
    onInboxClick: () -> Unit,
    onPortfolioClick: () -> Unit,
    onStatsClick: () -> Unit,
    onTodayClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xF5060412))
            .border(width = 1.dp, color = FairyGold.copy(alpha = 0.15f), shape = RoundedCornerShape(0.dp))
            .padding(top = 6.dp, bottom = 8.dp)
    ) {
        BottomNavItem("🏠", "Главная", current == AppTab.HOME, onHomeClick, 0, Modifier.weight(1f))
        BottomNavItem("📜", "Грамоты", current == AppTab.INBOX, onInboxClick, pendingInboxCount, Modifier.weight(1f))
        BottomNavItem("💰", "Казна", current == AppTab.PORTFOLIO, onPortfolioClick, 0, Modifier.weight(1f))
        BottomNavItem("📊", "Успехи", current == AppTab.STATS, onStatsClick, 0, Modifier.weight(1f))
        BottomNavItem("🔥", "Сегодня", current == AppTab.TODAY, onTodayClick, 0, Modifier.weight(1f))
    }
}

@Composable
private fun BottomNavItem(
    icon: String,
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    badge: Int,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(contentAlignment = Alignment.Center) {
                Text(icon, fontSize = 20.sp)
                if (badge > 0) {
                    Box(
                        modifier = Modifier
                            .offset(x = 14.dp, y = (-8).dp)
                            .size(16.dp)
                            .background(Error, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("$badge", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            Spacer(Modifier.height(2.dp))
            Text(
                label,
                fontSize = 10.sp,
                color = if (selected) FairyGold else Color.White.copy(alpha = 0.5f),
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
            )
        }
    }
}
