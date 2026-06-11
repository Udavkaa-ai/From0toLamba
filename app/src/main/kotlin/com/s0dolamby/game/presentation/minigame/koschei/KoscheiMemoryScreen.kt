package com.s0dolamby.game.presentation.minigame.koschei

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.minigame.common.ArchetypePalette
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import com.s0dolamby.game.presentation.minigame.common.MinigameShell
import com.s0dolamby.game.presentation.minigame.common.MinigameStage
import com.s0dolamby.game.presentation.minigame.common.drawSparkleHalo
import kotlinx.coroutines.delay
import kotlin.random.Random

// ─── модель «руны» Кощея ─────────────────────────────────────────────────────

private enum class Rune(
    val baseColor: Color,
    val glowColor: Color,
    val label: String
) {
    ICE(Color(0xFF26C6DA), Color(0xFF80DEEA), "лёд"),
    BONE(Color(0xFFCFD8DC), Color(0xFFFFFFFF), "кость"),
    MORN(Color(0xFFAB47BC), Color(0xFFCE93D8), "ночь"),
    MIST(Color(0xFF66BB6A), Color(0xFFA5D6A7), "туман")
}

private val ALL_RUNES = Rune.values().toList()

private enum class Phase { SHOWCASE, INPUT, FINAL_ROUND }

@Composable
fun KoscheiMemoryScreen(onBack: () -> Unit) {
    var seed by remember { mutableStateOf(System.currentTimeMillis()) }
    var round by remember(seed) { mutableStateOf(1) }
    var sequence by remember(seed) { mutableStateOf(generateSequence(round, seed)) }
    var phase by remember(seed) { mutableStateOf(Phase.SHOWCASE) }
    var litRune by remember(seed) { mutableStateOf<Rune?>(null) }
    var playerInput by remember(seed) { mutableStateOf(emptyList<Rune>()) }
    var errors by remember(seed) { mutableStateOf(0) }
    var stage by remember(seed) { mutableStateOf(MinigameStage.MEMORIZE) }
    var secondsLeft by remember(seed) { mutableStateOf(0) }
    var timedOut by remember(seed) { mutableStateOf(false) }

    // SHOWCASE: воспроизвести подсветку каждой руны в последовательности
    LaunchedEffect(seed, round, phase) {
        if (phase == Phase.SHOWCASE) {
            stage = MinigameStage.MEMORIZE
            secondsLeft = sequence.size + 2
            delay(700) // пауза перед первой вспышкой
            sequence.forEach { rune ->
                litRune = rune
                delay(SHOWCASE_LIT_MS)
                litRune = null
                delay(SHOWCASE_GAP_MS)
            }
            // переход к вводу
            phase = Phase.INPUT
            stage = MinigameStage.PLAY
            secondsLeft = INPUT_SECONDS
            playerInput = emptyList()
        }
    }

    // INPUT: обратный отсчёт секунд
    LaunchedEffect(seed, phase, round) {
        if (phase == Phase.INPUT) {
            while (secondsLeft > 0 && phase == Phase.INPUT) {
                delay(1000); secondsLeft -= 1
            }
            if (phase == Phase.INPUT && stage == MinigameStage.PLAY) {
                timedOut = true
                stage = MinigameStage.RESULT
            }
        }
    }

    val outcome: MinigameOutcome? = if (stage == MinigameStage.RESULT) {
        MinigameOutcome(errorCount = errors + (if (timedOut) 2 else 0), timeoutReached = timedOut)
    } else null

    fun handleTap(rune: Rune) {
        if (phase != Phase.INPUT) return
        val expected = sequence.getOrNull(playerInput.size) ?: return
        val newInput = playerInput + rune
        playerInput = newInput
        if (rune != expected) {
            errors += 1
        }
        if (newInput.size == sequence.size) {
            // Раунд закончен
            if (round >= TOTAL_ROUNDS) {
                stage = MinigameStage.RESULT
            } else {
                round += 1
                sequence = generateSequence(round, seed + round)
                phase = Phase.SHOWCASE
            }
        }
    }

    fun restart() {
        seed = System.currentTimeMillis()
        round = 1
        sequence = generateSequence(round, seed)
        phase = Phase.SHOWCASE
        playerInput = emptyList()
        errors = 0
        litRune = null
        timedOut = false
        stage = MinigameStage.MEMORIZE
    }

    MinigameShell(
        archetype = PersonaArchetype.KOSCHEI,
        gameTitle = "Память Кощея",
        stage = stage,
        secondsLeft = if (stage == MinigameStage.RESULT) null else secondsLeft.coerceAtLeast(0),
        outcome = outcome,
        onBack = onBack,
        onAgain = { restart() },
        onClose = onBack
    ) {
        if (stage == MinigameStage.MEMORIZE || stage == MinigameStage.PLAY) {
            RoundCounter(round = round, total = TOTAL_ROUNDS, sequenceSize = sequence.size,
                input = playerInput.size, phase = phase)
            Spacer(Modifier.height(16.dp))
            RuneGrid(litRune = litRune, enabled = phase == Phase.INPUT, onTap = ::handleTap)
            Spacer(Modifier.height(10.dp))
            ProgressBar(
                color = ArchetypePalette[PersonaArchetype.KOSCHEI].primary,
                size = sequence.size,
                inputSize = playerInput.size,
                expected = sequence,
                input = playerInput
            )
        }
        if (stage == MinigameStage.RESULT) {
            Spacer(Modifier.height(20.dp))
            Text(
                "Раундов сыграно: $round / $TOTAL_ROUNDS",
                color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp
            )
            Text(
                "Ошибок: $errors",
                color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp
            )
        }
    }
}

@Composable
private fun RoundCounter(round: Int, total: Int, sequenceSize: Int, input: Int, phase: Phase) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            "Раунд $round из $total",
            color = ArchetypePalette[PersonaArchetype.KOSCHEI].primary,
            fontSize = 13.sp, fontWeight = FontWeight.SemiBold
        )
        Spacer(Modifier.height(4.dp))
        val text = when (phase) {
            Phase.SHOWCASE -> "Запоминай · $sequenceSize рун"
            Phase.INPUT -> "Повтори ($input / $sequenceSize)"
            Phase.FINAL_ROUND -> ""
        }
        Text(text, color = Color.White.copy(alpha = 0.75f), fontSize = 13.sp)
    }
}

@Composable
private fun RuneGrid(litRune: Rune?, enabled: Boolean, onTap: (Rune) -> Unit) {
    val infinite = rememberInfiniteTransition(label = "rune-glow")
    val glow by infinite.animateFloat(
        initialValue = 0.7f, targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            tween(700, easing = LinearEasing), repeatMode = RepeatMode.Reverse
        ),
        label = "glow"
    )

    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            RuneTile(Rune.ICE, lit = litRune == Rune.ICE, enabled = enabled,
                glow = if (litRune == Rune.ICE) glow else 0f, onTap = onTap)
            RuneTile(Rune.BONE, lit = litRune == Rune.BONE, enabled = enabled,
                glow = if (litRune == Rune.BONE) glow else 0f, onTap = onTap)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            RuneTile(Rune.MIST, lit = litRune == Rune.MIST, enabled = enabled,
                glow = if (litRune == Rune.MIST) glow else 0f, onTap = onTap)
            RuneTile(Rune.MORN, lit = litRune == Rune.MORN, enabled = enabled,
                glow = if (litRune == Rune.MORN) glow else 0f, onTap = onTap)
        }
    }
}

@Composable
private fun RuneTile(
    rune: Rune,
    lit: Boolean,
    enabled: Boolean,
    glow: Float,
    onTap: (Rune) -> Unit
) {
    val tap = remember { Animatable(1f) }
    LaunchedEffect(lit) {
        if (lit) {
            tap.snapTo(0.92f)
            tap.animateTo(1f, animationSpec = tween(220))
        }
    }
    val scale = tap.value * (if (lit) 1.05f else 1f)
    val alpha = if (lit) 1f else 0.6f

    Box(
        modifier = Modifier
            .size(110.dp)
            .scale(scale)
            .shadow(if (lit) 16.dp else 4.dp, RoundedCornerShape(24.dp))
            .clip(RoundedCornerShape(24.dp))
            .background(
                Brush.radialGradient(
                    colors = if (lit) listOf(rune.glowColor, rune.baseColor)
                    else listOf(rune.baseColor.copy(alpha = 0.55f), rune.baseColor.copy(alpha = 0.85f))
                )
            )
            .border(
                width = if (lit) 3.dp else 1.dp,
                color = if (lit) rune.glowColor else Color.White.copy(alpha = 0.12f),
                shape = RoundedCornerShape(24.dp)
            )
            .let { if (enabled) it.clickable { onTap(rune) } else it },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            // Декоративная руна — символ-узор
            val sz = this.size.minDimension
            val center = Offset(this.size.width / 2f, this.size.height / 2f)
            if (lit) {
                drawSparkleHalo(
                    center = center,
                    radius = sz * 0.45f,
                    count = 4,
                    sparkleSize = 7f,
                    color = rune.glowColor,
                    intensity = glow
                )
            }
            // Внутренний орнамент-руна
            val pad = sz * 0.25f
            drawCircle(
                color = if (lit) Color.White.copy(alpha = 0.4f * alpha)
                else rune.baseColor.copy(alpha = 0.3f),
                radius = sz * 0.22f,
                center = center,
                style = Stroke(width = 2f)
            )
            drawCircle(
                color = if (lit) Color.White.copy(alpha = 0.6f) else rune.baseColor.copy(alpha = 0.6f),
                radius = sz * 0.06f,
                center = center
            )
            // 4 точки по сторонам
            val r = sz * 0.32f
            val dotColor = if (lit) Color.White.copy(alpha = 0.85f) else rune.baseColor.copy(alpha = 0.4f)
            listOf(
                Offset(center.x, center.y - r),
                Offset(center.x + r, center.y),
                Offset(center.x, center.y + r),
                Offset(center.x - r, center.y)
            ).forEach { drawCircle(dotColor, radius = sz * 0.025f, center = it) }
        }
        Text(
            rune.label,
            color = if (lit) Color.White else Color.White.copy(alpha = 0.55f),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 8.dp).align(Alignment.BottomCenter)
        )
    }
}

@Composable
private fun ProgressBar(
    color: Color,
    size: Int,
    inputSize: Int,
    expected: List<Rune>,
    input: List<Rune>
) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        for (i in 0 until size) {
            val state = when {
                i >= input.size -> 0  // ещё не введено
                input[i] == expected[i] -> 1  // верно
                else -> 2  // ошибка
            }
            val c = when (state) {
                1 -> color
                2 -> Color(0xFFFF6E5C)
                else -> Color.White.copy(alpha = 0.18f)
            }
            Box(
                modifier = Modifier
                    .height(6.dp)
                    .width(28.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(c)
            )
        }
    }
}

// ─── логика ──────────────────────────────────────────────────────────────────

private fun generateSequence(round: Int, seed: Long): List<Rune> {
    val rng = Random(seed + round * 17L)
    val length = SEQUENCE_LEN_BASE + (round - 1) * SEQUENCE_LEN_STEP
    return List(length) { ALL_RUNES[rng.nextInt(ALL_RUNES.size)] }
}

private const val TOTAL_ROUNDS = 3
private const val SEQUENCE_LEN_BASE = 3
private const val SEQUENCE_LEN_STEP = 2
private const val SHOWCASE_LIT_MS = 600L
private const val SHOWCASE_GAP_MS = 250L
private const val INPUT_SECONDS = 12
