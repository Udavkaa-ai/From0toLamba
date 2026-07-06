package com.s0dolamby.game.presentation.leaderboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.LeaderboardData
import com.s0dolamby.game.domain.model.LeaderboardStanding
import com.s0dolamby.game.domain.repository.LeaderboardRepository
import com.s0dolamby.game.presentation.common.components.AppBg
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.format.formatGroshes
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface LeaderboardUi {
    data object Loading : LeaderboardUi
    data class Error(val reason: String?) : LeaderboardUi
    data class Ready(val data: LeaderboardData) : LeaderboardUi
}

@HiltViewModel
class LeaderboardViewModel @Inject constructor(
    private val repository: LeaderboardRepository
) : ViewModel() {

    private val _state = MutableStateFlow<LeaderboardUi>(LeaderboardUi.Loading)
    val state = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _state.value = LeaderboardUi.Loading
            // Сначала отметимся в таблице (обновит наше положение и «был онлайн»),
            // потом заберём верхушку. Ошибку отправки игнорируем — важнее показать.
            repository.submitStanding()
            val result = repository.fetchTop(limit = 100)
            _state.value = result.fold(
                onSuccess = { LeaderboardUi.Ready(it) },
                onFailure = { LeaderboardUi.Error(it.message?.take(120)) }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaderboardScreen(
    onBack: () -> Unit,
    viewModel: LeaderboardViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    ScreenBackground(AppBg.LEADERBOARD) {
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
                            Text(Strings.t("leaderboard.title"), fontWeight = FontWeight.Bold)
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, Strings.t("btn.back")) }
                    },
                    actions = {
                        IconButton(onClick = viewModel::refresh) {
                            Icon(Icons.Default.Refresh, Strings.t("leaderboard.refresh"), tint = FairyGold)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Transparent,
                        titleContentColor = Color.White,
                        navigationIconContentColor = FairyGold
                    )
                )
            }
        ) { padding ->
            Box(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize()
                    .padding(horizontal = 16.dp)
            ) {
                when (val s = state) {
                    is LeaderboardUi.Loading -> CenterInfo("🏆", Strings.t("leaderboard.loading"))
                    is LeaderboardUi.Error -> ErrorState(reason = s.reason, onRetry = viewModel::refresh)
                    is LeaderboardUi.Ready ->
                        if (s.data.entries.isEmpty()) {
                            CenterInfo("🏆", Strings.t("leaderboard.empty"))
                        } else {
                            LeaderboardList(s.data)
                        }
                }
            }
        }
    }
}

@Composable
private fun LeaderboardList(data: LeaderboardData) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(top = 8.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(
                        Brush.verticalGradient(
                            listOf(EnchantedPurple.copy(alpha = 0.85f), NightBlue.copy(alpha = 0.9f))
                        )
                    )
                    .border(1.dp, FairyGold.copy(alpha = 0.25f), RoundedCornerShape(14.dp))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        Strings.t("leaderboard.total", data.total),
                        color = FairyGold,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        data.myPosition?.let { Strings.t("leaderboard.myPosition", it) }
                            ?: Strings.t("leaderboard.notRanked"),
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 12.sp
                    )
                }
                Text("🏆", fontSize = 26.sp)
            }
        }
        items(data.entries, key = { it.playerId }) { entry ->
            StandingRow(entry)
        }
    }
}

@Composable
private fun StandingRow(entry: LeaderboardStanding) {
    val medal = when (entry.position) {
        1 -> "🥇"; 2 -> "🥈"; 3 -> "🥉"; else -> entry.position.toString()
    }
    // Плотные тёмные плашки: раньше строки были почти прозрачные и терялись
    // на фоне-картинке (жалоба тестеров «тяжело читать»).
    val bg = if (entry.isMe) Color(0xFF3A2A0E) else Color(0xF01A1030)
    val borderColor = if (entry.isMe) FairyGold.copy(alpha = 0.7f) else Color.White.copy(alpha = 0.12f)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(1.dp, borderColor, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(modifier = Modifier.width(34.dp), contentAlignment = Alignment.Center) {
            Text(
                medal,
                color = if (entry.position <= 3) Color.Unspecified else FairyGold,
                fontSize = if (entry.position <= 3) 18.sp else 15.sp,
                fontWeight = FontWeight.Bold
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                if (entry.isMe) Strings.t("leaderboard.you", entry.nickname) else entry.nickname,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1
            )
            Text(
                Strings.t("leaderboard.rankDay", entry.rankTitle.ifBlank { "—" }, entry.day),
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 11.sp
            )
        }
        Text(
            formatGroshes(entry.wealth),
            color = FairyGold,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun CenterInfo(emoji: String, text: String) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(CircleShape)
                .background(FairyGold.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) { Text(emoji, fontSize = 34.sp) }
        Spacer(Modifier.height(14.dp))
        Text(
            text,
            color = Color.White.copy(alpha = 0.8f),
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun ErrorState(reason: String?, onRetry: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("🌫", fontSize = 34.sp)
        Spacer(Modifier.height(12.dp))
        Text(
            Strings.t("leaderboard.error"),
            color = Color.White.copy(alpha = 0.85f),
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold
        )
        reason?.let {
            Spacer(Modifier.height(4.dp))
            Text(it, color = Color.White.copy(alpha = 0.5f), fontSize = 11.sp)
        }
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = onRetry,
            colors = ButtonDefaults.buttonColors(containerColor = FairyGold, contentColor = NightBlue)
        ) {
            Text(Strings.t("leaderboard.retry"), fontWeight = FontWeight.SemiBold)
        }
    }
}
