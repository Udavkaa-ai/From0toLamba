package com.s0dolamby.game.presentation.minigame.kolobok

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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.minigame.common.ArchetypePalette
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import com.s0dolamby.game.presentation.minigame.common.MinigameShell
import com.s0dolamby.game.presentation.minigame.common.MinigameStage
import com.s0dolamby.game.presentation.minigame.common.drawSparkle
import kotlinx.coroutines.delay
import kotlin.random.Random

@Composable
fun KolobokNoraScreen(onBack: () -> Unit) {
    var seed by remember { mutableStateOf(System.currentTimeMillis()) }
    // Каждая попытка — это новый «уникальный ключ»; меняем когда показ закончен
    var attemptKey by remember(seed) { mutableStateOf(0) }
    var attemptIdx by remember(seed) { mutableStateOf(0) }       // 0..TOTAL_ATTEMPTS
    var currentNora by remember(seed) { mutableStateOf(-1) }     // -1 = пока пусто
    var caughtCount by remember(seed) { mutableStateOf(0) }
    var errors by remember(seed) { mutableStateOf(0) }
    var stage by remember(seed) { mutableStateOf(MinigameStage.PLAY) }
    var feedback by remember(seed) { mutableStateOf<Pair<Int, Boolean>?>(null) }

    LaunchedEffect(seed, attemptKey) {
        if (stage != MinigameStage.PLAY) return@LaunchedEffect
        if (attemptIdx >= TOTAL_ATTEMPTS) {
            stage = MinigameStage.RESULT
            return@LaunchedEffect
        }
        // Пауза-«затишье», потом колобок выглянет
        feedback = null
        delay(Random.nextLong(WAIT_MIN_MS, WAIT_MAX_MS + 1))
        val target = Random.nextInt(NORA_COUNT)
        currentNora = target
        // Время на реакцию
        delay(REACTION_WINDOW_MS)
        if (currentNora == target) {
            // Игрок не успел
            errors += 1
            feedback = target to false
            currentNora = -1
            delay(FEEDBACK_MS)
            attemptIdx += 1
            attemptKey += 1
        }
    }

    fun handleTap(idx: Int) {
        if (stage != MinigameStage.PLAY) return
        if (feedback != null) return
        when (currentNora) {
            idx -> {
                caughtCount += 1
                feedback = idx to true
                currentNora = -1
            }
            -1 -> {
                // Холостой тап — лёгкое наказание (тап в пустоту)
                errors += 1
                feedback = idx to false
            }
            else -> {
                errors += 1
                feedback = idx to false
                currentNora = -1
            }
        }
    }

    LaunchedEffect(feedback) {
        if (feedback != null && currentNora == -1) {
            delay(FEEDBACK_MS)
            attemptIdx += 1
            attemptKey += 1
        }
    }

    val outcome: MinigameOutcome? = if (stage == MinigameStage.RESULT) {
        MinigameOutcome(errorCount = errors, timeoutReached = false)
    } else null

    fun restart() {
        seed = System.currentTimeMillis()
        attemptKey = 0
        attemptIdx = 0
        currentNora = -1
        caughtCount = 0
        errors = 0
        feedback = null
        stage = MinigameStage.PLAY
    }

    MinigameShell(
        archetype = PersonaArchetype.KOLOBOK,
        gameTitle = "Нора-нора-нора",
        stage = stage,
        secondsLeft = if (stage == MinigameStage.RESULT) null else (TOTAL_ATTEMPTS - attemptIdx),
        outcome = outcome,
        onBack = onBack,
        onAgain = { restart() },
        onClose = onBack
    ) {
        if (stage == MinigameStage.PLAY) {
            Text(
                "Колобок выглянет — тапни нору",
                color = Color.White.copy(alpha = 0.85f), fontSize = 14.sp
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "Поймал $caughtCount  ·  промахов $errors",
                color = ArchetypePalette[PersonaArchetype.KOLOBOK].primary,
                fontSize = 12.sp
            )
            Spacer(Modifier.height(28.dp))
            NoraRow(
                currentNora = currentNora,
                feedback = feedback,
                onTap = ::handleTap
            )
            Spacer(Modifier.height(16.dp))
            ForestGround()
        }
        if (stage == MinigameStage.RESULT) {
            Spacer(Modifier.height(20.dp))
            Text(
                "Поймал $caughtCount из $TOTAL_ATTEMPTS",
                color = Color.White.copy(alpha = 0.7f), fontSize = 14.sp
            )
            Text(
                "Промахов: $errors",
                color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp
            )
        }
    }
}

@Composable
private fun ForestGround() {
    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(36.dp)
    ) {
        drawRect(
            Brush.verticalGradient(
                listOf(Color(0xFF3E1F00), Color(0xFF1A0F00))
            ),
            topLeft = Offset.Zero,
            size = Size(size.width, size.height)
        )
        // Опавшие листья — несколько маленьких оранжевых овалов
        for (i in 0..9) {
            val x = size.width * (0.05f + 0.10f * i)
            val y = size.height * (0.4f + 0.3f * ((i % 3) / 2f))
            drawOval(
                Color(0xFFE65100).copy(alpha = 0.45f),
                topLeft = Offset(x - 6f, y - 3f),
                size = Size(12f, 6f)
            )
        }
    }
}

@Composable
private fun NoraRow(
    currentNora: Int,
    feedback: Pair<Int, Boolean>?,
    onTap: (Int) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.Bottom
    ) {
        for (idx in 0 until NORA_COUNT) {
            NoraSlot(
                index = idx,
                isKolobokOut = currentNora == idx,
                feedback = feedback?.takeIf { it.first == idx },
                onTap = { onTap(idx) }
            )
        }
    }
}

@Composable
private fun NoraSlot(
    index: Int,
    isKolobokOut: Boolean,
    feedback: Pair<Int, Boolean>?,
    onTap: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable { onTap() }
    ) {
        Box(
            modifier = Modifier
                .size(width = 96.dp, height = 110.dp),
            contentAlignment = Alignment.BottomCenter
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                // Земляная горка
                val mound = Path().apply {
                    moveTo(0f, size.height)
                    quadraticBezierTo(size.width / 2f, size.height * 0.05f, size.width, size.height)
                    close()
                }
                drawPath(
                    mound,
                    brush = Brush.verticalGradient(
                        listOf(Color(0xFF7B4F2A), Color(0xFF3E2723)),
                        startY = 0f, endY = size.height
                    )
                )
                // Вход в нору
                drawOval(
                    Color(0xFF0F0700),
                    topLeft = Offset(size.width * 0.22f, size.height * 0.15f),
                    size = Size(size.width * 0.56f, size.height * 0.42f)
                )
                drawOval(
                    Color.Black.copy(alpha = 0.6f),
                    topLeft = Offset(size.width * 0.25f, size.height * 0.18f),
                    size = Size(size.width * 0.50f, size.height * 0.36f),
                    style = Stroke(width = 1.5f)
                )
                // Маленькие травинки сбоку
                for (i in 0..2) {
                    val gx = size.width * (0.05f + 0.1f * i)
                    drawLine(
                        Color(0xFF4E342E),
                        start = Offset(gx, size.height * 0.95f),
                        end = Offset(gx, size.height * 0.75f),
                        strokeWidth = 2f
                    )
                }
                for (i in 0..2) {
                    val gx = size.width * (0.85f + 0.05f * i)
                    drawLine(
                        Color(0xFF4E342E),
                        start = Offset(gx, size.height * 0.95f),
                        end = Offset(gx, size.height * 0.75f),
                        strokeWidth = 2f
                    )
                }
            }

            // Колобок выскакивает (анимация масштаба)
            val kolobokScale = remember { Animatable(0f) }
            LaunchedEffect(isKolobokOut) {
                if (isKolobokOut) {
                    kolobokScale.snapTo(0.3f)
                    kolobokScale.animateTo(
                        targetValue = 1f,
                        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy)
                    )
                } else {
                    kolobokScale.animateTo(0f, tween(160))
                }
            }
            if (kolobokScale.value > 0.02f) {
                Box(
                    modifier = Modifier
                        .size(54.dp)
                        .offset(y = (-32).dp)
                        .graphicsLayer {
                            scaleX = kolobokScale.value
                            scaleY = kolobokScale.value
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Canvas(modifier = Modifier.fillMaxSize()) {
                        drawKolobok(this.size.width, this.size.height)
                    }
                }
            }

            // Feedback overlay
            feedback?.let { (_, hit) ->
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .offset(y = (-40).dp)
                        .clip(CircleShape)
                        .background(
                            if (hit) Color(0xFF66BB6A).copy(alpha = 0.85f)
                            else Color(0xFFE57373).copy(alpha = 0.85f)
                        )
                        .border(2.dp, Color.White.copy(alpha = 0.55f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        if (hit) "✓" else "✗",
                        color = Color.White,
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

private fun DrawScope.drawKolobok(w: Float, h: Float) {
    val cx = w / 2f
    val cy = h / 2f
    val r = minOf(w, h) / 2f * 0.9f

    drawOval(
        Color.Black.copy(alpha = 0.3f),
        topLeft = Offset(cx - r * 0.9f, cy + r * 0.6f),
        size = Size(r * 1.8f, r * 0.3f)
    )

    drawCircle(
        Brush.radialGradient(
            colors = listOf(Color(0xFFFFE082), Color(0xFFD4A017), Color(0xFF6D4C00)),
            center = Offset(cx - r * 0.25f, cy - r * 0.25f),
            radius = r * 1.4f
        ),
        radius = r,
        center = Offset(cx, cy)
    )

    drawCircle(
        Color.White.copy(alpha = 0.5f),
        radius = r * 0.25f,
        center = Offset(cx - r * 0.3f, cy - r * 0.35f)
    )

    // Глаза
    drawCircle(Color.Black, radius = r * 0.10f, center = Offset(cx - r * 0.28f, cy - r * 0.10f))
    drawCircle(Color.Black, radius = r * 0.10f, center = Offset(cx + r * 0.28f, cy - r * 0.10f))
    drawCircle(Color.White, radius = r * 0.04f, center = Offset(cx - r * 0.25f, cy - r * 0.13f))
    drawCircle(Color.White, radius = r * 0.04f, center = Offset(cx + r * 0.31f, cy - r * 0.13f))

    // Улыбка
    val smile = Path().apply {
        moveTo(cx - r * 0.35f, cy + r * 0.18f)
        quadraticBezierTo(cx, cy + r * 0.45f, cx + r * 0.35f, cy + r * 0.18f)
    }
    drawPath(smile, color = Color(0xFF3E1A00), style = Stroke(width = r * 0.08f))

    drawSparkle(Offset(cx + r * 1.0f, cy - r * 0.7f), r * 0.14f, color = Color(0xFFFFD54F))
    drawSparkle(Offset(cx - r * 1.05f, cy + r * 0.3f), r * 0.12f, color = Color(0xFFFFD54F))
}

private const val NORA_COUNT = 3
private const val TOTAL_ATTEMPTS = 7
private const val WAIT_MIN_MS = 450L
private const val WAIT_MAX_MS = 1300L
private const val REACTION_WINDOW_MS = 1050L
private const val FEEDBACK_MS = 380L
