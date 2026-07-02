package com.s0dolamby.game.presentation.minigame.babayaga

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.minigame.common.ArchetypePalette
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import com.s0dolamby.game.presentation.minigame.common.MinigameShell
import com.s0dolamby.game.presentation.minigame.common.MinigameStage
import androidx.compose.ui.graphics.graphicsLayer
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

// ─── ингредиенты Бабы-Яги ─────────────────────────────────────────────

private enum class Ingredient(val emoji: String, val ruName: String, val color: Color) {
    MUHOMOR("🍄", "мухомор", Color(0xFFEF5350)),
    BONE("🦴", "кость", Color(0xFFECEFF1)),
    TOAD("🐸", "жаба", Color(0xFF66BB6A)),
    SNAKE("🐍", "змея", Color(0xFFAD1457)),
    SPIDER("🕷", "паук", Color(0xFF424242)),
    HERB("🌿", "трава", Color(0xFF558B2F))
}

private val ALL_INGREDIENTS = Ingredient.values().toList()

private enum class Phase { SHOWCASE, INPUT }

@Composable
fun BabaYagaCauldronScreen(
    onBack: () -> Unit,
    onComplete: ((MinigameOutcome) -> Unit)? = null
) {
    var seed by remember { mutableStateOf(System.currentTimeMillis()) }
    var sequence by remember(seed) { mutableStateOf(generateRecipe(seed)) }
    // Раскладка полки: после КАЖДОГО выбора ингредиенты пересаживаются —
    // запоминать надо сами ингредиенты, а не их места на полке.
    var shelfOrder by remember(seed) { mutableStateOf(ALL_INGREDIENTS) }
    var phase by remember(seed) { mutableStateOf(Phase.SHOWCASE) }
    var highlightedIngredient by remember(seed) { mutableStateOf<Ingredient?>(null) }
    var playerInput by remember(seed) { mutableStateOf(emptyList<Ingredient>()) }
    var errors by remember(seed) { mutableStateOf(0) }
    var stage by remember(seed) { mutableStateOf(MinigameStage.MEMORIZE) }
    var secondsLeft by remember(seed) { mutableStateOf(0) }
    var splashTrigger by remember(seed) { mutableStateOf(0) }     // увеличивается при добавлении ингредиента
    var splashTone by remember(seed) { mutableStateOf(SplashTone.NEUTRAL) }
    // Что сейчас летит в котёл (для анимации падения)
    var fallingIngredient by remember(seed) { mutableStateOf<Ingredient?>(null) }
    // Финал откладываем, чтобы последний бросок успел долететь и плеснуть
    var pendingFinish by remember(seed) { mutableStateOf(false) }

    LaunchedEffect(pendingFinish) {
        if (pendingFinish) {
            delay(900)
            stage = MinigameStage.RESULT
        }
    }

    LaunchedEffect(seed, phase) {
        if (phase == Phase.SHOWCASE) {
            stage = MinigameStage.MEMORIZE
            secondsLeft = sequence.size * 2 + 2
            delay(700)
            sequence.forEach { ing ->
                highlightedIngredient = ing
                splashTone = SplashTone.NEUTRAL
                fallingIngredient = ing
                splashTrigger += 1
                delay(SHOWCASE_LIT_MS)
                highlightedIngredient = null
                delay(SHOWCASE_GAP_MS)
            }
            phase = Phase.INPUT
            stage = MinigameStage.PLAY
            secondsLeft = INPUT_SECONDS
            playerInput = emptyList()
            // К началу ввода полка уже перемешана — позиции из показа не помогут
            shelfOrder = shelfOrder.shuffled()
        }
    }

    LaunchedEffect(seed, phase) {
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
        MinigameOutcome(errorCount = errors, timeoutReached = secondsLeft == 0 && playerInput.size < sequence.size)
    } else null

    fun handleTap(ing: Ingredient) {
        if (phase != Phase.INPUT) return
        if (pendingFinish) return
        val expected = sequence.getOrNull(playerInput.size) ?: return
        playerInput = playerInput + ing
        highlightedIngredient = ing
        fallingIngredient = ing
        splashTrigger += 1
        if (ing == expected) {
            splashTone = SplashTone.GOOD
        } else {
            splashTone = SplashTone.BAD
            errors += 1
        }
        if (playerInput.size == sequence.size) {
            // Даём последнему ингредиенту долететь и плеснуть
            pendingFinish = true
        } else {
            // Полка пересаживается после каждого броска в котёл
            shelfOrder = shelfOrder.shuffled()
        }
    }

    fun restart() {
        seed = System.currentTimeMillis()
        sequence = generateRecipe(seed)
        shelfOrder = ALL_INGREDIENTS
        phase = Phase.SHOWCASE
        playerInput = emptyList()
        errors = 0
        highlightedIngredient = null
        splashTrigger = 0
        splashTone = SplashTone.NEUTRAL
        fallingIngredient = null
        pendingFinish = false
        stage = MinigameStage.MEMORIZE
    }

    MinigameShell(
        archetype = PersonaArchetype.BABA_YAGA,
        gameTitle = Strings.t("minigame.title.cauldron"),
        stage = stage,
        secondsLeft = if (stage == MinigameStage.RESULT) null else secondsLeft.coerceAtLeast(0),
        outcome = outcome,
        onBack = onBack,
        onAgain = { restart() },
        onClose = onBack,
        onComplete = onComplete
    ) {
        if (stage == MinigameStage.MEMORIZE || stage == MinigameStage.PLAY) {
            HeaderHint(phase = phase, sequenceSize = sequence.size, input = playerInput.size)
            Spacer(Modifier.height(8.dp))
            IngredientRow(
                order = shelfOrder,
                highlight = highlightedIngredient,
                enabled = phase == Phase.INPUT,
                onTap = ::handleTap
            )
            Spacer(Modifier.height(8.dp))
            CauldronView(
                splashTrigger = splashTrigger,
                tone = splashTone,
                falling = fallingIngredient
            )
            Spacer(Modifier.height(8.dp))
            SeqProgress(
                color = ArchetypePalette[PersonaArchetype.BABA_YAGA].primary,
                size = sequence.size,
                expected = sequence,
                input = playerInput
            )
        }
        if (stage == MinigameStage.RESULT) {
            Spacer(Modifier.height(20.dp))
            Text(
                Strings.t(
                    "minigame.cauldron.brewedHeader",
                    if (errors == 0) Strings.t("minigame.cauldron.brewed.ok")
                    else Strings.t("minigame.cauldron.brewed.err")
                ),
                color = Color.White, fontSize = 14.sp
            )
            Text(
                Strings.t("minigame.cauldron.misses", errors, sequence.size),
                color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp
            )
            Spacer(Modifier.height(12.dp))
            Text(
                Strings.t("minigame.cauldron.recipeWas"),
                color = ArchetypePalette[PersonaArchetype.BABA_YAGA].primary,
                fontSize = 12.sp
            )
            Spacer(Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                sequence.forEachIndexed { idx, ing ->
                    Text(ing.emoji, fontSize = 24.sp)
                    if (idx < sequence.size - 1) {
                        Text("→", color = Color.White.copy(alpha = 0.5f),
                            modifier = Modifier.align(Alignment.CenterVertically))
                    }
                }
            }
        }
    }
}

@Composable
private fun HeaderHint(phase: Phase, sequenceSize: Int, input: Int) {
    Text(
        when (phase) {
            Phase.SHOWCASE -> Strings.t("minigame.cauldron.memorize", sequenceSize)
            Phase.INPUT -> Strings.t("minigame.cauldron.input", input, sequenceSize)
        },
        color = Color.White.copy(alpha = 0.85f), fontSize = 14.sp
    )
}

@Composable
private fun IngredientRow(
    order: List<Ingredient>,
    highlight: Ingredient?,
    enabled: Boolean,
    onTap: (Ingredient) -> Unit
) {
    // Кнопки растянуты на всю ширину (weight) — фиксированные 48dp были
    // мелковаты для тапа. Порядок задаётся снаружи и перемешивается.
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        order.forEach { ing ->
            Box(modifier = Modifier.weight(1f)) {
                IngredientButton(
                    ingredient = ing,
                    isHighlighted = highlight == ing,
                    enabled = enabled,
                    onTap = onTap
                )
            }
        }
    }
}

@Composable
private fun IngredientButton(
    ingredient: Ingredient,
    isHighlighted: Boolean,
    enabled: Boolean,
    onTap: (Ingredient) -> Unit
) {
    val scale = remember { Animatable(1f) }
    LaunchedEffect(isHighlighted) {
        if (isHighlighted) {
            scale.snapTo(0.85f)
            scale.animateTo(1.18f, animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy))
            scale.animateTo(1f, tween(180))
        }
    }
    val bgColor = if (isHighlighted) ingredient.color.copy(alpha = 0.85f)
    else Color(0xFF2A1840).copy(alpha = 0.7f)
    val borderColor = if (isHighlighted) Color(0xFFAED581)
    else Color.White.copy(alpha = 0.15f)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .scale(scale.value)
            .clip(CircleShape)
            .background(bgColor)
            .border(if (isHighlighted) 2.dp else 1.dp, borderColor, CircleShape)
            .let { if (enabled) it.clickable { onTap(ingredient) } else it },
        contentAlignment = Alignment.Center
    ) {
        Text(ingredient.emoji, fontSize = 32.sp)
    }
}

// ─── котёл (Canvas + frame ticker) ────────────────────────────────────

private enum class SplashTone { NEUTRAL, GOOD, BAD }

private data class Bubble(val xPct: Float, val ySeed: Long, val r: Float, val drift: Float)

@Composable
private fun CauldronView(splashTrigger: Int, tone: SplashTone, falling: Ingredient? = null) {
    val cauldronShake = remember { Animatable(0f) }
    val flashAlpha = remember { Animatable(0f) }
    // Падение ингредиента с полки в котёл (0 → 1)
    val fall = remember { Animatable(1f) }
    // Прогресс эффекта после плюха: пузырь (GOOD) или брызги (BAD)
    val burst = remember { Animatable(0f) }
    val flashColor by remember {
        derivedStateOf {
            when (tone) {
                SplashTone.GOOD -> Color(0xFFAED581)
                SplashTone.BAD -> Color(0xFFEF5350)
                SplashTone.NEUTRAL -> Color(0xFFFFD54F)
            }
        }
    }
    // Направления брызг жижи при ошибке — свои на каждый бросок
    val badDrops = remember(splashTrigger) {
        List(9) {
            Triple(
                (Random.nextFloat() - 0.5f) * 2.4f,       // vx
                -(0.8f + Random.nextFloat() * 1.4f),      // vy вверх
                3.5f + Random.nextFloat() * 4.5f          // радиус капли
            )
        }
    }

    // Хронометраж броска: падение → плюх (тряска+вспышка) → пузырь/брызги
    LaunchedEffect(splashTrigger) {
        if (splashTrigger == 0) return@LaunchedEffect
        burst.snapTo(0f)
        fall.snapTo(0f)
        fall.animateTo(1f, tween(FALL_MS, easing = FastOutLinearInEasing))
        launch {
            cauldronShake.snapTo(0f)
            cauldronShake.animateTo(8f, tween(60))
            cauldronShake.animateTo(-6f, tween(80))
            cauldronShake.animateTo(0f, tween(120))
        }
        launch {
            flashAlpha.snapTo(0.7f)
            flashAlpha.animateTo(0f, tween(700))
        }
        burst.animateTo(1f, tween(650, easing = LinearEasing))
    }

    // Поток времени для пузырей и огня
    var nowMs by remember { mutableStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            withFrameNanos { nowMs = System.currentTimeMillis() }
        }
    }

    val bubbles = remember {
        List(8) {
            Bubble(
                xPct = 0.15f + 0.70f * Random.nextFloat(),
                ySeed = Random.nextLong(0, 3000),
                r = 4f + 4f * Random.nextFloat(),
                drift = (Random.nextFloat() - 0.5f) * 0.02f
            )
        }
    }
    val infinite = rememberInfiniteTransition(label = "fire")
    val firePhase by infinite.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(300, easing = LinearEasing)),
        label = "firePhase"
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(220.dp)
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center
    ) {
        Canvas(
            modifier = Modifier
                .size(220.dp)
                .scale(1f + cauldronShake.value / 200f)
        ) {
            val w = this.size.width
            val h = this.size.height

            // Огонь под котлом (4 языка пламени)
            val fireBaseY = h * 0.85f
            val fireTopY = h * 0.65f
            for (i in 0..4) {
                val phaseOff = (firePhase + i * 0.17f) % 1f
                val baseX = w * (0.30f + 0.10f * i)
                val flameWidth = w * 0.07f
                val flameHeight = (h * 0.20f) * (0.7f + 0.3f * sin(phaseOff * Math.PI * 2).toFloat())
                val flamePath = Path().apply {
                    moveTo(baseX - flameWidth, fireBaseY)
                    quadraticBezierTo(
                        baseX - flameWidth * 0.5f, fireBaseY - flameHeight * 0.6f,
                        baseX, fireBaseY - flameHeight
                    )
                    quadraticBezierTo(
                        baseX + flameWidth * 0.5f, fireBaseY - flameHeight * 0.6f,
                        baseX + flameWidth, fireBaseY
                    )
                    close()
                }
                drawPath(
                    flamePath,
                    brush = Brush.verticalGradient(
                        colors = listOf(Color(0xFFFFC107), Color(0xFFD84315), Color(0xFFBF360C)),
                        startY = fireBaseY - flameHeight,
                        endY = fireBaseY
                    )
                )
            }

            // Дрова — три полоски
            for (i in 0..2) {
                drawRect(
                    Color(0xFF4E342E),
                    topLeft = Offset(w * (0.25f + 0.18f * i), h * 0.85f),
                    size = Size(w * 0.18f, h * 0.04f)
                )
            }

            // Котёл — чугунная чаша
            val cauldronTopY = h * 0.30f
            val cauldronBottomY = h * 0.72f
            val cauldronLeftX = w * 0.18f
            val cauldronRightX = w * 0.82f
            val cauldronPath = Path().apply {
                moveTo(cauldronLeftX, cauldronTopY)
                lineTo(cauldronRightX, cauldronTopY)
                // правая стенка с изгибом
                quadraticBezierTo(
                    w * 0.95f, cauldronBottomY * 0.85f,
                    w * 0.70f, cauldronBottomY
                )
                lineTo(w * 0.30f, cauldronBottomY)
                // левая стенка с изгибом
                quadraticBezierTo(
                    w * 0.05f, cauldronBottomY * 0.85f,
                    cauldronLeftX, cauldronTopY
                )
                close()
            }
            drawPath(
                cauldronPath,
                brush = Brush.verticalGradient(
                    colors = listOf(Color(0xFF263238), Color(0xFF000000)),
                    startY = cauldronTopY,
                    endY = cauldronBottomY
                )
            )

            // Ручки по бокам
            drawCircle(Color(0xFF263238),
                radius = w * 0.05f,
                center = Offset(cauldronLeftX - w * 0.02f, cauldronTopY + h * 0.06f),
                style = Stroke(width = w * 0.018f))
            drawCircle(Color(0xFF263238),
                radius = w * 0.05f,
                center = Offset(cauldronRightX + w * 0.02f, cauldronTopY + h * 0.06f),
                style = Stroke(width = w * 0.018f))

            // Содержимое — зелёное варево
            val brewTopY = cauldronTopY + h * 0.03f
            val brewPath = Path().apply {
                moveTo(cauldronLeftX + w * 0.02f, brewTopY)
                lineTo(cauldronRightX - w * 0.02f, brewTopY)
                quadraticBezierTo(
                    w * 0.90f, cauldronBottomY * 0.85f,
                    w * 0.68f, cauldronBottomY - h * 0.02f
                )
                lineTo(w * 0.32f, cauldronBottomY - h * 0.02f)
                quadraticBezierTo(
                    w * 0.10f, cauldronBottomY * 0.85f,
                    cauldronLeftX + w * 0.02f, brewTopY
                )
                close()
            }
            drawPath(
                brewPath,
                brush = Brush.radialGradient(
                    colors = listOf(Color(0xFF8BC34A), Color(0xFF558B2F), Color(0xFF33691E)),
                    center = Offset(w / 2f, brewTopY + h * 0.10f),
                    radius = w * 0.40f
                )
            )

            // Блик на варево
            drawOval(
                Color(0xFFAED581).copy(alpha = 0.55f),
                topLeft = Offset(w * 0.28f, brewTopY - h * 0.01f),
                size = Size(w * 0.20f, h * 0.04f)
            )

            // Пузырьки — каждый дрейфует вверх из дна котла, циклически
            val brewBottom = cauldronBottomY - h * 0.05f
            val brewLeft = cauldronLeftX + w * 0.05f
            val brewRight = cauldronRightX - w * 0.05f
            val brewWidth = brewRight - brewLeft
            bubbles.forEach { b ->
                val cyc = ((nowMs + b.ySeed) % 1800L) / 1800f
                val by = brewBottom - cyc * (brewBottom - brewTopY)
                val bx = brewLeft + brewWidth * b.xPct + b.drift * nowMs.toFloat()
                val visible = cyc in 0.05f..0.95f
                if (visible) {
                    drawCircle(
                        Color(0xFFC5E1A5).copy(alpha = 0.55f * (1 - cyc)),
                        radius = b.r,
                        center = Offset(bx.coerceIn(brewLeft, brewRight), by)
                    )
                    drawCircle(
                        Color.White.copy(alpha = 0.35f * (1 - cyc)),
                        radius = b.r * 0.45f,
                        center = Offset(bx.coerceIn(brewLeft, brewRight) - b.r * 0.25f,
                            by - b.r * 0.25f)
                    )
                }
            }

            // Вспышка-всплеск при добавлении ингредиента
            if (flashAlpha.value > 0f) {
                drawOval(
                    flashColor.copy(alpha = flashAlpha.value * 0.85f),
                    topLeft = Offset(w * 0.25f, brewTopY - h * 0.04f),
                    size = Size(w * 0.50f, h * 0.10f)
                )
            }

            // ── Эффекты после плюха ─────────────────────────────────────
            val t = burst.value
            if (t > 0f && t < 1f) {
                val brewCenterX = w / 2f
                when (tone) {
                    SplashTone.GOOD -> {
                        // Зелёный пузырь всплывает над котлом и лопается
                        val rise = t.coerceAtMost(0.75f) / 0.75f
                        val bubbleY = brewTopY - rise * h * 0.30f
                        val bubbleR = w * (0.05f + 0.09f * rise)
                        if (t < 0.75f) {
                            drawCircle(
                                Color(0xFF8BC34A).copy(alpha = 0.85f),
                                radius = bubbleR,
                                center = Offset(brewCenterX, bubbleY)
                            )
                            drawCircle(
                                Color(0xFFDCEDC8).copy(alpha = 0.9f),
                                radius = bubbleR * 0.3f,
                                center = Offset(brewCenterX - bubbleR * 0.35f, bubbleY - bubbleR * 0.35f)
                            )
                        } else {
                            // Лопнул: расширяющееся кольцо + разлетающиеся капельки
                            val pop = (t - 0.75f) / 0.25f
                            val popY = brewTopY - h * 0.30f
                            drawCircle(
                                Color(0xFFAED581).copy(alpha = (1f - pop) * 0.9f),
                                radius = bubbleR * (1f + pop * 1.6f),
                                center = Offset(brewCenterX, popY),
                                style = Stroke(width = w * 0.015f * (1f - pop * 0.5f))
                            )
                            for (i in 0 until 6) {
                                val a = Math.PI * 2 * i / 6
                                drawCircle(
                                    Color(0xFFC5E1A5).copy(alpha = 1f - pop),
                                    radius = w * 0.012f,
                                    center = Offset(
                                        brewCenterX + (bubbleR * (1.2f + pop * 2f) * cos(a)).toFloat(),
                                        popY + (bubbleR * (1.2f + pop * 2f) * sin(a)).toFloat()
                                    )
                                )
                            }
                        }
                    }
                    SplashTone.BAD -> {
                        // Взрыв в котле: брызги багровой жижи разлетаются по параболам
                        badDrops.forEach { (vx, vy, dropR) ->
                            val dx = vx * t * w * 0.45f
                            val dy = vy * t * h * 0.5f + t * t * h * 0.9f
                            val px = brewCenterX + dx
                            val py = brewTopY + dy
                            if (py < h) {
                                drawCircle(
                                    Color(0xFF8E24AA).copy(alpha = (1f - t) * 0.95f),
                                    radius = dropR * (1f - t * 0.4f),
                                    center = Offset(px, py)
                                )
                                drawCircle(
                                    Color(0xFFCE93D8).copy(alpha = (1f - t) * 0.6f),
                                    radius = dropR * 0.4f,
                                    center = Offset(px - dropR * 0.2f, py - dropR * 0.2f)
                                )
                            }
                        }
                        // Тёмная клякса на самом вареве
                        drawOval(
                            Color(0xFF6A1B9A).copy(alpha = (1f - t) * 0.7f),
                            topLeft = Offset(w * 0.32f, brewTopY - h * 0.02f),
                            size = Size(w * 0.36f, h * 0.08f)
                        )
                    }
                    SplashTone.NEUTRAL -> Unit
                }
            }
        }

        // Падающий ингредиент — эмодзи летит с полки в котёл, вращаясь
        if (falling != null && fall.value < 1f) {
            Text(
                falling.emoji,
                fontSize = 30.sp,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .graphicsLayer {
                        val p = fall.value
                        // Лёгкая дуга: чуть вбок и вниз с ускорением
                        translationX = (p - 0.5f) * 30f
                        translationY = p * p * 260f
                        rotationZ = p * 260f
                        alpha = if (p > 0.92f) (1f - p) * 12f else 1f
                    }
            )
        }
    }
}

@Composable
private fun SeqProgress(
    color: Color,
    size: Int,
    expected: List<Ingredient>,
    input: List<Ingredient>
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
                    .width(34.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(c)
            )
        }
    }
}

private fun generateRecipe(seed: Long): List<Ingredient> {
    val rng = Random(seed)
    return List(RECIPE_LENGTH) { ALL_INGREDIENTS[rng.nextInt(ALL_INGREDIENTS.size)] }
}

private const val RECIPE_LENGTH = 4
private const val SHOWCASE_LIT_MS = 650L
private const val SHOWCASE_GAP_MS = 300L
private const val FALL_MS = 380
private const val INPUT_SECONDS = 14
