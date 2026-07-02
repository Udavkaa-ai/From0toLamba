package com.s0dolamby.game.presentation.common.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard
import com.s0dolamby.game.presentation.common.theme.LocalAppPalette
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import com.s0dolamby.game.presentation.common.theme.LocalContentColorSecondary

/**
 * Карточка в стиле «двух тем»:
 *  • тёмная ночь — фиолет→ночной синий, текст светлый;
 *  • тёплая ярмарка — пергамент, текст тёмная сепия.
 *
 * Карточка не только красит фон, но и провайдит `LocalContentColor` с
 * подходящим оттенком, чтобы дочерние `Text` без явного `color =`
 * автоматически читались на правильном по теме фоне. Места, где цвет
 * текста задан жёстко (`color = Color.White`), переезжают на
 * `LocalContentColor.current` или на `palette.onCard*` порционно.
 */
/**
 * Провайдит те же цветовые локали, что и [FairyCard] — для КАСТОМНЫХ
 * карточек (свой Card/Box с palette.cardTop-градиентом), которые не
 * используют FairyCard напрямую. Без этого `LocalContentColorMuted` и
 * прочие возвращают дефолтный полупрозрачный белый: на пергаменте тёплой
 * темы текст исчезает, на тёмной — едва виден.
 */
@Composable
fun ProvideOnCardColors(content: @Composable () -> Unit) {
    val palette = LocalAppPalette.current
    CompositionLocalProvider(
        LocalContentColor provides palette.onCard,
        LocalContentColorSecondary provides palette.onCardSecondary,
        LocalContentColorMuted provides palette.onCardMuted,
        LocalAccentOnCard provides palette.accentOnCard,
        content = content
    )
}

@Composable
fun FairyCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    innerPadding: Int = 16,
    /**
     * Опциональная full-bleed «шапка» карточки — рисуется БЕЗ внутреннего
     * padding, от края до края (как баннер дела в TG: 120dp картинка
     * упирается в скруглённые углы карточки). Контент после шапки идёт в
     * Column с обычным `innerPadding`.
     */
    headerContent: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val palette = LocalAppPalette.current
    val body: @Composable () -> Unit = {
        Box {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Brush.verticalGradient(colors = listOf(palette.cardTop, palette.cardMid, palette.cardBottom)))
            ) {
                ProvideOnCardColors {
                    headerContent?.invoke()
                    Column(
                        modifier = Modifier.padding(innerPadding.dp),
                        content = content
                    )
                }
            }
            CardCornerOrnaments(modifier = Modifier.matchParentSize())
        }
    }

    if (onClick != null) {
        Card(
            onClick = onClick,
            modifier = modifier,
            colors = CardDefaults.cardColors(containerColor = Color.Transparent)
        ) { body() }
    } else {
        Card(
            modifier = modifier,
            colors = CardDefaults.cardColors(containerColor = Color.Transparent)
        ) { body() }
    }
}
