package com.s0dolamby.game.presentation.minigame.koschei

import com.s0dolamby.game.presentation.feedback.pausableDelay
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
import androidx.compose.ui.draw.shadow
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
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.minigame.common.ArchetypePalette
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import com.s0dolamby.game.presentation.minigame.common.MinigameShell
import com.s0dolamby.game.presentation.minigame.common.MinigameStage
import com.s0dolamby.game.presentation.minigame.common.drawSparkleHalo
import kotlinx.coroutines.delay
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

// ─── элементы цепочки Кощея ─────────────────────────────────────────────

private enum class KoscheiKind(val label: String, val color: Color) {
    OAK("Дуб", Color(0xFF8BC34A)),
    CHEST("Ларец", Color(0xFFFFB300)),
    HARE("Заяц", Color(0xFFE0E0E0)),
    DUCK("Утка", Color(0xFFFFE082)),
    EGG("Яйцо", Color(0xFFFFF8E1)),
    NEEDLE("Игла", Color(0xFFCFD8DC))
}

private data class Card(
    val id: Int,
    val kind: KoscheiKind,
    var isFaceUp: Boolean = false,
    var isMatched: Boolean = false
)

private const val GRID_ROWS = 4
private const val GRID_COLS = 3
private const val PAIR_COUNT = (GRID_ROWS * GRID_COLS) / 2
private const val MISMATCH_HIDE_MS = 650L
// 60с позволяло перевернуть каждую карту по 6 раз — память не нужна.
// 25с хватает на ~12 осмысленных пар переворотов.
private const val TIME_BUDGET_S = 25

@Composable
fun KoscheiMemoryScreen(
    onBack: () -> Unit,
    onComplete: ((MinigameOutcome) -> Unit)? = null
) {
    var seed by remember { mutableStateOf(System.currentTimeMillis()) }
    val cards = remember(seed) { mutableStateListOf<Card>().apply { addAll(buildDeck(seed)) } }
    var firstFlippedIdx by remember(seed) { mutableStateOf<Int?>(null) }
    var secondFlippedIdx by remember(seed) { mutableStateOf<Int?>(null) }
    var lockTaps by remember(seed) { mutableStateOf(false) }
    var attempts by remember(seed) { mutableStateOf(0) }
    var pairsFound by remember(seed) { mutableStateOf(0) }
    var stage by remember(seed) { mutableStateOf(MinigameStage.PLAY) }
    var secondsLeft by remember(seed) { mutableStateOf(TIME_BUDGET_S) }

    LaunchedEffect(seed) {
        while (secondsLeft > 0 && stage == MinigameStage.PLAY) {
            pausableDelay(1000)
            secondsLeft -= 1
        }
        if (stage == MinigameStage.PLAY && secondsLeft == 0) {
            stage = MinigameStage.RESULT
        }
    }

    // Обработка пары: после двух flip — пауза, оценка
    LaunchedEffect(secondFlippedIdx) {
        val first = firstFlippedIdx
        val second = secondFlippedIdx
        if (first != null && second != null) {
            lockTaps = true
            val match = cards[first].kind == cards[second].kind
            if (match) {
                delay(450)
                cards[first] = cards[first].copy(isMatched = true)
                cards[second] = cards[second].copy(isMatched = true)
                pairsFound += 1
                if (pairsFound == PAIR_COUNT) {
                    stage = MinigameStage.RESULT
                }
            } else {
                // Несовпавшая пара — НЕ ошибка, просто закрываем обратно.
                // Ошибки считаются по неоткрытым парам на таймауте.
                delay(MISMATCH_HIDE_MS)
                cards[first] = cards[first].copy(isFaceUp = false)
                cards[second] = cards[second].copy(isFaceUp = false)
            }
            attempts += 1
            firstFlippedIdx = null
            secondFlippedIdx = null
            lockTaps = false
        }
    }

    // Ошибки = пары, не открытые до конца таймера. Собрал все = идеал.
    val outcome: MinigameOutcome? = if (stage == MinigameStage.RESULT) {
        val unmatchedPairs = PAIR_COUNT - pairsFound
        MinigameOutcome(errorCount = unmatchedPairs, timeoutReached = false)
    } else null

    fun handleTap(idx: Int) {
        if (lockTaps) return
        if (stage != MinigameStage.PLAY) return
        val card = cards.getOrNull(idx) ?: return
        if (card.isFaceUp || card.isMatched) return
        cards[idx] = card.copy(isFaceUp = true)
        if (firstFlippedIdx == null) firstFlippedIdx = idx
        else if (secondFlippedIdx == null) secondFlippedIdx = idx
    }

    fun restart() {
        seed = System.currentTimeMillis()
        cards.clear()
        cards.addAll(buildDeck(seed))
        firstFlippedIdx = null
        secondFlippedIdx = null
        lockTaps = false
        attempts = 0
        pairsFound = 0
        stage = MinigameStage.PLAY
        secondsLeft = TIME_BUDGET_S
    }

    MinigameShell(
        archetype = PersonaArchetype.KOSCHEI,
        gameTitle = Strings.t("minigame.title.memory"),
        stage = stage,
        secondsLeft = if (stage == MinigameStage.RESULT) null else secondsLeft.coerceAtLeast(0),
        outcome = outcome,
        onBack = onBack,
        onAgain = { restart() },
        onClose = onBack,
        onComplete = onComplete,
        review = { KoscheiReviewGrid(cards) }
    ) {
        if (stage == MinigameStage.PLAY) {
            ScoreLine(pairsFound, attempts)
            Spacer(Modifier.height(14.dp))
            CardGrid(cards = cards, onTap = ::handleTap, modifier = Modifier.weight(1f))
            Spacer(Modifier.height(10.dp))
            ChainHint()
        }
        if (stage == MinigameStage.RESULT) {
            Spacer(Modifier.height(16.dp))
            Text(
                "Собрано пар: $pairsFound из $PAIR_COUNT",
                color = Color.White, fontSize = 14.sp
            )
            Text(
                "Попыток: $attempts",
                color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp
            )
        }
    }
}

@Composable
private fun ScoreLine(pairsFound: Int, attempts: Int) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            "Пар: $pairsFound / $PAIR_COUNT",
            color = ArchetypePalette[PersonaArchetype.KOSCHEI].primary,
            fontSize = 13.sp, fontWeight = FontWeight.SemiBold
        )
        Text(
            "Попыток: $attempts",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 12.sp
        )
    }
}

@Composable
private fun ChainHint() {
    val labelKeys = listOf("OAK", "CHEST", "HARE", "DUCK", "EGG", "NEEDLE")
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        labelKeys.forEachIndexed { idx, key ->
            Text(
                Strings.t("minigame.koschei.kind.$key"),
                color = Color.White.copy(alpha = 0.45f),
                fontSize = 10.sp
            )
            if (idx < labelKeys.size - 1) {
                Text(
                    "→",
                    color = ArchetypePalette[PersonaArchetype.KOSCHEI].primary.copy(alpha = 0.6f),
                    fontSize = 10.sp
                )
            }
        }
    }
}

@Composable
private fun CardGrid(cards: List<Card>, onTap: (Int) -> Unit, modifier: Modifier = Modifier) {
    // Раньше карты растягивались только по ширине (weight) и фиксированный
    // аспект 96/116 → на тесных экранах 4 ряда не влезали и наезжали друг на
    // друга. Теперь считаем размер карты так, чтобы сетка целиком помещалась
    // и по ширине, И по высоте выделенного места.
    val gap = 8.dp
    BoxWithConstraints(modifier = modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val cellByWidth = (maxWidth - gap * (GRID_COLS - 1)) / GRID_COLS
        // ширина карты, при которой её высота (w * 116/96) уложится по высоте
        val cellByHeight = (maxHeight - gap * (GRID_ROWS - 1)) / GRID_ROWS * (96f / 116f)
        val cardW = minOf(cellByWidth, cellByHeight)
        Column(
            verticalArrangement = Arrangement.spacedBy(gap),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            for (row in 0 until GRID_ROWS) {
                Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                    for (col in 0 until GRID_COLS) {
                        val idx = row * GRID_COLS + col
                        val card = cards[idx]
                        Box(modifier = Modifier.width(cardW)) {
                            CardView(card = card, onClick = { onTap(idx) })
                        }
                    }
                }
            }
        }
    }
}

/** Разбор: все карты открыты, зелёная рамка — собрал, красная — не успел. */
@Composable
private fun KoscheiReviewGrid(cards: List<Card>) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier.padding(bottom = 8.dp)
    ) {
        Text("🟢 собрал", color = Success, fontSize = 11.sp)
        Text("🔴 не успел", color = Error, fontSize = 11.sp)
    }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        for (row in 0 until GRID_ROWS) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                for (col in 0 until GRID_COLS) {
                    val card = cards[row * GRID_COLS + col]
                    val ok = card.isMatched
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .aspectRatio(1.25f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(card.kind.color.copy(alpha = 0.22f))
                            .border(2.dp, if (ok) Success else Error, RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(card.kind.label, color = Color.White, fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun CardView(card: Card, onClick: () -> Unit) {
    val matchedScale = remember(card.isMatched) { Animatable(if (card.isMatched) 1.05f else 1f) }
    LaunchedEffect(card.isMatched) {
        if (card.isMatched) {
            matchedScale.animateTo(1.10f, tween(180))
            matchedScale.animateTo(1f, tween(220))
        }
    }
    // Настоящий 3D-флип: rotationY 0° (рубашка) → 180° (лицо).
    // На 90° карта стоит ребром — контент меняем именно в этот момент.
    val flip = remember { Animatable(if (card.isFaceUp) 180f else 0f) }
    LaunchedEffect(card.isFaceUp) {
        flip.animateTo(
            targetValue = if (card.isFaceUp) 180f else 0f,
            animationSpec = tween(340, easing = FastOutSlowInEasing)
        )
    }
    val showFace = flip.value > 90f

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(96f / 116f)
            .scale(matchedScale.value)
            .shadow(if (card.isFaceUp) 8.dp else 4.dp, RoundedCornerShape(14.dp))
            .clip(RoundedCornerShape(14.dp))
            .graphicsLayer {
                rotationY = flip.value
                cameraDistance = 14f * density
            }
            .clickable { onClick() }
    ) {
        if (showFace) {
            // Лицо рисуем с компенсирующим зеркалированием — иначе при 180°
            // оно было бы отражено по горизонтали
            Box(modifier = Modifier
                .fillMaxSize()
                .graphicsLayer { rotationY = 180f }
            ) {
                CardFace(card)
            }
        } else {
            CardBack()
        }
    }
}

@Composable
private fun CardFace(card: Card) {
    val borderColor = if (card.isMatched) ArchetypePalette[PersonaArchetype.KOSCHEI].primary
    else Color.White.copy(alpha = 0.25f)
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF1A2030), Color(0xFF0B121F))
                )
            )
            .border(if (card.isMatched) 2.5.dp else 1.dp, borderColor, RoundedCornerShape(14.dp)),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize().padding(8.dp)) {
            val sz = this.size.minDimension
            val center = Offset(this.size.width / 2f, this.size.height / 2f - sz * 0.08f)
            if (card.isMatched) {
                drawSparkleHalo(
                    center = center,
                    radius = sz * 0.40f,
                    count = 4,
                    sparkleSize = 5f,
                    color = ArchetypePalette[PersonaArchetype.KOSCHEI].primary,
                    intensity = 0.65f
                )
            }
            drawKoscheiKind(card.kind, center, sz * 0.4f)
        }
        Text(
            Strings.t("minigame.koschei.kind.${card.kind.name}"),
            color = if (card.isMatched) ArchetypePalette[PersonaArchetype.KOSCHEI].primary
            else Color.White.copy(alpha = 0.85f),
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 6.dp)
        )
    }
}

@Composable
private fun CardBack() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF2A1840), Color(0xFF0F0A1E))
                )
            )
            .border(1.dp, Color(0xFF80DEEA).copy(alpha = 0.35f), RoundedCornerShape(14.dp))
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = this.size.width
            val h = this.size.height
            val center = Offset(w / 2f, h / 2f)
            val ice = Color(0xFF80DEEA).copy(alpha = 0.45f)
            // Снежинка: 6 лучей
            for (i in 0 until 6) {
                val a = Math.PI * 2 * i / 6
                val r = w * 0.30f
                val end = Offset(
                    center.x + (r * cos(a)).toFloat(),
                    center.y + (r * sin(a)).toFloat()
                )
                drawLine(ice, start = center, end = end, strokeWidth = 1.5f)
                // боковые лучики
                val mid = Offset(
                    center.x + (r * 0.6f * cos(a)).toFloat(),
                    center.y + (r * 0.6f * sin(a)).toFloat()
                )
                val side1 = Offset(
                    mid.x + (r * 0.18f * cos(a + Math.PI / 4)).toFloat(),
                    mid.y + (r * 0.18f * sin(a + Math.PI / 4)).toFloat()
                )
                val side2 = Offset(
                    mid.x + (r * 0.18f * cos(a - Math.PI / 4)).toFloat(),
                    mid.y + (r * 0.18f * sin(a - Math.PI / 4)).toFloat()
                )
                drawLine(ice, start = mid, end = side1, strokeWidth = 1f)
                drawLine(ice, start = mid, end = side2, strokeWidth = 1f)
            }
            drawCircle(Color(0xFFCFD8DC).copy(alpha = 0.8f), radius = w * 0.04f, center = center)
        }
    }
}

// ─── рисование иконок цепочки ──────────────────────────────────────────

private fun DrawScope.drawKoscheiKind(kind: KoscheiKind, center: Offset, sizePx: Float) {
    when (kind) {
        KoscheiKind.OAK -> drawOak(center, sizePx)
        KoscheiKind.CHEST -> drawChest(center, sizePx)
        KoscheiKind.HARE -> drawHare(center, sizePx)
        KoscheiKind.DUCK -> drawDuck(center, sizePx)
        KoscheiKind.EGG -> drawEgg(center, sizePx)
        KoscheiKind.NEEDLE -> drawNeedle(center, sizePx)
    }
}

private fun DrawScope.drawOak(center: Offset, sizePx: Float) {
    // Ствол
    drawRect(
        Color(0xFF6D4C41),
        topLeft = Offset(center.x - sizePx * 0.08f, center.y + sizePx * 0.05f),
        size = Size(sizePx * 0.16f, sizePx * 0.45f)
    )
    // Крона — три круга
    val green = Color(0xFF7CB342)
    val greenDark = Color(0xFF4E7A22)
    drawCircle(green, radius = sizePx * 0.30f, center = Offset(center.x, center.y - sizePx * 0.10f))
    drawCircle(greenDark, radius = sizePx * 0.22f, center = Offset(center.x - sizePx * 0.18f, center.y))
    drawCircle(greenDark, radius = sizePx * 0.22f, center = Offset(center.x + sizePx * 0.18f, center.y))
    // Жёлуди
    drawCircle(Color(0xFF8B4513), radius = sizePx * 0.04f, center = Offset(center.x - sizePx * 0.10f, center.y + sizePx * 0.05f))
    drawCircle(Color(0xFF8B4513), radius = sizePx * 0.04f, center = Offset(center.x + sizePx * 0.05f, center.y + sizePx * 0.10f))
}

private fun DrawScope.drawChest(center: Offset, sizePx: Float) {
    // Низ ларца
    drawRect(
        Color(0xFF8D6E63),
        topLeft = Offset(center.x - sizePx * 0.35f, center.y - sizePx * 0.10f),
        size = Size(sizePx * 0.70f, sizePx * 0.40f)
    )
    // Крышка (арка)
    val lid = Path().apply {
        moveTo(center.x - sizePx * 0.35f, center.y - sizePx * 0.10f)
        quadraticBezierTo(center.x, center.y - sizePx * 0.45f, center.x + sizePx * 0.35f, center.y - sizePx * 0.10f)
        close()
    }
    drawPath(lid, color = Color(0xFFA1887F))
    // Замок
    drawRect(
        Color(0xFFFFB300),
        topLeft = Offset(center.x - sizePx * 0.06f, center.y - sizePx * 0.12f),
        size = Size(sizePx * 0.12f, sizePx * 0.18f)
    )
    drawCircle(Color(0xFFFFE082), radius = sizePx * 0.025f, center = Offset(center.x, center.y - sizePx * 0.04f))
    // Скрепы
    drawLine(Color(0xFF5D4037),
        start = Offset(center.x - sizePx * 0.35f, center.y + sizePx * 0.06f),
        end = Offset(center.x + sizePx * 0.35f, center.y + sizePx * 0.06f),
        strokeWidth = sizePx * 0.02f)
}

private fun DrawScope.drawHare(center: Offset, sizePx: Float) {
    val grey = Color(0xFFE0E0E0)
    val darkGrey = Color(0xFFBDBDBD)
    // Уши — два длинных овала
    drawOval(grey,
        topLeft = Offset(center.x - sizePx * 0.20f, center.y - sizePx * 0.55f),
        size = Size(sizePx * 0.10f, sizePx * 0.40f))
    drawOval(grey,
        topLeft = Offset(center.x + sizePx * 0.10f, center.y - sizePx * 0.55f),
        size = Size(sizePx * 0.10f, sizePx * 0.40f))
    drawOval(Color(0xFFFFCDD2).copy(alpha = 0.7f),
        topLeft = Offset(center.x - sizePx * 0.17f, center.y - sizePx * 0.48f),
        size = Size(sizePx * 0.05f, sizePx * 0.25f))
    drawOval(Color(0xFFFFCDD2).copy(alpha = 0.7f),
        topLeft = Offset(center.x + sizePx * 0.12f, center.y - sizePx * 0.48f),
        size = Size(sizePx * 0.05f, sizePx * 0.25f))
    // Голова
    drawCircle(grey, radius = sizePx * 0.25f, center = Offset(center.x, center.y - sizePx * 0.05f))
    // Тело
    drawOval(darkGrey,
        topLeft = Offset(center.x - sizePx * 0.27f, center.y + sizePx * 0.10f),
        size = Size(sizePx * 0.54f, sizePx * 0.40f))
    // Глаза
    drawCircle(Color.Black, radius = sizePx * 0.04f, center = Offset(center.x - sizePx * 0.08f, center.y - sizePx * 0.05f))
    drawCircle(Color.Black, radius = sizePx * 0.04f, center = Offset(center.x + sizePx * 0.08f, center.y - sizePx * 0.05f))
    // Нос
    drawCircle(Color(0xFFEC407A), radius = sizePx * 0.025f, center = Offset(center.x, center.y + sizePx * 0.05f))
}

private fun DrawScope.drawDuck(center: Offset, sizePx: Float) {
    val yellow = Color(0xFFFFE082)
    val yellowDark = Color(0xFFFFC107)
    // Тело — крупный овал
    drawOval(yellow,
        topLeft = Offset(center.x - sizePx * 0.35f, center.y - sizePx * 0.05f),
        size = Size(sizePx * 0.70f, sizePx * 0.50f))
    // Голова — круг
    drawCircle(yellow, radius = sizePx * 0.22f, center = Offset(center.x - sizePx * 0.25f, center.y - sizePx * 0.15f))
    // Клюв — оранжевый треугольник
    val beak = Path().apply {
        moveTo(center.x - sizePx * 0.42f, center.y - sizePx * 0.15f)
        lineTo(center.x - sizePx * 0.62f, center.y - sizePx * 0.12f)
        lineTo(center.x - sizePx * 0.42f, center.y - sizePx * 0.05f)
        close()
    }
    drawPath(beak, color = Color(0xFFFF8F00))
    // Глаз
    drawCircle(Color.Black, radius = sizePx * 0.035f, center = Offset(center.x - sizePx * 0.30f, center.y - sizePx * 0.18f))
    // Крыло
    drawOval(yellowDark,
        topLeft = Offset(center.x - sizePx * 0.10f, center.y + sizePx * 0.05f),
        size = Size(sizePx * 0.30f, sizePx * 0.18f))
}

private fun DrawScope.drawEgg(center: Offset, sizePx: Float) {
    val cream = Color(0xFFFFF8E1)
    val creamDark = Color(0xFFEAD9A8)
    // Тело яйца — асимметричный овал
    drawOval(
        Brush.radialGradient(
            colors = listOf(cream, creamDark),
            center = Offset(center.x - sizePx * 0.05f, center.y - sizePx * 0.15f),
            radius = sizePx * 0.6f
        ),
        topLeft = Offset(center.x - sizePx * 0.27f, center.y - sizePx * 0.40f),
        size = Size(sizePx * 0.54f, sizePx * 0.80f)
    )
    // Блик
    drawOval(
        Color.White.copy(alpha = 0.65f),
        topLeft = Offset(center.x - sizePx * 0.18f, center.y - sizePx * 0.32f),
        size = Size(sizePx * 0.12f, sizePx * 0.22f)
    )
    // Маленькая трещинка
    val crack = Path().apply {
        moveTo(center.x - sizePx * 0.05f, center.y + sizePx * 0.10f)
        lineTo(center.x, center.y + sizePx * 0.18f)
        lineTo(center.x + sizePx * 0.08f, center.y + sizePx * 0.12f)
        lineTo(center.x + sizePx * 0.04f, center.y + sizePx * 0.22f)
    }
    drawPath(crack, color = Color(0xFFA1887F).copy(alpha = 0.45f), style = Stroke(width = sizePx * 0.015f))
}

private fun DrawScope.drawNeedle(center: Offset, sizePx: Float) {
    val silver = Color(0xFFE0E0E0)
    val silverDark = Color(0xFF9E9E9E)
    // Ушко — кольцо сверху
    val needleTopY = center.y - sizePx * 0.50f
    val needleBotY = center.y + sizePx * 0.50f
    drawCircle(silver, radius = sizePx * 0.07f, center = Offset(center.x, needleTopY),
        style = Stroke(width = sizePx * 0.03f))
    // Стержень — узкий вертикальный градиент от широкого к острому
    val needlePath = Path().apply {
        moveTo(center.x - sizePx * 0.025f, needleTopY + sizePx * 0.04f)
        lineTo(center.x + sizePx * 0.025f, needleTopY + sizePx * 0.04f)
        lineTo(center.x + sizePx * 0.005f, needleBotY)
        lineTo(center.x - sizePx * 0.005f, needleBotY)
        close()
    }
    drawPath(needlePath,
        brush = Brush.verticalGradient(
            listOf(silver, silverDark, Color(0xFF616161)),
            startY = needleTopY, endY = needleBotY
        )
    )
    // Блик
    drawLine(Color.White.copy(alpha = 0.5f),
        start = Offset(center.x - sizePx * 0.012f, needleTopY + sizePx * 0.10f),
        end = Offset(center.x - sizePx * 0.003f, needleBotY - sizePx * 0.05f),
        strokeWidth = sizePx * 0.008f)
}

// ─── deck builder ──────────────────────────────────────────────────────

private fun buildDeck(seed: Long): List<Card> {
    val kinds = KoscheiKind.values().toList()
    require(kinds.size == PAIR_COUNT) {
        "PAIR_COUNT ($PAIR_COUNT) must match number of KoscheiKind values (${kinds.size})"
    }
    val rng = Random(seed)
    val pairs = kinds.flatMap { listOf(it, it) }
    val shuffled = pairs.shuffled(rng)
    return shuffled.mapIndexed { idx, kind -> Card(id = idx, kind = kind) }
}
