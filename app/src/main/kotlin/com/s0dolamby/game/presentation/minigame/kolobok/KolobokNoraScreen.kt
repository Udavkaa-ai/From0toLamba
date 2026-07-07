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
import kotlin.math.sin
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
    onComplete: ((MinigameOutcome) -> Unit)? = null,
    rank: com.s0dolamby.game.domain.model.InvestorRank =
        com.s0dolamby.game.domain.model.InvestorRank.NEWBIE
) {
    // Чем выше чин, тем короче окно реакции (850→530мс).
    val reactionWindow = remember(rank) {
        (REACTION_WINDOW_MS - com.s0dolamby.game.presentation.minigame.common.MinigameDifficulty.tier(rank) * 80L)
            .coerceAtLeast(500L)
    }
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
        delay(reactionWindow)
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

        // Гость — все морды рисуются Canvas'ом (свои спрайты, не эмодзи):
        // моргают и шевелят ушами, пока торчат из норы
        if (guestScale.value > 0.02f && guest != null) {
            val faceInfinite = rememberInfiniteTransition(label = "face-live")
            val facePhase by faceInfinite.animateFloat(
                initialValue = 0f, targetValue = 1f,
                animationSpec = infiniteRepeatable(tween(2200, easing = LinearEasing)),
                label = "facePhase"
            )
            Box(
                modifier = Modifier
                    .fillMaxSize(0.82f)
                    .offset(y = (-16).dp)
                    .graphicsLayer {
                        scaleX = guestScale.value
                        scaleY = guestScale.value
                        rotationY = swing
                        cameraDistance = 10f * density
                    },
                contentAlignment = Alignment.Center
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    when (guest) {
                        NoraGuest.KOLOBOK -> drawKolobok(this.size.width, this.size.height)
                        NoraGuest.HARE -> drawHareFace(facePhase)
                        NoraGuest.WOLF -> drawWolfFace(facePhase)
                        NoraGuest.BEAR -> drawBearFace(facePhase)
                        NoraGuest.FOX -> drawFoxFace(facePhase)
                    }
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

// ─── Морды зверей (рисованные «спрайты» с морганием и живыми ушами) ────────

/** Глаза открыты почти всегда; на ~12% цикла — моргание. */
private fun blinkOpen(phase: Float): Boolean = (phase % 1f) > 0.12f

/** Пара глаз: открытые кружки со зрачками или закрытые дуги-чёрточки. */
private fun DrawScope.drawEyes(
    cx: Float, cy: Float, dx: Float, r: Float,
    open: Boolean, iris: Color = Color.White, pupil: Color = Color(0xFF1A1A1A)
) {
    for (side in listOf(-1, 1)) {
        val ex = cx + side * dx
        if (open) {
            drawCircle(iris, radius = r, center = Offset(ex, cy))
            drawCircle(pupil, radius = r * 0.55f, center = Offset(ex, cy + r * 0.1f))
            drawCircle(Color.White, radius = r * 0.18f, center = Offset(ex - r * 0.25f, cy - r * 0.25f))
        } else {
            drawLine(pupil, Offset(ex - r, cy), Offset(ex + r, cy), strokeWidth = r * 0.5f)
        }
    }
}

private fun DrawScope.drawHareFace(phase: Float) {
    val w = size.width; val h = size.height
    val cx = w / 2f; val cy = h * 0.62f
    val r = minOf(w, h) * 0.30f
    val fur = Color(0xFFBDC7CE)
    val furDark = Color(0xFF8E9AA3)
    // Уши — длинные, покачиваются в противофазе
    val wob = sin(phase * 2 * Math.PI).toFloat() * 6f
    for (side in listOf(-1, 1)) {
        val baseX = cx + side * r * 0.45f
        val tip = Offset(baseX + side * wob, cy - r * 2.3f + side * wob * 0.4f)
        val ear = Path().apply {
            moveTo(baseX - r * 0.22f, cy - r * 0.6f)
            quadraticBezierTo(tip.x - r * 0.2f, tip.y, tip.x, tip.y)
            quadraticBezierTo(tip.x + r * 0.25f, tip.y + r * 0.4f, baseX + r * 0.25f, cy - r * 0.55f)
            close()
        }
        drawPath(ear, fur)
        drawOval(Color(0xFFF3C0CC),
            topLeft = Offset(baseX - r * 0.1f + side * wob * 0.6f, cy - r * 1.9f),
            size = Size(r * 0.28f, r * 1.1f))
    }
    // Голова
    drawCircle(fur, radius = r, center = Offset(cx, cy))
    drawCircle(furDark.copy(alpha = 0.25f), radius = r, center = Offset(cx, cy),
        style = Stroke(width = r * 0.06f))
    // Щёки
    drawCircle(Color.White.copy(alpha = 0.8f), radius = r * 0.34f, center = Offset(cx - r * 0.3f, cy + r * 0.35f))
    drawCircle(Color.White.copy(alpha = 0.8f), radius = r * 0.34f, center = Offset(cx + r * 0.3f, cy + r * 0.35f))
    drawEyes(cx, cy - r * 0.15f, r * 0.4f, r * 0.16f, blinkOpen(phase))
    // Нос + зубы
    drawCircle(Color(0xFFE58BA0), radius = r * 0.12f, center = Offset(cx, cy + r * 0.22f))
    drawRect(Color.White,
        topLeft = Offset(cx - r * 0.12f, cy + r * 0.38f),
        size = Size(r * 0.24f, r * 0.28f))
    drawLine(furDark, Offset(cx, cy + r * 0.38f), Offset(cx, cy + r * 0.66f), strokeWidth = r * 0.04f)
}

private fun DrawScope.drawWolfFace(phase: Float) {
    val w = size.width; val h = size.height
    val cx = w / 2f; val cy = h * 0.58f
    val r = minOf(w, h) * 0.34f
    val fur = Color(0xFF6E7B86)
    val furDark = Color(0xFF46525C)
    // Уши-треугольники, чуть подрагивают
    val twitch = (sin(phase * 4 * Math.PI).toFloat() * 3f)
    for (side in listOf(-1, 1)) {
        val ear = Path().apply {
            moveTo(cx + side * r * 0.35f, cy - r * 0.55f)
            lineTo(cx + side * (r * 1.05f + twitch), cy - r * 1.45f - twitch)
            lineTo(cx + side * r * 0.95f, cy - r * 0.3f)
            close()
        }
        drawPath(ear, furDark)
    }
    // Голова
    drawCircle(fur, radius = r, center = Offset(cx, cy))
    // Светлая вытянутая морда
    drawOval(Color(0xFFB9C2C9),
        topLeft = Offset(cx - r * 0.5f, cy - r * 0.05f),
        size = Size(r, r * 1.0f))
    // Злые глаза — наклонные веки
    drawEyes(cx, cy - r * 0.28f, r * 0.45f, r * 0.17f, blinkOpen(phase), iris = Color(0xFFFFD54F))
    for (side in listOf(-1, 1)) {
        drawLine(furDark,
            Offset(cx + side * r * 0.2f, cy - r * 0.55f),
            Offset(cx + side * r * 0.7f, cy - r * 0.38f),
            strokeWidth = r * 0.1f)
    }
    // Нос и пасть (приоткрывается по фазе)
    drawCircle(Color(0xFF22272B), radius = r * 0.14f, center = Offset(cx, cy + r * 0.28f))
    val jaw = (sin(phase * 2 * Math.PI).toFloat() * 0.5f + 0.5f) * r * 0.16f
    drawLine(furDark, Offset(cx, cy + r * 0.4f), Offset(cx, cy + r * 0.6f + jaw), strokeWidth = r * 0.05f)
    val mouth = Path().apply {
        moveTo(cx - r * 0.32f, cy + r * 0.55f)
        quadraticBezierTo(cx, cy + r * 0.72f + jaw, cx + r * 0.32f, cy + r * 0.55f)
    }
    drawPath(mouth, furDark, style = Stroke(width = r * 0.05f))
    // Клыки
    for (side in listOf(-1, 1)) {
        val fx = cx + side * r * 0.2f
        val fang = Path().apply {
            moveTo(fx - r * 0.05f, cy + r * 0.58f)
            lineTo(fx, cy + r * 0.78f + jaw * 0.6f)
            lineTo(fx + r * 0.05f, cy + r * 0.58f)
            close()
        }
        drawPath(fang, Color.White)
    }
}

private fun DrawScope.drawBearFace(phase: Float) {
    val w = size.width; val h = size.height
    val cx = w / 2f; val cy = h * 0.6f
    val r = minOf(w, h) * 0.36f
    val fur = Color(0xFF8A5A2B)
    val furDark = Color(0xFF5D3A17)
    // Круглые уши, слегка «дышат»
    val earPulse = 1f + sin(phase * 2 * Math.PI).toFloat() * 0.04f
    for (side in listOf(-1, 1)) {
        drawCircle(fur, radius = r * 0.4f * earPulse,
            center = Offset(cx + side * r * 0.7f, cy - r * 0.75f))
        drawCircle(Color(0xFFC49A6C), radius = r * 0.22f * earPulse,
            center = Offset(cx + side * r * 0.7f, cy - r * 0.75f))
    }
    drawCircle(fur, radius = r, center = Offset(cx, cy))
    // Светлая морда
    drawOval(Color(0xFFD9B98C),
        topLeft = Offset(cx - r * 0.45f, cy + r * 0.02f),
        size = Size(r * 0.9f, r * 0.72f))
    drawEyes(cx, cy - r * 0.22f, r * 0.4f, r * 0.14f, blinkOpen(phase + 0.4f))
    drawCircle(furDark, radius = r * 0.15f, center = Offset(cx, cy + r * 0.22f))
    val mouth = Path().apply {
        moveTo(cx - r * 0.2f, cy + r * 0.5f)
        quadraticBezierTo(cx, cy + r * 0.62f, cx + r * 0.2f, cy + r * 0.5f)
    }
    drawPath(mouth, furDark, style = Stroke(width = r * 0.05f))
}

private fun DrawScope.drawFoxFace(phase: Float) {
    val w = size.width; val h = size.height
    val cx = w / 2f; val cy = h * 0.6f
    val r = minOf(w, h) * 0.33f
    val fur = Color(0xFFE2842E)
    val furDark = Color(0xFFA85312)
    // Острые уши с тёмными кончиками, подёргиваются по очереди
    for (side in listOf(-1, 1)) {
        val tw = if (side < 0) sin(phase * 2 * Math.PI).toFloat() * 4f
                 else sin((phase + 0.5f) * 2 * Math.PI).toFloat() * 4f
        val ear = Path().apply {
            moveTo(cx + side * r * 0.3f, cy - r * 0.55f)
            lineTo(cx + side * (r * 1.0f + tw), cy - r * 1.55f - tw)
            lineTo(cx + side * r * 1.0f, cy - r * 0.25f)
            close()
        }
        drawPath(ear, fur)
        val tip = Path().apply {
            moveTo(cx + side * (r * 0.75f + tw * 0.7f), cy - r * 1.15f)
            lineTo(cx + side * (r * 1.0f + tw), cy - r * 1.55f - tw)
            lineTo(cx + side * r * 1.0f, cy - r * 0.95f)
            close()
        }
        drawPath(tip, furDark)
    }
    // Голова с острыми белыми щеками
    drawCircle(fur, radius = r, center = Offset(cx, cy))
    for (side in listOf(-1, 1)) {
        val cheek = Path().apply {
            moveTo(cx + side * r * 0.15f, cy + r * 0.1f)
            lineTo(cx + side * r * 1.05f, cy + r * 0.15f)
            lineTo(cx + side * r * 0.25f, cy + r * 0.85f)
            close()
        }
        drawPath(cheek, Color(0xFFF6EDE2))
    }
    // Хитрые прищуренные глаза
    drawEyes(cx, cy - r * 0.2f, r * 0.42f, r * 0.15f, blinkOpen(phase + 0.2f), iris = Color(0xFFFFC94D))
    // Нос на кончике мордочки
    drawCircle(Color(0xFF3A2413), radius = r * 0.12f, center = Offset(cx, cy + r * 0.42f))
    val smile = Path().apply {
        moveTo(cx - r * 0.25f, cy + r * 0.55f)
        quadraticBezierTo(cx, cy + r * 0.68f, cx + r * 0.25f, cy + r * 0.55f)
    }
    drawPath(smile, furDark, style = Stroke(width = r * 0.045f))
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
