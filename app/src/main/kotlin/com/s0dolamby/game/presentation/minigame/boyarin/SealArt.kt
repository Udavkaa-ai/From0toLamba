package com.s0dolamby.game.presentation.minigame.boyarin

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import com.s0dolamby.game.domain.model.InvestorRank
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// ─────────────────────────────────────────────────────────────────────────
//  Процедурная купеческая печать — перенос движка из TG-версии (components/Seal.tsx).
//  6 НЕЗАВИСИМЫХ признаков; подделка врёт ровно в ОДНОМ из них, и признак
//  ВИДИМЫЙ (форма / зверь / число точек / кольца / оттенок / размер), а не
//  тонкая игра света. Все признаки инвариантны к повороту — поэтому клетки
//  можно медленно вращать, не делая подделку неотличимой.
// ─────────────────────────────────────────────────────────────────────────

enum class SealShape { CIRCLE, SQUARE, DIAMOND, HEXAGON, OCTAGON, TRIANGLE_UP, TRIANGLE_DOWN, SHIELD }

/** primary заметно ярче фона клетки, secondary — тёмный для линий и эмблемы. */
data class SealColor(val key: String, val primary: Color, val secondary: Color)

val SEAL_COLORS: List<SealColor> = listOf(
    SealColor("gold", Color(0xFFE8B833), Color(0xFF5A3100)),
    SealColor("bronze", Color(0xFFC97A3E), Color(0xFF4A2208)),
    SealColor("crimson", Color(0xFFD14B4B), Color(0xFF4D1010)),
    SealColor("emerald", Color(0xFF4FA577), Color(0xFF123322)),
    SealColor("indigo", Color(0xFF6275C4), Color(0xFF1A2348)),
    SealColor("violet", Color(0xFFA855F7), Color(0xFF2E1065)),
    SealColor("teal", Color(0xFF2DD4BF), Color(0xFF0F4440))
)

enum class SealBorder { SOLID, DOUBLE, TEETH }

private val RING_COUNTS = listOf(0, 1, 2, 3)
private val DOT_COUNTS = listOf(0, 4, 6, 8, 12)

enum class SealAnimal { BEAR, WOLF, DEER, FALCON, BOAR, FISH }
enum class SealMotif { ANCHOR, KEY, FEATHER, HORSESHOE, CROWN, SWORD, FLAME }

sealed class SealEmblem {
    data class Animal(val v: SealAnimal) : SealEmblem()
    data class Motif(val v: SealMotif) : SealEmblem()
}

private val ALL_EMBLEMS: List<SealEmblem> =
    SealAnimal.values().map { SealEmblem.Animal(it) } +
        SealMotif.values().map { SealEmblem.Motif(it) }

data class Seal(
    val shape: SealShape,
    val color: SealColor,
    val rings: Int,
    val border: SealBorder,
    val dots: Int,
    val emblem: SealEmblem,
    /** масштаб рисунка внутри клетки (1.0 = норма) — признак «размер». */
    val innerScale: Float = 1f
)

// ─── Хэш и детерминированный выбор ──────────────────────────────────────────

private fun hash(s: String): Int {
    var h = -0x7ee3623b // 0x811C9DC5 (FNV-1a offset basis)
    for (c in s) {
        h = h xor c.code
        h *= 0x01000193
    }
    return h and 0x7fffffff
}

private fun channel(seed: String, ch: String): Int = hash("$seed::$ch")

private fun <T> pickBy(list: List<T>, n: Int): T = list[n % list.size]

fun generateReferenceSeal(seed: String): Seal = Seal(
    shape = SealShape.values()[channel(seed, "shape") % SealShape.values().size],
    color = SEAL_COLORS[channel(seed, "color") % SEAL_COLORS.size],
    rings = RING_COUNTS[channel(seed, "rings") % RING_COUNTS.size],
    border = SealBorder.values()[channel(seed, "border") % SealBorder.values().size],
    dots = DOT_COUNTS[channel(seed, "dots") % DOT_COUNTS.size],
    emblem = ALL_EMBLEMS[channel(seed, "emblem") % ALL_EMBLEMS.size]
)

// ─── Мутация (что делает подделку) ──────────────────────────────────────────

enum class MutTarget { SHAPE, RINGS, EMBLEM_SAME, COLOR_HUE, DOTS, SIZE }

/** Пул отличий по чину — от ГРУБЫХ (видно с одного взгляда) к ТОНКИМ
 *  (надо всматриваться и помнить эталон). Форма и размер — самые заметные,
 *  их отдаём только Скомороху; всем выше — точки/эмблема/кольца/оттенок,
 *  которые не выцепить «на глаз» без внимания.
 *   - Скоморох: форма (круг↔шестигранник) — мгновенно, для обучения.
 *   - Купец: число точек и силуэт эмблемы — надо приглядеться.
 *   - Мудрец: + кольца.
 *   - Боярин: кольца, оттенок, схожая эмблема — тонко.
 *   - Князь: оттенок и кольца — почти незаметно. */
val RANK_MUT_POOLS: Map<InvestorRank, List<MutTarget>> = mapOf(
    InvestorRank.NEWBIE to listOf(MutTarget.SHAPE),
    InvestorRank.AMBASSADOR to listOf(MutTarget.DOTS, MutTarget.EMBLEM_SAME),
    InvestorRank.ANALYST to listOf(MutTarget.DOTS, MutTarget.EMBLEM_SAME, MutTarget.RINGS),
    InvestorRank.SHARK to listOf(MutTarget.RINGS, MutTarget.COLOR_HUE, MutTarget.EMBLEM_SAME),
    InvestorRank.LAMBO_SENSEI to listOf(MutTarget.COLOR_HUE, MutTarget.RINGS)
)

/** Визуально схожие формы — соседние геометрии. ВАЖНО: пара всегда отличается
 *  ЧИСЛОМ углов, а не поворотом. Иначе при вращении клеток квадрат и ромб
 *  (это один и тот же квадрат, повёрнутый на 45°) стали бы неотличимы. */
private val SIMILAR_SHAPE: Map<SealShape, SealShape> = mapOf(
    SealShape.CIRCLE to SealShape.HEXAGON,        // круг → 6 углов
    SealShape.SQUARE to SealShape.HEXAGON,        // 4 → 6 (НЕ ромб — он конгруэнтен квадрату)
    SealShape.DIAMOND to SealShape.TRIANGLE_DOWN, // 4 → 3 (НЕ квадрат)
    SealShape.HEXAGON to SealShape.OCTAGON,       // 6 → 8
    SealShape.OCTAGON to SealShape.HEXAGON,       // 8 → 6
    SealShape.TRIANGLE_UP to SealShape.SHIELD,    // оба с острой вершиной сверху
    SealShape.TRIANGLE_DOWN to SealShape.DIAMOND, // 3 → 4
    SealShape.SHIELD to SealShape.TRIANGLE_UP
)

/** Визуально схожие эмблемы — подбор по силуэту, не по смыслу. */
private val SIMILAR_ANIMAL: Map<SealAnimal, SealAnimal> = mapOf(
    SealAnimal.BEAR to SealAnimal.BOAR,
    SealAnimal.BOAR to SealAnimal.BEAR,
    SealAnimal.WOLF to SealAnimal.DEER,
    SealAnimal.DEER to SealAnimal.WOLF,
    SealAnimal.FALCON to SealAnimal.FISH,
    SealAnimal.FISH to SealAnimal.FALCON
)
private val SIMILAR_MOTIF: Map<SealMotif, SealMotif> = mapOf(
    SealMotif.FEATHER to SealMotif.FLAME,
    SealMotif.FLAME to SealMotif.FEATHER,
    SealMotif.ANCHOR to SealMotif.SWORD,
    SealMotif.SWORD to SealMotif.ANCHOR,
    SealMotif.KEY to SealMotif.CROWN,
    SealMotif.CROWN to SealMotif.KEY,
    SealMotif.HORSESHOE to SealMotif.ANCHOR
)

private fun <T> nextInList(arr: List<T>, current: T, step: Int): T {
    val i = arr.indexOf(current)
    val safeStep = (((step % (arr.size - 1)) + (arr.size - 1)) % (arr.size - 1)) + 1
    return arr[(i + safeStep) % arr.size]
}

/** Сдвиг тона (HSL hue) на N градусов; яркость и насыщенность не трогаем. */
private fun shiftHue(c: Color, degrees: Float): Color {
    val r = c.red; val g = c.green; val b = c.blue
    val mx = max(r, max(g, b)); val mn = min(r, min(g, b))
    val l = (mx + mn) / 2f
    var h = 0f; var s = 0f
    if (mx != mn) {
        val d = mx - mn
        s = if (l > 0.5f) d / (2 - mx - mn) else d / (mx + mn)
        h = when (mx) {
            r -> ((g - b) / d + (if (g < b) 6f else 0f))
            g -> ((b - r) / d + 2f)
            else -> ((r - g) / d + 4f)
        } * 60f
    }
    h = (h + degrees + 360f) % 360f
    val cc = (1 - abs(2 * l - 1)) * s
    val x = cc * (1 - abs((h / 60f) % 2f - 1))
    val m = l - cc / 2
    val (r2, g2, b2) = when {
        h < 60 -> Triple(cc, x, 0f)
        h < 120 -> Triple(x, cc, 0f)
        h < 180 -> Triple(0f, cc, x)
        h < 240 -> Triple(0f, x, cc)
        h < 300 -> Triple(x, 0f, cc)
        else -> Triple(cc, 0f, x)
    }
    return Color(
        (r2 + m).coerceIn(0f, 1f),
        (g2 + m).coerceIn(0f, 1f),
        (b2 + m).coerceIn(0f, 1f)
    )
}

fun mutateSeal(ref: Seal, seed: String, index: Int, pool: List<MutTarget>): Seal {
    val h = hash("$seed:cell$index:mut")
    val target = pool[h % pool.size]
    val step = (h ushr 4) + 1
    return when (target) {
        MutTarget.SHAPE -> ref.copy(shape = SIMILAR_SHAPE.getValue(ref.shape))
        MutTarget.RINGS -> ref.copy(rings = nextInList(RING_COUNTS, ref.rings, step))
        MutTarget.DOTS -> ref.copy(
            dots = DOT_COUNTS[(DOT_COUNTS.indexOf(ref.dots) + 2) % DOT_COUNTS.size]
        )
        MutTarget.COLOR_HUE -> {
            val dir = if (h and 1 == 0) 1f else -1f
            ref.copy(
                color = SealColor(
                    key = ref.color.key + (if (dir > 0) "-warm" else "-cool"),
                    primary = shiftHue(ref.color.primary, 20f * dir),
                    secondary = shiftHue(ref.color.secondary, 20f * dir)
                )
            )
        }
        MutTarget.SIZE -> ref.copy(innerScale = if ((h shr 3) and 1 == 0) 0.85f else 1.15f)
        MutTarget.EMBLEM_SAME -> ref.copy(
            emblem = when (val e = ref.emblem) {
                is SealEmblem.Animal -> SealEmblem.Animal(SIMILAR_ANIMAL.getValue(e.v))
                is SealEmblem.Motif -> SealEmblem.Motif(SIMILAR_MOTIF.getValue(e.v))
            }
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  Отрисовка на Canvas. Всё рисуется в системе координат 0..100 (как SVG
//  viewBox из TG), затем масштабируется под размер клетки.
// ─────────────────────────────────────────────────────────────────────────

private fun lighten(c: Color, f: Float) = Color(
    c.red + (1 - c.red) * f, c.green + (1 - c.green) * f, c.blue + (1 - c.blue) * f, c.alpha
)

private fun darken(c: Color, f: Float) = Color(
    c.red * (1 - f), c.green * (1 - f), c.blue * (1 - f), c.alpha
)

private fun regularPolygon(cx: Float, cy: Float, r: Float, n: Int, start: Float): Path {
    val p = Path()
    for (i in 0 until n) {
        val a = start + (i.toFloat() / n) * (PI * 2).toFloat()
        val x = cx + cos(a) * r; val y = cy + sin(a) * r
        if (i == 0) p.moveTo(x, y) else p.lineTo(x, y)
    }
    p.close()
    return p
}

/** Контур формы радиуса r (для заливки и обводок/колец). */
private fun shapePath(shape: SealShape, r: Float): Path = when (shape) {
    SealShape.CIRCLE -> Path().apply { addOval(Rect(50f - r, 50f - r, 50f + r, 50f + r)) }
    SealShape.SQUARE -> {
        val s = r * 1.7f
        Path().apply { addRect(Rect(50f - s / 2, 50f - s / 2, 50f + s / 2, 50f + s / 2)) }
    }
    SealShape.DIAMOND -> Path().apply {
        moveTo(50f, 50f - r); lineTo(50f + r, 50f); lineTo(50f, 50f + r); lineTo(50f - r, 50f); close()
    }
    SealShape.HEXAGON -> regularPolygon(50f, 50f, r, 6, (-PI / 2).toFloat())
    SealShape.OCTAGON -> regularPolygon(50f, 50f, r, 8, (-PI / 8).toFloat())
    SealShape.TRIANGLE_UP -> regularPolygon(50f, 52f, r + 2, 3, (-PI / 2).toFloat())
    SealShape.TRIANGLE_DOWN -> regularPolygon(50f, 48f, r + 2, 3, (PI / 2).toFloat())
    SealShape.SHIELD -> Path().apply {
        moveTo(50f, 50f - r + 2)
        lineTo(50f + r - 6, 50f - r + 10)
        lineTo(50f + r - 6, 50f)
        quadraticBezierTo(50f + r - 6, 50f + r - 2, 50f, 50f + r + 4)
        quadraticBezierTo(50f - r + 6, 50f + r - 2, 50f - r + 6, 50f)
        lineTo(50f - r + 6, 50f - r + 10)
        close()
    }
}

/** Рисует печать в текущем DrawScope, вписывая её в квадрат size×size. */
fun DrawScope.drawSeal(seal: Seal, dim: Boolean = false) {
    val u = size.minDimension / 100f
    val a = if (dim) 0.4f else 1f
    withTransform({ scale(u, u, pivot = Offset.Zero) }) {
        // Точки-розетка на внешнем кольце — не масштабируются признаком «размер»
        drawDots(seal, a)
        // Тело печати масштабируется при мутации размера
        withTransform({ scale(seal.innerScale, seal.innerScale, pivot = Offset(50f, 50f)) }) {
            drawBody(seal, a)
            drawGloss(a)
            drawRings(seal, a)
            drawBorder(seal, a)
            drawEmblem(seal, a)
        }
    }
}

private fun DrawScope.drawBody(seal: Seal, a: Float) {
    val fill = Brush.radialGradient(
        colors = listOf(
            lighten(seal.color.primary, 0.35f).copy(alpha = a),
            seal.color.primary.copy(alpha = a),
            darken(seal.color.primary, 0.35f).copy(alpha = a)
        ),
        center = Offset(35f, 30f),
        radius = 75f
    )
    val path = shapePath(seal.shape, 36f)
    drawPath(path, brush = fill)
    drawPath(path, color = seal.color.secondary.copy(alpha = a), style = Stroke(width = 2f))
}

private fun DrawScope.drawGloss(a: Float) {
    // Полу-эллиптический глянец сверху — «стекло» на воске
    drawOval(
        brush = Brush.verticalGradient(
            colors = listOf(Color.White.copy(alpha = 0.30f * a), Color.Transparent),
            startY = 21f, endY = 43f
        ),
        topLeft = Offset(28f, 21f),
        size = Size(44f, 22f)
    )
}

private fun DrawScope.drawRings(seal: Seal, a: Float) {
    if (seal.rings == 0) return
    val base = 30f
    for (i in 0 until seal.rings) {
        val r = base - i * 4
        if (r > 8) drawPath(
            shapePath(seal.shape, r),
            color = seal.color.secondary.copy(alpha = a),
            style = Stroke(width = 1f)
        )
    }
}

private fun DrawScope.drawBorder(seal: Seal, a: Float) {
    when (seal.border) {
        SealBorder.SOLID -> Unit
        SealBorder.DOUBLE -> drawPath(
            shapePath(seal.shape, 33f),
            color = seal.color.secondary.copy(alpha = 0.8f * a),
            style = Stroke(width = 1f)
        )
        SealBorder.TEETH -> {
            val r = 34f
            for (i in 0 until 20) {
                val ang = (i.toFloat() / 20) * (PI * 2).toFloat()
                drawLine(
                    color = seal.color.secondary.copy(alpha = a),
                    start = Offset(50f + cos(ang) * r, 50f + sin(ang) * r),
                    end = Offset(50f + cos(ang) * (r - 4), 50f + sin(ang) * (r - 4)),
                    strokeWidth = 1.2f
                )
            }
        }
    }
}

private fun DrawScope.drawDots(seal: Seal, a: Float) {
    if (seal.dots == 0) return
    val r = 44f
    for (i in 0 until seal.dots) {
        val ang = (i.toFloat() / seal.dots) * (PI * 2).toFloat() - (PI / 2).toFloat()
        val c = Offset(50f + cos(ang) * r, 50f + sin(ang) * r)
        drawCircle(seal.color.primary.copy(alpha = a), radius = 3f, center = c)
        drawCircle(seal.color.secondary.copy(alpha = a), radius = 3f, center = c, style = Stroke(width = 0.6f))
    }
}

// ─── Эмблемы ────────────────────────────────────────────────────────────────

private fun DrawScope.drawEmblem(seal: Seal, a: Float) {
    val fill = seal.color.secondary.copy(alpha = a)
    when (val e = seal.emblem) {
        is SealEmblem.Motif -> drawMotif(e.v, fill)
        is SealEmblem.Animal -> drawAnimal(e.v, fill)
    }
}

private fun DrawScope.drawMotif(m: SealMotif, fill: Color) {
    when (m) {
        SealMotif.ANCHOR -> {
            drawCircle(fill, radius = 3f, center = Offset(50f, 34f))
            drawLine(fill, Offset(50f, 37f), Offset(50f, 65f), strokeWidth = 3f)
            drawLine(fill, Offset(40f, 45f), Offset(60f, 45f), strokeWidth = 3f)
            drawPath(Path().apply {
                moveTo(37f, 60f); quadraticBezierTo(50f, 72f, 63f, 60f)
            }, color = fill, style = Stroke(width = 3f))
        }
        SealMotif.KEY -> {
            drawCircle(fill, radius = 7f, center = Offset(50f, 36f), style = Stroke(width = 3f))
            drawLine(fill, Offset(50f, 43f), Offset(50f, 68f), strokeWidth = 3f)
            drawLine(fill, Offset(50f, 58f), Offset(56f, 58f), strokeWidth = 3f)
            drawLine(fill, Offset(50f, 64f), Offset(58f, 64f), strokeWidth = 3f)
        }
        SealMotif.FEATHER -> {
            drawPath(Path().apply {
                moveTo(38f, 68f)
                quadraticBezierTo(40f, 50f, 50f, 36f)
                quadraticBezierTo(60f, 26f, 66f, 30f)
                quadraticBezierTo(62f, 40f, 54f, 50f)
                quadraticBezierTo(46f, 60f, 38f, 68f)
                close()
            }, color = fill)
            drawLine(fill, Offset(38f, 68f), Offset(32f, 74f), strokeWidth = 2f)
        }
        SealMotif.HORSESHOE -> {
            drawPath(Path().apply {
                moveTo(34f, 40f); quadraticBezierTo(34f, 66f, 50f, 66f); quadraticBezierTo(66f, 66f, 66f, 40f)
            }, color = fill, style = Stroke(width = 4f))
            for (c in listOf(Offset(34f, 42f), Offset(66f, 42f), Offset(38f, 58f), Offset(62f, 58f))) {
                drawCircle(fill, radius = 1.5f, center = c)
            }
        }
        SealMotif.CROWN -> {
            drawPath(Path().apply {
                moveTo(32f, 64f); lineTo(32f, 48f); lineTo(41f, 58f); lineTo(50f, 34f)
                lineTo(59f, 58f); lineTo(68f, 48f); lineTo(68f, 64f); close()
            }, color = fill)
            drawRect(fill, topLeft = Offset(32f, 64f), size = Size(36f, 6f))
        }
        SealMotif.SWORD -> {
            drawRect(fill, topLeft = Offset(48f, 24f), size = Size(4f, 34f))
            drawRect(fill, topLeft = Offset(38f, 54f), size = Size(24f, 4f))
            drawPath(Path().apply { moveTo(47f, 58f); lineTo(50f, 74f); lineTo(53f, 58f); close() }, color = fill)
        }
        SealMotif.FLAME -> {
            drawPath(Path().apply {
                moveTo(50f, 28f)
                quadraticBezierTo(62f, 38f, 60f, 50f)
                quadraticBezierTo(66f, 44f, 62f, 54f)
                quadraticBezierTo(62f, 68f, 50f, 72f)
                quadraticBezierTo(38f, 68f, 38f, 54f)
                quadraticBezierTo(34f, 44f, 40f, 50f)
                quadraticBezierTo(38f, 38f, 50f, 28f)
                close()
            }, color = fill)
        }
    }
}

private fun DrawScope.drawAnimal(a: SealAnimal, fill: Color) {
    val eye = Color.Black.copy(alpha = 0.55f)
    val shade = Color.Black.copy(alpha = 0.35f)
    when (a) {
        SealAnimal.BEAR -> {
            drawCircle(fill, radius = 6f, center = Offset(38f, 36f))
            drawCircle(fill, radius = 6f, center = Offset(62f, 36f))
            drawCircle(fill, radius = 14f, center = Offset(50f, 52f))
            drawOval(shade, topLeft = Offset(44f, 53f), size = Size(12f, 10f))
            drawCircle(eye, radius = 2f, center = Offset(50f, 55f))
        }
        SealAnimal.WOLF -> {
            drawPath(Path().apply { moveTo(32f, 40f); lineTo(38f, 28f); lineTo(44f, 40f); close() }, color = fill)
            drawPath(Path().apply { moveTo(56f, 40f); lineTo(62f, 28f); lineTo(68f, 40f); close() }, color = fill)
            drawPath(Path().apply {
                moveTo(30f, 45f); lineTo(50f, 38f); lineTo(70f, 45f); lineTo(68f, 62f)
                lineTo(58f, 70f); lineTo(42f, 70f); lineTo(32f, 62f); close()
            }, color = fill)
            drawPath(Path().apply { moveTo(48f, 68f); lineTo(50f, 74f); lineTo(52f, 68f); close() }, color = Color.Black.copy(alpha = 0.4f))
        }
        SealAnimal.DEER -> {
            val antler = Stroke(width = 2.2f)
            drawPath(Path().apply {
                moveTo(42f, 30f); lineTo(42f, 22f); moveTo(42f, 22f); lineTo(36f, 22f)
                moveTo(42f, 22f); lineTo(38f, 16f); moveTo(42f, 26f); lineTo(36f, 26f)
            }, color = fill, style = antler)
            drawPath(Path().apply {
                moveTo(58f, 30f); lineTo(58f, 22f); moveTo(58f, 22f); lineTo(64f, 22f)
                moveTo(58f, 22f); lineTo(62f, 16f); moveTo(58f, 26f); lineTo(64f, 26f)
            }, color = fill, style = antler)
            drawOval(fill, topLeft = Offset(40f, 40f), size = Size(20f, 32f))
            drawCircle(Color.Black, radius = 1.5f, center = Offset(46f, 52f))
            drawCircle(Color.Black, radius = 1.5f, center = Offset(54f, 52f))
        }
        SealAnimal.FALCON -> {
            drawPath(Path().apply {
                moveTo(20f, 50f); quadraticBezierTo(35f, 30f, 50f, 42f); quadraticBezierTo(65f, 30f, 80f, 50f)
                quadraticBezierTo(65f, 46f, 50f, 52f); quadraticBezierTo(35f, 46f, 20f, 50f); close()
            }, color = fill)
            drawPath(Path().apply { moveTo(46f, 48f); lineTo(50f, 70f); lineTo(54f, 48f); close() }, color = fill)
        }
        SealAnimal.BOAR -> {
            drawOval(fill, topLeft = Offset(34f, 40f), size = Size(32f, 24f))
            drawPath(Path().apply { moveTo(36f, 54f); lineTo(30f, 62f); lineTo(34f, 62f); close() }, color = fill)
            drawPath(Path().apply { moveTo(64f, 54f); lineTo(70f, 62f); lineTo(66f, 62f); close() }, color = fill)
            drawCircle(Color.Black, radius = 1.5f, center = Offset(48f, 50f))
            drawCircle(Color.Black, radius = 1.5f, center = Offset(56f, 50f))
            drawOval(shade, topLeft = Offset(45f, 55f), size = Size(10f, 6f))
        }
        SealAnimal.FISH -> {
            drawPath(Path().apply {
                moveTo(20f, 50f); quadraticBezierTo(36f, 32f, 62f, 50f); quadraticBezierTo(36f, 68f, 20f, 50f); close()
            }, color = fill)
            drawPath(Path().apply { moveTo(62f, 50f); lineTo(78f, 38f); lineTo(74f, 50f); lineTo(78f, 62f); close() }, color = fill)
            drawCircle(Color.Black, radius = 1.8f, center = Offset(32f, 48f))
        }
    }
}
