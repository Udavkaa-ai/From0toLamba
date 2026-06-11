package com.s0dolamby.game.presentation.minigame.zolushka

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.changedToDown
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.minigame.common.ArchetypePalette
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import com.s0dolamby.game.presentation.minigame.common.MinigameShell
import com.s0dolamby.game.presentation.minigame.common.MinigameStage
import com.s0dolamby.game.presentation.minigame.common.drawSparkle
import kotlinx.coroutines.delay
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

// ─── модель монеты ─────────────────────────────────────────────────────────

private enum class CoinMetal(val highlight: Color, val deep: Color, val ruName: String) {
    GOLD(Color(0xFFFFE082), Color(0xFFB8860B), "золотая"),
    SILVER(Color(0xFFF5F5F5), Color(0xFF7C8595), "серебряная"),
    COPPER(Color(0xFFEAA17C), Color(0xFF8A4423), "медная")
}

private enum class CoinPattern { RAYS, ROSETTE, STAR }

private data class CoinStyle(
    val metal: CoinMetal,
    val pattern: CoinPattern,
    val hasInscription: Boolean
) {
    fun describe(): String {
        val patternLabel = when (pattern) {
            CoinPattern.RAYS -> "лучами"
            CoinPattern.ROSETTE -> "розеткой"
            CoinPattern.STAR -> "звездой"
        }
        val inscr = if (hasInscription) " · с надписью" else ""
        return "${metal.ruName} с $patternLabel$inscr"
    }
}

private fun randomStyle(rng: Random) = CoinStyle(
    metal = CoinMetal.values().let { it[rng.nextInt(it.size)] },
    pattern = CoinPattern.values().let { it[rng.nextInt(it.size)] },
    hasInscription = rng.nextBoolean()
)

private fun fakeOf(real: CoinStyle, rng: Random): CoinStyle {
    val mutations = listOf<(CoinStyle) -> CoinStyle>(
        { it.copy(metal = CoinMetal.values().filter { m -> m != it.metal }.random(rng)) },
        { it.copy(pattern = CoinPattern.values().filter { p -> p != it.pattern }.random(rng)) },
        { it.copy(hasInscription = !it.hasInscription) }
    )
    return mutations.random(rng)(real)
}

private data class FallingCoin(
    val id: Long,
    val xPercent: Float,
    val style: CoinStyle,
    val isReal: Boolean,
    val spawnedAtMs: Long,
    val speedPxPerSec: Float
)

@Composable
fun ZolushkaCoinsScreen(onBack: () -> Unit) {
    val density = LocalDensity.current
    var seed by remember { mutableStateOf(System.currentTimeMillis()) }
    val rng = remember(seed) { Random(seed) }
    val target = remember(seed) { randomStyle(rng) }

    var stage by remember(seed) { mutableStateOf(MinigameStage.MEMORIZE) }
    var memorizeLeft by remember(seed) { mutableStateOf(MEMORIZE_SECONDS) }
    var playLeft by remember(seed) { mutableStateOf(PLAY_SECONDS) }
    val coins = remember(seed) { mutableStateListOf<FallingCoin>() }
    var caught by remember(seed) { mutableStateOf(0) }
    var errors by remember(seed) { mutableStateOf(0) }
    var nowMs by remember { mutableStateOf(System.currentTimeMillis()) }

    LaunchedEffect(seed, stage) {
        if (stage == MinigameStage.PLAY) {
            while (stage == MinigameStage.PLAY) {
                withFrameNanos { nowMs = System.currentTimeMillis() }
            }
        }
    }

    LaunchedEffect(seed, stage) {
        if (stage == MinigameStage.MEMORIZE) {
            while (memorizeLeft > 0 && stage == MinigameStage.MEMORIZE) {
                delay(1000); memorizeLeft -= 1
            }
            if (stage == MinigameStage.MEMORIZE) stage = MinigameStage.PLAY
        }
    }

    LaunchedEffect(seed, stage) {
        if (stage == MinigameStage.PLAY) {
            while (playLeft > 0 && stage == MinigameStage.PLAY) {
                delay(1000); playLeft -= 1
            }
            if (stage == MinigameStage.PLAY) stage = MinigameStage.RESULT
        }
    }

    LaunchedEffect(seed, stage) {
        if (stage == MinigameStage.PLAY) {
            var nextId = 0L
            while (stage == MinigameStage.PLAY) {
                val isReal = rng.nextDouble() < REAL_COIN_PROBABILITY
                coins += FallingCoin(
                    id = nextId++,
                    xPercent = 0.10f + 0.80f * rng.nextFloat(),
                    style = if (isReal) target else fakeOf(target, rng),
                    isReal = isReal,
                    spawnedAtMs = System.currentTimeMillis(),
                    speedPxPerSec = with(density) {
                        FALL_SPEED_DP_MIN.dp.toPx() +
                            rng.nextFloat() * (FALL_SPEED_DP_MAX - FALL_SPEED_DP_MIN).dp.toPx()
                    }
                )
                delay(rng.nextLong(SPAWN_INTERVAL_MS_MIN, SPAWN_INTERVAL_MS_MAX))
            }
        }
    }

    val outcome: MinigameOutcome? = if (stage == MinigameStage.RESULT) {
        val missesGoal = if (caught < CAUGHT_GOAL) (CAUGHT_GOAL - caught) else 0
        MinigameOutcome(errorCount = errors + missesGoal, timeoutReached = false)
    } else null

    fun restart() {
        seed = System.currentTimeMillis()
        memorizeLeft = MEMORIZE_SECONDS
        playLeft = PLAY_SECONDS
        caught = 0
        errors = 0
        coins.clear()
        stage = MinigameStage.MEMORIZE
    }

    MinigameShell(
        archetype = PersonaArchetype.ZOLUSHKA,
        gameTitle = "Падающие монеты",
        stage = stage,
        secondsLeft = when (stage) {
            MinigameStage.MEMORIZE -> memorizeLeft
            MinigameStage.PLAY -> playLeft
            MinigameStage.RESULT -> null
        },
        outcome = outcome,
        onBack = onBack,
        onAgain = { restart() },
        onClose = onBack
    ) {
        when (stage) {
            MinigameStage.MEMORIZE -> MemorizeStage(target)
            MinigameStage.PLAY -> PlayStage(
                target = target,
                coins = coins,
                nowMs = nowMs,
                caught = caught,
                errors = errors,
                onCaughtReal = { caught += 1 },
                onCaughtFake = { errors += 1 }
            )
            MinigameStage.RESULT -> ResultStage(target, caught, errors)
        }
    }
}

@Composable
private fun MemorizeStage(target: CoinStyle) {
    Spacer(Modifier.height(8.dp))
    Text(
        "Запомни настоящую монету",
        color = Color.White.copy(alpha = 0.85f), fontSize = 14.sp
    )
    Spacer(Modifier.height(16.dp))
    Box(
        modifier = Modifier
            .size(180.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(
                Brush.radialGradient(
                    listOf(Color(0xFF2A1960), Color(0xFF0D1735))
                )
            )
            .border(2.dp, ArchetypePalette[PersonaArchetype.ZOLUSHKA].primary, RoundedCornerShape(24.dp)),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawCoin(target, this.size.minDimension * 0.62f, Offset(this.size.width / 2f, this.size.height / 2f))
        }
    }
    Spacer(Modifier.height(12.dp))
    Text(
        target.describe(),
        color = ArchetypePalette[PersonaArchetype.ZOLUSHKA].primary,
        fontSize = 14.sp,
        fontWeight = FontWeight.SemiBold
    )
}

@Composable
private fun PlayStage(
    target: CoinStyle,
    coins: SnapshotStateList<FallingCoin>,
    nowMs: Long,
    caught: Int,
    errors: Int,
    onCaughtReal: () -> Unit,
    onCaughtFake: () -> Unit
) {
    val density = LocalDensity.current
    Text(
        "Лови $CAUGHT_GOAL настоящих · поймал $caught · ошибок $errors",
        color = Color.White, fontSize = 13.sp
    )
    Spacer(Modifier.height(6.dp))
    Box(
        modifier = Modifier
            .size(64.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFF1A0F3F).copy(alpha = 0.7f))
            .border(1.dp, ArchetypePalette[PersonaArchetype.ZOLUSHKA].primary.copy(alpha = 0.55f), RoundedCornerShape(14.dp)),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawCoin(target, this.size.minDimension * 0.62f, Offset(this.size.width / 2f, this.size.height / 2f))
        }
    }
    Spacer(Modifier.height(10.dp))

    var boxSize by remember { mutableStateOf(IntSize.Zero) }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .weight(1f, fill = true)
            .clip(RoundedCornerShape(20.dp))
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0x551A0F3F),
                        Color(0xCC0D1735)
                    )
                )
            )
            .onSizeChanged { boxSize = it }
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Main)
                        val down = event.changes.firstOrNull { it.changedToDown() }
                        if (down != null) {
                            val tap = down.position
                            val now = System.currentTimeMillis()
                            val coinRadius = with(density) { COIN_DIAMETER.dp.toPx() / 2f }
                            val hit = coins.firstOrNull { coin ->
                                val coinX = boxSize.width * coin.xPercent
                                val coinY = (now - coin.spawnedAtMs) / 1000f * coin.speedPxPerSec
                                val dx = tap.x - coinX
                                val dy = tap.y - coinY
                                sqrt(dx * dx + dy * dy) <= coinRadius * 1.2f
                            }
                            if (hit != null) {
                                coins.remove(hit)
                                if (hit.isReal) onCaughtReal() else onCaughtFake()
                                down.consume()
                            }
                        }
                    }
                }
            }
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val coinRadius = with(density) { COIN_DIAMETER.dp.toPx() / 2f }
            val maxY = this.size.height + coinRadius
            coins.forEach { coin ->
                val x = this.size.width * coin.xPercent
                val y = (nowMs - coin.spawnedAtMs) / 1000f * coin.speedPxPerSec
                if (y in -coinRadius..maxY) {
                    drawCoin(coin.style, coinRadius * 2f * 0.85f, Offset(x, y))
                }
            }
        }
    }

    LaunchedEffect(nowMs, boxSize) {
        if (boxSize.height == 0) return@LaunchedEffect
        val coinRadius = with(density) { COIN_DIAMETER.dp.toPx() / 2f }
        val maxY = boxSize.height + coinRadius
        coins.removeAll { coin ->
            val y = (nowMs - coin.spawnedAtMs) / 1000f * coin.speedPxPerSec
            y > maxY
        }
    }
}

@Composable
private fun ResultStage(target: CoinStyle, caught: Int, errors: Int) {
    Spacer(Modifier.height(16.dp))
    Text(
        "Поймал $caught настоящих",
        color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold
    )
    Text(
        "Поддельных по ошибке: $errors",
        color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp
    )
    Spacer(Modifier.height(16.dp))
    Text(
        "Эталон был: ${target.describe()}",
        color = ArchetypePalette[PersonaArchetype.ZOLUSHKA].primary,
        fontSize = 12.sp
    )
}

// ─── рисование монеты ─────────────────────────────────────────────────────

private fun DrawScope.drawCoin(style: CoinStyle, diameter: Float, center: Offset) {
    val r = diameter / 2f
    val highlight = style.metal.highlight
    val deep = style.metal.deep

    drawCircle(
        Color.Black.copy(alpha = 0.35f),
        radius = r * 1.04f,
        center = Offset(center.x + r * 0.05f, center.y + r * 0.05f)
    )
    drawCircle(
        Brush.radialGradient(
            colors = listOf(highlight, deep),
            center = Offset(center.x - r * 0.3f, center.y - r * 0.3f),
            radius = r * 1.5f
        ),
        radius = r,
        center = center
    )
    drawCircle(
        deep.copy(alpha = 0.85f),
        radius = r,
        center = center,
        style = Stroke(width = r * 0.08f)
    )
    if (style.hasInscription) {
        drawCircle(
            deep.copy(alpha = 0.55f),
            radius = r * 0.88f,
            center = center,
            style = Stroke(width = r * 0.05f)
        )
    }

    when (style.pattern) {
        CoinPattern.RAYS -> {
            for (i in 0 until 8) {
                val a = Math.PI * 2 * i / 8
                val x0 = center.x + (r * 0.30f * cos(a)).toFloat()
                val y0 = center.y + (r * 0.30f * sin(a)).toFloat()
                val x1 = center.x + (r * 0.70f * cos(a)).toFloat()
                val y1 = center.y + (r * 0.70f * sin(a)).toFloat()
                drawLine(
                    deep,
                    start = Offset(x0, y0),
                    end = Offset(x1, y1),
                    strokeWidth = r * 0.08f
                )
            }
            drawCircle(deep, radius = r * 0.18f, center = center)
        }
        CoinPattern.ROSETTE -> {
            for (i in 0 until 6) {
                val a = Math.PI * 2 * i / 6
                val cx = center.x + (r * 0.45f * cos(a)).toFloat()
                val cy = center.y + (r * 0.45f * sin(a)).toFloat()
                drawCircle(deep, radius = r * 0.18f, center = Offset(cx, cy))
            }
            drawCircle(highlight, radius = r * 0.16f, center = center)
            drawCircle(deep, radius = r * 0.06f, center = center)
        }
        CoinPattern.STAR -> {
            val starPath = Path().apply {
                for (i in 0 until 10) {
                    val angle = Math.PI * i / 5 - Math.PI / 2
                    val rad = if (i % 2 == 0) r * 0.65f else r * 0.28f
                    val x = center.x + (rad * cos(angle)).toFloat()
                    val y = center.y + (rad * sin(angle)).toFloat()
                    if (i == 0) moveTo(x, y) else lineTo(x, y)
                }
                close()
            }
            drawPath(starPath, color = deep)
        }
    }
    drawSparkle(Offset(center.x - r * 0.55f, center.y - r * 0.55f), r * 0.20f, color = highlight)
}

private const val MEMORIZE_SECONDS = 5
private const val PLAY_SECONDS = 18
private const val COIN_DIAMETER = 56
private const val FALL_SPEED_DP_MIN = 140f
private const val FALL_SPEED_DP_MAX = 200f
private const val SPAWN_INTERVAL_MS_MIN = 450L
private const val SPAWN_INTERVAL_MS_MAX = 850L
private const val REAL_COIN_PROBABILITY = 0.58
private const val CAUGHT_GOAL = 8
