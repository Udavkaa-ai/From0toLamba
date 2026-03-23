package com.s0dolamby.game.presentation.home

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.domain.model.InvestorRank
import com.s0dolamby.game.presentation.common.components.CardCornerOrnaments
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import androidx.compose.runtime.withFrameMillis
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

// ─── Firework particle ────────────────────────────────────────────────────────

private data class FireworkParticle(
    var x: Float,    // relative 0..1
    var y: Float,    // relative 0..1
    var vx: Float,   // relative units/sec
    var vy: Float,
    var life: Float, // 1 → 0
    val color: Color,
    val radius: Float
)

// ─── Rank display helpers ─────────────────────────────────────────────────────

private val InvestorRank.celebrationEmoji: String get() = when (this) {
    InvestorRank.NEWBIE      -> "🐣"
    InvestorRank.AMBASSADOR  -> "📣"
    InvestorRank.ANALYST     -> "🔍"
    InvestorRank.SHARK       -> "🦈"
    InvestorRank.LAMBO_SENSEI -> "👑"
}

private val InvestorRank.congratsTitle: String get() = when (this) {
    InvestorRank.NEWBIE      -> "Добро пожаловать в торговлю!"
    InvestorRank.AMBASSADOR  -> "Первые шаги сделаны!"
    InvestorRank.ANALYST     -> "Чуйка не подводит!"
    InvestorRank.SHARK       -> "Слава о тебе гремит по ярмарке!"
    InvestorRank.LAMBO_SENSEI -> "Легенда среди купцов!"
}

private val InvestorRank.congratsText: String get() = when (this) {
    InvestorRank.NEWBIE      -> "Пустой кошель — не приговор. Всякий Царь начинал Скоморохом."
    InvestorRank.AMBASSADOR  -> "Ты вступил на купеческий путь. Первые рубли — первые уроки. Слушай чуйку."
    InvestorRank.ANALYST     -> "Твой взгляд острее дьячьего пера. Мошенники дрожат — Мудрец пришёл на ярмарку."
    InvestorRank.SHARK       -> "Богатырская хватка! Дельцы трижды думают, прежде чем явиться к тебе с ложью."
    InvestorRank.LAMBO_SENSEI -> "Царь! Отныне имя твоё вписано в Летопись. Никакой обман тебя не проведёт."
}

private val burstColors = listOf(
    FairyGold,
    Color(0xFFFF4444),
    Color(0xFF44FF88),
    Color(0xFF44AAFF),
    Color(0xFFCC44FF),
    Color(0xFFFFAA22),
    Color(0xFFFF88CC),
    Color(0xFFFFFFAA),
)

// ─── Main composable ─────────────────────────────────────────────────────────

@Composable
fun RankUpCelebrationOverlay(
    rank: InvestorRank,
    onDismiss: () -> Unit
) {
    val particles = remember { mutableStateListOf<FireworkParticle>() }

    // Particle animation loop
    LaunchedEffect(Unit) {
        var lastBurstMs = 0L
        var lastFrameMs = 0L

        while (true) {
            val now = withFrameMillis { it }
            val dt = if (lastFrameMs == 0L) 0f else (now - lastFrameMs).coerceAtMost(50L) / 1000f
            lastFrameMs = now

            // Spawn a burst every ~600 ms
            if (now - lastBurstMs > 600L) {
                lastBurstMs = now
                val bx = Random.nextFloat() * 0.8f + 0.1f
                val by = Random.nextFloat() * 0.45f + 0.05f
                val baseColor = burstColors.random()
                val count = 20
                repeat(count) { i ->
                    val angle = (i.toFloat() / count) * 2f * PI.toFloat() +
                        Random.nextFloat() * 0.5f
                    val speed = Random.nextFloat() * 0.28f + 0.08f
                    particles += FireworkParticle(
                        x = bx, y = by,
                        vx = cos(angle) * speed,
                        vy = sin(angle) * speed,
                        life = 1f,
                        color = if (Random.nextFloat() > 0.3f) baseColor else burstColors.random(),
                        radius = Random.nextFloat() * 3f + 2f
                    )
                }
                // Trailing sparkles from the burst center
                repeat(8) {
                    val angle = Random.nextFloat() * 2f * PI.toFloat()
                    val speed = Random.nextFloat() * 0.1f + 0.02f
                    particles += FireworkParticle(
                        x = bx, y = by,
                        vx = cos(angle) * speed,
                        vy = sin(angle) * speed,
                        life = 1f,
                        color = FairyGold,
                        radius = 1.5f
                    )
                }
            }

            // Update & cull
            val gravity = 0.25f
            val iter = particles.iterator()
            while (iter.hasNext()) {
                val p = iter.next()
                p.x += p.vx * dt
                p.y += p.vy * dt
                p.vy += gravity * dt
                p.life -= dt * 0.65f
                if (p.life <= 0f || p.y > 1.15f) iter.remove()
            }
        }
    }

    // Card entrance spring
    val cardScale = remember { Animatable(0.65f) }
    LaunchedEffect(Unit) {
        cardScale.animateTo(
            1f,
            spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMediumLow)
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.78f)),
        contentAlignment = Alignment.Center
    ) {
        // ── Full-screen fireworks ──
        Canvas(modifier = Modifier.fillMaxSize()) {
            particles.forEach { p ->
                drawFireworkParticle(p)
            }
        }

        // ── Грамота card ──
        Box(
            modifier = Modifier
                .graphicsLayer { scaleX = cardScale.value; scaleY = cardScale.value }
                .padding(horizontal = 20.dp)
                .fillMaxWidth()
        ) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = Color.Transparent,
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.verticalGradient(
                                listOf(
                                    EnchantedPurple,
                                    Color(0xFF1A0D40),
                                    NightBlue
                                )
                            ),
                            shape = RoundedCornerShape(20.dp)
                        )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(28.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Header
                        Text(
                            "✦  Жалованная Грамота  ✦",
                            style = MaterialTheme.typography.labelMedium,
                            color = FairyGold.copy(alpha = 0.65f),
                            fontStyle = FontStyle.Italic,
                            letterSpacing = 1.5.sp
                        )

                        OrnamentDivider()

                        // Big emoji
                        Text(
                            rank.celebrationEmoji,
                            fontSize = 72.sp
                        )

                        // Rank name
                        Text(
                            "Отныне чин твой —",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.6f)
                        )
                        Text(
                            rank.displayName,
                            style = MaterialTheme.typography.headlineLarge,
                            fontWeight = FontWeight.Bold,
                            color = FairyGold,
                            letterSpacing = 2.sp
                        )

                        OrnamentDivider()

                        // Title
                        Text(
                            rank.congratsTitle,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White,
                            textAlign = TextAlign.Center
                        )

                        // Body text
                        Text(
                            rank.congratsText,
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.White.copy(alpha = 0.75f),
                            textAlign = TextAlign.Center,
                            fontStyle = FontStyle.Italic
                        )

                        Spacer(Modifier.height(4.dp))

                        Button(
                            onClick = onDismiss,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = FairyGold,
                                contentColor = Color(0xFF1A0A00)
                            )
                        ) {
                            Text(
                                "Принять с честью  ✦",
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.bodyLarge
                            )
                        }
                    }
                }
            }
            CardCornerOrnaments(
                modifier = Modifier.matchParentSize(),
                cornerSize = 22.dp,
                alpha = 0.55f
            )
        }
    }
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

private fun DrawScope.drawFireworkParticle(p: FireworkParticle) {
    val alpha = p.life.coerceIn(0f, 1f)
    val r = (p.radius * p.life + 1f) * density
    drawCircle(
        color = p.color.copy(alpha = alpha),
        radius = r,
        center = Offset(p.x * size.width, p.y * size.height)
    )
    // Tiny tail
    if (p.life > 0.4f) {
        val tailLen = r * 2.5f
        val nx = if (p.vx != 0f || p.vy != 0f) {
            val len = kotlin.math.sqrt(p.vx * p.vx + p.vy * p.vy)
            p.vx / len to p.vy / len
        } else 0f to 0f
        val tailPath = Path().apply {
            val cx = p.x * size.width
            val cy = p.y * size.height
            moveTo(cx, cy)
            lineTo(cx - nx.first * tailLen, cy - nx.second * tailLen)
        }
        drawPath(tailPath, p.color.copy(alpha = alpha * 0.4f),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = r * 0.5f))
    }
}
