package com.s0dolamby.game.presentation.minigame.boyarin

import com.s0dolamby.game.presentation.feedback.pausableDelay
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.InvestorRank
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.minigame.common.ArchetypePalette
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import com.s0dolamby.game.presentation.minigame.common.MinigameShell
import com.s0dolamby.game.presentation.minigame.common.MinigameStage
import kotlinx.coroutines.delay

// ─── поле печатей ─────────────────────────────────────────────────────────
//
// Движок печати перенесён из TG (см. SealArt.kt). Подлинные клетки рисуются
// РОВНО как эталон; подделка врёт в одном ВИДИМОМ признаке (форма / зверь /
// точки / кольца / оттенок / размер). Набор возможных отличий растёт с чином
// игрока — на Скоморохе только форма, у Князя все шесть.

private data class SealCell(
    val seal: Seal,
    val isForged: Boolean,
    var found: Boolean = false
)

private fun buildField(seed: Long, rank: InvestorRank): Triple<Seal, List<SealCell>, Int> {
    val seedStr = seed.toString()
    val rng = kotlin.random.Random(seed)
    val etalon = generateReferenceSeal(seedStr)
    val forgedCount = rng.nextInt(FORGED_MIN, FORGED_MAX + 1)
    val pool = RANK_MUT_POOLS[rank] ?: RANK_MUT_POOLS.getValue(InvestorRank.NEWBIE)
    val forgedIdx = (0 until TOTAL_SEALS).shuffled(rng).take(forgedCount).toSet()
    val cells = (0 until TOTAL_SEALS).map { i ->
        val forged = i in forgedIdx
        val seal = if (forged) mutateSeal(etalon, seedStr, i, pool) else etalon
        SealCell(seal, isForged = forged)
    }
    return Triple(etalon, cells, forgedCount)
}

// ─── экран ──────────────────────────────────────────────────────────────

@Composable
fun BoyarinCharterScreen(
    onBack: () -> Unit,
    onComplete: ((MinigameOutcome) -> Unit)? = null,
    /** Чин игрока — задаёт, сколько ВИДОВ отличий встречается в подделках. */
    rank: InvestorRank = InvestorRank.NEWBIE
) {
    var seed by remember { mutableStateOf(System.currentTimeMillis()) }
    val (etalon, initialCells, forgedTotal) = remember(seed) { buildField(seed, rank) }
    val cells = remember(seed) { mutableStateListOf<SealCell>().apply { addAll(initialCells) } }
    var foundCount by remember(seed) { mutableStateOf(0) }
    var errors by remember(seed) { mutableStateOf(0) }
    // Сначала — фаза запоминания: эталон крупно, потом прячется.
    var stage by remember(seed) { mutableStateOf(MinigameStage.MEMORIZE) }
    var memorizeLeft by remember(seed) { mutableStateOf(MEMORIZE_S) }
    var secondsLeft by remember(seed) { mutableStateOf(TIME_BUDGET_S) }
    var wrongFlashIdx by remember(seed) { mutableStateOf(-1) }

    // Медленное вращение клеток — печати «живут», но признаки инвариантны к
    // повороту, поэтому подделку по-прежнему видно.
    val spinTransition = rememberInfiniteTransition(label = "seal-spin")
    val spin = spinTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(18000, easing = LinearEasing), RepeatMode.Restart),
        label = "spin"
    )

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
        onComplete = onComplete,
        review = { BoyarinReviewGrid(cells, etalon) }
    ) {
        if (stage == MinigameStage.MEMORIZE) {
            // Фаза запоминания — эталон крупно и неподвижно, потом исчезает
            Spacer(Modifier.height(8.dp))
            Text(
                "Запомни подлинную печать",
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
                Canvas(modifier = Modifier.fillMaxSize().padding(18.dp)) {
                    drawSeal(etalon)
                }
            }
            Spacer(Modifier.height(16.dp))
            Text(
                "Запомни печать ЦЕЛИКОМ: форму, цвет, эмблему в центре (зверь или знак), " +
                    "число колец, точки по краю и размер оттиска.\n" +
                    "Подделка врёт ровно в одном признаке — а клетки крутятся, так что " +
                    "смотри на сами приметы, не на поворот.",
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
            // Сетка 4×N со скроллом если не влезает
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
                                spin = spin,
                                phaseDeg = (idx * 47 % 360).toFloat(),
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
private fun SealCellView(
    cell: SealCell,
    wrongFlash: Boolean,
    spin: State<Float>,
    phaseDeg: Float,
    onClick: () -> Unit
) {
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
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp)
                // Вращаем только рисунок печати, не рамку/крестик. Чтение spin.value
                // внутри graphicsLayer откладывается на фазу отрисовки — без рекомпозиции.
                .graphicsLayer { rotationZ = if (cell.found) 0f else (spin.value + phaseDeg) % 360f }
        ) {
            drawSeal(cell.seal)
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

/** Разбор: все печати; зелёная рамка — нашёл подделку, красная с «!» — пропустил. */
@Composable
private fun BoyarinReviewGrid(cells: List<SealCell>, etalon: Seal) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier.padding(bottom = 8.dp)
    ) {
        Text("🟢 нашёл", color = Success, fontSize = 11.sp)
        Text("🔴 пропустил", color = Error, fontSize = 11.sp)
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(bottom = 8.dp)
    ) {
        Text("Эталон: ", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(Color(0xFF2A1840))
                .border(2.dp, ArchetypePalette[PersonaArchetype.BOYARIN].primary, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.fillMaxSize().padding(6.dp)) {
                drawSeal(etalon)
            }
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        cells.chunked(GRID_COLS).forEach { rowCells ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                rowCells.forEach { cell ->
                    val border = when {
                        cell.isForged && cell.found -> Success
                        cell.isForged -> Error
                        else -> Color.White.copy(alpha = 0.1f)
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF1A0F30))
                            .border(2.dp, border, RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize().padding(5.dp)) {
                            drawSeal(cell.seal)
                        }
                        if (cell.isForged && !cell.found) {
                            Text("!", color = Error, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

private const val GRID_COLS = 4
// Поле небольшое (печати крупнее), подделок мало и разное число каждый раз
private const val TOTAL_SEALS = 20
private const val FORGED_MIN = 3
private const val FORGED_MAX = 6
private const val MEMORIZE_S = 6
private const val TIME_BUDGET_S = 30
