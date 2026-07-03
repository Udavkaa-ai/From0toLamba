package com.s0dolamby.game.presentation.minigame.sechenie

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import kotlin.math.abs
import kotlin.random.Random

/**
 * «Сечение» — игра на глазомер (порт eyeball из kaa-bot): на струне нужно
 * тапом отметить заданную долю. Используется как РЕАКЦИЯ на важную весть дня:
 * меткий глаз — делец добрасывает бонус к довложению в это дело.
 *
 * Бонус по точности: промах ≤2% → +10%, ≤5% → +5%, ≤10% → +2%, дальше — мимо.
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

private data class SechenieTask(val label: String, val targetPct: Float)

private fun pickTask(): SechenieTask {
    return if (Random.nextFloat() < 0.45f) {
        val (n, d) = Sechenie.FRACTIONS.random()
        SechenieTask("$n/$d", n.toFloat() / d * 100f)
    } else {
        val p = 5 + Random.nextInt(91)
        SechenieTask("$p%", p.toFloat())
    }
}

/**
 * Полноэкранный оверлей игры. [projectName] — дело из вести, к которому
 * относится реакция. [onInvestWithBonus] зовётся с бонус-процентом (>0).
 */
@Composable
fun SechenieOverlay(
    projectName: String,
    onInvestWithBonus: (Int) -> Unit,
    onClose: () -> Unit
) {
    val task = remember { pickTask() }
    // null = ждём тапа; иначе — доля тапа 0..1 по струне
    var tapFraction by remember { mutableStateOf<Float?>(null) }
    var resultShown by remember { mutableStateOf(false) }
    val anim = remember { Animatable(0f) }
    var errorPct by remember { mutableFloatStateOf(0f) }

    LaunchedEffect(tapFraction) {
        if (tapFraction != null) {
            anim.snapTo(0f)
            anim.animateTo(1f, tween(900, easing = FastOutSlowInEasing))
            resultShown = true
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
                color = FairyGold,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(4.dp))
            Text(
                Strings.t("sechenie.subtitle", projectName),
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 12.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(16.dp))
            Text(
                Strings.t("sechenie.task", task.label),
                color = Color.White,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(10.dp))

            // ── Струна ────────────────────────────────────────────────
            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp)
                    .pointerInput(Unit) {
                        detectTapGestures { offset ->
                            if (tapFraction == null) {
                                val pad = 24.dp.toPx()
                                val len = size.width - pad * 2
                                val frac = ((offset.x - pad) / len).coerceIn(0f, 1f)
                                tapFraction = frac
                                errorPct = abs(frac * 100f - task.targetPct)
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

                // Струна + концевые засечки
                drawLine(stringColor, Offset(x0, y), Offset(x1, y),
                    strokeWidth = 2.5.dp.toPx(), cap = StrokeCap.Round)
                for (x in listOf(x0, x1)) {
                    drawLine(stringColor.copy(alpha = 0.6f),
                        Offset(x, y - 8.dp.toPx()), Offset(x, y + 8.dp.toPx()),
                        strokeWidth = 2.dp.toPx())
                }

                val frac = tapFraction
                if (frac != null) {
                    val t = anim.value
                    val tapX = x0 + frac * len
                    val targetX = x0 + task.targetPct / 100f * len
                    val errColor = Sechenie.colorFor(errorPct)

                    // Круги-рябь от тапа (первая половина анимации)
                    if (t < 0.55f) {
                        val rippleT = t / 0.55f
                        for (ring in 0 until 3) {
                            val ringT = (rippleT - ring * 0.15f).coerceIn(0f, 1f)
                            if (ringT > 0f) {
                                drawCircle(
                                    stringColor.copy(alpha = (1f - ringT) * 0.5f),
                                    radius = 8.dp.toPx() + ringT * 42.dp.toPx(),
                                    center = Offset(tapX, y),
                                    style = androidx.compose.ui.graphics.drawscope.Stroke(
                                        width = (2f - ringT) * 1.5.dp.toPx()
                                    )
                                )
                            }
                        }
                    }

                    // Результат (вторая половина): зона ошибки, целевая метка, точка
                    if (t > 0.35f) {
                        val rt = ((t - 0.35f) / 0.65f).coerceIn(0f, 1f)
                        val errLow = minOf(tapX, targetX)
                        val errHigh = maxOf(tapX, targetX)
                        // Цветная зона ошибки растёт от errLow
                        drawLine(
                            errColor.copy(alpha = 0.55f),
                            Offset(errLow, y),
                            Offset(errLow + (errHigh - errLow) * rt, y),
                            strokeWidth = 5.dp.toPx(), cap = StrokeCap.Round
                        )
                        // Целевая засечка
                        drawLine(
                            FairyGold.copy(alpha = rt),
                            Offset(targetX, y - 14.dp.toPx()),
                            Offset(targetX, y + 14.dp.toPx()),
                            strokeWidth = 2.dp.toPx()
                        )
                        // Точка игрока
                        drawCircle(errColor, radius = 8.dp.toPx() * rt, center = Offset(tapX, y))
                        drawCircle(Color.White.copy(alpha = rt), radius = 3.dp.toPx() * rt,
                            center = Offset(tapX, y))
                        // Искры при «глаз-алмаз»
                        if (errorPct <= 2f && rt > 0.5f) {
                            val st = (rt - 0.5f) / 0.5f
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
            }

            if (tapFraction == null) {
                Text(
                    Strings.t("sechenie.hint"),
                    color = Color.White.copy(alpha = 0.55f),
                    fontSize = 12.sp
                )
            }

            // ── Результат и офферы ────────────────────────────────────
            if (resultShown) {
                val bonus = Sechenie.bonusFor(errorPct)
                val accuracy = (100f - errorPct).coerceAtLeast(0f)
                Spacer(Modifier.height(10.dp))
                Text(
                    Strings.t(Sechenie.statusKey(errorPct)),
                    color = Sechenie.colorFor(errorPct),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    Strings.t("sechenie.accuracy", accuracy),
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 12.sp
                )
                Spacer(Modifier.height(14.dp))
                if (bonus > 0) {
                    Text(
                        Strings.t("sechenie.offer", bonus),
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
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
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center
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
