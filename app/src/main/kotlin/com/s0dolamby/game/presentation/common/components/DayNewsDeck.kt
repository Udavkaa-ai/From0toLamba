package com.s0dolamby.game.presentation.common.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.model.PayoutStatus
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import com.s0dolamby.game.presentation.common.theme.Success
import com.s0dolamby.game.presentation.common.theme.Warning
import kotlinx.coroutines.launch

/**
 * Свайп-колода «Вестей дня» (TG DayNewsOverlay стиль). Глобальная — рисуется
 * поверх любого экрана после «Следующий день». Фон затемнён почти полностью,
 * сверху — счётчик, снизу — подсказка про свайпы.
 */
@Composable
fun DayNewsDeck(
    updates: List<DailyUpdate>,
    onDismiss: (DailyUpdate) -> Unit,
    onOpenProject: (DailyUpdate) -> Unit,
    /** Активные дела — реакция «Сечением» доступна только по ним. */
    activeProjectIds: Set<String> = emptySet(),
    /** Вести, на которые уже отреагировали (одна реакция на весть). */
    reactedIds: Set<String> = emptySet(),
    onReact: (DailyUpdate) -> Unit = {}
) {
    val current = updates.firstOrNull() ?: return
    val remaining = updates.size

    Box(
        modifier = Modifier
            .fillMaxSize()
            // Плотный скрим: экран под вестями почти не виден и не отвлекает.
            // clickable-заглушка глотает тапы по интерфейсу под колодой.
            .background(Color(0xF2060412))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {}
    ) {
        if (remaining > 1) {
            Card(
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth()
                    .padding(horizontal = 36.dp)
                    .offset(y = 8.dp),
            ) { Box(Modifier.height(40.dp)) }
        }
        if (remaining > 2) {
            Card(
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth()
                    .padding(horizontal = 48.dp)
                    .offset(y = 16.dp),
            ) { Box(Modifier.height(40.dp)) }
        }

        SwipeableUpdateCard(
            update = current,
            modifier = Modifier.align(Alignment.Center),
            canReact = current.eventKind != null &&
                current.projectId in activeProjectIds &&
                current.id !in reactedIds,
            onReact = { onReact(current) },
            onSwipeLeft = { onDismiss(current) },
            onSwipeRight = { onOpenProject(current) }
        )

        // Оверлей лежит на фиксированном тёмном скриме в обеих темах —
        // фиксированные светлые цвета, не карточные локали.
        Text(
            Strings.t("daynews.counter", remaining),
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 48.dp),
            style = MaterialTheme.typography.labelMedium,
            color = FairyGold
        )

        // Подсказка про свайпы — крупнее и с направлениями
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 40.dp)
                .fillMaxWidth()
                .padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(Strings.t("daynews.hint.left"), color = Color.White.copy(alpha = 0.8f), fontSize = 12.sp)
                Text(Strings.t("daynews.hint.right"), color = FairyGold.copy(alpha = 0.9f), fontSize = 12.sp)
            }
            Text(
                Strings.t("daynews.hint.swipe"),
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 11.sp
            )
        }
    }
}

@Composable
private fun SwipeableUpdateCard(
    update: DailyUpdate,
    modifier: Modifier = Modifier,
    canReact: Boolean = false,
    onReact: () -> Unit = {},
    onSwipeLeft: () -> Unit,
    onSwipeRight: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val density = LocalDensity.current
    val screenWidthPx = with(density) { 380.dp.toPx() }
    val swipeThreshold = with(density) { 100.dp.toPx() }

    val offsetX = remember(update.id) { Animatable(0f) }
    val rotation = remember(update.id) { Animatable(0f) }

    // Важные вести подсвечиваются рамкой по роду события
    val accentBorder = when (update.eventKind) {
        com.s0dolamby.game.domain.model.DailyEventKind.POSITIVE -> Success.copy(alpha = 0.8f)
        com.s0dolamby.game.domain.model.DailyEventKind.NEGATIVE -> Error.copy(alpha = 0.8f)
        else -> FairyGold.copy(alpha = 0.35f)
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .graphicsLayer {
                translationX = offsetX.value
                rotationZ = rotation.value
            }
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.linearGradient(
                    listOf(Color(0xFF2A1960), NightBlue)
                )
            )
            .border(
                if (update.eventKind != null) 2.dp else 1.dp,
                accentBorder,
                RoundedCornerShape(16.dp)
            )
            .pointerInput(update.id) {
                detectHorizontalDragGestures(
                    onDragEnd = {
                        coroutineScope.launch {
                            when {
                                offsetX.value > swipeThreshold -> {
                                    launch { offsetX.animateTo(screenWidthPx * 1.5f, tween(250)) }
                                    onSwipeRight()
                                }
                                offsetX.value < -swipeThreshold -> {
                                    launch { offsetX.animateTo(-screenWidthPx * 1.5f, tween(250)) }
                                    onSwipeLeft()
                                }
                                else -> {
                                    launch { offsetX.animateTo(0f, spring()) }
                                    launch { rotation.animateTo(0f, spring()) }
                                }
                            }
                        }
                    },
                    onHorizontalDrag = { _, dragAmount ->
                        coroutineScope.launch {
                            offsetX.snapTo(offsetX.value + dragAmount)
                            rotation.snapTo(offsetX.value / screenWidthPx * 12f)
                        }
                    }
                )
            }
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Карточка на фиксированном тёмном градиенте (не palette.card*) —
                // фиксированный светлый текст в обеих темах.
                Text(update.projectName, color = Color.White.copy(alpha = 0.75f), fontSize = 11.sp)
                Text("День ${update.day}", color = Color.White.copy(alpha = 0.7f), fontSize = 10.sp)
            }

            // Бейдж важного события — сразу видно, на что смотреть
            when (update.eventKind) {
                com.s0dolamby.game.domain.model.DailyEventKind.POSITIVE -> Surface(
                    color = Success.copy(alpha = 0.18f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(Strings.t("daynews.badge.positive"), color = Success,
                        fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                }
                com.s0dolamby.game.domain.model.DailyEventKind.NEGATIVE -> Surface(
                    color = Error.copy(alpha = 0.18f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(Strings.t("daynews.badge.negative"), color = Error,
                        fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                }
                else -> Unit
            }

            Text(update.title, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text(update.body, color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp)

            when (update.payoutStatus) {
                PayoutStatus.DELAYED -> Surface(
                    color = Error.copy(alpha = 0.15f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text("⚠ Выплаты задержаны", color = Error, fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                }
                PayoutStatus.BOOSTED -> Surface(
                    color = Success.copy(alpha = 0.15f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text("↑ Выплаты ускорены", color = Success, fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                }
                else -> Unit
            }

            if (update.redFlags.isNotEmpty()) {
                update.redFlags.take(2).forEach { flag ->
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Default.Warning, null, tint = Warning, modifier = Modifier.size(14.dp))
                        Text(flag.cleanRedFlag(), color = Warning, fontSize = 11.sp)
                    }
                }
            }

            // Реакция на важную весть: игра «Сечение» → бонус к довложению
            if (canReact) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(FairyGold.copy(alpha = 0.16f))
                        .border(1.dp, FairyGold.copy(alpha = 0.55f), RoundedCornerShape(10.dp))
                        .clickable { onReact() }
                ) {
                    Text(
                        // Позитив — «сорви куш» (Сечение); негатив — «отбейся» (Зоркий счёт)
                        if (update.eventKind == com.s0dolamby.game.domain.model.DailyEventKind.NEGATIVE)
                            Strings.t("daynews.react.bad")
                        else Strings.t("daynews.react"),
                        color = FairyGold,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 9.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }
        }
    }
}

private fun String.cleanRedFlag(): String =
    replace('_', ' ')
        .replace(Regex("([a-z])([A-Z])"), "$1 $2")
        .lowercase()
