package com.s0dolamby.game.presentation.minigame.zolushka

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
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.minigame.common.ArchetypePalette
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import com.s0dolamby.game.presentation.minigame.common.MinigameShell
import com.s0dolamby.game.presentation.minigame.common.MinigameStage
import com.s0dolamby.game.presentation.minigame.common.drawSparkleHalo
import kotlinx.coroutines.delay
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

// ─── зернышки Золушки ──────────────────────────────────────────────────

private enum class Grain(
    val seedColor: Color,
    val glowColor: Color,
    val label: String
) {
    WHEAT(Color(0xFFE6B33C), Color(0xFFFFE082), "пшеница"),
    LENTIL(Color(0xFF8B5A2B), Color(0xFFCAA170), "чечевица"),
    ACORN(Color(0xFFA0522D), Color(0xFFD7967E), "жёлудь"),
    POMEGRANATE(Color(0xFFC2185B), Color(0xFFF8BBD0), "вишня")
}

private val ALL_GRAINS = Grain.values().toList()

private enum class Phase { SHOWCASE, INPUT }

@Composable
fun ZolushkaCoinsScreen(
    onBack: () -> Unit,
    onComplete: ((MinigameOutcome) -> Unit)? = null
) {
    var seed by remember { mutableStateOf(System.currentTimeMillis()) }
    // Одна мастер-последовательность на всю игру; раунды показывают
    // растущий префикс: 3 → 5 → 7 зёрен. Начало всегда одно и то же —
    // запоминать надо только новый хвост.
    val master = remember(seed) { generateMaster(seed) }
    var round by remember(seed) { mutableStateOf(1) }
    var sequence by remember(seed) { mutableStateOf(master.take(prefixLen(1))) }
    var phase by remember(seed) { mutableStateOf(Phase.SHOWCASE) }
    var litGrain by remember(seed) { mutableStateOf<Grain?>(null) }
    var playerInput by remember(seed) { mutableStateOf(emptyList<Grain>()) }
    var errors by remember(seed) { mutableStateOf(0) }
    var stage by remember(seed) { mutableStateOf(MinigameStage.MEMORIZE) }
    var secondsLeft by remember(seed) { mutableStateOf(0) }

    LaunchedEffect(seed, round, phase) {
        if (phase == Phase.SHOWCASE) {
            stage = MinigameStage.MEMORIZE
            secondsLeft = sequence.size + 2
            delay(700)
            sequence.forEach { grain ->
                litGrain = grain
                delay(SHOWCASE_LIT_MS)
                litGrain = null
                delay(SHOWCASE_GAP_MS)
            }
            phase = Phase.INPUT
            stage = MinigameStage.PLAY
            secondsLeft = INPUT_SECONDS
            playerInput = emptyList()
        }
    }

    LaunchedEffect(seed, phase, round) {
        if (phase == Phase.INPUT) {
            while (secondsLeft > 0 && phase == Phase.INPUT) {
                delay(1000); secondsLeft -= 1
            }
            if (phase == Phase.INPUT && stage == MinigameStage.PLAY) {
                stage = MinigameStage.RESULT
            }
        }
    }

    val outcome: MinigameOutcome? = if (stage == MinigameStage.RESULT) {
        MinigameOutcome(errorCount = errors, timeoutReached = false)
    } else null

    fun handleTap(grain: Grain) {
        if (phase != Phase.INPUT) return
        val expected = sequence.getOrNull(playerInput.size) ?: return
        val newInput = playerInput + grain
        playerInput = newInput
        if (grain != expected) errors += 1
        if (newInput.size == sequence.size) {
            if (round >= TOTAL_ROUNDS) {
                stage = MinigameStage.RESULT
            } else {
                round += 1
                sequence = master.take(prefixLen(round))
                phase = Phase.SHOWCASE
            }
        }
    }

    fun restart() {
        seed = System.currentTimeMillis()
        round = 1
        sequence = master.take(prefixLen(1))
        phase = Phase.SHOWCASE
        playerInput = emptyList()
        errors = 0
        litGrain = null
        stage = MinigameStage.MEMORIZE
    }

    MinigameShell(
        archetype = PersonaArchetype.ZOLUSHKA,
        gameTitle = Strings.t("minigame.title.coins"),
        stage = stage,
        secondsLeft = if (stage == MinigameStage.RESULT) null else secondsLeft.coerceAtLeast(0),
        outcome = outcome,
        onBack = onBack,
        onAgain = { restart() },
        onClose = onBack,
        onComplete = onComplete
    ) {
        if (stage == MinigameStage.MEMORIZE || stage == MinigameStage.PLAY) {
            RoundCounter(round = round, total = TOTAL_ROUNDS, sequenceSize = sequence.size,
                input = playerInput.size, phase = phase)
            Spacer(Modifier.height(16.dp))
            GrainGrid(litGrain = litGrain, enabled = phase == Phase.INPUT, onTap = ::handleTap)
            Spacer(Modifier.height(10.dp))
            ProgressBar(
                color = ArchetypePalette[PersonaArchetype.ZOLUSHKA].primary,
                size = sequence.size,
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
            color = ArchetypePalette[PersonaArchetype.ZOLUSHKA].primary,
            fontSize = 13.sp, fontWeight = FontWeight.SemiBold
        )
        Spacer(Modifier.height(4.dp))
        val text = when (phase) {
            Phase.SHOWCASE ->
                if (round == 1) "Запоминай · $sequenceSize зёрнышка"
                else "Начало то же + 2 новых · всего $sequenceSize"
            Phase.INPUT -> "Перебери ($input / $sequenceSize)"
        }
        Text(text, color = Color.White.copy(alpha = 0.75f), fontSize = 13.sp)
    }
}

@Composable
private fun ColumnScope.GrainGrid(litGrain: Grain?, enabled: Boolean, onTap: (Grain) -> Unit) {
    val infinite = rememberInfiniteTransition(label = "grain-glow")
    val glow by infinite.animateFloat(
        initialValue = 0.7f, targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            tween(700, easing = LinearEasing), repeatMode = RepeatMode.Reverse
        ),
        label = "glow"
    )
    // Лёгкое «дыхание» всех клеток в режиме ожидания
    val idleBreath by infinite.animateFloat(
        initialValue = 0.985f, targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            tween(1400, easing = FastOutSlowInEasing), repeatMode = RepeatMode.Reverse
        ),
        label = "idleBreath"
    )

    // Клетки растягиваются на весь доступный экран: 2×2, каждая weight(1f)
    Column(
        modifier = Modifier
            .weight(1f)
            .fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(Modifier.weight(1f).fillMaxHeight()) {
                GrainTile(Grain.WHEAT, lit = litGrain == Grain.WHEAT, enabled = enabled,
                    glow = if (litGrain == Grain.WHEAT) glow else 0f,
                    idleBreath = idleBreath, onTap = onTap)
            }
            Box(Modifier.weight(1f).fillMaxHeight()) {
                GrainTile(Grain.LENTIL, lit = litGrain == Grain.LENTIL, enabled = enabled,
                    glow = if (litGrain == Grain.LENTIL) glow else 0f,
                    idleBreath = idleBreath, onTap = onTap)
            }
        }
        Row(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(Modifier.weight(1f).fillMaxHeight()) {
                GrainTile(Grain.ACORN, lit = litGrain == Grain.ACORN, enabled = enabled,
                    glow = if (litGrain == Grain.ACORN) glow else 0f,
                    idleBreath = idleBreath, onTap = onTap)
            }
            Box(Modifier.weight(1f).fillMaxHeight()) {
                GrainTile(Grain.POMEGRANATE, lit = litGrain == Grain.POMEGRANATE, enabled = enabled,
                    glow = if (litGrain == Grain.POMEGRANATE) glow else 0f,
                    idleBreath = idleBreath, onTap = onTap)
            }
        }
    }
}

@Composable
private fun GrainTile(
    grain: Grain,
    lit: Boolean,
    enabled: Boolean,
    glow: Float,
    idleBreath: Float,
    onTap: (Grain) -> Unit
) {
    val tap = remember { Animatable(1f) }
    LaunchedEffect(lit) {
        if (lit) {
            tap.snapTo(0.90f)
            tap.animateTo(1.06f, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
            tap.animateTo(1f, tween(180))
        }
    }
    // Покачивание зажжённой клетки + дыхание в покое
    val infinite = rememberInfiniteTransition(label = "tile-wiggle")
    val wiggle by infinite.animateFloat(
        initialValue = -2f, targetValue = 2f,
        animationSpec = infiniteRepeatable(
            tween(260, easing = LinearEasing), repeatMode = RepeatMode.Reverse
        ),
        label = "wiggle"
    )
    val scale = tap.value * (if (lit) 1.04f else idleBreath)
    val alpha = if (lit) 1f else 0.7f

    Box(
        modifier = Modifier
            .fillMaxSize()
            .scale(scale)
            .graphicsLayer { rotationZ = if (lit) wiggle else 0f }
            .shadow(if (lit) 18.dp else 4.dp, RoundedCornerShape(28.dp))
            .clip(RoundedCornerShape(28.dp))
            .background(
                Brush.radialGradient(
                    colors = if (lit) listOf(Color(0xFFFFE0E6), grain.seedColor)
                    else listOf(Color(0xFF3A1F2A), Color(0xFF1A0F18))
                )
            )
            .border(
                width = if (lit) 3.dp else 1.dp,
                color = if (lit) grain.glowColor else Color.White.copy(alpha = 0.15f),
                shape = RoundedCornerShape(28.dp)
            )
            .let { if (enabled) it.clickable { onTap(grain) } else it },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val sz = this.size.minDimension
            val center = Offset(this.size.width / 2f, this.size.height / 2f)
            if (lit) {
                drawSparkleHalo(
                    center = center,
                    radius = sz * 0.42f,
                    count = 6,
                    sparkleSize = 9f,
                    color = grain.glowColor,
                    intensity = glow
                )
            }
            drawGrainEmblem(grain, center, sz * 0.52f, lit, alpha)
        }
        Text(
            grain.label,
            color = if (lit) Color(0xFF2A0F1A) else Color.White.copy(alpha = 0.6f),
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 10.dp).align(Alignment.BottomCenter)
        )
    }
}

private fun DrawScope.drawGrainEmblem(grain: Grain, center: Offset, sizePx: Float, lit: Boolean, alpha: Float) {
    val baseColor = grain.seedColor.copy(alpha = if (lit) 1f else alpha)
    val highlight = grain.glowColor.copy(alpha = if (lit) 1f else alpha * 0.6f)
    when (grain) {
        Grain.WHEAT -> {
            // Колос: вертикальный стебель + 6 косых зёрнышек
            val stalkH = sizePx * 0.6f
            drawLine(
                Color(0xFF8B6914).copy(alpha = if (lit) 1f else alpha),
                start = Offset(center.x, center.y + stalkH * 0.4f),
                end = Offset(center.x, center.y - stalkH * 0.4f),
                strokeWidth = sizePx * 0.04f
            )
            for (i in 0..5) {
                val side = if (i % 2 == 0) -1 else 1
                val y = center.y + stalkH * (0.3f - i * 0.12f)
                drawOval(
                    baseColor,
                    topLeft = Offset(center.x + side * sizePx * 0.05f - sizePx * 0.06f,
                        y - sizePx * 0.04f),
                    size = Size(sizePx * 0.18f, sizePx * 0.10f)
                )
            }
            drawCircle(highlight, radius = sizePx * 0.05f, center = Offset(center.x, center.y - stalkH * 0.5f))
        }
        Grain.LENTIL -> {
            // Чечевица: 5 коричневых линз
            val positions = listOf(
                Offset(-0.25f, -0.10f), Offset(0.20f, -0.20f), Offset(0.00f, 0.05f),
                Offset(-0.15f, 0.20f), Offset(0.25f, 0.15f)
            )
            positions.forEach { p ->
                drawOval(
                    baseColor,
                    topLeft = Offset(center.x + p.x * sizePx - sizePx * 0.16f,
                        center.y + p.y * sizePx - sizePx * 0.06f),
                    size = Size(sizePx * 0.32f, sizePx * 0.12f)
                )
                drawOval(
                    highlight,
                    topLeft = Offset(center.x + p.x * sizePx - sizePx * 0.14f,
                        center.y + p.y * sizePx - sizePx * 0.04f),
                    size = Size(sizePx * 0.28f, sizePx * 0.08f),
                    style = Stroke(width = sizePx * 0.01f)
                )
            }
        }
        Grain.ACORN -> {
            // Жёлудь: овал орех + шапочка-полусфера сверху
            val nutCenter = Offset(center.x, center.y + sizePx * 0.05f)
            drawOval(
                baseColor,
                topLeft = Offset(nutCenter.x - sizePx * 0.20f, nutCenter.y - sizePx * 0.10f),
                size = Size(sizePx * 0.40f, sizePx * 0.40f)
            )
            // Блик
            drawOval(
                highlight,
                topLeft = Offset(nutCenter.x - sizePx * 0.15f, nutCenter.y - sizePx * 0.05f),
                size = Size(sizePx * 0.10f, sizePx * 0.18f)
            )
            // Шапочка — тёмно-коричневая полусфера
            val capColor = Color(0xFF5D4037).copy(alpha = if (lit) 1f else alpha)
            val capPath = Path().apply {
                moveTo(nutCenter.x - sizePx * 0.24f, nutCenter.y - sizePx * 0.05f)
                quadraticBezierTo(nutCenter.x, nutCenter.y - sizePx * 0.30f,
                    nutCenter.x + sizePx * 0.24f, nutCenter.y - sizePx * 0.05f)
                close()
            }
            drawPath(capPath, color = capColor)
            // Хвостик
            drawLine(
                capColor,
                start = Offset(nutCenter.x, nutCenter.y - sizePx * 0.28f),
                end = Offset(nutCenter.x, nutCenter.y - sizePx * 0.40f),
                strokeWidth = sizePx * 0.04f
            )
        }
        Grain.POMEGRANATE -> {
            // Гранатовые зёрнышки: 5 капель красно-розового цвета
            for (i in 0 until 6) {
                val a = Math.PI * 2 * i / 6
                val cx = center.x + (sizePx * 0.22f * cos(a)).toFloat()
                val cy = center.y + (sizePx * 0.22f * sin(a)).toFloat()
                drawCircle(baseColor, radius = sizePx * 0.10f, center = Offset(cx, cy))
                drawCircle(highlight, radius = sizePx * 0.04f,
                    center = Offset(cx - sizePx * 0.03f, cy - sizePx * 0.03f))
            }
            drawCircle(baseColor, radius = sizePx * 0.10f, center = center)
            drawCircle(highlight, radius = sizePx * 0.04f,
                center = Offset(center.x - sizePx * 0.03f, center.y - sizePx * 0.03f))
        }
    }
}

@Composable
private fun ProgressBar(
    color: Color,
    size: Int,
    expected: List<Grain>,
    input: List<Grain>
) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        for (i in 0 until size) {
            val state = when {
                i >= input.size -> 0
                input[i] == expected[i] -> 1
                else -> 2
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

private fun generateMaster(seed: Long): List<Grain> {
    val rng = Random(seed)
    return List(MASTER_LENGTH) { ALL_GRAINS[rng.nextInt(ALL_GRAINS.size)] }
}

private fun prefixLen(round: Int): Int =
    SEQUENCE_LEN_BASE + (round - 1) * SEQUENCE_LEN_STEP

private const val TOTAL_ROUNDS = 3
private const val SEQUENCE_LEN_BASE = 3
private const val SEQUENCE_LEN_STEP = 2
private const val MASTER_LENGTH = SEQUENCE_LEN_BASE + (TOTAL_ROUNDS - 1) * SEQUENCE_LEN_STEP  // 7
private const val SHOWCASE_LIT_MS = 600L
private const val SHOWCASE_GAP_MS = 250L
private const val INPUT_SECONDS = 14
