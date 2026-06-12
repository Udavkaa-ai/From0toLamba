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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue

/**
 * Phase 1 — экран отношений с дельцами. Сетка 7 архетипов с пустыми
 * уровнями связи и балансом жетонов. Реальные tieLevels / archetypeTokens
 * подключаются отдельным шагом (нужны поля в GameState + Service логика).
 */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RelationshipsScreen(onBack: () -> Unit) {
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
                            Text("Отношения с дельцами", fontWeight = FontWeight.Bold, color = Color.White)
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.Default.ArrowBack, "Назад", tint = Color.White)
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
                    "Уровни связи (0..10) растут от прохождения мини-игр дельца и закрытия его дел в плюс. Жетоны — мини-валюта архетипа.",
                    color = Color.White.copy(alpha = 0.65f),
                    fontSize = 12.sp
                )

                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("🎯 Сумма связей", color = Color.White.copy(alpha = 0.65f), fontSize = 12.sp)
                            Text("0", color = FairyGold, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Бонус за уровень", color = Color.White.copy(alpha = 0.65f), fontSize = 12.sp)
                            Text("+1% / день", color = FairyGold, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(PersonaArchetype.values().toList()) { archetype ->
                        ArchetypeCell(archetype)
                    }
                }
            }
        }
    }
}

@Composable
private fun ArchetypeCell(archetype: PersonaArchetype) {
    val emoji = when (archetype) {
        PersonaArchetype.BURATINO -> "🪆"
        PersonaArchetype.BOYARIN -> "👑"
        PersonaArchetype.KOLOBOK -> "🤗"
        PersonaArchetype.KOSCHEI -> "💀"
        PersonaArchetype.ZOLUSHKA -> "👠"
        PersonaArchetype.BABA_YAGA -> "🧙"
        PersonaArchetype.IVAN_DURAK -> "🃏"
    }
    val name = when (archetype) {
        PersonaArchetype.BURATINO -> "Буратино"
        PersonaArchetype.BOYARIN -> "Боярин"
        PersonaArchetype.KOLOBOK -> "Колобок"
        PersonaArchetype.KOSCHEI -> "Кощей"
        PersonaArchetype.ZOLUSHKA -> "Золушка"
        PersonaArchetype.BABA_YAGA -> "Баба-Яга"
        PersonaArchetype.IVAN_DURAK -> "Иван-дурак"
    }

    Box(
        modifier = Modifier
            .height(118.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(
                Brush.verticalGradient(
                    listOf(
                        EnchantedPurple.copy(alpha = 0.6f),
                        NightBlue.copy(alpha = 0.85f)
                    )
                )
            )
            .border(1.dp, FairyGold.copy(alpha = 0.25f), RoundedCornerShape(14.dp))
            .clickable { /* TODO Phase 2: open archetype detail */ }
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(FairyGold.copy(alpha = 0.15f))
                    .border(1.dp, FairyGold.copy(alpha = 0.4f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(emoji, fontSize = 26.sp)
            }
            Text(
                name,
                color = Color.White.copy(alpha = 0.9f),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("🤝 0", color = Color.White.copy(alpha = 0.5f), fontSize = 10.sp)
                Text("·", color = Color.White.copy(alpha = 0.3f), fontSize = 10.sp)
                Text("🪙 0", color = FairyGold.copy(alpha = 0.7f), fontSize = 10.sp)
            }
        }
    }
}
