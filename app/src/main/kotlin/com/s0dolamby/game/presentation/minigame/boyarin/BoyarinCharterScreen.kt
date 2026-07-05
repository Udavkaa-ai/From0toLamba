package com.s0dolamby.game.presentation.minigame.boyarin

import com.s0dolamby.game.presentation.feedback.pausableDelay
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.minigame.common.ArchetypePalette
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import com.s0dolamby.game.presentation.minigame.common.MinigameShell
import com.s0dolamby.game.presentation.minigame.common.MinigameStage
import kotlinx.coroutines.delay
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

// ─── модель печати ──────────────────────────────────────────────────────

private enum class WaxColor(val light: Color, val dark: Color) {
    CRIMSON(Color(0xFFD32F2F), Color(0xFF7B1212)),
    EMERALD(Color(0xFF388E3C), Color(0xFF1B4D1E)),
    AMBER(Color(0xFFF9A825), Color(0xFF8A5E00))
}

private enum class Emblem { STAR, CROSS, CROWN, SUN, LILY }

/**
 * Печать v2. У КАЖДОЙ печати поля свой случайный контур воска ([blobSeed]) —
 * легитимный «шум», по которому подделку не определить. Подделка отличается
 * ОДНИМ тонким признаком от эталона:
 *  - [lightAngleDeg] — свет повёрнут на ±30–60° (не 90+, ловить труднее);
 *  - [inverted] — воск «вдавлен» (редкий, самый заметный признак);
 *  - [glintStrength] — блик слегка затёрт (0.55 против 1.0);
 *  - [emblemScale] — эмблема чуть меньше/больше (0.82 / 1.18);
 *  - [ringWeight] — оттиск кольца тоньше/жирнее (0.6 / 1.5);
 *  - [emblemTiltDeg] — эмблема слегка повёрнута (±14°);
 *  - [hueShift] — воск чуть теплее/холоднее оттенком (±1).
 */
private data class Seal(
    val wax: WaxColor,
    val emblem: Emblem,
    val doubleRing: Boolean,
    val lightAngleDeg: Float = 225f,
    val inverted: Boolean = false,
    val glintStrength: Float = 1f,
    val emblemScale: Float = 1f,
    val ringWeight: Float = 1f,
    val emblemTiltDeg: Float = 0f,
    val hueShift: Float = 0f,
    val blobSeed: Int = 0
)

private data class SealCell(
    val seal: Seal,
    val isForged: Boolean,
    var found: Boolean = false
)

private fun forgeOf(real: Seal, rng: Random): Seal {
    return when (rng.nextInt(7)) {
        0 -> {
            val delta = (30f + rng.nextFloat() * 30f) * (if (rng.nextBoolean()) 1 else -1)
            real.copy(lightAngleDeg = (real.lightAngleDeg + delta + 360f) % 360f)
        }
        1 -> real.copy(inverted = true)
        2 -> real.copy(glintStrength = 0.55f)
        3 -> real.copy(emblemScale = if (rng.nextBoolean()) 0.82f else 1.18f)
        4 -> real.copy(ringWeight = if (rng.nextBoolean()) 0.6f else 1.5f)
        5 -> real.copy(emblemTiltDeg = (if (rng.nextBoolean()) 1 else -1) * 14f)
        else -> real.copy(hueShift = if (rng.nextBoolean()) 1f else -1f)
    }
}

private fun buildField(seed: Long): Triple<Seal, List<SealCell>, Int> {
    val rng = Random(seed)
    val etalon = Seal(
        wax = WaxColor.values().let { it[rng.nextInt(it.size)] },
        emblem = Emblem.values().let { it[rng.nextInt(it.size)] },
        doubleRing = rng.nextBoolean(),
        // Свет каждой игры падает с новой стороны
        lightAngleDeg = rng.nextInt(8) * 45f,
        blobSeed = rng.nextInt()
    )
    // Подделок мало и КАЖДЫЙ РАЗ разное количество — пересчитывать
    // по шаблону «всегда 8» больше не выйдет
    val forgedCount = rng.nextInt(FORGED_MIN, FORGED_MAX + 1)
    val cells = mutableListOf<SealCell>()
    repeat(TOTAL_SEALS - forgedCount) {
        // Контур воска у каждой печати свой — легитимный шум
        cells += SealCell(etalon.copy(blobSeed = rng.nextInt()), isForged = false)
    }
    repeat(forgedCount) {
        var forged: Seal
        do { forged = forgeOf(etalon, rng) } while (forged == etalon)
        cells += SealCell(forged.copy(blobSeed = rng.nextInt()), isForged = true)
    }
    return Triple(etalon, cells.shuffled(rng), forgedCount)
}

// ─── экран ──────────────────────────────────────────────────────────────

@Composable
fun BoyarinCharterScreen(
    onBack: () -> Unit,
    onComplete: ((MinigameOutcome) -> Unit)? = null
) {
    var seed by remember { mutableStateOf(System.currentTimeMillis()) }
    val (etalon, initialCells, forgedTotal) = remember(seed) { buildField(seed) }
    val cells = remember(seed) { mutableStateListOf<SealCell>().apply { addAll(initialCells) } }
    var foundCount by remember(seed) { mutableStateOf(0) }
    var errors by remember(seed) { mutableStateOf(0) }
    // Сначала — фаза запоминания: эталон крупно, потом прячется.
    // Раньше образец висел перед глазами всю игру и сравнение было
    // механическим — тестировщики жаловались, что слишком просто.
    var stage by remember(seed) { mutableStateOf(MinigameStage.MEMORIZE) }
    var memorizeLeft by remember(seed) { mutableStateOf(MEMORIZE_S) }
    var secondsLeft by remember(seed) { mutableStateOf(TIME_BUDGET_S) }
    var wrongFlashIdx by remember(seed) { mutableStateOf(-1) }

    LaunchedEffect(seed, stage) {
        when (stage) {
            MinigameStage.MEMORIZE -> {
                while (memorizeLeft > 0 && stage == MinigameStage.MEMORIZE) {
                    pausableDelay(1000); memorizeLeft -= 1
                }
                if (stage == MinigameStage.MEMORIZE) stage = MinigameStage.PLAY
            }
            MinigameStage.PLAY -> {
                while (secondsLeft > 0 && stage == MinigameStage.PLAY) {
                    pausableDelay(1000); secondsLeft -= 1
                }
                if (stage == MinigameStage.PLAY) stage = MinigameStage.RESULT
            }
            else -> Unit
        }
    }

    LaunchedEffect(wrongFlashIdx) {
        if (wrongFlashIdx >= 0) {
            delay(420)
            wrongFlashIdx = -1
        }
    }

    val outcome: MinigameOutcome? = if (stage == MinigameStage.RESULT) {
        val timeout = foundCount < forgedTotal
        MinigameOutcome(errorCount = errors, timeoutReached = timeout && errors == 0)
    } else null

    fun handleTap(idx: Int) {
        if (stage != MinigameStage.PLAY) return
        val cell = cells.getOrNull(idx) ?: return
        if (cell.found) return
        if (cell.isForged) {
            cells[idx] = cell.copy(found = true)
            foundCount += 1
            if (foundCount == forgedTotal) stage = MinigameStage.RESULT
        } else {
            errors += 1
            wrongFlashIdx = idx
        }
    }

    fun restart() {
        seed = System.currentTimeMillis()
        foundCount = 0
        errors = 0
        memorizeLeft = MEMORIZE_S
        secondsLeft = TIME_BUDGET_S
        wrongFlashIdx = -1
        stage = MinigameStage.MEMORIZE
    }

    MinigameShell(
        archetype = PersonaArchetype.BOYARIN,
        gameTitle = Strings.t("minigame.title.charter"),
        stage = stage,
        secondsLeft = when (stage) {
            MinigameStage.MEMORIZE -> memorizeLeft.coerceAtLeast(0)
            MinigameStage.PLAY -> secondsLeft.coerceAtLeast(0)
            MinigameStage.RESULT -> null
        },
        outcome = outcome,
        onBack = onBack,
        onAgain = { restart() },
        onClose = onBack,
        onComplete = onComplete
    ) {
        if (stage == MinigameStage.MEMORIZE) {
            // Фаза запоминания — эталон крупно, потом исчезает
            Spacer(Modifier.height(8.dp))
            Text(
                "Запомни подлинную печать — блик и объём воска",
                color = ArchetypePalette[PersonaArchetype.BOYARIN].primary,
                fontSize = 14.sp, fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(16.dp))
            Box(
                modifier = Modifier
                    .size(160.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF2A1840).copy(alpha = 0.85f))
                    .border(3.dp, ArchetypePalette[PersonaArchetype.BOYARIN].primary, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Canvas(modifier = Modifier.fillMaxSize().padding(14.dp)) {
                    drawSeal(etalon, Offset(this.size.width / 2f, this.size.height / 2f),
                        this.size.minDimension / 2f * 0.92f)
                }
            }
            Spacer(Modifier.height(16.dp))
            Text(
                "Запомни печать ЦЕЛИКОМ: сторону и яркость блика, размер и наклон герба, толщину кольца, оттенок воска.\nПодделка врёт ровно в одном — а контур воска у всех печатей разный, он не в счёт.",
                color = Color.White.copy(alpha = 0.75f),
                fontSize = 13.sp, lineHeight = 19.sp,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
            Spacer(Modifier.height(18.dp))
            Button(
                onClick = { stage = MinigameStage.PLAY },
                colors = ButtonDefaults.buttonColors(
                    containerColor = ArchetypePalette[PersonaArchetype.BOYARIN].primary,
                    contentColor = Color(0xFF1A0A00)
                )
            ) {
                Text("Запомнил — к грамотам", fontWeight = FontWeight.SemiBold)
            }
        }
        if (stage == MinigameStage.PLAY) {
            // Эталон спрятан — ищем подделки по памяти
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Column {
                    Text(
                        "Печать в памяти — ищи, что «не так», подделка врёт в одном",
                        color = ArchetypePalette[PersonaArchetype.BOYARIN].primary,
                        fontSize = 12.sp, fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        "Подделок найдено: $foundCount / $forgedTotal",
                        color = Color.White.copy(alpha = 0.8f), fontSize = 13.sp
                    )
                    Text(
                        "Ошибок: $errors",
                        color = Color.White.copy(alpha = 0.55f), fontSize = 11.sp
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            // Сетка 4×6 со скроллом если не влезает
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                cells.chunked(GRID_COLS).forEachIndexed { rowIdx, rowCells ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        rowCells.forEachIndexed { colIdx, cell ->
                            val idx = rowIdx * GRID_COLS + colIdx
                            SealCellView(
                                cell = cell,
                                wrongFlash = wrongFlashIdx == idx,
                                onClick = { handleTap(idx) }
                            )
                        }
                    }
                }
            }
        }
        if (stage == MinigameStage.RESULT) {
            Spacer(Modifier.height(20.dp))
            Text(
                "Найдено подделок: $foundCount из $forgedTotal",
                color = Color.White, fontSize = 14.sp
            )
            Text(
                "Напрасных обвинений: $errors",
                color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp
            )
        }
    }
}

@Composable
private fun SealCellView(cell: SealCell, wrongFlash: Boolean, onClick: () -> Unit) {
    val foundScale = remember(cell.found) { Animatable(1f) }
    LaunchedEffect(cell.found) {
        if (cell.found) {
            foundScale.animateTo(1.15f, tween(150))
            foundScale.animateTo(1f, tween(200))
        }
    }
    val borderColor = when {
        cell.found -> Color(0xFFFF6E5C)
        wrongFlash -> Color(0xFFEF5350)
        else -> Color.White.copy(alpha = 0.12f)
    }
    Box(
        modifier = Modifier
            .size(74.dp)
            .scale(foundScale.value)
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (wrongFlash) Color(0xFF4A1010)
                else Color(0xFF1A0F30).copy(alpha = 0.75f)
            )
            .border(if (cell.found || wrongFlash) 2.dp else 1.dp, borderColor, RoundedCornerShape(12.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize().padding(8.dp)) {
            drawSeal(cell.seal, Offset(this.size.width / 2f, this.size.height / 2f),
                this.size.minDimension / 2f * 0.95f)
        }
        if (cell.found) {
            Text(
                "✗",
                color = Color(0xFFFF6E5C),
                fontSize = 38.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

// ─── рисование печати ──────────────────────────────────────────────────

/** Лёгкий сдвиг оттенка воска: + теплее (янтарь), − холоднее (сталь). */
private fun shifted(color: Color, hueShift: Float): Color {
    if (hueShift == 0f) return color
    val target = if (hueShift > 0) Color(0xFFFFB74D) else Color(0xFF90A4AE)
    val t = 0.16f * kotlin.math.abs(hueShift)
    return Color(
        red = color.red + (target.red - color.red) * t,
        green = color.green + (target.green - color.green) * t,
        blue = color.blue + (target.blue - color.blue) * t,
        alpha = color.alpha
    )
}

private fun DrawScope.drawSeal(seal: Seal, center: Offset, radius: Float) {
    // Инверсия меняет местами light/dark — воск выглядит «вдавленным»
    val baseLight = shifted(seal.wax.light, seal.hueShift)
    val baseDark = shifted(seal.wax.dark, seal.hueShift)
    val light = if (seal.inverted) baseDark else baseLight
    val dark = if (seal.inverted) baseLight else baseDark
    val mid = Color(
        red = (light.red + dark.red) / 2f,
        green = (light.green + dark.green) / 2f,
        blue = (light.blue + dark.blue) / 2f
    )

    // Точка, откуда падает свет — определяет центр градиента и позицию блика
    val lightRad = Math.toRadians(seal.lightAngleDeg.toDouble())
    val lightOffset = Offset(
        center.x + (radius * 0.30f * cos(lightRad)).toFloat(),
        center.y + (radius * 0.30f * sin(lightRad)).toFloat()
    )

    // Восковая клякса: у каждой печати СВОЙ неровный контур (blobSeed) —
    // 14 лепестков со случайным «расплывом». Это шум, не признак подделки.
    val blobRng = Random(seal.blobSeed)
    val petals = 14
    val wobbles = FloatArray(petals + 1) { 0.84f + blobRng.nextFloat() * 0.18f }
    wobbles[petals] = wobbles[0]
    val blobPath = Path().apply {
        for (i in 0..petals) {
            val a = Math.PI * 2 * i / petals
            val w = wobbles[i]
            val x = center.x + (radius * w * cos(a)).toFloat()
            val y = center.y + (radius * w * sin(a)).toFloat()
            if (i == 0) moveTo(x, y) else lineTo(x, y)
        }
        close()
    }
    // Тень кляксы — воск лежит на грамоте
    drawPath(blobPath, color = Color.Black.copy(alpha = 0.35f),
        style = Stroke(width = radius * 0.10f))
    // Трёхстопный градиент — воск выглядит объёмнее
    drawPath(
        blobPath,
        brush = Brush.radialGradient(
            colors = listOf(light, mid, dark),
            center = lightOffset,
            radius = radius * 1.5f
        )
    )

    // Тиснёный обод: мелкие зубчики по краю оттиска
    val teethR = radius * 0.80f
    for (i in 0 until 24) {
        val a = Math.PI * 2 * i / 24
        drawCircle(
            dark.copy(alpha = 0.5f),
            radius = radius * 0.028f,
            center = Offset(
                center.x + (teethR * cos(a)).toFloat(),
                center.y + (teethR * sin(a)).toFloat()
            )
        )
    }

    // Кольца оттиска — толщина зависит от ringWeight (признак подделки)
    drawCircle(
        dark.copy(alpha = 0.9f),
        radius = radius * 0.70f,
        center = center,
        style = Stroke(width = radius * 0.06f * seal.ringWeight)
    )
    if (seal.doubleRing) {
        drawCircle(
            dark.copy(alpha = 0.7f),
            radius = radius * 0.57f,
            center = center,
            style = Stroke(width = radius * 0.04f * seal.ringWeight)
        )
    }

    // Эмблема в центре — с наклоном и масштабом (тонкие признаки подделки)
    val emblemColor = dark.copy(alpha = 0.95f)
    val er = radius * seal.emblemScale
    withTransform({
        rotate(seal.emblemTiltDeg, pivot = center)
    }) {
        when (seal.emblem) {
            Emblem.STAR -> {
                val starPath = Path().apply {
                    for (i in 0 until 10) {
                        val angle = Math.PI * i / 5 - Math.PI / 2
                        val r = if (i % 2 == 0) er * 0.42f else er * 0.18f
                        val x = center.x + (r * cos(angle)).toFloat()
                        val y = center.y + (r * sin(angle)).toFloat()
                        if (i == 0) moveTo(x, y) else lineTo(x, y)
                    }
                    close()
                }
                drawPath(starPath, color = emblemColor)
            }
            Emblem.CROSS -> {
                val arm = er * 0.40f
                val thick = er * 0.13f
                drawRect(emblemColor,
                    topLeft = Offset(center.x - thick / 2f, center.y - arm),
                    size = androidx.compose.ui.geometry.Size(thick, arm * 2))
                drawRect(emblemColor,
                    topLeft = Offset(center.x - arm, center.y - thick / 2f),
                    size = androidx.compose.ui.geometry.Size(arm * 2, thick))
            }
            Emblem.CROWN -> {
                val crownPath = Path().apply {
                    val baseY = center.y + er * 0.22f
                    val topY = center.y - er * 0.30f
                    val halfW = er * 0.38f
                    moveTo(center.x - halfW, baseY)
                    lineTo(center.x - halfW, topY + er * 0.18f)
                    lineTo(center.x - halfW * 0.45f, baseY - er * 0.18f)
                    lineTo(center.x, topY)
                    lineTo(center.x + halfW * 0.45f, baseY - er * 0.18f)
                    lineTo(center.x + halfW, topY + er * 0.18f)
                    lineTo(center.x + halfW, baseY)
                    close()
                }
                drawPath(crownPath, color = emblemColor)
            }
            Emblem.SUN -> {
                // Солнце: диск + 8 лучей
                drawCircle(emblemColor, radius = er * 0.20f, center = center)
                for (i in 0 until 8) {
                    val a = Math.PI * 2 * i / 8
                    drawLine(
                        emblemColor,
                        start = Offset(
                            center.x + (er * 0.27f * cos(a)).toFloat(),
                            center.y + (er * 0.27f * sin(a)).toFloat()
                        ),
                        end = Offset(
                            center.x + (er * 0.43f * cos(a)).toFloat(),
                            center.y + (er * 0.43f * sin(a)).toFloat()
                        ),
                        strokeWidth = er * 0.06f
                    )
                }
            }
            Emblem.LILY -> {
                // Трилистник-лилия: три лепестка-капли из центра
                for (i in 0 until 3) {
                    val a = Math.PI * 2 * i / 3 - Math.PI / 2
                    val tipX = center.x + (er * 0.42f * cos(a)).toFloat()
                    val tipY = center.y + (er * 0.42f * sin(a)).toFloat()
                    val perp = a + Math.PI / 2
                    val w = er * 0.14f
                    val petal = Path().apply {
                        moveTo(center.x, center.y)
                        quadraticBezierTo(
                            center.x + (w * cos(perp)).toFloat() + (er * 0.2f * cos(a)).toFloat(),
                            center.y + (w * sin(perp)).toFloat() + (er * 0.2f * sin(a)).toFloat(),
                            tipX, tipY
                        )
                        quadraticBezierTo(
                            center.x - (w * cos(perp)).toFloat() + (er * 0.2f * cos(a)).toFloat(),
                            center.y - (w * sin(perp)).toFloat() + (er * 0.2f * sin(a)).toFloat(),
                            center.x, center.y
                        )
                        close()
                    }
                    drawPath(petal, color = emblemColor)
                }
                drawCircle(emblemColor, radius = er * 0.08f, center = center)
            }
        }
    }

    // Двойной блик со стороны света: основной + малый спутник.
    // У «затёртых» подделок оба тусклее (glintStrength).
    val glintRad = Math.toRadians(seal.lightAngleDeg.toDouble())
    val gx = center.x + (radius * 0.55f * cos(glintRad)).toFloat()
    val gy = center.y + (radius * 0.55f * sin(glintRad)).toFloat()
    drawCircle(
        Color.White.copy(alpha = 0.34f * seal.glintStrength),
        radius = radius * 0.13f,
        center = Offset(gx, gy)
    )
    drawCircle(
        Color.White.copy(alpha = 0.22f * seal.glintStrength),
        radius = radius * 0.06f,
        center = Offset(
            center.x + (radius * 0.38f * cos(glintRad + 0.5)).toFloat(),
            center.y + (radius * 0.38f * sin(glintRad + 0.5)).toFloat()
        )
    )
}

private const val GRID_COLS = 4
// Поле меньше (печати крупнее), подделок мало и разное число каждый раз
private const val TOTAL_SEALS = 20
private const val FORGED_MIN = 3
private const val FORGED_MAX = 6
private const val MEMORIZE_S = 6
// 45с хватало на перебор всех печатей — теперь времени впритык
private const val TIME_BUDGET_S = 30
