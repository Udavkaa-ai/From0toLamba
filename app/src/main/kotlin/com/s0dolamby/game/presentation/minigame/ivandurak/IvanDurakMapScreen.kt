package com.s0dolamby.game.presentation.minigame.ivandurak

import androidx.compose.animation.core.*
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.minigame.common.ArchetypePalette
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import com.s0dolamby.game.presentation.minigame.common.MinigameShell
import com.s0dolamby.game.presentation.minigame.common.MinigameStage
import kotlinx.coroutines.delay
import kotlin.random.Random

// ─── вещи Ивана на карте ────────────────────────────────────────────────

private enum class MapItem(val emoji: String, val label: String) {
    AXE("🪓", "топор"),
    SWORD("⚔️", "меч"),
    SHIELD("🛡", "щит"),
    BOW("🏹", "лук"),
    HORSE("🐴", "конь"),
    CROWN("👑", "венец")
}

private val ALL_ITEMS = MapItem.values().toList()

@Composable
fun IvanDurakMapScreen(onBack: () -> Unit) {
    var seed by remember { mutableStateOf(System.currentTimeMillis()) }
    // target: какой предмет лежит в какой ячейке (6 ячеек 2×3, все разные)
    val target = remember(seed) { ALL_ITEMS.shuffled(Random(seed)) }
    // palette: предметы внизу в случайном порядке (другой seed чтобы порядок отличался)
    val palette = remember(seed) { ALL_ITEMS.shuffled(Random(seed + 31)) }

    var stage by remember(seed) { mutableStateOf(MinigameStage.MEMORIZE) }
    var memorizeLeft by remember(seed) { mutableStateOf(MEMORIZE_SECONDS) }
    var playLeft by remember(seed) { mutableStateOf(PLAY_SECONDS) }
    var placed by remember(seed) { mutableStateOf(List<MapItem?>(CELL_COUNT) { null }) }
    var selectedItem by remember(seed) { mutableStateOf<MapItem?>(null) }
    var errors by remember(seed) { mutableStateOf(0) }
    var wrongFlashIdx by remember(seed) { mutableStateOf(-1) }

    LaunchedEffect(seed, stage) {
        if (stage == MinigameStage.MEMORIZE) {
            while (memorizeLeft > 0 && stage == MinigameStage.MEMORIZE) {
                delay(1000); memorizeLeft -= 1
            }
            if (stage == MinigameStage.MEMORIZE) stage = MinigameStage.PLAY
        } else if (stage == MinigameStage.PLAY) {
            while (playLeft > 0 && stage == MinigameStage.PLAY) {
                delay(1000); playLeft -= 1
            }
            if (stage == MinigameStage.PLAY) stage = MinigameStage.RESULT
        }
    }

    LaunchedEffect(wrongFlashIdx) {
        if (wrongFlashIdx >= 0) {
            delay(420)
            wrongFlashIdx = -1
        }
    }

    val outcome: MinigameOutcome? = if (stage == MinigameStage.RESULT) {
        val unplaced = placed.count { it == null }
        MinigameOutcome(
            errorCount = errors,
            timeoutReached = unplaced > 0 && errors == 0
        )
    } else null

    fun handleCellTap(idx: Int) {
        if (stage != MinigameStage.PLAY) return
        if (placed[idx] != null) return
        val item = selectedItem ?: return
        if (target[idx] == item) {
            placed = placed.toMutableList().also { it[idx] = item }
            selectedItem = null
            if (placed.none { it == null }) {
                stage = MinigameStage.RESULT
            }
        } else {
            errors += 1
            wrongFlashIdx = idx
            selectedItem = null
        }
    }

    fun restart() {
        seed = System.currentTimeMillis()
        memorizeLeft = MEMORIZE_SECONDS
        playLeft = PLAY_SECONDS
        placed = List(CELL_COUNT) { null }
        selectedItem = null
        errors = 0
        wrongFlashIdx = -1
        stage = MinigameStage.MEMORIZE
    }

    MinigameShell(
        archetype = PersonaArchetype.IVAN_DURAK,
        gameTitle = "Повторить карту",
        stage = stage,
        secondsLeft = when (stage) {
            MinigameStage.MEMORIZE -> memorizeLeft
            MinigameStage.PLAY -> playLeft
            MinigameStage.RESULT -> null
        },
        outcome = outcome,
        onBack = onBack,
        onAgain = { restart() },
        onClose = onBack
    ) {
        when (stage) {
            MinigameStage.MEMORIZE -> {
                Text(
                    "Запомни, что где лежит",
                    color = Color.White.copy(alpha = 0.85f), fontSize = 14.sp
                )
                Spacer(Modifier.height(14.dp))
                MapGrid(
                    cells = target.map { it },
                    wrongFlashIdx = -1,
                    revealAll = true,
                    onTap = {}
                )
            }
            MinigameStage.PLAY -> {
                Text(
                    if (selectedItem == null) "Выбери вещь внизу…"
                    else "…и положи ${selectedItem!!.label} на её место",
                    color = Color.White.copy(alpha = 0.85f), fontSize = 14.sp
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "Ошибок: $errors",
                    color = ArchetypePalette[PersonaArchetype.IVAN_DURAK].primary,
                    fontSize = 12.sp
                )
                Spacer(Modifier.height(10.dp))
                MapGrid(
                    cells = placed,
                    wrongFlashIdx = wrongFlashIdx,
                    revealAll = false,
                    onTap = ::handleCellTap
                )
                Spacer(Modifier.height(16.dp))
                ItemPalette(
                    palette = palette,
                    placed = placed,
                    selected = selectedItem,
                    onSelect = { selectedItem = if (selectedItem == it) null else it }
                )
            }
            MinigameStage.RESULT -> {
                Spacer(Modifier.height(20.dp))
                Text(
                    "Разложено: ${placed.count { it != null }} из $CELL_COUNT",
                    color = Color.White, fontSize = 14.sp
                )
                Text(
                    "Ошибок: $errors",
                    color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp
                )
            }
        }
    }
}

@Composable
private fun MapGrid(
    cells: List<MapItem?>,
    wrongFlashIdx: Int,
    revealAll: Boolean,
    onTap: (Int) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        cells.chunked(GRID_COLS).forEachIndexed { rowIdx, rowItems ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                rowItems.forEachIndexed { colIdx, item ->
                    val idx = rowIdx * GRID_COLS + colIdx
                    MapCell(
                        item = item,
                        isWrongFlash = wrongFlashIdx == idx,
                        revealMode = revealAll,
                        onClick = { onTap(idx) }
                    )
                }
            }
        }
    }
}

@Composable
private fun MapCell(
    item: MapItem?,
    isWrongFlash: Boolean,
    revealMode: Boolean,
    onClick: () -> Unit
) {
    val placeScale = remember(item) { Animatable(if (item != null && !revealMode) 0.6f else 1f) }
    LaunchedEffect(item) {
        if (item != null && !revealMode) {
            placeScale.animateTo(1.12f, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
            placeScale.animateTo(1f, tween(150))
        }
    }
    val borderColor = when {
        isWrongFlash -> Color(0xFFEF5350)
        item != null -> ArchetypePalette[PersonaArchetype.IVAN_DURAK].primary.copy(alpha = 0.7f)
        else -> Color.White.copy(alpha = 0.18f)
    }
    Box(
        modifier = Modifier
            .size(width = 96.dp, height = 96.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.verticalGradient(
                    if (isWrongFlash) listOf(Color(0xFF4A1010), Color(0xFF2A0808))
                    else listOf(Color(0xFF3E2723).copy(alpha = 0.85f), Color(0xFF1A0F08).copy(alpha = 0.95f))
                )
            )
            .border(if (isWrongFlash || item != null) 2.dp else 1.dp, borderColor, RoundedCornerShape(16.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        if (item != null) {
            Text(
                item.emoji,
                fontSize = 40.sp,
                modifier = Modifier.scale(placeScale.value)
            )
        } else {
            Text(
                "?",
                color = Color.White.copy(alpha = 0.25f),
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun ItemPalette(
    palette: List<MapItem>,
    placed: List<MapItem?>,
    selected: MapItem?,
    onSelect: (MapItem) -> Unit
) {
    val placedSet = placed.filterNotNull().toSet()
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        palette.forEach { item ->
            val isPlaced = item in placedSet
            val isSelected = item == selected
            val scale = remember { Animatable(1f) }
            LaunchedEffect(isSelected) {
                if (isSelected) {
                    scale.animateTo(1.18f, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
                } else {
                    scale.animateTo(1f, tween(150))
                }
            }
            Box(
                modifier = Modifier
                    .size(50.dp)
                    .scale(scale.value)
                    .clip(CircleShape)
                    .background(
                        when {
                            isPlaced -> Color(0xFF1A0F08).copy(alpha = 0.4f)
                            isSelected -> ArchetypePalette[PersonaArchetype.IVAN_DURAK].primary.copy(alpha = 0.35f)
                            else -> Color(0xFF3E2723).copy(alpha = 0.8f)
                        }
                    )
                    .border(
                        if (isSelected) 2.dp else 1.dp,
                        if (isSelected) ArchetypePalette[PersonaArchetype.IVAN_DURAK].primary
                        else Color.White.copy(alpha = 0.15f),
                        CircleShape
                    )
                    .graphicsLayer { alpha = if (isPlaced) 0.3f else 1f }
                    .let { if (!isPlaced) it.clickable { onSelect(item) } else it },
                contentAlignment = Alignment.Center
            ) {
                Text(item.emoji, fontSize = 26.sp)
            }
        }
    }
}

private const val GRID_COLS = 3
private const val CELL_COUNT = 6
private const val MEMORIZE_SECONDS = 6
private const val PLAY_SECONDS = 25
