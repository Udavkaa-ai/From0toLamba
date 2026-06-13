package com.s0dolamby.game.presentation.common.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import com.s0dolamby.game.presentation.common.theme.FairyGold
import kotlin.math.PI
import kotlin.math.cos
import kotlin.random.Random

private data class CoinParticle(
    var x: Float,
    var y: Float,
    var vy: Float,
    var rotation: Float,
    var rotationSpeed: Float,
    val color: Color,
    val radius: Float,
    var life: Float
)

/**
 * Лёгкий «золотой дождь» — спавнит ~40 монет на 1.6 секунды и даёт им
 * упасть с гравитацией. Никаких блокирующих overlay'ев и тапов — просто
 * декоративная посыпка над контентом.
 *
 * Перезапускается, когда `seed` меняется (Int/String — любой ключ).
 */
@Composable
fun CoinShowerOverlay(seed: Any?) {
    if (seed == null) return
    val particles = remember(seed) { mutableStateListOf<CoinParticle>() }
    LaunchedEffect(seed) {
        // первый бросок
        repeat(34) {
            particles += CoinParticle(
                x = Random.nextFloat(),
                y = -Random.nextFloat() * 0.3f,
                vy = Random.nextFloat() * 0.35f + 0.4f,
                rotation = Random.nextFloat() * 360f,
                rotationSpeed = (Random.nextFloat() - 0.5f) * 720f,
                color = listOf(
                    FairyGold,
                    Color(0xFFFFD66B),
                    Color(0xFFFFB347),
                    Color(0xFFFFE08A)
                ).random(),
                radius = Random.nextFloat() * 6f + 8f,
                life = 1f
            )
        }
        var lastBurstMs = 0L
        var lastFrameMs = 0L
        var elapsed = 0f
        while (elapsed < 1.6f) {
            val now = withFrameMillis { it }
            val dt = if (lastFrameMs == 0L) 0f else (now - lastFrameMs).coerceAtMost(50L) / 1000f
            lastFrameMs = now
            elapsed += dt

            // ещё кидать монеты в первые 0.6с
            if (elapsed < 0.6f && now - lastBurstMs > 60L) {
                lastBurstMs = now
                particles += CoinParticle(
                    x = Random.nextFloat(),
                    y = -0.1f,
                    vy = Random.nextFloat() * 0.4f + 0.35f,
                    rotation = Random.nextFloat() * 360f,
                    rotationSpeed = (Random.nextFloat() - 0.5f) * 720f,
                    color = FairyGold,
                    radius = Random.nextFloat() * 5f + 7f,
                    life = 1f
                )
            }

            // обновим
            val iter = particles.iterator()
            while (iter.hasNext()) {
                val p = iter.next()
                p.y += p.vy * dt
                p.vy += 0.35f * dt           // гравитация
                p.rotation += p.rotationSpeed * dt
                if (p.y > 1.05f) p.life -= dt * 2f
                if (p.life <= 0f) iter.remove()
            }
        }
        // дожить хвосты
        while (particles.isNotEmpty()) {
            val now = withFrameMillis { it }
            val dt = if (lastFrameMs == 0L) 0f else (now - lastFrameMs).coerceAtMost(50L) / 1000f
            lastFrameMs = now
            val iter = particles.iterator()
            while (iter.hasNext()) {
                val p = iter.next()
                p.y += p.vy * dt
                p.vy += 0.35f * dt
                p.rotation += p.rotationSpeed * dt
                p.life -= dt * 1.5f
                if (p.life <= 0f || p.y > 1.2f) iter.remove()
            }
        }
    }

    Canvas(modifier = Modifier.fillMaxSize()) {
        particles.forEach { p ->
            val cx = p.x * size.width
            val cy = p.y * size.height
            val r = p.radius * density
            val alpha = p.life.coerceIn(0f, 1f)
            // монетка — эллипс, имитируется через scale Y по cos(rotation)
            val flatten = cos(p.rotation * PI / 180f).toFloat().let { kotlin.math.abs(it).coerceAtLeast(0.15f) }
            rotate(p.rotation, Offset(cx, cy)) {
                drawCircle(
                    color = p.color.copy(alpha = alpha),
                    radius = r,
                    center = Offset(cx, cy)
                )
                // обводка
                drawCircle(
                    color = Color(0xFF8B5A2B).copy(alpha = alpha * 0.6f),
                    radius = r,
                    center = Offset(cx, cy),
                    style = Stroke(width = 1.5f)
                )
                // ребро (эллипс)
                drawCircle(
                    color = Color(0xFFC79A47).copy(alpha = alpha * 0.55f),
                    radius = r * flatten,
                    center = Offset(cx, cy)
                )
            }
        }
    }
}
