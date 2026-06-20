package com.s0dolamby.game.presentation.relationships

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.PersonaAvatar
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted

/**
 * Экран отношений с дельцами. Сетка 7 архетипов с уровнями связи
 * и балансом жетонов. Данные тянутся из GameState через RelationshipsViewModel.
 */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RelationshipsScreen(
    onBack: () -> Unit,
    viewModel: RelationshipsViewModel = hiltViewModel()
) {
    val ui by viewModel.uiState.collectAsState()
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
                            Text(Strings.t("rel.title"), fontWeight = FontWeight.Bold, color = LocalContentColor.current)
                            Text("✦", color = FairyGold, fontSize = 12.sp)
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
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    Strings.t("rel.subtitle", ui.maxLevel),
                    color = LocalContentColorMuted.current,
                    fontSize = 12.sp
                )

                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(Strings.t("rel.sumTies"), color = LocalContentColorMuted.current, fontSize = 12.sp)
                            Text("${ui.tiesTotal}", color = FairyGold, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
                            if (ui.seenCount > 0) {
                                Text(
                                    Strings.t("rel.knownOf", ui.seenCount, ui.entries.size),
                                    color = LocalContentColorMuted.current,
                                    fontSize = 11.sp
                                )
                            }
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(Strings.t("rel.bonusPerLevel"), color = LocalContentColorMuted.current, fontSize = 12.sp)
                            Text(
                                Strings.t("rel.bonusPerDay", ui.bonusPercentPerLevel),
                                color = FairyGold,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }

                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(ui.entries) { entry ->
                        ArchetypeCell(entry, ui.maxLevel)
                    }
                }
            }
        }
    }
}

@Composable
private fun ArchetypeCell(entry: ArchetypeEntry, maxLevel: Int) {
    val archetype = entry.archetype
    val emoji = when (archetype) {
        PersonaArchetype.BURATINO -> "🪆"
        PersonaArchetype.BOYARIN -> "👑"
        PersonaArchetype.KOLOBOK -> "🤗"
        PersonaArchetype.KOSCHEI -> "💀"
        PersonaArchetype.ZOLUSHKA -> "👠"
        PersonaArchetype.BABA_YAGA -> "🧙"
        PersonaArchetype.IVAN_DURAK -> "🃏"
    }
    val name = Strings.t("persona.${archetype.name}")
    val seen = entry.seen

    Box(
        modifier = Modifier
            .height(124.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(
                Brush.verticalGradient(
                    listOf(
                        EnchantedPurple.copy(alpha = if (seen) 0.7f else 0.35f),
                        NightBlue.copy(alpha = if (seen) 0.95f else 0.6f)
                    )
                )
            )
            .border(
                1.dp,
                if (seen) FairyGold.copy(alpha = 0.45f) else FairyGold.copy(alpha = 0.15f),
                RoundedCornerShape(14.dp)
            )
            .clickable { /* TODO Phase 4: open archetype detail */ }
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            if (seen) {
                PersonaAvatar(archetype, size = 48.dp)
            } else {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(FairyGold.copy(alpha = 0.08f))
                        .border(1.dp, FairyGold.copy(alpha = 0.18f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(emoji, fontSize = 26.sp)
                }
            }
            Text(
                if (seen) name else "?",
                color = LocalContentColor.current.copy(alpha = if (seen) 0.9f else 0.4f),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "🤝 ${entry.tieLevel}/$maxLevel",
                    color = LocalContentColor.current.copy(alpha = if (entry.tieLevel > 0) 0.85f else 0.4f),
                    fontSize = 10.sp,
                    fontWeight = if (entry.tieLevel > 0) FontWeight.SemiBold else FontWeight.Normal
                )
            }
            Text(
                "🪙 ${entry.tokens}",
                color = FairyGold.copy(alpha = if (entry.tokens > 0) 0.85f else 0.35f),
                fontSize = 10.sp,
                fontWeight = if (entry.tokens > 0) FontWeight.SemiBold else FontWeight.Normal
            )
        }
    }
}
