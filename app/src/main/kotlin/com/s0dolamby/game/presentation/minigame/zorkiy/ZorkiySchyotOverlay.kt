package com.s0dolamby.game.presentation.minigame.zorkiy

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.usecase.BadNewsOutcome
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.Error as ErrorColor
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.common.theme.Success
import kotlinx.coroutines.delay
import kotlin.random.Random

/**
 * «Зоркий счёт» — реакция на ТРЕВОЖНУЮ весть: в квадрате вразнобой, под
 * разными углами и разного размера, разбросаны числа 1–10 и буквы-помехи.
 * Тапай числа ПО ПОРЯДКУ, общий таймер — 10 секунд.
 *
 * Ставки (игра добровольная):
 *  - обычная весть: WIN (все 10, ≤1 ошибки) → возврат половины урона;
 *    иначе → заморозка начислений на 2–3 дня. Вывод не блокируется.
 *  - весть о заморозке вывода (isLockNews): WIN только БЕЗ ошибок —
 *    успел к сундукам, вывод открывается; иначе условие вести просто
 *    остаётся в силе.
 */

private data class FieldItem(
    val label: String,
    val number: Int?,        // null = буква-помеха
    val xFrac: Float,        // 0..1 позиция в квадрате
    val yFrac: Float,
    val rotation: Float,     // градусы
    val sizeSp: Int
)

private val DISTRACTOR_LETTERS = listOf("Ж", "Б", "Ф", "Д", "К", "Я", "Щ", "Л", "Ю", "Ч")

private fun buildField(): List<FieldItem> {
    // Сетка 4×5 = 20 ячеек, элементы садятся в случайные ячейки с джиттером —
    // без пересечений, но выглядит хаотично
    val cells = mutableListOf<Pair<Float, Float>>()
    for (row in 0 until 5) {
        for (col in 0 until 4) {
            cells += (col + 0.5f) / 4f to (row + 0.5f) / 5f
        }
    }
    cells.shuffle()
    val labels: List<Pair<String, Int?>> =
        (1..10).map { it.toString() to it } +
            DISTRACTOR_LETTERS.shuffled().take(8).map { it to null }
    return labels.mapIndexed { i, (label, num) ->
        val (cx, cy) = cells[i]
        FieldItem(
            label = label,
            number = num,
            xFrac = (cx + (Random.nextFloat() - 0.5f) * 0.08f).coerceIn(0.07f, 0.93f),
            yFrac = (cy + (Random.nextFloat() - 0.5f) * 0.06f).coerceIn(0.07f, 0.93f),
            rotation = (Random.nextFloat() - 0.5f) * 80f,
            sizeSp = 17 + Random.nextInt(16)
        )
    }
}

private enum class Phase { INTRO, PLAY, DONE }

@Composable
fun ZorkiySchyotOverlay(
    projectName: String,
    /** Весть о заморозке вывода: победа без ошибок открывает окно вывода. */
    isLockNews: Boolean = false,
    /** «Предложение, от которого нельзя отказаться»: победа без ошибок отбивает
     *  угрозу, любая ошибка — дело под замком и −50% при закрытии. */
    isMafia: Boolean = false,
    onOutcome: (BadNewsOutcome) -> Unit,
    onRetreat: () -> Unit
) {
    var phase by remember { mutableStateOf(Phase.INTRO) }
    val field = remember { buildField() }
    var next by remember { mutableIntStateOf(1) }         // какое число ищем
    var errors by remember { mutableIntStateOf(0) }
    var wrongFlashLabel by remember { mutableStateOf<String?>(null) }
    var outcome by remember { mutableStateOf<BadNewsOutcome?>(null) }
    val timer = remember { Animatable(1f) }

    fun finish(timedOut: Boolean) {
        val found = next - 1
        // У вести о заморозке вывода планка выше: WIN только без единой
        // ошибки — «в последний момент» прощает лишь безупречных.
        val winErrorCap = if (isLockNews || isMafia) 0 else 1
        outcome = when {
            !timedOut && errors <= winErrorCap -> BadNewsOutcome.WIN
            !timedOut -> BadNewsOutcome.LOSE
            found >= 5 -> BadNewsOutcome.LOSE
            else -> BadNewsOutcome.FAIL
        }
        phase = Phase.DONE
    }

    // ЕДИНЫЙ таймер на всю игру. Ручной отсчёт (а не animateTo), чтобы
    // замирал на паузе фидбека: пока открыт попап, время не идёт.
    LaunchedEffect(phase) {
        if (phase == Phase.PLAY) {
            timer.snapTo(1f)
            val total = TOTAL_SECONDS * 1000L
            var elapsed = 0L
            val stepMs = 50L
            while (elapsed < total && phase == Phase.PLAY) {
                kotlinx.coroutines.delay(stepMs)
                if (!com.s0dolamby.game.presentation.feedback.FeedbackPauseBus.paused.value) {
                    elapsed += stepMs
                    timer.snapTo(1f - elapsed.toFloat() / total)
                }
            }
            // Время вышло (не прервано тапом по последнему числу)
            if (phase == Phase.PLAY) finish(timedOut = true)
        }
    }

    LaunchedEffect(wrongFlashLabel) {
        if (wrongFlashLabel != null) {
            delay(350)
            wrongFlashLabel = null
        }
    }

    fun handleTap(item: FieldItem) {
        if (phase != Phase.PLAY) return
        if (item.number == next) {
            if (next == 10) {
                next = 11
                finish(timedOut = false)
            } else {
                next += 1
            }
        } else if (item.number == null || item.number > next) {
            // буква или ещё не наступившее число — ошибка
            errors += 1
            wrongFlashLabel = item.label
        }
        // тап по уже найденному числу — молча игнорируем
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xF5060412))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {},
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .padding(20.dp)
                .widthIn(max = 420.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(Brush.verticalGradient(listOf(EnchantedPurple, NightBlue)))
                .border(1.dp, ErrorColor.copy(alpha = 0.5f), RoundedCornerShape(24.dp))
                .padding(horizontal = 20.dp, vertical = 22.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                Strings.t("zorkiy.title"),
                color = FairyGold, fontSize = 18.sp, fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(4.dp))
            Text(
                Strings.t("zorkiy.subtitle", projectName),
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 12.sp, textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(12.dp))

            when (phase) {
                Phase.INTRO -> {
                    Text(
                        Strings.t("zorkiy.rules"),
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 13.sp, lineHeight = 19.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        Strings.t(
                            when {
                                isMafia -> "zorkiy.stakes.mafia"
                                isLockNews -> "zorkiy.stakes.lock"
                                else -> "zorkiy.stakes"
                            }
                        ),
                        color = ErrorColor.copy(alpha = 0.9f),
                        fontSize = 12.sp, lineHeight = 18.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = { phase = Phase.PLAY },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = FairyGold, contentColor = Color(0xFF1A0A00)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(Strings.t("zorkiy.btn.risk"), fontWeight = FontWeight.SemiBold) }
                    Spacer(Modifier.height(6.dp))
                    OutlinedButton(onClick = onRetreat, modifier = Modifier.fillMaxWidth()) {
                        Text(Strings.t("zorkiy.btn.retreat"), color = Color.White.copy(alpha = 0.8f))
                    }
                }

                Phase.PLAY -> {
                    // Какое число ищем + счёт ошибок
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            Strings.t("zorkiy.find", next),
                            color = FairyGold, fontSize = 15.sp, fontWeight = FontWeight.Bold
                        )
                        Text(
                            Strings.t("zorkiy.errors", errors),
                            color = if (errors == 0) Color.White.copy(alpha = 0.6f) else ErrorColor,
                            fontSize = 12.sp
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    // Полоска-таймер 5 секунд
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(Color.White.copy(alpha = 0.12f))
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(timer.value)
                                .height(6.dp)
                                .background(
                                    if (timer.value > 0.35f) FairyGold else ErrorColor
                                )
                        )
                    }
                    Spacer(Modifier.height(10.dp))

                    // Квадратное поле с разбросанными знаками
                    BoxWithConstraints(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFF120A2E))
                            .border(1.dp, Color.White.copy(alpha = 0.15f), RoundedCornerShape(16.dp))
                    ) {
                        val fieldW = maxWidth
                        field.forEach { item ->
                            val foundAlready = item.number != null && item.number < next
                            val isWrongFlash = wrongFlashLabel == item.label
                            Box(
                                modifier = Modifier
                                    .offset(
                                        x = fieldW * item.xFrac - 22.dp,
                                        y = fieldW * item.yFrac - 22.dp
                                    )
                                    .size(44.dp)
                                    .graphicsLayer { rotationZ = item.rotation }
                                    .clip(CircleShape)
                                    .background(
                                        when {
                                            isWrongFlash -> ErrorColor.copy(alpha = 0.4f)
                                            foundAlready -> Success.copy(alpha = 0.18f)
                                            else -> Color.Transparent
                                        }
                                    )
                                    .clickable { handleTap(item) },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    item.label,
                                    color = when {
                                        foundAlready -> Success.copy(alpha = 0.7f)
                                        isWrongFlash -> ErrorColor
                                        else -> Color.White.copy(alpha = 0.9f)
                                    },
                                    fontSize = item.sizeSp.sp,
                                    fontWeight = if (item.number != null) FontWeight.Bold
                                    else FontWeight.Normal
                                )
                            }
                        }
                    }
                }

                Phase.DONE -> {
                    val o = outcome ?: BadNewsOutcome.FAIL
                    val (emoji, titleKey, bodyKey, color) = when {
                        isMafia && o == BadNewsOutcome.WIN ->
                            Quad("🛡️", "zorkiy.mafiaSafe.title", "zorkiy.mafiaSafe.body", Success)
                        isMafia ->
                            Quad("🔒", "zorkiy.mafiaLocked.title", "zorkiy.mafiaLocked.body", ErrorColor)
                        isLockNews && o == BadNewsOutcome.WIN ->
                            Quad("🗝️", "zorkiy.unlock.title", "zorkiy.unlock.body", Success)
                        isLockNews ->
                            Quad("🔒", "zorkiy.lockstay.title", "zorkiy.lockstay.body", ErrorColor)
                        o == BadNewsOutcome.WIN ->
                            Quad("🛡️", "zorkiy.win.title", "zorkiy.win.body", Success)
                        else ->
                            Quad("🥶", "zorkiy.lose.title", "zorkiy.lose.body", Color(0xFFFFB74D))
                    }
                    Text(emoji, fontSize = 44.sp)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        Strings.t(titleKey),
                        color = color, fontSize = 20.sp, fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        Strings.t(bodyKey),
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 13.sp, lineHeight = 19.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        Strings.t("zorkiy.summary", (next - 1).coerceAtMost(10), errors),
                        color = Color.White.copy(alpha = 0.55f), fontSize = 11.sp
                    )
                    Spacer(Modifier.height(14.dp))
                    Button(
                        onClick = { onOutcome(o) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = FairyGold, contentColor = Color(0xFF1A0A00)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(Strings.t("zorkiy.btn.accept"), fontWeight = FontWeight.SemiBold) }
                }
            }
        }
    }
}

private data class Quad(val a: String, val b: String, val c: String, val d: Color)

private const val TOTAL_SECONDS = 10
