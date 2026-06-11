package com.s0dolamby.game.presentation.minigame.boyarin

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.PersonaArchetype
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

private enum class Emblem { STAR, CROSS, CROWN }

/**
 * Печать. Цвет/эмблема/кольца у ВСЕХ печатей поля одинаковые (как у эталона) —
 * подделка выдаёт себя только освещением воска:
 * - [lightAngleDeg] — откуда падает свет (куда смещён центр градиента и блик).
 *   У эталона 225° (верх-лево). У подделок свет повёрнут на 90/180/270°.
 * - [inverted] — у подделки light/dark в градиенте поменяны местами
 *   (воск «выпуклый» наоборот — вдавленный).
 */
private data class Seal(
    val wax: WaxColor,
    val emblem: Emblem,
    val doubleRing: Boolean,
    val lightAngleDeg: Float = ETALON_LIGHT_ANGLE,
    val inverted: Boolean = false
)

private data class SealCell(
    val seal: Seal,
    val isForged: Boolean,
    var found: Boolean = false
)

private fun forgeOf(real: Seal, rng: Random): Seal {
    return if (rng.nextBoolean()) {
        // Свет повёрнут на 90/180/270°
        val delta = listOf(90f, 180f, 270f).random(rng)
        real.copy(lightAngleDeg = (real.lightAngleDeg + delta) % 360f)
    } else {
        // Градиент инвертирован: светлый центр → тёмный центр
        real.copy(inverted = true)
    }
}

private fun buildField(seed: Long): Pair<Seal, List<SealCell>> {
    val rng = Random(seed)
    val etalon = Seal(
        wax = WaxColor.values().let { it[rng.nextInt(it.size)] },
        emblem = Emblem.values().let { it[rng.nextInt(it.size)] },
        doubleRing = rng.nextBoolean()
    )
    val cells = mutableListOf<SealCell>()
    repeat(TOTAL_SEALS - FORGED_COUNT) { cells += SealCell(etalon, isForged = false) }
    repeat(FORGED_COUNT) {
        var forged: Seal
        do { forged = forgeOf(etalon, rng) } while (forged == etalon)
        cells += SealCell(forged, isForged = true)
    }
    return etalon to cells.shuffled(rng)
}

// ─── экран ──────────────────────────────────────────────────────────────

@Composable
fun BoyarinCharterScreen(
    onBack: () -> Unit,
    onComplete: ((MinigameOutcome) -> Unit)? = null
) {
    var seed by remember { mutableStateOf(System.currentTimeMillis()) }
    val (etalon, initialCells) = remember(seed) { buildField(seed) }
    val cells = remember(seed) { mutableStateListOf<SealCell>().apply { addAll(initialCells) } }
    var foundCount by remember(seed) { mutableStateOf(0) }
    var errors by remember(seed) { mutableStateOf(0) }
    var stage by remember(seed) { mutableStateOf(MinigameStage.PLAY) }
    var secondsLeft by remember(seed) { mutableStateOf(TIME_BUDGET_S) }
    var wrongFlashIdx by remember(seed) { mutableStateOf(-1) }

    LaunchedEffect(seed) {
        while (secondsLeft > 0 && stage == MinigameStage.PLAY) {
            delay(1000); secondsLeft -= 1
        }
        if (stage == MinigameStage.PLAY) stage = MinigameStage.RESULT
    }

    LaunchedEffect(wrongFlashIdx) {
        if (wrongFlashIdx >= 0) {
            delay(420)
            wrongFlashIdx = -1
        }
    }

    val outcome: MinigameOutcome? = if (stage == MinigameStage.RESULT) {
        val timeout = foundCount < FORGED_COUNT
        MinigameOutcome(errorCount = errors, timeoutReached = timeout && errors == 0)
    } else null

    fun handleTap(idx: Int) {
        if (stage != MinigameStage.PLAY) return
        val cell = cells.getOrNull(idx) ?: return
        if (cell.found) return
        if (cell.isForged) {
            cells[idx] = cell.copy(found = true)
            foundCount += 1
            if (foundCount == FORGED_COUNT) stage = MinigameStage.RESULT
        } else {
            errors += 1
            wrongFlashIdx = idx
        }
    }

    fun restart() {
        seed = System.currentTimeMillis()
        foundCount = 0
        errors = 0
        secondsLeft = TIME_BUDGET_S
        wrongFlashIdx = -1
        stage = MinigameStage.PLAY
    }

    MinigameShell(
        archetype = PersonaArchetype.BOYARIN,
        gameTitle = "Купеческая грамота",
        stage = stage,
        secondsLeft = if (stage == MinigameStage.RESULT) null else secondsLeft.coerceAtLeast(0),
        outcome = outcome,
        onBack = onBack,
        onAgain = { restart() },
        onClose = onBack,
        onComplete = onComplete
    ) {
        if (stage == MinigameStage.PLAY) {
            // Эталон + счёт
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF2A1840).copy(alpha = 0.8f))
                        .border(2.dp, ArchetypePalette[PersonaArchetype.BOYARIN].primary, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Canvas(modifier = Modifier.fillMaxSize().padding(6.dp)) {
                        drawSeal(etalon, Offset(this.size.width / 2f, this.size.height / 2f),
                            this.size.minDimension / 2f * 0.92f)
                    }
                }
                Column {
                    Text(
                        "Подлинная печать · следи за бликом",
                        color = ArchetypePalette[PersonaArchetype.BOYARIN].primary,
                        fontSize = 12.sp, fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        "Подделок найдено: $foundCount / $FORGED_COUNT",
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
                "Найдено подделок: $foundCount из $FORGED_COUNT",
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

private fun DrawScope.drawSeal(seal: Seal, center: Offset, radius: Float) {
    // Инверсия меняет местами light/dark — воск выглядит «вдавленным»
    val light = if (seal.inverted) seal.wax.dark else seal.wax.light
    val dark = if (seal.inverted) seal.wax.light else seal.wax.dark

    // Точка, откуда падает свет — определяет центр градиента и позицию блика
    val lightRad = Math.toRadians(seal.lightAngleDeg.toDouble())
    val lightOffset = Offset(
        center.x + (radius * 0.30f * cos(lightRad)).toFloat(),
        center.y + (radius * 0.30f * sin(lightRad)).toFloat()
    )

    // Восковая клякса — волнистый край из 12 лепестков
    val blobPath = Path().apply {
        val petals = 12
        for (i in 0..petals) {
            val a = Math.PI * 2 * i / petals
            val wobble = if (i % 2 == 0) 1f else 0.88f
            val x = center.x + (radius * wobble * cos(a)).toFloat()
            val y = center.y + (radius * wobble * sin(a)).toFloat()
            if (i == 0) moveTo(x, y) else lineTo(x, y)
        }
        close()
    }
    drawPath(
        blobPath,
        brush = Brush.radialGradient(
            colors = listOf(light, dark),
            center = lightOffset,
            radius = radius * 1.5f
        )
    )

    // Внешнее кольцо оттиска
    drawCircle(
        dark.copy(alpha = 0.9f),
        radius = radius * 0.72f,
        center = center,
        style = Stroke(width = radius * 0.07f)
    )
    // Второе кольцо (признак doubleRing)
    if (seal.doubleRing) {
        drawCircle(
            dark.copy(alpha = 0.7f),
            radius = radius * 0.58f,
            center = center,
            style = Stroke(width = radius * 0.045f)
        )
    }

    // Эмблема в центре
    val emblemColor = dark.copy(alpha = 0.95f)
    when (seal.emblem) {
        Emblem.STAR -> {
            val starPath = Path().apply {
                for (i in 0 until 10) {
                    val angle = Math.PI * i / 5 - Math.PI / 2
                    val r = if (i % 2 == 0) radius * 0.42f else radius * 0.18f
                    val x = center.x + (r * cos(angle)).toFloat()
                    val y = center.y + (r * sin(angle)).toFloat()
                    if (i == 0) moveTo(x, y) else lineTo(x, y)
                }
                close()
            }
            drawPath(starPath, color = emblemColor)
        }
        Emblem.CROSS -> {
            val arm = radius * 0.40f
            val thick = radius * 0.13f
            drawRect(emblemColor,
                topLeft = Offset(center.x - thick / 2f, center.y - arm),
                size = androidx.compose.ui.geometry.Size(thick, arm * 2))
            drawRect(emblemColor,
                topLeft = Offset(center.x - arm, center.y - thick / 2f),
                size = androidx.compose.ui.geometry.Size(arm * 2, thick))
        }
        Emblem.CROWN -> {
            val crownPath = Path().apply {
                val baseY = center.y + radius * 0.22f
                val topY = center.y - radius * 0.30f
                val halfW = radius * 0.38f
                moveTo(center.x - halfW, baseY)
                lineTo(center.x - halfW, topY + radius * 0.18f)
                lineTo(center.x - halfW * 0.45f, baseY - radius * 0.18f)
                lineTo(center.x, topY)
                lineTo(center.x + halfW * 0.45f, baseY - radius * 0.18f)
                lineTo(center.x + halfW, topY + radius * 0.18f)
                lineTo(center.x + halfW, baseY)
                close()
            }
            drawPath(crownPath, color = emblemColor)
        }
    }

    // Блик на воске — со стороны источника света
    val glintRad = Math.toRadians(seal.lightAngleDeg.toDouble())
    drawCircle(
        Color.White.copy(alpha = 0.32f),
        radius = radius * 0.13f,
        center = Offset(
            center.x + (radius * 0.55f * cos(glintRad)).toFloat(),
            center.y + (radius * 0.55f * sin(glintRad)).toFloat()
        )
    )
}

private const val GRID_COLS = 4
private const val TOTAL_SEALS = 24
private const val FORGED_COUNT = 8
private const val TIME_BUDGET_S = 45
private const val ETALON_LIGHT_ANGLE = 225f   // свет сверху-слева
