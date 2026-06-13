package com.s0dolamby.game.presentation.common.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Карточка в стиле HomeScreen: градиентный фон
 * primaryContainer → background (по палитре активной темы) + золотые
 * угловые орнаменты. На тёплой ярмарке градиент уходит в карамельные тона.
 */
@Composable
fun FairyCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    innerPadding: Int = 16,
    content: @Composable ColumnScope.() -> Unit
) {
    val top = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.88f)
    val bottom = MaterialTheme.colorScheme.background.copy(alpha = 0.95f)
    val body: @Composable () -> Unit = {
        Box {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Brush.verticalGradient(colors = listOf(top, bottom)))
            ) {
                Column(
                    modifier = Modifier.padding(innerPadding.dp),
                    content = content
                )
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
