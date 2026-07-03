package com.s0dolamby.game.presentation.minigame.sechenie

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.common.theme.Success
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.random.Random

/**
 * «Сечение» — игра на глазомер (порт eyeball из kaa-bot): на струне нужно
 * отметить заданную долю. Ползунок ВОДИТСЯ пальцем по струне и фиксируется
 * отпусканием — видно, куда ставишь. Серия из ТРЁХ измерений, бонус по
 * средней ошибке. Задания привязаны к экономике дела из вести.
 *
 * Бонус: средняя ошибка ≤2% → +10%, ≤5% → +5%, ≤10% → +2%, дальше — мимо.
 */
object Sechenie {
    val FRACTIONS = listOf(
        1 to 2, 1 to 3, 2 to 3, 1 to 4, 3 to 4,
        1 to 5, 2 to 5, 3 to 5, 4 to 5,
        1 to 6, 5 to 6, 3 to 8, 5 to 8
    )

    fun bonusFor(errorPct: Float): Int = when {
        errorPct <= 2f -> 10
        errorPct <= 5f -> 5
        errorPct <= 10f -> 2
        else -> 0
    }

    fun statusKey(errorPct: Float): String = when {
        errorPct <= 0.3f -> "sechenie.status.perfect"
        errorPct <= 2f -> "sechenie.status.diamond"
        errorPct <= 5f -> "sechenie.status.hit"
        errorPct <= 10f -> "sechenie.status.close"
        errorPct <= 20f -> "sechenie.status.focus"
        else -> "sechenie.status.miss"
    }

    fun colorFor(errorPct: Float): Color = when {
        errorPct <= 2f -> Color(0xFF10B981)
        errorPct <= 5f -> Color(0xFFF59E0B)
        errorPct <= 10f -> Color(0xFFFB923C)
        else -> Color(0xFFEF4444)
    }
}

data class SechenieTask(val label: String, val targetPct: Float)

/**
 * Три задания на глазомер из ЭКОНОМИКИ дела: доля вложенного в текущей
 * стоимости, доля прироста/просадки, вес события из вести. Величины вне
 * 5..95% заменяются сказочными дробями.
 */
@Composable
fun buildSechenieTasks(project: Project?, update: DailyUpdate): List<SechenieTask> {
    val tasks = mutableListOf<SechenieTask>()
    if (project != null && project.currentValueRubles > 0) {
        // 1. Твоя доля: вложенное в текущей стоимости
        val share = (project.investedAmountRubles / project.currentValueRubles * 100).toFloat()
        if (share in 5f..95f) {
            val p = share.roundToInt()
            tasks += SechenieTask(Strings.t("sechenie.task.share", p), p.toFloat())
        }
        // 2. Прирост или просадка дела
        val growth = ((project.currentValueRubles - project.investedAmountRubles) /
            project.currentValueRubles * 100).toFloat()
        if (abs(growth) in 5f..95f) {
            val p = abs(growth).roundToInt()
            tasks += SechenieTask(
                if (growth >= 0) Strings.t("sechenie.task.growth", p)
                else Strings.t("sechenie.task.drawdown", p),
                p.toFloat()
            )
        }
        // 3. Вес события из вести в стоимости дела
        val eventW = (abs(update.eventDeltaRubles) / project.currentValueRubles * 100).toFloat()
        if (eventW in 5f..95f) {
            val p = eventW.roundToInt()
            tasks += SechenieTask(Strings.t("sechenie.task.event", p), p.toFloat())
        }
    }
    // Добор сказочными дробями до трёх
    val rng = Random(update.id.hashCode())
    while (tasks.size < 3) {
        val (n, d) = Sechenie.FRACTIONS[rng.nextInt(Sechenie.FRACTIONS.size)]
        val pct = n.toFloat() / d * 100f
        if (tasks.none { abs(it.targetPct - pct) < 1f }) {
            tasks += SechenieTask(Strings.t("sechenie.task.fraction", "$n/$d"), pct)
        }
    }
    return tasks.take(3).shuffled(rng)
}

private enum class RoundPhase { MEASURE, RESULT }

@Composable
fun SechenieOverlay(
    projectName: String,
    tasks: List<SechenieTask>,
    onInvestWithBonus: (Int) -> Unit,
    onClose: () -> Unit
) {
    var roundIdx by remember { mutableIntStateOf(0) }
    var phase by remember { mutableStateOf(RoundPhase.MEASURE) }
    // Ползунок: доля 0..1 пока водишь пальцем; null — ещё не касался
    var dragFrac by remember { mutableStateOf<Float?>(null) }
    var errorPct by remember { mutableFloatStateOf(0f) }
    val errors = remember { mutableStateListOf<Float>() }
    val anim = remember { Animatable(0f) }
    var resultShown by remember { mutableStateOf(false) }
    var seriesDone by remember { mutableStateOf(false) }

    val task = tasks.getOrNull(roundIdx) ?: return

    fun fixAnswer(frac: Float) {
        if (phase != RoundPhase.MEASURE) return
        errorPct = abs(frac * 100f - task.targetPct)
        errors += errorPct
        phase = RoundPhase.RESULT
    }

    LaunchedEffect(phase, roundIdx) {
        if (phase == RoundPhase.RESULT) {
            resultShown = false
            anim.snapTo(0f)
            anim.animateTo(1f, tween(800, easing = FastOutSlowInEasing))
            resultShown = true
        }
    }

    fun nextRound() {
        if (roundIdx >= tasks.size - 1) {
            seriesDone = true
        } else {
            roundIdx += 1
            dragFrac = null
            phase = RoundPhase.MEASURE
            resultShown = false
        }
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
                .border(1.dp, FairyGold.copy(alpha = 0.45f), RoundedCornerShape(24.dp))
                .padding(horizontal = 20.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                Strings.t("sechenie.title"),
                color = FairyGold, fontSize = 18.sp, fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(4.dp))
            Text(
                Strings.t("sechenie.subtitle", projectName),
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 12.sp, textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(10.dp))

            if (!seriesDone) {
                // Счётчик раунда + средняя серия
                Text(
                    Strings.t("sechenie.round", roundIdx + 1, tasks.size),
                    color = FairyGold.copy(alpha = 0.85f),
                    fontSize = 12.sp, fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    task.label,
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(8.dp))

                // ── Струна с ползунком ────────────────────────────────
                Canvas(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                        .pointerInput(roundIdx) {
                            detectDragGestures(
                                onDragStart = { offset ->
                                    if (phase == RoundPhase.MEASURE) {
                                        val pad = 24.dp.toPx()
                                        dragFrac = ((offset.x - pad) / (size.width - pad * 2))
                                            .coerceIn(0f, 1f)
                                    }
                                },
                                onDrag = { change, _ ->
                                    if (phase == RoundPhase.MEASURE) {
                                        val pad = 24.dp.toPx()
                                        dragFrac = ((change.position.x - pad) / (size.width - pad * 2))
                                            .coerceIn(0f, 1f)
                                    }
                                },
                                onDragEnd = {
                                    dragFrac?.let { fixAnswer(it) }
                                }
                            )
                        }
                        .pointerInput(roundIdx) {
                            // Простой тап тоже работает: коснулся-отпустил
                            detectTapGestures { offset ->
                                if (phase == RoundPhase.MEASURE) {
                                    val pad = 24.dp.toPx()
                                    val frac = ((offset.x - pad) / (size.width - pad * 2))
                                        .coerceIn(0f, 1f)
                                    dragFrac = frac
                                    fixAnswer(frac)
                                }
                            }
                        }
                ) {
                    val pad = 24.dp.toPx()
                    val x0 = pad
                    val x1 = size.width - pad
                    val len = x1 - x0
                    val y = size.height / 2f
                    val stringColor = Color.White.copy(alpha = 0.85f)

                    drawLine(stringColor, Offset(x0, y), Offset(x1, y),
                        strokeWidth = 2.5.dp.toPx(), cap = StrokeCap.Round)
                    for (x in listOf(x0, x1)) {
                        drawLine(stringColor.copy(alpha = 0.6f),
                            Offset(x, y - 8.dp.toPx()), Offset(x, y + 8.dp.toPx()),
                            strokeWidth = 2.dp.toPx())
                    }

                    val frac = dragFrac
                    if (phase == RoundPhase.MEASURE && frac != null) {
                        // Живой ползунок под пальцем: вертикальная игла + кружок
                        // + текущий процент над ним
                        val px = x0 + frac * len
                        drawLine(FairyGold.copy(alpha = 0.9f),
                            Offset(px, y - 26.dp.toPx()), Offset(px, y + 26.dp.toPx()),
                            strokeWidth = 2.dp.toPx())
                        drawCircle(FairyGold, radius = 9.dp.toPx(), center = Offset(px, y))
                        drawCircle(Color(0xFF1A0A00), radius = 4.dp.toPx(), center = Offset(px, y))
                    }

                    if (phase == RoundPhase.RESULT && frac != null) {
                        val t = anim.value
                        val tapX = x0 + frac * len
                        val targetX = x0 + task.targetPct / 100f * len
                        val errColor = Sechenie.colorFor(errorPct)
                        val errLow = minOf(tapX, targetX)
                        val errHigh = maxOf(tapX, targetX)
                        drawLine(
                            errColor.copy(alpha = 0.55f),
                            Offset(errLow, y),
                            Offset(errLow + (errHigh - errLow) * t, y),
                            strokeWidth = 5.dp.toPx(), cap = StrokeCap.Round
                        )
                        drawLine(
                            FairyGold.copy(alpha = t),
                            Offset(targetX, y - 14.dp.toPx()),
                            Offset(targetX, y + 14.dp.toPx()),
                            strokeWidth = 2.dp.toPx()
                        )
                        drawCircle(errColor, radius = 8.dp.toPx() * t, center = Offset(tapX, y))
                        drawCircle(Color.White.copy(alpha = t), radius = 3.dp.toPx() * t,
                            center = Offset(tapX, y))
                        if (errorPct <= 2f && t > 0.5f) {
                            val st = (t - 0.5f) / 0.5f
                            for (i in 0 until 10) {
                                val a = Math.PI * 2 * i / 10
                                val dist = (20 + st * 26).dp.toPx()
                                drawCircle(
                                    Color(0xFF10B981).copy(alpha = 1f - st),
                                    radius = 2.dp.toPx(),
                                    center = Offset(
                                        tapX + (dist * kotlin.math.cos(a)).toFloat(),
                                        y + (dist * kotlin.math.sin(a)).toFloat()
                                    )
                                )
                            }
                        }
                    }
                }

                // Живой процент под пальцем / подсказка / результат раунда
                when {
                    phase == RoundPhase.MEASURE && dragFrac != null -> Text(
                        "%.1f%%".format(dragFrac!! * 100f),
                        color = FairyGold, fontSize = 15.sp, fontWeight = FontWeight.Bold
                    )
                    phase == RoundPhase.MEASURE -> Text(
                        Strings.t("sechenie.hint"),
                        color = Color.White.copy(alpha = 0.55f), fontSize = 12.sp
                    )
                    else -> Unit
                }

                if (phase == RoundPhase.RESULT && resultShown) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        Strings.t(Sechenie.statusKey(errorPct)),
                        color = Sechenie.colorFor(errorPct),
                        fontSize = 18.sp, fontWeight = FontWeight.Bold
                    )
                    Text(
                        Strings.t("sechenie.accuracy", (100f - errorPct).coerceAtLeast(0f)),
                        color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp
                    )
                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = { nextRound() },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = FairyGold, contentColor = Color(0xFF1A0A00)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            if (roundIdx >= tasks.size - 1) Strings.t("sechenie.btn.total")
                            else Strings.t("sechenie.btn.next"),
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            } else {
                // ── Итог серии из трёх измерений ─────────────────────
                val avgError = if (errors.isEmpty()) 100f else errors.sum() / errors.size
                val bonus = Sechenie.bonusFor(avgError)
                Text(
                    Strings.t(Sechenie.statusKey(avgError)),
                    color = Sechenie.colorFor(avgError),
                    fontSize = 22.sp, fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(6.dp))
                // Три измерения — точность каждого
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    errors.forEach { e ->
                        Box(
                            modifier = Modifier
                                .size(width = 64.dp, height = 26.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Sechenie.colorFor(e).copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                "%.1f%%".format((100f - e).coerceAtLeast(0f)),
                                color = Sechenie.colorFor(e),
                                fontSize = 12.sp, fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    Strings.t("sechenie.avgAccuracy", (100f - avgError).coerceAtLeast(0f)),
                    color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp
                )
                Spacer(Modifier.height(14.dp))
                if (bonus > 0) {
                    Text(
                        Strings.t("sechenie.offer", bonus),
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 13.sp, lineHeight = 19.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = { onInvestWithBonus(bonus) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = FairyGold,
                            contentColor = Color(0xFF1A0A00)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(Strings.t("sechenie.btn.invest", bonus), fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(6.dp))
                } else {
                    Text(
                        Strings.t("sechenie.missBody"),
                        color = Color.White.copy(alpha = 0.6f),
                        fontSize = 12.sp, textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(10.dp))
                }
                OutlinedButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) {
                    Text(Strings.t("minigame.btn.close"), color = Color.White.copy(alpha = 0.8f))
                }
            }
        }
    }
}
