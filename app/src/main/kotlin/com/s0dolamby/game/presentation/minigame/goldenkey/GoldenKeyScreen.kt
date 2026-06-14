package com.s0dolamby.game.presentation.minigame.goldenkey

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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import com.s0dolamby.game.presentation.minigame.common.MinigameShell
import com.s0dolamby.game.presentation.minigame.common.MinigameStage
import com.s0dolamby.game.presentation.minigame.common.drawSparkleHalo
import com.s0dolamby.game.util.SeedRng
import kotlinx.coroutines.delay
import kotlin.math.cos
import kotlin.math.sin

// ─── модель ключа ─────────────────────────────────────────────────────────────

enum class BowlShape { ROUND, SQUARE, OVAL }
enum class KeyColor(val light: Color, val dark: Color) {
    GOLD(Color(0xFFFFE082), Color(0xFFB8860B)),
    SILVER(Color(0xFFF0F0F0), Color(0xFF7C8595)),
    COPPER(Color(0xFFEAA17C), Color(0xFF8A4423))
}
enum class StemPattern { SMOOTH, DOTTED, STRIPED }

data class GoldenKey(
    val bowlShape: BowlShape,
    val color: KeyColor,
    val teethCount: Int,
    val stemPattern: StemPattern,
    val hasTassel: Boolean
)

private val SHAPES = BowlShape.values().toList()
private val COLORS = KeyColor.values().toList()
private val TEETH = listOf(2, 3, 4)
private val PATTERNS = StemPattern.values().toList()

private fun randomKey(rng: SeedRng): GoldenKey = GoldenKey(
    bowlShape = rng.pick(SHAPES),
    color = rng.pick(COLORS),
    teethCount = rng.pick(TEETH),
    stemPattern = rng.pick(PATTERNS),
    hasTassel = rng.nextBoolean()
)

private fun mutate(rng: SeedRng, base: GoldenKey): GoldenKey {
    val mutations = listOf<(GoldenKey) -> GoldenKey>(
        { it.copy(bowlShape = SHAPES.filter { s -> s != it.bowlShape }.let(rng::pick)) },
        { it.copy(color = COLORS.filter { c -> c != it.color }.let(rng::pick)) },
        { it.copy(teethCount = TEETH.filter { n -> n != it.teethCount }.let(rng::pick)) },
        { it.copy(stemPattern = PATTERNS.filter { p -> p != it.stemPattern }.let(rng::pick)) },
        { it.copy(hasTassel = !it.hasTassel) }
    )
    return rng.pick(mutations)(base)
}

internal fun buildRound(seed: String, optionCount: Int = OPTIONS_COUNT): Pair<GoldenKey, List<GoldenKey>> {
    require(optionCount in 2..162) { "optionCount must fit the attribute space (162)" }
    val rng = SeedRng(seed)
    val correct = randomKey(rng)
    val options = mutableListOf(correct)
    var attempts = 0
    val maxAttempts = optionCount * 12
    while (options.size < optionCount && attempts < maxAttempts) {
        val candidate = mutate(rng, correct)
        if (candidate !in options) options += candidate
        attempts++
    }
    while (options.size < optionCount) {
        val candidate = randomKey(rng)
        if (candidate !in options) options += candidate
    }
    return correct to options.toMutableList().also {
        for (i in it.indices.reversed()) {
            val j = rng.nextInt(i + 1)
            val tmp = it[i]; it[i] = it[j]; it[j] = tmp
        }
    }
}

// ─── рисование ключа ─────────────────────────────────────────────────────────

private fun DrawScope.drawKey(key: GoldenKey, sizePx: Float) {
    val cx = size.width / 2f
    val topY = (size.height - sizePx) / 2f
    val bowlRadius = sizePx * 0.23f
    val stemHeight = sizePx * 0.55f
    val stemWidth = sizePx * 0.13f
    val stemTop = topY + bowlRadius * 2f
    val light = key.color.light
    val dark = key.color.dark

    val bowlCenter = Offset(cx, topY + bowlRadius)

    // Drop shadow
    val shadowOffset = sizePx * 0.035f
    val shadowColor = Color.Black.copy(alpha = 0.45f)
    when (key.bowlShape) {
        BowlShape.ROUND -> drawCircle(shadowColor, radius = bowlRadius * 1.02f,
            center = bowlCenter.copy(x = bowlCenter.x + shadowOffset, y = bowlCenter.y + shadowOffset))
        BowlShape.SQUARE -> drawRect(shadowColor,
            topLeft = Offset(cx - bowlRadius + shadowOffset, topY + shadowOffset),
            size = Size(bowlRadius * 2f, bowlRadius * 2f))
        BowlShape.OVAL -> drawOval(shadowColor,
            topLeft = Offset(cx - bowlRadius * 1.2f + shadowOffset, topY + bowlRadius * 0.2f + shadowOffset),
            size = Size(bowlRadius * 2.4f, bowlRadius * 1.6f))
    }
    drawRect(shadowColor,
        topLeft = Offset(cx - stemWidth / 2f + shadowOffset, stemTop + shadowOffset),
        size = Size(stemWidth, stemHeight))

    // Bowl
    val bowlGradient = Brush.radialGradient(
        colors = listOf(light, dark),
        center = Offset(cx - bowlRadius * 0.3f, topY + bowlRadius * 0.6f),
        radius = bowlRadius * 1.6f
    )
    when (key.bowlShape) {
        BowlShape.ROUND -> drawCircle(bowlGradient, radius = bowlRadius, center = bowlCenter)
        BowlShape.SQUARE -> drawRect(bowlGradient,
            topLeft = Offset(cx - bowlRadius, topY),
            size = Size(bowlRadius * 2f, bowlRadius * 2f))
        BowlShape.OVAL -> drawOval(bowlGradient,
            topLeft = Offset(cx - bowlRadius * 1.2f, topY + bowlRadius * 0.2f),
            size = Size(bowlRadius * 2.4f, bowlRadius * 1.6f))
    }

    // Filigree
    val filigree = dark.copy(alpha = 0.75f)
    when (key.bowlShape) {
        BowlShape.ROUND -> {
            drawCircle(filigree, radius = bowlRadius * 0.62f, center = bowlCenter,
                style = Stroke(width = sizePx * 0.012f))
            drawCircle(filigree, radius = bowlRadius * 0.38f, center = bowlCenter,
                style = Stroke(width = sizePx * 0.012f))
            for (i in 0 until 6) {
                val a = Math.PI * 2 * i / 6
                drawCircle(filigree, radius = sizePx * 0.012f,
                    center = Offset(cx + (bowlRadius * 0.78f * cos(a)).toFloat(),
                        bowlCenter.y + (bowlRadius * 0.78f * sin(a)).toFloat()))
            }
        }
        BowlShape.SQUARE -> {
            val r = bowlRadius * 0.7f
            val rhomb = Path().apply {
                moveTo(cx, bowlCenter.y - r)
                lineTo(cx + r, bowlCenter.y)
                lineTo(cx, bowlCenter.y + r)
                lineTo(cx - r, bowlCenter.y)
                close()
            }
            drawPath(rhomb, color = filigree, style = Stroke(width = sizePx * 0.014f))
            drawCircle(filigree, radius = sizePx * 0.022f, center = bowlCenter)
        }
        BowlShape.OVAL -> {
            drawOval(filigree,
                topLeft = Offset(cx - bowlRadius * 0.85f, topY + bowlRadius * 0.55f),
                size = Size(bowlRadius * 1.7f, bowlRadius * 1.0f),
                style = Stroke(width = sizePx * 0.012f))
            drawOval(filigree,
                topLeft = Offset(cx - bowlRadius * 0.5f, topY + bowlRadius * 0.75f),
                size = Size(bowlRadius * 1.0f, bowlRadius * 0.6f),
                style = Stroke(width = sizePx * 0.012f))
        }
    }

    drawCircle(NightBlue.copy(alpha = 0.85f), radius = bowlRadius * 0.18f, center = bowlCenter)

    // Stem
    val stemGradient = Brush.horizontalGradient(
        colors = listOf(dark, light, dark),
        startX = cx - stemWidth / 2f, endX = cx + stemWidth / 2f
    )
    drawRect(stemGradient,
        topLeft = Offset(cx - stemWidth / 2f, stemTop),
        size = Size(stemWidth, stemHeight))

    val patternColor = dark.copy(alpha = 0.85f)
    when (key.stemPattern) {
        StemPattern.SMOOTH -> Unit
        StemPattern.DOTTED -> {
            val dots = 6
            for (i in 0 until dots) {
                val y = stemTop + stemHeight * (i + 0.5f) / dots
                drawCircle(patternColor, radius = stemWidth * 0.22f, center = Offset(cx, y))
            }
        }
        StemPattern.STRIPED -> {
            val stripes = 6
            for (i in 1..stripes) {
                val y = stemTop + stemHeight * i / (stripes + 1)
                drawLine(patternColor,
                    start = Offset(cx - stemWidth / 2f, y),
                    end = Offset(cx + stemWidth / 2f, y),
                    strokeWidth = sizePx * 0.018f)
            }
        }
    }

    // Teeth
    val toothBase = sizePx * 0.13f
    val toothHeight = sizePx * 0.06f
    val toothGap = sizePx * 0.03f
    val teethX = cx + stemWidth / 2f
    val teethBaseY = stemTop + stemHeight
    for (i in 0 until key.teethCount) {
        val y = teethBaseY - (i + 1) * (toothHeight + toothGap) + toothGap
        val tooth = Path().apply {
            moveTo(teethX, y)
            lineTo(teethX + toothBase, y + toothHeight * 0.15f)
            lineTo(teethX + toothBase * 0.7f, y + toothHeight)
            lineTo(teethX, y + toothHeight * 0.85f)
            close()
        }
        drawPath(tooth, brush = Brush.horizontalGradient(listOf(light, dark),
            startX = teethX, endX = teethX + toothBase))
    }

    // Tassel
    if (key.hasTassel) {
        val tasselTopX = cx - bowlRadius * 1.05f
        val tasselTopY = topY + bowlRadius * 0.4f
        val cordLen = sizePx * 0.10f
        val cordEndX = tasselTopX - cordLen * 0.4f
        val cordEndY = tasselTopY + cordLen
        drawLine(Color(0xFFB8860B), start = Offset(tasselTopX, tasselTopY),
            end = Offset(cordEndX, cordEndY), strokeWidth = sizePx * 0.015f)
        drawOval(Color(0xFF7B1818),
            topLeft = Offset(cordEndX - sizePx * 0.035f, cordEndY - sizePx * 0.015f),
            size = Size(sizePx * 0.07f, sizePx * 0.04f))
        for (i in 0..4) {
            val sx = cordEndX - sizePx * 0.03f + sizePx * 0.015f * i
            drawLine(Color(0xFFCC1F1F),
                start = Offset(sx, cordEndY + sizePx * 0.015f),
                end = Offset(sx + sizePx * 0.005f, cordEndY + sizePx * 0.11f),
                strokeWidth = sizePx * 0.012f)
        }
    }
}

// ─── экран ───────────────────────────────────────────────────────────────────

@Composable
fun GoldenKeyScreen(
    onBack: () -> Unit,
    onComplete: ((MinigameOutcome) -> Unit)? = null
) {
    var seed by remember { mutableStateOf(System.currentTimeMillis().toString()) }
    val (correct, options) = remember(seed) { buildRound(seed) }

    var stage by remember(seed) { mutableStateOf(MinigameStage.MEMORIZE) }
    var pickedIndex by remember(seed) { mutableStateOf(-1) }
    var memorizeLeft by remember(seed) { mutableStateOf(MEMORIZE_SECONDS) }
    var chooseLeft by remember(seed) { mutableStateOf(CHOOSE_SECONDS) }
    var timedOut by remember(seed) { mutableStateOf(false) }

    LaunchedEffect(seed, stage) {
        if (stage == MinigameStage.MEMORIZE) {
            while (memorizeLeft > 0 && stage == MinigameStage.MEMORIZE) {
                delay(1000); memorizeLeft -= 1
            }
            if (stage == MinigameStage.MEMORIZE) stage = MinigameStage.PLAY
        } else if (stage == MinigameStage.PLAY) {
            while (chooseLeft > 0 && stage == MinigameStage.PLAY) {
                delay(1000); chooseLeft -= 1
            }
            if (stage == MinigameStage.PLAY) {
                timedOut = true
                stage = MinigameStage.RESULT
            }
        }
    }

    val outcome: MinigameOutcome? = if (stage == MinigameStage.RESULT) {
        val picked = options.getOrNull(pickedIndex)
        val errors = when {
            timedOut -> 2
            picked == correct -> 0
            else -> 1
        }
        MinigameOutcome(errorCount = errors, timeoutReached = timedOut)
    } else null

    val secondsLeft = when (stage) {
        MinigameStage.MEMORIZE -> memorizeLeft
        MinigameStage.PLAY -> chooseLeft
        MinigameStage.RESULT -> null
    }

    fun restart() {
        seed = System.currentTimeMillis().toString()
        memorizeLeft = MEMORIZE_SECONDS
        chooseLeft = CHOOSE_SECONDS
        pickedIndex = -1
        timedOut = false
        stage = MinigameStage.MEMORIZE
    }

    MinigameShell(
        archetype = PersonaArchetype.BURATINO,
        gameTitle = Strings.t("minigame.title.goldenKey"),
        stage = stage,
        secondsLeft = secondsLeft,
        outcome = outcome,
        onBack = onBack,
        onAgain = { restart() },
        onClose = onBack,
        onComplete = onComplete
    ) {
        when (stage) {
            MinigameStage.MEMORIZE -> MemorizeStage(
                key = correct,
                onReady = { stage = MinigameStage.PLAY }
            )
            MinigameStage.PLAY -> ChooseStage(options) { idx ->
                pickedIndex = idx
                stage = MinigameStage.RESULT
            }
            MinigameStage.RESULT -> ResultPreview(correct, options.getOrNull(pickedIndex))
        }
    }
}

@Composable
private fun MemorizeStage(key: GoldenKey, onReady: () -> Unit) {
    val infinite = rememberInfiniteTransition(label = "memorize-pulse")
    val pulse by infinite.animateFloat(
        initialValue = 0.96f, targetValue = 1.04f,
        animationSpec = infiniteRepeatable(
            animation = tween(1100, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )
    // Перспективное 3D-покачивание вокруг вертикальной оси (как ключ на верёвочке)
    val etalonSwingPhase by infinite.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(3600, easing = LinearEasing)),
        label = "etalonSwing"
    )
    val swingY = (kotlin.math.sin(etalonSwingPhase * 2 * Math.PI) * 38f).toFloat()
    val swingZ = (kotlin.math.sin(etalonSwingPhase * 4 * Math.PI) * 6f).toFloat()
    Text(
        Strings.t("minigame.goldenKey.memorize"),
        color = Color.White.copy(alpha = 0.85f), fontSize = 14.sp
    )
    Spacer(Modifier.height(16.dp))
    Box(modifier = Modifier.size(220.dp), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier
            .fillMaxSize()
            .scale(pulse)
            .graphicsLayer {
                rotationY = swingY
                rotationZ = swingZ
                cameraDistance = 12f * density
            }
        ) {
            drawSparkleHalo(
                center = Offset(this.size.width / 2f, this.size.height / 2f),
                radius = this.size.minDimension * 0.45f,
                count = 5,
                sparkleSize = 6f,
                color = FairyGold,
                intensity = 0.35f
            )
            drawKey(key, sizePx = this.size.minDimension * 0.78f)
        }
    }
    Spacer(Modifier.height(16.dp))
    Text(
        Strings.t("minigame.goldenKey.features"),
        color = Color.White.copy(alpha = 0.65f), fontSize = 12.sp
    )
    Spacer(Modifier.height(20.dp))
    Button(
        onClick = onReady,
        colors = ButtonDefaults.buttonColors(containerColor = FairyGold, contentColor = NightBlue)
    ) {
        Text(Strings.t("minigame.goldenKey.ready"), fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ChooseStage(options: List<GoldenKey>, onPick: (Int) -> Unit) {
    val infinite = rememberInfiniteTransition(label = "key-swing")
    val swingPhase by infinite.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(3200, easing = LinearEasing)),
        label = "swingPhase"
    )
    Text(
        Strings.t("minigame.goldenKey.pick", options.size),
        color = Color.White.copy(alpha = 0.85f), fontSize = 14.sp
    )
    Spacer(Modifier.height(10.dp))
    val cols = 3
    val cellSize = 100.dp
    val gap = 8.dp
    Column(verticalArrangement = Arrangement.spacedBy(gap)) {
        options.chunked(cols).forEachIndexed { rowIdx, rowKeys ->
            Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                rowKeys.forEachIndexed { colIdx, key ->
                    val idx = rowIdx * cols + colIdx
                    // Каждый ключ покачивается в 3D со своей фазой —
                    // амплитуда ±30°, ключ всегда читаем (не встаёт ребром)
                    val phase = (swingPhase + idx * 0.13f) % 1f
                    val rotY = (kotlin.math.sin(phase * 2 * Math.PI) * 30f).toFloat()
                    KeyCard(
                        key = key,
                        highlight = false,
                        size = cellSize,
                        rotationYDeg = rotY,
                        onClick = { onPick(idx) }
                    )
                }
            }
        }
    }
}

@Composable
private fun ResultPreview(correct: GoldenKey, picked: GoldenKey?) {
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(Strings.t("minigame.goldenKey.etalon"), color = FairyGold, fontSize = 11.sp)
            Spacer(Modifier.height(4.dp))
            KeyCard(key = correct, highlight = true, size = 110.dp)
        }
        if (picked != null) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    Strings.t("minigame.goldenKey.yourChoice"),
                    color = if (picked == correct) FairyGold else Color(0xFFFF8A65),
                    fontSize = 11.sp
                )
                Spacer(Modifier.height(4.dp))
                KeyCard(key = picked, highlight = picked == correct, size = 110.dp)
            }
        }
    }
}

@Composable
private fun KeyCard(
    key: GoldenKey,
    highlight: Boolean,
    size: androidx.compose.ui.unit.Dp,
    rotationYDeg: Float = 0f,
    onClick: (() -> Unit)? = null
) {
    val borderColor = if (highlight) FairyGold else Color.White.copy(alpha = 0.18f)
    val borderWidth = if (highlight) 3.dp else 1.dp
    Box(
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(20.dp))
            .background(
                Brush.verticalGradient(
                    listOf(EnchantedPurple.copy(alpha = 0.85f), NightBlue.copy(alpha = 0.95f))
                )
            )
            .border(borderWidth, borderColor, RoundedCornerShape(20.dp))
            .let { m -> if (onClick != null) m.clickable { onClick() } else m },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier
            .fillMaxSize()
            .graphicsLayer {
                rotationY = rotationYDeg
                cameraDistance = 12f * density
            }
        ) {
            drawKey(key, sizePx = this.size.minDimension * 0.72f)
        }
    }
}

private const val MEMORIZE_SECONDS = 15
private const val CHOOSE_SECONDS = 20
private const val OPTIONS_COUNT = 9
