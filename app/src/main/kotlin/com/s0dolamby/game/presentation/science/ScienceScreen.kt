package com.s0dolamby.game.presentation.science

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.s0dolamby.game.data.science.ScienceUnlockStore
import com.s0dolamby.game.domain.science.ScienceCard
import com.s0dolamby.game.domain.science.ScienceCatalog
import com.s0dolamby.game.presentation.common.components.AppBg
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.components.WobblyEmoji
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class ScienceViewModel @Inject constructor(
    store: ScienceUnlockStore
) : ViewModel() {
    val unlockedIds = store.unlockedIds
}

/**
 * «Наука старца» — коллекция приёмов мошенников. Открытые карты — в полный
 * рост (сказка → жизнь → совет), запертые — силуэт с подсказкой, где такую
 * науку добывают. Собери все — и разводы будешь узнавать не только на ярмарке.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScienceScreen(
    onBack: () -> Unit,
    viewModel: ScienceViewModel = hiltViewModel()
) {
    val unlocked by viewModel.unlockedIds.collectAsState()
    val total = ScienceCatalog.ALL.size

    ScreenBackground(AppBg.STATS) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(
                                Strings.t("science.title"),
                                color = Color.White,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                Strings.t("science.progress", unlocked.size, total),
                                style = MaterialTheme.typography.labelSmall,
                                color = FairyGold.copy(alpha = 0.8f)
                            )
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.Default.ArrowBack, Strings.t("btn.back"), tint = Color.White)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
                )
            }
        ) { padding ->
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 90.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Text(
                        Strings.t("science.subtitle"),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.7f)
                    )
                }
                items(ScienceCatalog.ALL, key = { it.id }) { card ->
                    if (card.id in unlocked) UnlockedCard(card) else LockedCard(card)
                }
            }
        }
    }
}

@Composable
private fun UnlockedCard(card: ScienceCard) {
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            WobblyEmoji(card.emoji, fontSize = 26.sp, amplitudeDeg = 5f, periodMs = 2400)
            Text(
                card.title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = LocalAccentOnCard.current
            )
        }
        Spacer(Modifier.height(8.dp))
        ScienceCardBody(tale = card.tale, reality = card.reality, advice = card.advice)
    }
}

@Composable
private fun LockedCard(card: ScienceCard) {
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text("🔒", fontSize = 22.sp)
            Column {
                Text(
                    Strings.t("science.locked.title"),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = LocalContentColorMuted.current
                )
                Text(
                    card.unlockHint,
                    style = MaterialTheme.typography.labelSmall,
                    fontStyle = FontStyle.Italic,
                    color = LocalContentColorMuted.current
                )
            }
        }
    }
}
