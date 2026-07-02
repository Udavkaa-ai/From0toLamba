package com.s0dolamby.game.presentation.common.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.FairyGold

/**
 * Полноэкранный оверлей на время advance-day (порт TG DayTransitionOverlay).
 * Маскирует зазор между нажатием «Следующий день» и обновлением инбокса/
 * портфеля — генерация новых дел ходит в AI и может занять пару секунд.
 *
 * Сцена в духе сказочной ярмарки: царские палаты, матрёшка, грамота,
 * самовар, купец-странник ходит туда-сюда, сверху — волшебные искры.
 */
@Composable
fun DayTransitionOverlay(visible: Boolean) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(250)),
        exit = fadeOut(tween(250))
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xF8080418))
                // Глушим клики по интерфейсу под оверлеем
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null
                ) {},
            contentAlignment = Alignment.Center
        ) {
            val infinite = rememberInfiniteTransition(label = "fairground")

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(20.dp),
                modifier = Modifier.padding(horizontal = 24.dp)
            ) {
                // ── Сцена ярмарки 240×160 ────────────────────────────────
                Box(modifier = Modifier.size(width = 240.dp, height = 160.dp)) {
                    // Царские палаты слева
                    Text(
                        "🏰",
                        fontSize = 52.sp,
                        modifier = Modifier.offset(x = 6.dp, y = 0.dp)
                    )

                    // Матрёшка справа — покачивается
                    val bob by infinite.animateFloat(
                        initialValue = 0f, targetValue = 1f,
                        animationSpec = infiniteRepeatable(
                            tween(2000, easing = FastOutSlowInEasing),
                            repeatMode = RepeatMode.Reverse
                        ),
                        label = "bob"
                    )
                    Text(
                        "🪆",
                        fontSize = 46.sp,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .offset(x = (-10).dp, y = 14.dp)
                            .graphicsLayer {
                                translationY = -5.dp.toPx() * bob
                                rotationZ = -3f + 6f * bob
                            }
                    )

                    // Грамота — пляшет внизу-справа
                    val scrollRock by infinite.animateFloat(
                        initialValue = -8f, targetValue = 10f,
                        animationSpec = infiniteRepeatable(
                            tween(1300, easing = FastOutSlowInEasing),
                            repeatMode = RepeatMode.Reverse
                        ),
                        label = "scrollRock"
                    )
                    Text(
                        "📜",
                        fontSize = 30.sp,
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .offset(x = (-28).dp, y = (-12).dp)
                            .graphicsLayer { rotationZ = scrollRock }
                    )

                    // Самовар — левый нижний край
                    Text(
                        "🫖",
                        fontSize = 26.sp,
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .offset(x = 14.dp, y = (-6).dp)
                    )

                    // Купец-странник ходит туда-сюда. 🧙‍♂️ смотрит влево,
                    // поэтому при движении вправо зеркалим (scaleX = -1).
                    val walk by infinite.animateFloat(
                        initialValue = 0f, targetValue = 2f,
                        animationSpec = infiniteRepeatable(
                            tween(3400, easing = LinearEasing)
                        ),
                        label = "walk"
                    )
                    val walkX = if (walk < 1f) walk * 130f else (2f - walk) * 130f
                    val facingRight = walk < 1f
                    Text(
                        "🧙‍♂️",
                        fontSize = 44.sp,
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .offset(x = 50.dp)
                            .graphicsLayer {
                                translationX = walkX.dp.toPx()
                                scaleX = if (facingRight) -1f else 1f
                            }
                    )

                    // Сказочные искры по всей сцене
                    for (i in 0 until 4) {
                        val sparkle by infinite.animateFloat(
                            initialValue = 0f, targetValue = 1f,
                            animationSpec = infiniteRepeatable(
                                tween(2000 + i * 400, easing = FastOutSlowInEasing),
                                repeatMode = RepeatMode.Reverse
                            ),
                            label = "sparkle$i"
                        )
                        Text(
                            "✨",
                            fontSize = 13.sp,
                            color = FairyGold,
                            modifier = Modifier
                                .offset(
                                    x = (20 + i * 56).dp,
                                    y = if (i % 2 == 0) (-4).dp else 10.dp
                                )
                                .graphicsLayer {
                                    translationY = -12.dp.toPx() * sparkle
                                    alpha = 0.3f + 0.7f * sparkle
                                }
                        )
                    }
                }

                // ── Пульсирующий заголовок ───────────────────────────────
                val pulse by infinite.animateFloat(
                    initialValue = 0.65f, targetValue = 1f,
                    animationSpec = infiniteRepeatable(
                        tween(900, easing = FastOutSlowInEasing),
                        repeatMode = RepeatMode.Reverse
                    ),
                    label = "pulse"
                )
                Text(
                    Strings.t("daytransition.title"),
                    color = FairyGold,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.graphicsLayer { alpha = pulse }
                )

                Text(
                    Strings.t("daytransition.subtitle"),
                    color = Color.White.copy(alpha = 0.55f),
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
