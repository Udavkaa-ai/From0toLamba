package com.s0dolamby.game.presentation.minigame.common

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue

enum class MinigameStage { MEMORIZE, PLAY, RESULT }

data class MinigameOutcome(
    val errorCount: Int,
    val timeoutReached: Boolean
) {
    val isPerfect: Boolean get() = errorCount == 0 && !timeoutReached
    val isWin: Boolean get() = errorCount <= 1 && !timeoutReached
}

/**
 * Единый каркас для всех мини-игр.
 *
 * Слои сверху вниз:
 *   фон-картинка + затемнение
 *   архетипный туман-оверлей (цвет под архетип)
 *   TopAppBar с заголовком игры
 *   Шапка-диалог: аватар архетипа + реплика (зависит от этапа)
 *   Таймер-кольцо (если seconds != null)
 *   Кастомный content игры (Canvas/Row/Column игры)
 *   ResultOverlay при stage == RESULT
 *
 * Игры подают [content] — что и как рисовать в зависимости от своих этапов.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MinigameShell(
    archetype: PersonaArchetype,
    gameTitle: String,
    stage: MinigameStage,
    secondsLeft: Int?,
    onBack: () -> Unit,
    outcome: MinigameOutcome? = null,
    onAgain: () -> Unit = {},
    onClose: () -> Unit = onBack,
    /** Зовётся один раз, когда игра впервые переходит в стадию RESULT. */
    onComplete: ((MinigameOutcome) -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val style = ArchetypePalette[archetype]

    // Уведомляем верхний уровень о завершении игры — один раз
    LaunchedEffect(stage, outcome) {
        if (stage == MinigameStage.RESULT && outcome != null) {
            onComplete?.invoke(outcome)
        }
    }

    // Архетипный фон: zoom-portrait дельца сильно затемнён + цветной градиент-вуаль
    // — даёт 7 разных «комнат» вместо одного home_bg. Сверху всё ещё mist в цвете
    // архетипа для движения.
    Box(modifier = Modifier.fillMaxSize()) {
        Image(
            painter = painterResource(style.portraitRes),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            alpha = 0.55f,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer { scaleX = 1.6f; scaleY = 1.6f }
        )
        // Архетипная вуаль — снизу темнее, сверху прозрачнее в цвете архетипа
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colorStops = arrayOf(
                            0f to style.shadow.copy(alpha = 0.88f),
                            0.4f to style.shadow.copy(alpha = 0.78f),
                            1f to Color(0xF0050715)
                        )
                    )
                )
        )
        // Радиальная подсветка под палитру архетипа — лёгкое свечение в центре
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            style.primary.copy(alpha = 0.12f),
                            Color.Transparent
                        ),
                        radius = 800f
                    )
                )
        )
        // Архетипный туман поверх фона — тонко окрашивает сцену в характер дельца
        MinigameMistOverlay(
            modifier = Modifier.fillMaxSize(),
            accent = style.primary,
            intensity = if (stage == MinigameStage.RESULT && outcome?.isPerfect == true) 1.4f else 0.85f
        )

        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                TopAppBar(
                    title = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                            Text(gameTitle, fontWeight = FontWeight.Bold)
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Transparent,
                        titleContentColor = Color.White,
                        navigationIconContentColor = FairyGold
                    )
                )
            }
        ) { padding ->
            Column(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                ArchetypeHeader(
                    style = style,
                    archetypeLabel = archetype.displayLabel(),
                    line = headerLine(style, stage, outcome)
                )

                if (secondsLeft != null && stage != MinigameStage.RESULT) {
                    Spacer(Modifier.height(10.dp))
                    MinigameTimerRing(
                        secondsLeft = secondsLeft,
                        totalSeconds = secondsLeft.coerceAtLeast(1) + 1,
                        primary = style.primary,
                        accent = style.accent
                    )
                }

                Spacer(Modifier.height(12.dp))

                // Контентная зона игры. Игры используют свои Composable.
                Column(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Top,
                    content = content
                )
            }
        }

        AnimatedVisibility(
            visible = stage == MinigameStage.RESULT && outcome != null,
            enter = fadeIn(tween(220)),
            exit = fadeOut(tween(180))
        ) {
            outcome?.let {
                ResultOverlay(
                    archetype = archetype,
                    style = style,
                    outcome = it,
                    onAgain = onAgain,
                    onClose = onClose
                )
            }
        }
    }
}

@Composable
private fun ArchetypeHeader(
    style: ArchetypeStyle,
    archetypeLabel: String,
    line: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .border(2.dp, style.primary, CircleShape)
        ) {
            Image(
                painter = painterResource(style.portraitRes),
                contentDescription = archetypeLabel,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                archetypeLabel,
                color = style.primary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold
            )
            Text(line, color = Color.White, fontSize = 14.sp, lineHeight = 18.sp)
        }
    }
}

private fun headerLine(
    style: ArchetypeStyle,
    stage: MinigameStage,
    outcome: MinigameOutcome?
): String = when (stage) {
    MinigameStage.MEMORIZE, MinigameStage.PLAY -> style.tagline
    MinigameStage.RESULT -> outcome?.let {
        if (it.isWin) style.winPhrase else style.losePhrase
    } ?: style.tagline
}

private fun PersonaArchetype.displayLabel(): String = when (this) {
    PersonaArchetype.BURATINO -> "Буратино"
    PersonaArchetype.BOYARIN -> "Боярин"
    PersonaArchetype.KOSCHEI -> "Кощей"
    PersonaArchetype.KOLOBOK -> "Колобок"
    PersonaArchetype.ZOLUSHKA -> "Золушка"
    PersonaArchetype.BABA_YAGA -> "Баба-Яга"
    PersonaArchetype.IVAN_DURAK -> "Иван-Дурак"
}

@Composable
private fun ResultOverlay(
    archetype: PersonaArchetype,
    style: ArchetypeStyle,
    outcome: MinigameOutcome,
    onAgain: () -> Unit,
    onClose: () -> Unit
) {
    // Sparkle-анимация при идеальной игре
    val infinite = rememberInfiniteTransition(label = "result")
    val sparklePulse by infinite.animateFloat(
        initialValue = 0.5f, targetValue = 1f,
        animationSpec = infiniteRepeatable(
            tween(900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "sparklePulse"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xCC050715)),
        contentAlignment = Alignment.Center
    ) {
        if (outcome.isPerfect) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                drawSparkleHalo(
                    center = Offset(size.width / 2, size.height / 2),
                    radius = size.minDimension * 0.32f,
                    count = 12,
                    sparkleSize = 16f,
                    color = style.primary,
                    intensity = sparklePulse
                )
            }
        }
        Column(
            modifier = Modifier
                .clip(RoundedCornerShape(24.dp))
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color(0xFF1A0F3F).copy(alpha = 0.95f),
                            NightBlue.copy(alpha = 0.98f)
                        )
                    )
                )
                .border(1.dp, style.primary.copy(alpha = 0.5f), RoundedCornerShape(24.dp))
                .padding(horizontal = 24.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            val emoji = when {
                outcome.isPerfect -> "🌟"
                outcome.isWin -> "🎉"
                outcome.timeoutReached -> "⌛"
                else -> "❌"
            }
            val title = when {
                outcome.isPerfect -> "Идеально!"
                outcome.isWin -> "Хорошо"
                outcome.timeoutReached -> "Не успел"
                else -> "Промах"
            }
            val body = when {
                outcome.isPerfect -> "Все детали разглядел — даже хозяин удивился."
                outcome.isWin -> "Один промах простителен. Получи свою долю."
                outcome.timeoutReached -> "Время вышло, делец укатился."
                else -> "Слишком много ошибок. Дельца просто так не возьмёшь."
            }
            Text(emoji, fontSize = 48.sp)
            Spacer(Modifier.height(8.dp))
            Text(title, color = style.primary, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(6.dp))
            Text(
                body,
                color = Color.White.copy(alpha = 0.78f),
                fontSize = 13.sp,
                lineHeight = 18.sp,
                modifier = Modifier.widthIn(max = 240.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
            if (outcome.isPerfect) {
                Spacer(Modifier.height(10.dp))
                Surface(
                    color = style.primary.copy(alpha = 0.18f),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp, style.primary.copy(alpha = 0.45f)
                    )
                ) {
                    Text(
                        "🪙  Жетон ${archetype.displayLabel()}",
                        color = style.primary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            } else if (!outcome.isWin) {
                Spacer(Modifier.height(10.dp))
                Text(
                    "Тут позже появится «Смотреть рекламу — обойти»",
                    color = Color.White.copy(alpha = 0.45f),
                    fontSize = 11.sp,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }
            Spacer(Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(
                    onClick = onAgain,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = style.primary,
                        contentColor = Color(0xFF1A0A00)
                    )
                ) { Text("Ещё раз", fontWeight = FontWeight.SemiBold) }
                OutlinedButton(onClick = onClose) { Text("Закрыть") }
            }
        }
    }
}

