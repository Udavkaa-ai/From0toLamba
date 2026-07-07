package com.s0dolamby.game.presentation.training

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.config.MinigameInfo
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.common.components.AppBg
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.minigame.babayaga.BabaYagaCauldronScreen
import com.s0dolamby.game.presentation.minigame.boyarin.BoyarinCharterScreen
import com.s0dolamby.game.presentation.minigame.common.ArchetypePalette
import com.s0dolamby.game.presentation.minigame.goldenkey.GoldenKeyScreen
import com.s0dolamby.game.presentation.minigame.ivandurak.IvanDurakMapScreen
import com.s0dolamby.game.presentation.minigame.kolobok.KolobokNoraScreen
import com.s0dolamby.game.presentation.minigame.koschei.KoscheiMemoryScreen
import com.s0dolamby.game.presentation.minigame.zolushka.ZolushkaCoinsScreen

/**
 * «Тренировочный зал» — список всех мини-игр дельцов с объяснением
 * механики. Игрок открывает любую, читает «как играть» и тренируется
 * без ставок: результат ни на что в игре не влияет. Тестировщики просили
 * место, где можно спокойно разобраться, как что работает.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrainingHallScreen(
    onBack: () -> Unit,
    onPlay: (PersonaArchetype) -> Unit
) {
    ScreenBackground(AppBg.STATS) {
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
                            Text(Strings.t("training.title"), fontWeight = FontWeight.Bold)
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.Default.ArrowBack, Strings.t("btn.back"))
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
                )
            }
        ) { padding ->
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 90.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Text(
                        Strings.t("training.subtitle"),
                        color = Color.White.copy(alpha = 0.75f),
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                }
                items(MinigameInfo.trainingOrder) { archetype ->
                    TrainingRow(archetype = archetype, onClick = { onPlay(archetype) })
                }
            }
        }
    }
}

@Composable
private fun TrainingRow(archetype: PersonaArchetype, onClick: () -> Unit) {
    val info = MinigameInfo[archetype]
    val style = ArchetypePalette[archetype]
    FairyCard(modifier = Modifier.fillMaxWidth().clickable { onClick() }) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Image(
                painter = painterResource(style.portraitRes),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .border(1.dp, FairyGold.copy(alpha = 0.4f), CircleShape)
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    info.title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = LocalAccentOnCard.current
                )
                Text(
                    info.goal,
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalContentColorMuted.current
                )
            }
            Text("›", color = LocalAccentOnCard.current, fontSize = 20.sp)
        }
    }
}

private enum class TrainPhase { INTRO, PLAYING }

/**
 * Обучающий запуск одной мини-игры: сперва карточка «как играть»
 * (цель, правила, совет), потом сама игра в тренировочном режиме
 * (без записи результата в прогресс). «Назад» из игры возвращает к
 * правилам, чтобы можно было перечитать и попробовать снова.
 */
@Composable
fun TrainingMinigameScreen(
    archetype: PersonaArchetype,
    onBack: () -> Unit
) {
    var phase by remember(archetype) { mutableStateOf(TrainPhase.INTRO) }

    when (phase) {
        TrainPhase.INTRO -> TrainingIntro(
            archetype = archetype,
            onStart = { phase = TrainPhase.PLAYING },
            onBack = onBack
        )
        TrainPhase.PLAYING -> {
            val backToIntro = { phase = TrainPhase.INTRO }
            when (archetype) {
                PersonaArchetype.BURATINO -> GoldenKeyScreen(onBack = backToIntro)
                // Тренировка показывает все виды отличий сразу (как у высокого чина)
                PersonaArchetype.BOYARIN -> BoyarinCharterScreen(
                    onBack = backToIntro,
                    rank = com.s0dolamby.game.domain.model.InvestorRank.ANALYST
                )
                PersonaArchetype.KOSCHEI -> KoscheiMemoryScreen(onBack = backToIntro)
                PersonaArchetype.KOLOBOK -> KolobokNoraScreen(onBack = backToIntro)
                PersonaArchetype.ZOLUSHKA -> ZolushkaCoinsScreen(onBack = backToIntro)
                PersonaArchetype.BABA_YAGA -> BabaYagaCauldronScreen(onBack = backToIntro)
                PersonaArchetype.IVAN_DURAK -> IvanDurakMapScreen(onBack = backToIntro)
            }
        }
    }
}

@Composable
private fun TrainingIntro(
    archetype: PersonaArchetype,
    onStart: () -> Unit,
    onBack: () -> Unit
) {
    val info = MinigameInfo[archetype]
    val style = ArchetypePalette[archetype]
    Box(
        modifier = Modifier.fillMaxSize().background(NightBlue),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .padding(20.dp)
                .widthIn(max = 380.dp)
                .verticalScroll(rememberScrollState())
                .clip(RoundedCornerShape(20.dp))
                .background(Brush.verticalGradient(listOf(EnchantedPurple, NightBlue)))
                .border(1.dp, FairyGold.copy(alpha = 0.4f), RoundedCornerShape(20.dp))
                .padding(22.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Image(
                painter = painterResource(style.portraitRes),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .border(2.dp, FairyGold.copy(alpha = 0.5f), CircleShape)
            )
            Spacer(Modifier.height(10.dp))
            Text(
                info.title,
                color = FairyGold,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(4.dp))
            Text(
                Strings.t("training.goal", info.goal),
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 13.sp,
                lineHeight = 18.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(6.dp))
            Text(
                Strings.t("training.timeLimit", info.secondsTotal),
                color = FairyGold.copy(alpha = 0.8f),
                fontSize = 12.sp
            )
            Spacer(Modifier.height(16.dp))

            // Правила по шагам
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                info.rules.forEachIndexed { i, rule ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(
                            modifier = Modifier
                                .size(22.dp)
                                .clip(CircleShape)
                                .background(FairyGold.copy(alpha = 0.18f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                "${i + 1}",
                                color = FairyGold,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            rule,
                            color = Color.White.copy(alpha = 0.9f),
                            fontSize = 13.sp,
                            lineHeight = 18.sp,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            if (info.tip.isNotBlank()) {
                Spacer(Modifier.height(14.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Success.copy(alpha = 0.12f))
                        .border(1.dp, Success.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("💡", fontSize = 15.sp)
                    Text(
                        info.tip,
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            Spacer(Modifier.height(20.dp))
            Button(
                onClick = onStart,
                colors = ButtonDefaults.buttonColors(containerColor = FairyGold, contentColor = NightBlue),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(Strings.t("training.start"), fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
                Text(Strings.t("btn.back"), color = Color.White.copy(alpha = 0.7f))
            }
        }
    }
}
