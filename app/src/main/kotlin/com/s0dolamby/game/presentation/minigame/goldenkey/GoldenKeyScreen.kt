package com.s0dolamby.game.presentation.minigame.goldenkey

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.util.SeedRng
import kotlinx.coroutines.delay

// ─── модель ключа ─────────────────────────────────────────────────────────────

enum class BowlShape { ROUND, SQUARE, OVAL }
enum class KeyColor(val rgb: Color) {
    GOLD(Color(0xFFFFD700)),
    SILVER(Color(0xFFE0E0E0)),
    COPPER(Color(0xFFB87333))
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

internal fun buildRound(seed: String): Pair<GoldenKey, List<GoldenKey>> {
    val rng = SeedRng(seed)
    val correct = randomKey(rng)
    val options = mutableListOf(correct)
    var attempts = 0
    while (options.size < 4 && attempts < 30) {
        val candidate = mutate(rng, correct)
        if (candidate !in options) options += candidate
        attempts++
    }
    while (options.size < 4) {
        // fallback — добавить любую новую случайную (на случай вырожденного пространства)
        val candidate = randomKey(rng)
        if (candidate !in options) options += candidate
    }
    return correct to options.toMutableList().also {
        // Простая детерминированная перетасовка (Fisher-Yates на seed-rng)
        for (i in it.indices.reversed()) {
            val j = rng.nextInt(i + 1)
            val tmp = it[i]; it[i] = it[j]; it[j] = tmp
        }
    }
}

// ─── рисование ключа ─────────────────────────────────────────────────────────

internal fun DrawScope.drawKey(key: GoldenKey, sizePx: Float) {
    val cx = size.width / 2f
    val topY = (size.height - sizePx) / 2f
    val bowlRadius = sizePx * 0.22f
    val stemHeight = sizePx * 0.55f
    val stemWidth = sizePx * 0.12f
    val stemTop = topY + bowlRadius * 2f
    val color = key.color.rgb

    // Bowl
    val bowlCenter = Offset(cx, topY + bowlRadius)
    when (key.bowlShape) {
        BowlShape.ROUND -> drawCircle(color, radius = bowlRadius, center = bowlCenter)
        BowlShape.SQUARE -> drawRect(
            color,
            topLeft = Offset(cx - bowlRadius, topY),
            size = Size(bowlRadius * 2f, bowlRadius * 2f)
        )
        BowlShape.OVAL -> drawOval(
            color,
            topLeft = Offset(cx - bowlRadius * 1.2f, topY + bowlRadius * 0.2f),
            size = Size(bowlRadius * 2.4f, bowlRadius * 1.6f)
        )
    }
    drawCircle(Color.Black.copy(alpha = 0.55f), radius = bowlRadius * 0.35f, center = bowlCenter)

    // Stem
    drawRect(
        color,
        topLeft = Offset(cx - stemWidth / 2f, stemTop),
        size = Size(stemWidth, stemHeight)
    )
    // Pattern на stem
    when (key.stemPattern) {
        StemPattern.SMOOTH -> Unit
        StemPattern.DOTTED -> {
            val dots = 5
            for (i in 0 until dots) {
                val y = stemTop + stemHeight * (i + 0.5f) / dots
                drawCircle(Color.Black.copy(alpha = 0.45f), radius = stemWidth * 0.18f, center = Offset(cx, y))
            }
        }
        StemPattern.STRIPED -> {
            val stripes = 4
            for (i in 1..stripes) {
                val y = stemTop + stemHeight * i / (stripes + 1)
                drawLine(
                    Color.Black.copy(alpha = 0.45f),
                    start = Offset(cx - stemWidth / 2f, y),
                    end = Offset(cx + stemWidth / 2f, y),
                    strokeWidth = stemWidth * 0.18f
                )
            }
        }
    }

    // Teeth — справа внизу stem
    val toothWidth = sizePx * 0.10f
    val toothHeight = sizePx * 0.06f
    val teethRightX = cx + stemWidth / 2f
    val teethBaseY = stemTop + stemHeight
    for (i in 0 until key.teethCount) {
        val y = teethBaseY - toothHeight * (i + 1) * 1.2f
        drawRect(
            color,
            topLeft = Offset(teethRightX, y),
            size = Size(toothWidth, toothHeight)
        )
    }

    // Tassel — слева от bowl
    if (key.hasTassel) {
        val tasselX = cx - bowlRadius * 1.3f
        val tasselY = topY + bowlRadius * 0.6f
        val tasselPath = Path().apply {
            moveTo(tasselX, tasselY)
            lineTo(tasselX - sizePx * 0.08f, tasselY + sizePx * 0.12f)
            lineTo(tasselX + sizePx * 0.04f, tasselY + sizePx * 0.18f)
            close()
        }
        drawPath(tasselPath, color = Color(0xFFB22222))
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
            while (memorizeLeft > 0) {
                delay(1000); memorizeLeft -= 1
            }
            stage = Stage.CHOOSE
        } else if (stage == Stage.CHOOSE) {
            while (chooseLeft > 0 && stage == Stage.CHOOSE) {
                delay(1000); chooseLeft -= 1
            }
            if (stage == Stage.CHOOSE) stage = Stage.RESULT
        }
    }

    Scaffold(
        containerColor = Color(0xFF0D1735),
        topBar = {
            TopAppBar(
                title = { Text("🔑 Золотой ключик", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Transparent,
                    titleContentColor = Color(0xFFFFB800),
                    navigationIconContentColor = Color(0xFFFFB800)
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            when (stage) {
                Stage.MEMORIZE -> MemorizeStage(correct, memorizeLeft)
                Stage.CHOOSE -> ChooseStage(options, chooseLeft) { idx ->
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

@Composable
private fun MemorizeStage(key: GoldenKey, secondsLeft: Int) {
    Spacer(Modifier.height(12.dp))
    Text(
        "Запомни ключ — у тебя $secondsLeft сек",
        color = Color.White, fontSize = 16.sp
    )
    Spacer(Modifier.height(24.dp))
    KeyCard(key = key, selected = false, size = 220.dp)
    Spacer(Modifier.height(12.dp))
    Text(
        "Цвет · форма · число зубчиков · узор стержня · кисточка",
        color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp
    )
}

@Composable
private fun ChooseStage(options: List<GoldenKey>, secondsLeft: Int, onPick: (Int) -> Unit) {
    Spacer(Modifier.height(12.dp))
    Text(
        "Выбери тот же ключ — $secondsLeft сек",
        color = Color.White, fontSize = 16.sp
    )
    Spacer(Modifier.height(16.dp))
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        for (row in 0..1) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                for (col in 0..1) {
                    val idx = row * 2 + col
                    KeyCard(
                        key = options[idx],
                        selected = false,
                        size = 140.dp,
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
    Spacer(Modifier.height(20.dp))
    Text(
        if (win) "🎉 Ключ узнан!" else if (picked == null) "⌛ Не успел" else "❌ Ошибся",
        color = if (win) Color(0xFFFFD700) else Color(0xFFFF8A65),
        fontSize = 22.sp, fontWeight = FontWeight.Bold
    )
    Spacer(Modifier.height(12.dp))
    if (win) {
        Text("Чуйка раскрыта: дельца можно вести в дело.",
            color = Color.White.copy(alpha = 0.8f), fontSize = 13.sp)
    } else {
        Text("Без жетона. Можно посмотреть рекламу, чтобы пройти в обход.",
            color = Color.White.copy(alpha = 0.65f), fontSize = 13.sp)
    }
    Spacer(Modifier.height(20.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Эталон", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
            KeyCard(key = correct, selected = true, size = 120.dp)
        }
        if (picked != null) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Твой выбор", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
                KeyCard(key = picked, selected = false, size = 120.dp)
            }
        }
    }
    Spacer(Modifier.height(28.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Button(
            onClick = onAgain,
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFB800), contentColor = Color.Black)
        ) { Text("Ещё раз") }
        OutlinedButton(onClick = onClose) { Text("Закрыть") }
    }
}

@Composable
private fun KeyCard(
    key: GoldenKey,
    selected: Boolean,
    size: androidx.compose.ui.unit.Dp,
    onClick: (() -> Unit)? = null
) {
    val border = if (selected) Color(0xFFFFD700) else Color.White.copy(alpha = 0.2f)
    val bg = Color(0xFF2A1960)
    val mod = Modifier
        .size(size)
        .clip(RoundedCornerShape(16.dp))
        .background(bg)
        .let { m ->
            // border via stroke in Canvas — проще нарисовать в Canvas overlay
            if (onClick != null) m.clickable { onClick() } else m
        }
    Box(modifier = mod, contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val px = this.size.minDimension
            drawKey(key, sizePx = px * 0.75f)
            drawRect(
                color = border,
                topLeft = Offset.Zero,
                size = this.size,
                style = Stroke(
                    width = if (selected) 4.dp.toPx() else 2.dp.toPx(),
                    pathEffect = if (selected) null else PathEffect.dashPathEffect(floatArrayOf(8f, 6f))
                )
            )
        }
    }
}

private const val MEMORIZE_SECONDS = 10
private const val CHOOSE_SECONDS = 10
