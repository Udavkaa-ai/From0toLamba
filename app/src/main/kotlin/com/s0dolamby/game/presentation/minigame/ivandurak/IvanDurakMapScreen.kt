package com.s0dolamby.game.presentation.minigame.ivandurak

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.minigame.common.ArchetypePalette
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import com.s0dolamby.game.presentation.minigame.common.MinigameShell
import com.s0dolamby.game.presentation.minigame.common.MinigameStage
import kotlinx.coroutines.delay
import kotlin.random.Random

// ─── сказочная колода ───────────────────────────────────────────────────

private enum class Suit(val emoji: String, val tint: Color) {
    SWORDS("⚔️", Color(0xFF90A4AE)),
    COINS("🪙", Color(0xFFFFD54F)),
    CUPS("🏺", Color(0xFFB39DDB)),
    WANDS("🌿", Color(0xFF81C784))
}

private val RANKS = listOf("6", "7", "8", "9", "10", "В", "Д", "К", "Т")

private data class PlayCard(val suit: Suit, val rank: String)

private fun dealHand(seed: Long): List<PlayCard> {
    val rng = Random(seed)
    val all = Suit.values().flatMap { s -> RANKS.map { r -> PlayCard(s, r) } }
    return all.shuffled(rng).take(HAND_SIZE)
}

@Composable
fun IvanDurakMapScreen(onBack: () -> Unit) {
    var seed by remember { mutableStateOf(System.currentTimeMillis()) }
    val hand = remember(seed) { dealHand(seed) }

    var roundKey by remember(seed) { mutableStateOf(0) }
    var roundIdx by remember(seed) { mutableStateOf(0) }
    var shownCard by remember(seed) { mutableStateOf<PlayCard?>(null) }
    var caught by remember(seed) { mutableStateOf(0) }
    var errors by remember(seed) { mutableStateOf(0) }
    var stage by remember(seed) { mutableStateOf(MinigameStage.PLAY) }
    var resolved by remember(seed) { mutableStateOf(false) }
    var flashGood by remember(seed) { mutableStateOf<Boolean?>(null) }   // null = нет вспышки

    LaunchedEffect(seed, roundKey) {
        if (stage != MinigameStage.PLAY) return@LaunchedEffect
        if (roundIdx >= TOTAL_ROUNDS) {
            stage = MinigameStage.RESULT
            return@LaunchedEffect
        }
        flashGood = null
        resolved = false
        shownCard = null
        delay(Random.nextLong(PAUSE_MIN_MS, PAUSE_MAX_MS + 1))
        shownCard = hand.random(Random(seed + roundKey * 13L))
        delay(REACTION_WINDOW_MS)
        if (!resolved) {
            // Не успел выбрать карту
            resolved = true
            errors += 1
            flashGood = false
            shownCard = null
            delay(FLASH_MS)
            roundIdx += 1
            roundKey += 1
        }
    }

    fun handleHandTap(card: PlayCard) {
        if (stage != MinigameStage.PLAY) return
        if (resolved) return
        val target = shownCard ?: return
        resolved = true
        if (card == target) {
            caught += 1
            flashGood = true
        } else {
            errors += 1
            flashGood = false
        }
        shownCard = null
    }

    LaunchedEffect(flashGood, resolved) {
        if (flashGood != null && resolved && shownCard == null) {
            delay(FLASH_MS)
            roundIdx += 1
            roundKey += 1
        }
    }

    val outcome: MinigameOutcome? = if (stage == MinigameStage.RESULT) {
        MinigameOutcome(errorCount = errors, timeoutReached = false)
    } else null

    fun restart() {
        seed = System.currentTimeMillis()
        roundKey = 0
        roundIdx = 0
        shownCard = null
        caught = 0
        errors = 0
        resolved = false
        flashGood = null
        stage = MinigameStage.PLAY
    }

    MinigameShell(
        archetype = PersonaArchetype.IVAN_DURAK,
        gameTitle = "Подкинь карту",
        stage = stage,
        secondsLeft = if (stage == MinigameStage.RESULT) null else (TOTAL_ROUNDS - roundIdx),
        outcome = outcome,
        onBack = onBack,
        onAgain = { restart() },
        onClose = onBack
    ) {
        if (stage == MinigameStage.PLAY) {
            Text(
                "Иван кидает карту — найди такую же у себя!",
                color = Color.White.copy(alpha = 0.85f), fontSize = 14.sp
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "Поймано $caught  ·  ошибок $errors",
                color = ArchetypePalette[PersonaArchetype.IVAN_DURAK].primary,
                fontSize = 12.sp
            )
            Spacer(Modifier.height(12.dp))

            // Центральная зона — карта Ивана
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                ShownCardArea(card = shownCard, flashGood = flashGood)
            }

            Spacer(Modifier.height(12.dp))
            Text(
                "Твоя рука:",
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 12.sp
            )
            Spacer(Modifier.height(6.dp))
            HandRow(hand = hand, enabled = shownCard != null, onTap = ::handleHandTap)
            Spacer(Modifier.height(8.dp))
        }
        if (stage == MinigameStage.RESULT) {
            Spacer(Modifier.height(20.dp))
            Text(
                "Поймано карт: $caught из $TOTAL_ROUNDS",
                color = Color.White, fontSize = 14.sp
            )
            Text(
                "Ошибок (не та карта или зевнул): $errors",
                color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp
            )
        }
    }
}

@Composable
private fun ShownCardArea(card: PlayCard?, flashGood: Boolean?) {
    // Вспышка после ответа
    if (flashGood != null) {
        Box(
            modifier = Modifier
                .size(120.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(
                    if (flashGood) Color(0xFF66BB6A).copy(alpha = 0.30f)
                    else Color(0xFFE57373).copy(alpha = 0.30f)
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(
                if (flashGood) "✓" else "✗",
                color = if (flashGood) Color(0xFF66BB6A) else Color(0xFFE57373),
                fontSize = 56.sp,
                fontWeight = FontWeight.Bold
            )
        }
        return
    }
    if (card == null) {
        // Ожидание — Иван «тасует»
        val infinite = rememberInfiniteTransition(label = "shuffle")
        val wob by infinite.animateFloat(
            initialValue = -4f, targetValue = 4f,
            animationSpec = infiniteRepeatable(
                tween(300, easing = FastOutSlowInEasing), repeatMode = RepeatMode.Reverse
            ),
            label = "wob"
        )
        Box(
            modifier = Modifier
                .size(width = 96.dp, height = 132.dp)
                .graphicsLayer { rotationZ = wob }
                .clip(RoundedCornerShape(14.dp))
                .background(
                    Brush.verticalGradient(
                        listOf(Color(0xFF5D4037), Color(0xFF2A1408))
                    )
                )
                .border(1.dp, Color(0xFFFFAB91).copy(alpha = 0.4f), RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text("🂠", fontSize = 44.sp)
        }
        return
    }
    // Показанная карта — выпрыгивает с пружиной + 3D-покачивание
    val popScale = remember(card) { Animatable(0.4f) }
    LaunchedEffect(card) {
        popScale.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
    }
    val infinite = rememberInfiniteTransition(label = "card-swing")
    val swing by infinite.animateFloat(
        initialValue = -10f, targetValue = 10f,
        animationSpec = infiniteRepeatable(
            tween(360, easing = FastOutSlowInEasing), repeatMode = RepeatMode.Reverse
        ),
        label = "swing"
    )
    Box(
        modifier = Modifier
            .scale(popScale.value)
            .graphicsLayer {
                rotationY = swing
                cameraDistance = 12f * density
            }
    ) {
        CardFace(card = card, width = 110.dp, height = 152.dp, rankSize = 26.sp, suitSize = 48.sp)
    }
}

@Composable
private fun HandRow(hand: List<PlayCard>, enabled: Boolean, onTap: (PlayCard) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        hand.forEach { card ->
            Box(
                modifier = Modifier
                    .weight(1f)
                    .let { m ->
                        if (enabled) m.clickable { onTap(card) } else m
                    }
            ) {
                CardFace(
                    card = card,
                    width = null, height = 92.dp,
                    rankSize = 14.sp, suitSize = 24.sp,
                    dimmed = !enabled
                )
            }
        }
    }
}

@Composable
private fun CardFace(
    card: PlayCard,
    width: androidx.compose.ui.unit.Dp?,
    height: androidx.compose.ui.unit.Dp,
    rankSize: androidx.compose.ui.unit.TextUnit,
    suitSize: androidx.compose.ui.unit.TextUnit,
    dimmed: Boolean = false
) {
    val base = Modifier
        .let { if (width != null) it.width(width) else it.fillMaxWidth() }
        .height(height)
        .shadow(4.dp, RoundedCornerShape(12.dp))
        .clip(RoundedCornerShape(12.dp))
        .background(
            Brush.verticalGradient(
                listOf(Color(0xFFFFF8E1), Color(0xFFEFE0C0))
            )
        )
        .border(1.5.dp, card.suit.tint.copy(alpha = if (dimmed) 0.35f else 0.8f), RoundedCornerShape(12.dp))
        .graphicsLayer { alpha = if (dimmed) 0.55f else 1f }

    Box(modifier = base) {
        Text(
            card.rank,
            color = Color(0xFF3E2723),
            fontSize = rankSize,
            fontWeight = FontWeight.Bold,
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(start = 6.dp, top = 2.dp)
        )
        Text(
            card.suit.emoji,
            fontSize = suitSize,
            modifier = Modifier.align(Alignment.Center)
        )
    }
}

private const val HAND_SIZE = 6
private const val TOTAL_ROUNDS = 8
private const val REACTION_WINDOW_MS = 2200L
private const val PAUSE_MIN_MS = 450L
private const val PAUSE_MAX_MS = 1100L
private const val FLASH_MS = 420L
