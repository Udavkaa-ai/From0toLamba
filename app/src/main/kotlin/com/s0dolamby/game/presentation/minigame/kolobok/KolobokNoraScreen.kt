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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.minigame.common.ArchetypePalette
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import com.s0dolamby.game.presentation.minigame.common.MinigameShell
import com.s0dolamby.game.presentation.minigame.common.MinigameStage
import com.s0dolamby.game.presentation.minigame.common.drawSparkle
import kotlinx.coroutines.delay
import kotlin.random.Random

// ─── кто выскакивает из норы ────────────────────────────────────────────

private enum class NoraGuest(val emoji: String, val label: String) {
    HARE("🐰", "заяц"),
    WOLF("🐺", "волк"),
    BEAR("🐻", "медведь"),
    FOX("🦊", "лиса"),
    KOLOBOK("", "колобок")   // рисуется Canvas, не эмодзи
}

private val ANIMALS = listOf(NoraGuest.HARE, NoraGuest.WOLF, NoraGuest.BEAR, NoraGuest.FOX)

@Composable
fun KolobokNoraScreen(
    onBack: () -> Unit,
    onComplete: ((MinigameOutcome) -> Unit)? = null
) {
    var seed by remember { mutableStateOf(System.currentTimeMillis()) }
    var attemptKey by remember(seed) { mutableStateOf(0) }
    var attemptIdx by remember(seed) { mutableStateOf(0) }
    var activeNora by remember(seed) { mutableStateOf(-1) }            // где сейчас гость
    var activeGuest by remember(seed) { mutableStateOf<NoraGuest?>(null) }
    var caught by remember(seed) { mutableStateOf(0) }                  // пойманные звери
    var errors by remember(seed) { mutableStateOf(0) }
    var stage by remember(seed) { mutableStateOf(MinigameStage.PLAY) }
    var feedback by remember(seed) { mutableStateOf<Pair<Int, Boolean>?>(null) }   // (idx, good?)
    var resolved by remember(seed) { mutableStateOf(false) }            // обработан ли текущий показ

    LaunchedEffect(seed, attemptKey) {
        if (stage != MinigameStage.PLAY) return@LaunchedEffect
        if (attemptIdx >= TOTAL_ATTEMPTS) {
            stage = MinigameStage.RESULT
            return@LaunchedEffect
        }
        feedback = null
        resolved = false
        delay(Random.nextLong(WAIT_MIN_MS, WAIT_MAX_MS + 1))
        val isKolobok = Random.nextDouble() < KOLOBOK_PROBABILITY
        val guest = if (isKolobok) NoraGuest.KOLOBOK else ANIMALS.random()
        val nora = Random.nextInt(NORA_COUNT)
        activeGuest = guest
        activeNora = nora
        delay(REACTION_WINDOW_MS)
        if (!resolved) {
            // Окно реакции истекло без тапа
            resolved = true
            if (guest == NoraGuest.KOLOBOK) {
                // Колобка трогать не надо — молодец, что не тапнул
                feedback = nora to true
            } else {
                // Зверь ушёл непойманным — ошибка
                errors += 1
                feedback = nora to false
            }
            activeNora = -1
            activeGuest = null
            delay(FEEDBACK_MS)
            attemptIdx += 1
            attemptKey += 1
        }
    }

    fun handleTap(idx: Int) {
        if (stage != MinigameStage.PLAY) return
        if (resolved || feedback != null) return
        val guest = activeGuest
        when {
            activeNora == idx && guest != null -> {
                resolved = true
                if (guest == NoraGuest.KOLOBOK) {
                    // Тапнул по колобку — ошибка!
                    errors += 1
                    feedback = idx to false
                } else {
                    caught += 1
                    feedback = idx to true
                }
                activeNora = -1
                activeGuest = null
            }
            else -> {
                // Тап мимо/в пустую нору — мягко игнорируем (зверь мог уже спрятаться)
            }
        }
    }

    LaunchedEffect(feedback) {
        if (feedback != null && resolved && activeNora == -1) {
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
        activeNora = -1
        activeGuest = null
        caught = 0
        errors = 0
        feedback = null
        resolved = false
        stage = MinigameStage.PLAY
    }

    MinigameShell(
        archetype = PersonaArchetype.KOLOBOK,
        gameTitle = Strings.t("minigame.title.nora"),
        stage = stage,
        secondsLeft = if (stage == MinigameStage.RESULT) null else (TOTAL_ATTEMPTS - attemptIdx),
        outcome = outcome,
        onBack = onBack,
        onAgain = { restart() },
        onClose = onBack,
        onComplete = onComplete
    ) {
        if (stage == MinigameStage.PLAY) {
            Text(
                "Лови зверей — 🐰🐺🐻🦊 — но не тронь Колобка!",
                color = Color.White.copy(alpha = 0.85f), fontSize = 14.sp
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "Поймано $caught  ·  ошибок $errors",
                color = ArchetypePalette[PersonaArchetype.KOLOBOK].primary,
                fontSize = 12.sp
            )
            Spacer(Modifier.height(16.dp))
            NoraGrid(
                activeNora = activeNora,
                activeGuest = activeGuest,
                feedback = feedback,
                onTap = ::handleTap
            )
        }
        if (stage == MinigameStage.RESULT) {
            Spacer(Modifier.height(20.dp))
            Text(
                "Поймано зверей: $caught",
                color = Color.White, fontSize = 14.sp
            )
            Text(
                "Ошибок (упущенные звери + тапы по Колобку): $errors",
                color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp
            )
        }
    }
}

@Composable
private fun NoraGrid(
    activeNora: Int,
    activeGuest: NoraGuest?,
    feedback: Pair<Int, Boolean>?,
    onTap: (Int) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        for (row in 0 until GRID_ROWS) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                for (col in 0 until GRID_COLS) {
                    val idx = row * GRID_COLS + col
                    Box(modifier = Modifier.weight(1f)) {
                        NoraSlot(
                            isActive = activeNora == idx,
                            guest = if (activeNora == idx) activeGuest else null,
                            feedback = feedback?.takeIf { it.first == idx },
                            onTap = { onTap(idx) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NoraSlot(
    isActive: Boolean,
    guest: NoraGuest?,
    feedback: Pair<Int, Boolean>?,
    onTap: () -> Unit
) {
    val guestScale = remember { Animatable(0f) }
    LaunchedEffect(isActive) {
        if (isActive) {
            guestScale.snapTo(0.3f)
            guestScale.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
        } else {
            guestScale.animateTo(0f, tween(140))
        }
    }
    // Лёгкое 3D-покачивание гостя
    val infinite = rememberInfiniteTransition(label = "guest-swing")
    val swing by infinite.animateFloat(
        initialValue = -14f, targetValue = 14f,
        animationSpec = infiniteRepeatable(
            tween(380, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "swing"
    )

    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clickable { onTap() },
        contentAlignment = Alignment.BottomCenter
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            // Земляная горка с норой
            val mound = Path().apply {
                moveTo(0f, size.height)
                quadraticBezierTo(size.width / 2f, size.height * 0.18f, size.width, size.height)
                close()
            }
            drawPath(
                mound,
                brush = Brush.verticalGradient(
                    listOf(Color(0xFF7B4F2A), Color(0xFF3E2723)),
                    startY = 0f, endY = size.height
                )
            )
            drawOval(
                Color(0xFF0F0700),
                topLeft = Offset(size.width * 0.24f, size.height * 0.30f),
                size = Size(size.width * 0.52f, size.height * 0.34f)
            )
            drawOval(
                Color.Black.copy(alpha = 0.6f),
                topLeft = Offset(size.width * 0.27f, size.height * 0.33f),
                size = Size(size.width * 0.46f, size.height * 0.28f),
                style = Stroke(width = 1.5f)
            )
        }

        // Гость
        if (guestScale.value > 0.02f && guest != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize(0.62f)
                    .offset(y = (-14).dp)
                    .graphicsLayer {
                        scaleX = guestScale.value
                        scaleY = guestScale.value
                        rotationY = swing
                        cameraDistance = 10f * density
                    },
                contentAlignment = Alignment.Center
            ) {
                if (guest == NoraGuest.KOLOBOK) {
                    Canvas(modifier = Modifier.fillMaxSize()) {
                        drawKolobok(this.size.width, this.size.height)
                    }
                } else {
                    Text(guest.emoji, fontSize = 38.sp)
                }
            }
        }

        // Feedback
        feedback?.let { (_, good) ->
            Box(
                modifier = Modifier
                    .fillMaxSize(0.55f)
                    .offset(y = (-16).dp)
                    .clip(CircleShape)
                    .background(
                        if (good) Color(0xFF66BB6A).copy(alpha = 0.85f)
                        else Color(0xFFE57373).copy(alpha = 0.85f)
                    )
                    .border(2.dp, Color.White.copy(alpha = 0.55f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    if (good) "✓" else "✗",
                    color = Color.White,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold
                )
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
    drawCircle(Color.Black, radius = r * 0.10f, center = Offset(cx - r * 0.28f, cy - r * 0.10f))
    drawCircle(Color.Black, radius = r * 0.10f, center = Offset(cx + r * 0.28f, cy - r * 0.10f))
    drawCircle(Color.White, radius = r * 0.04f, center = Offset(cx - r * 0.25f, cy - r * 0.13f))
    drawCircle(Color.White, radius = r * 0.04f, center = Offset(cx + r * 0.31f, cy - r * 0.13f))
    val smile = Path().apply {
        moveTo(cx - r * 0.35f, cy + r * 0.18f)
        quadraticBezierTo(cx, cy + r * 0.45f, cx + r * 0.35f, cy + r * 0.18f)
    }
    drawPath(smile, color = Color(0xFF3E1A00), style = Stroke(width = r * 0.08f))
    drawSparkle(Offset(cx + r * 1.0f, cy - r * 0.7f), r * 0.14f, color = Color(0xFFFFD54F))
    drawSparkle(Offset(cx - r * 1.05f, cy + r * 0.3f), r * 0.12f, color = Color(0xFFFFD54F))
}

private const val GRID_ROWS = 3
private const val GRID_COLS = 3
private const val NORA_COUNT = GRID_ROWS * GRID_COLS
private const val TOTAL_ATTEMPTS = 12

// Тайминги подогнаны под темп TG-версии (спавн каждые ~0.75с, гость виден
// ~0.9с): пауза между гостями короткая, окно реакции узкое, фидбек мгновенный.
// Тестировщики жаловались, что старые (350–1000/1000/360) ощущались вязко.
private const val KOLOBOK_PROBABILITY = 0.32
private const val WAIT_MIN_MS = 150L
private const val WAIT_MAX_MS = 450L
private const val REACTION_WINDOW_MS = 850L
private const val FEEDBACK_MS = 220L
