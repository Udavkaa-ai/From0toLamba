package com.s0dolamby.game.presentation.minigame.goldenkey

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.R
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
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
    // Полное пространство: 3 формы × 3 цвета × 3 зубчика × 3 узора × 2 кисточки = 162
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
    // Fallback — иногда мутация в одно свойство не даёт достаточно вариантов;
    // добавляем случайные ключи, пока не наберём нужное число
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

    // ─── Drop shadow под ключом ─────────────────────────────────────────────
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

    // ─── Bowl с радиальным градиентом ───────────────────────────────────────
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

    // ─── Bowl filigree (различим по форме) ──────────────────────────────────
    val filigree = dark.copy(alpha = 0.75f)
    when (key.bowlShape) {
        BowlShape.ROUND -> {
            drawCircle(filigree, radius = bowlRadius * 0.62f, center = bowlCenter,
                style = Stroke(width = sizePx * 0.012f))
            drawCircle(filigree, radius = bowlRadius * 0.38f, center = bowlCenter,
                style = Stroke(width = sizePx * 0.012f))
            // 6 точек по окружности
            for (i in 0 until 6) {
                val a = Math.PI * 2 * i / 6
                drawCircle(filigree, radius = sizePx * 0.012f,
                    center = Offset(cx + (bowlRadius * 0.78f * cos(a)).toFloat(),
                        bowlCenter.y + (bowlRadius * 0.78f * sin(a)).toFloat()))
            }
        }
        BowlShape.SQUARE -> {
            // Внутренний ромб
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
            // Две дуги-овала внутри
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

    // ─── Bowl hole в центре ─────────────────────────────────────────────────
    drawCircle(NightBlue.copy(alpha = 0.85f), radius = bowlRadius * 0.18f, center = bowlCenter)

    // ─── Stem с градиентом ──────────────────────────────────────────────────
    val stemGradient = Brush.horizontalGradient(
        colors = listOf(dark, light, dark),
        startX = cx - stemWidth / 2f, endX = cx + stemWidth / 2f
    )
    drawRect(stemGradient,
        topLeft = Offset(cx - stemWidth / 2f, stemTop),
        size = Size(stemWidth, stemHeight))

    // ─── Stem pattern ───────────────────────────────────────────────────────
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

    // ─── Teeth — трапециевидные, справа внизу stem ──────────────────────────
    val toothBase = sizePx * 0.13f
    val toothTop = sizePx * 0.07f
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

    // ─── Tassel — кисточка с бахромой ──────────────────────────────────────
    if (key.hasTassel) {
        val tasselTopX = cx - bowlRadius * 1.05f
        val tasselTopY = topY + bowlRadius * 0.4f
        val cordLen = sizePx * 0.10f
        val cordEndX = tasselTopX - cordLen * 0.4f
        val cordEndY = tasselTopY + cordLen
        drawLine(Color(0xFFB8860B), start = Offset(tasselTopX, tasselTopY),
            end = Offset(cordEndX, cordEndY), strokeWidth = sizePx * 0.015f)
        // Корона кисточки — маленький эллипс
        drawOval(Color(0xFF7B1818),
            topLeft = Offset(cordEndX - sizePx * 0.035f, cordEndY - sizePx * 0.015f),
            size = Size(sizePx * 0.07f, sizePx * 0.04f))
        // Бахрома — 5 линий вниз
        for (i in 0..4) {
            val sx = cordEndX - sizePx * 0.03f + sizePx * 0.015f * i
            drawLine(Color(0xFFCC1F1F),
                start = Offset(sx, cordEndY + sizePx * 0.015f),
                end = Offset(sx + sizePx * 0.005f, cordEndY + sizePx * 0.11f),
                strokeWidth = sizePx * 0.012f)
        }
    }
}

private fun DrawScope.drawSparkles(centerX: Float, centerY: Float, radius: Float, intensity: Float) {
    val points = listOf(
        Offset(centerX - radius, centerY - radius * 0.5f),
        Offset(centerX + radius * 0.9f, centerY - radius * 0.7f),
        Offset(centerX - radius * 0.8f, centerY + radius * 0.6f),
        Offset(centerX + radius * 0.7f, centerY + radius * 0.8f),
        Offset(centerX, centerY - radius * 1.1f)
    )
    points.forEach { p ->
        val r = radius * 0.08f * intensity
        drawCircle(FairyGold.copy(alpha = 0.85f * intensity), radius = r, center = p)
        drawLine(FairyGold.copy(alpha = 0.6f * intensity),
            start = Offset(p.x - r * 2f, p.y), end = Offset(p.x + r * 2f, p.y),
            strokeWidth = r * 0.6f)
        drawLine(FairyGold.copy(alpha = 0.6f * intensity),
            start = Offset(p.x, p.y - r * 2f), end = Offset(p.x, p.y + r * 2f),
            strokeWidth = r * 0.6f)
    }
}

// ─── экран ───────────────────────────────────────────────────────────────────

private enum class Stage { MEMORIZE, CHOOSE, RESULT }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GoldenKeyScreen(onBack: () -> Unit) {
    var seed by remember { mutableStateOf(System.currentTimeMillis().toString()) }
    val (correct, options) = remember(seed) { buildRound(seed) }

    var stage by remember(seed) { mutableStateOf(Stage.MEMORIZE) }
    var pickedIndex by remember(seed) { mutableStateOf(-1) }
    var memorizeLeft by remember(seed) { mutableStateOf(MEMORIZE_SECONDS) }
    var chooseLeft by remember(seed) { mutableStateOf(CHOOSE_SECONDS) }

    LaunchedEffect(seed, stage) {
        if (stage == Stage.MEMORIZE) {
            while (memorizeLeft > 0 && stage == Stage.MEMORIZE) {
                delay(1000); memorizeLeft -= 1
            }
            if (stage == Stage.MEMORIZE) stage = Stage.CHOOSE
        } else if (stage == Stage.CHOOSE) {
            while (chooseLeft > 0 && stage == Stage.CHOOSE) {
                delay(1000); chooseLeft -= 1
            }
            if (stage == Stage.CHOOSE) stage = Stage.RESULT
        }
    }

    ScreenBackground(R.drawable.home_bg) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                TopAppBar(
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                            Text("Золотой ключик", fontWeight = FontWeight.Bold)
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Transparent,
                        titleContentColor = Color.White,
                        navigationIconContentColor = FairyGold
                    )
                )
            }
        ) { padding ->
            Column(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                BuratinoHeader(stage = stage, secondsLeft = when (stage) {
                    Stage.MEMORIZE -> memorizeLeft
                    Stage.CHOOSE -> chooseLeft
                    Stage.RESULT -> 0
                })

                Spacer(Modifier.height(16.dp))

                when (stage) {
                    Stage.MEMORIZE -> MemorizeStage(
                        key = correct,
                        onReady = { stage = Stage.CHOOSE }
                    )
                    Stage.CHOOSE -> ChooseStage(options) { idx ->
                        pickedIndex = idx
                        stage = Stage.RESULT
                    }
                    Stage.RESULT -> ResultStage(
                        correct = correct,
                        options = options,
                        pickedIndex = pickedIndex,
                        onAgain = {
                            seed = System.currentTimeMillis().toString()
                            memorizeLeft = MEMORIZE_SECONDS
                            chooseLeft = CHOOSE_SECONDS
                            pickedIndex = -1
                        },
                        onClose = onBack
                    )
                }
            }
        }
    }
}

@Composable
private fun BuratinoHeader(stage: Stage, secondsLeft: Int) {
    val (label, ttl) = when (stage) {
        Stage.MEMORIZE -> "Запомни мой ключ, друг" to "Осталось $secondsLeft сек"
        Stage.CHOOSE -> "Найди его среди подделок" to "Осталось $secondsLeft сек"
        Stage.RESULT -> "Ну как, узнал?" to ""
    }
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Image(
            painter = painterResource(R.drawable.beseda_buratino),
            contentDescription = "Буратино",
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .border(2.dp, FairyGold, CircleShape)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text("Буратино", color = FairyGold,
                fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Text(label, color = Color.White, fontSize = 15.sp)
            if (ttl.isNotEmpty()) {
                Text(ttl, color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
            }
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
    Spacer(Modifier.height(8.dp))
    KeyShowcase(key = key, size = 240.dp, scale = pulse, sparkleIntensity = 0f)
    Spacer(Modifier.height(16.dp))
    Text(
        "5 признаков: форма · цвет · зубчики · узор · кисточка",
        color = Color.White.copy(alpha = 0.65f), fontSize = 12.sp
    )
    Spacer(Modifier.height(20.dp))
    Button(
        onClick = onReady,
        colors = ButtonDefaults.buttonColors(containerColor = FairyGold, contentColor = NightBlue)
    ) {
        Text("Запомнил", fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ChooseStage(options: List<GoldenKey>, onPick: (Int) -> Unit) {
    Spacer(Modifier.height(4.dp))
    val cols = 3
    val cellSize = 100.dp
    val gap = 8.dp
    Column(verticalArrangement = Arrangement.spacedBy(gap)) {
        options.chunked(cols).forEachIndexed { rowIdx, rowKeys ->
            Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                rowKeys.forEachIndexed { colIdx, key ->
                    val idx = rowIdx * cols + colIdx
                    KeyCard(
                        key = key,
                        highlight = false,
                        size = cellSize,
                        onClick = { onPick(idx) }
                    )
                }
            }
        }
    }
}

@Composable
private fun ResultStage(
    correct: GoldenKey,
    options: List<GoldenKey>,
    pickedIndex: Int,
    onAgain: () -> Unit,
    onClose: () -> Unit
) {
    val picked = options.getOrNull(pickedIndex)
    val win = picked == correct
    Spacer(Modifier.height(8.dp))
    Text(
        when {
            win -> "🎉 Ключ узнан!"
            picked == null -> "⌛ Не успел"
            else -> "❌ Ошибся"
        },
        color = if (win) FairyGold else Color(0xFFFF8A65),
        fontSize = 24.sp, fontWeight = FontWeight.Bold
    )
    Spacer(Modifier.height(8.dp))
    Text(
        if (win) "Жетон Буратино пойман. Чуйка раскрыта."
        else "Жетон не получен. Скоро тут — реклама в обмен на проход.",
        color = Color.White.copy(alpha = 0.75f), fontSize = 13.sp
    )
    Spacer(Modifier.height(20.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Эталон", color = FairyGold, fontSize = 12.sp)
            Spacer(Modifier.height(4.dp))
            KeyCard(key = correct, highlight = true, size = 140.dp,
                sparkleIntensity = if (win) 1f else 0f)
        }
        if (picked != null) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Твой выбор",
                    color = if (win) FairyGold else Color(0xFFFF8A65), fontSize = 12.sp)
                Spacer(Modifier.height(4.dp))
                KeyCard(key = picked, highlight = win, size = 140.dp,
                    sparkleIntensity = 0f)
            }
        }
    }
    Spacer(Modifier.height(28.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Button(
            onClick = onAgain,
            colors = ButtonDefaults.buttonColors(containerColor = FairyGold, contentColor = NightBlue)
        ) { Text("Ещё раз", fontWeight = FontWeight.SemiBold) }
        OutlinedButton(onClick = onClose) { Text("Закрыть") }
    }
}

@Composable
private fun KeyShowcase(
    key: GoldenKey,
    size: androidx.compose.ui.unit.Dp,
    scale: Float = 1f,
    sparkleIntensity: Float = 0f
) {
    Box(
        modifier = Modifier.size(size),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize().scale(scale)) {
            if (sparkleIntensity > 0f) {
                drawSparkles(this.size.width / 2f, this.size.height / 2f,
                    this.size.minDimension * 0.45f, sparkleIntensity)
            }
            drawKey(key, sizePx = this.size.minDimension * 0.78f)
        }
    }
}

@Composable
private fun KeyCard(
    key: GoldenKey,
    highlight: Boolean,
    size: androidx.compose.ui.unit.Dp,
    sparkleIntensity: Float = 0f,
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
        Canvas(modifier = Modifier.fillMaxSize()) {
            if (sparkleIntensity > 0f) {
                drawSparkles(this.size.width / 2f, this.size.height / 2f,
                    this.size.minDimension * 0.4f, sparkleIntensity)
            }
            drawKey(key, sizePx = this.size.minDimension * 0.72f)
        }
    }
}

private const val MEMORIZE_SECONDS = 15
private const val CHOOSE_SECONDS = 20
private const val OPTIONS_COUNT = 9
