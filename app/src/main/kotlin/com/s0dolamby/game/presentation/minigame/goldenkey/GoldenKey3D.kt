package com.s0dolamby.game.presentation.minigame.goldenkey

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

// ─────────────────────────────────────────────────────────────────────────
//  Настоящий 3D-ключ Буратино — процедурный меш из геометрии, без внешних
//  ассетов. Реальные вершины/грани, матрица поворота, перспектива и
//  освещение по нормалям. Крутится в реальном времени на Canvas.
//  Черты ключа читаются в объёме: форма ушка, металл, число зубцов, узор
//  стержня (полосы/точки), кисточка.
// ─────────────────────────────────────────────────────────────────────────

private class V3(val x: Float, val y: Float, val z: Float)

private fun V3.rotY(s: Float, c: Float) = V3(x * c + z * s, y, -x * s + z * c)
private fun V3.rotX(s: Float, c: Float) = V3(x, y * c - z * s, y * s + z * c)

/** Грань меша: вершины (3–4) + собственный металл (свет/тень). */
private class Face(val v: List<V3>, val light: Color, val dark: Color)

private fun quad(a: V3, b: V3, c: V3, d: V3, l: Color, dk: Color) = Face(listOf(a, b, c, d), l, dk)

// ─── строители деталей ──────────────────────────────────────────────────

/** Тор/овал ушка в плоскости XY, тюбик радиуса [tube]. rx/ry — радиусы кольца. */
private fun ring(cx: Float, cy: Float, rx: Float, ry: Float, tube: Float, su: Int, sv: Int, l: Color, d: Color): List<Face> {
    val faces = ArrayList<Face>(su * sv)
    fun p(iu: Int, iv: Int): V3 {
        val u = iu.toFloat() / su * 2f * PI.toFloat()
        val vv = iv.toFloat() / sv * 2f * PI.toFloat()
        val cu = cos(u); val siu = sin(u)
        return V3(cx + (rx + tube * cos(vv)) * cu, cy + (ry + tube * cos(vv)) * siu, tube * sin(vv))
    }
    for (iu in 0 until su) for (iv in 0 until sv) {
        faces += quad(p(iu, iv), p(iu + 1, iv), p(iu + 1, iv + 1), p(iu, iv + 1), l, d)
    }
    return faces
}

/** Осекоординатный ящик (для квадратного ушка, зубцов, точек-заклёпок, кисточки). */
private fun box(cx: Float, cy: Float, cz: Float, hx: Float, hy: Float, hz: Float, l: Color, d: Color): List<Face> {
    fun v(sx: Int, sy: Int, sz: Int) = V3(cx + sx * hx, cy + sy * hy, cz + sz * hz)
    val ppp = v(1, 1, 1); val ppm = v(1, 1, -1); val pmp = v(1, -1, 1); val pmm = v(1, -1, -1)
    val mpp = v(-1, 1, 1); val mpm = v(-1, 1, -1); val mmp = v(-1, -1, 1); val mmm = v(-1, -1, -1)
    return listOf(
        quad(pmp, ppp, ppm, pmm, l, d),   // +x
        quad(mpp, mmp, mmm, mpm, l, d),   // -x
        quad(mpp, ppp, pmp, mmp, l, d),   // +y? (top): use consistent order
        quad(mmm, pmm, ppm, mpm, l, d),   // -y
        quad(mmp, pmp, ppp, mpp, l, d),   // +z
        quad(mpm, ppm, pmm, mmm, l, d)    // -z
    )
}

/** Цилиндр стержня вдоль оси Y; узор — полосы (чередование металла по высоте). */
private fun cylinder(r: Float, yTop: Float, yBot: Float, seg: Int, rings: Int, striped: Boolean, l: Color, d: Color): List<Face> {
    val faces = ArrayList<Face>(seg * rings)
    fun y(i: Int) = yTop + (yBot - yTop) * i / rings
    fun ang(i: Int) = i.toFloat() / seg * 2f * PI.toFloat()
    for (iy in 0 until rings) {
        // полосатый узор — тёмный металл через ряд
        val bandDark = striped && (iy % 2 == 1)
        val fl = if (bandDark) d else l
        val fd = if (bandDark) mix(d, Color.Black, 0.35f) else d
        for (i in 0 until seg) {
            val a0 = ang(i); val a1 = ang(i + 1)
            val y0 = y(iy); val y1 = y(iy + 1)
            val p0 = V3(r * cos(a0), y0, r * sin(a0))
            val p1 = V3(r * cos(a1), y0, r * sin(a1))
            val p2 = V3(r * cos(a1), y1, r * sin(a1))
            val p3 = V3(r * cos(a0), y1, r * sin(a0))
            faces += quad(p0, p1, p2, p3, fl, fd)
        }
    }
    return faces
}

private fun buildKeyMesh(key: GoldenKey): List<Face> {
    val l = key.color.light
    val d = key.color.dark
    val faces = ArrayList<Face>(256)

    // Ушко сверху, стержень вниз, зубцы у нижнего конца.
    val bowCy = 0.66f
    val tube = 0.10f
    when (key.bowlShape) {
        BowlShape.ROUND -> faces += ring(0f, bowCy, 0.36f, 0.36f, tube, 14, 7, l, d)
        BowlShape.OVAL -> faces += ring(0f, bowCy, 0.30f, 0.44f, tube, 14, 7, l, d)
        BowlShape.SQUARE -> {
            // рамка из 4 брусьев — читается как квадрат
            val R = 0.34f; val t = tube
            faces += box(0f, bowCy + R, 0f, R + t, t, t, l, d)   // верх
            faces += box(0f, bowCy - R, 0f, R + t, t, t, l, d)   // низ
            faces += box(-R, bowCy, 0f, t, R, t, l, d)           // лево
            faces += box(R, bowCy, 0f, t, R, t, l, d)            // право
        }
    }

    // Стержень
    val shaftR = 0.11f
    val shaftTop = 0.30f
    val shaftBot = -0.78f
    faces += cylinder(shaftR, shaftTop, shaftBot, 12, 6, key.stemPattern == StemPattern.STRIPED, l, d)

    // Узор «точки» — заклёпки-кубики по стержню (спереди/сзади/по бокам)
    if (key.stemPattern == StemPattern.DOTTED) {
        var yy = shaftTop - 0.12f
        while (yy > shaftBot + 0.35f) {
            faces += box(0f, yy, shaftR, 0.055f, 0.055f, 0.05f, l, d)
            faces += box(0f, yy, -shaftR, 0.055f, 0.055f, 0.05f, l, d)
            faces += box(shaftR, yy, 0f, 0.05f, 0.055f, 0.055f, l, d)
            faces += box(-shaftR, yy, 0f, 0.05f, 0.055f, 0.055f, l, d)
            yy -= 0.20f
        }
    }

    // Зубцы (бородка) — брусья на +X у нижнего конца
    val toothH = 0.12f
    val gap = 0.06f
    val baseX = shaftR
    var ty = shaftBot + 0.10f
    repeat(key.teethCount) { i ->
        val len = 0.16f + (i % 2) * 0.06f   // лёгкая нерегулярность зубцов
        faces += box(baseX + len / 2f, ty, 0f, len / 2f, toothH / 2f, 0.06f, l, d)
        ty += toothH + gap
    }

    // Кисточка — яркий красный шнур + кисть, СБОКУ-СПЕРЕДИ от стержня, иначе
    // пряталась внутри стержня и в разборе «кисточка» не совпадала.
    if (key.hasTassel) {
        val red = Color(0xFFD5443F); val redDark = Color(0xFF6E1616)
        val tx = -0.20f; val tz = 0.16f
        faces += box(tx, bowCy - 0.22f, tz, 0.022f, 0.12f, 0.022f, red, redDark)  // шнур
        faces += box(tx, bowCy - 0.40f, tz, 0.075f, 0.10f, 0.05f, red, redDark)   // кисть
    }
    return faces
}

// ─── математика цвета/освещения ──────────────────────────────────────────

private fun mix(a: Color, b: Color, t: Float) = Color(
    a.red + (b.red - a.red) * t,
    a.green + (b.green - a.green) * t,
    a.blue + (b.blue - a.blue) * t
)

// ─── композабл ────────────────────────────────────────────────────────────

/** Вращающийся 3D-ключ. Все черты ключа отражены в объёме. */
@Composable
fun RotatingKey3D(key: GoldenKey, modifier: Modifier = Modifier) {
    val mesh = remember(key) { buildKeyMesh(key) }
    val infinite = rememberInfiniteTransition(label = "key3d")
    val angle by infinite.animateFloat(
        initialValue = 0f, targetValue = (2f * PI).toFloat(),
        animationSpec = infiniteRepeatable(tween(6000, easing = LinearEasing)),
        label = "spin"
    )
    Canvas(modifier = modifier) {
        draw3DKey(mesh, angle)
    }
}

private fun DrawScope.draw3DKey(mesh: List<Face>, angle: Float) {
    val tilt = 0.34f
    val sA = sin(angle); val cA = cos(angle)
    val sT = sin(tilt); val cT = cos(tilt)
    // свет спереди-сверху-слева
    val lx = -0.35f; val ly = 0.62f; val lz = 0.70f
    val f = 3.4f
    val scale = size.minDimension * 0.40f
    val cx = size.width / 2f
    val cy = size.height / 2f

    fun project(p: V3): Offset {
        val persp = f / (f - p.z)
        return Offset(cx + p.x * scale * persp, cy - p.y * scale * persp)
    }

    // готовим грани: поворот, нормаль, освещение, глубина
    class Prep(val pts: List<V3>, val color: Color, val depth: Float)
    val prepared = ArrayList<Prep>(mesh.size)
    for (face in mesh) {
        val r = face.v.map { it.rotY(sA, cA).rotX(sT, cT) }
        // нормаль по первым трём вершинам
        val ux = r[1].x - r[0].x; val uy = r[1].y - r[0].y; val uz = r[1].z - r[0].z
        val wx = r[2].x - r[0].x; val wy = r[2].y - r[0].y; val wz = r[2].z - r[0].z
        var nx = uy * wz - uz * wy
        var ny = uz * wx - ux * wz
        var nz = ux * wy - uy * wx
        val nlen = sqrt(nx * nx + ny * ny + nz * nz).takeIf { it > 1e-4f } ?: 1f
        nx /= nlen; ny /= nlen; nz /= nlen
        // нормаль к камере (двусторонняя закраска)
        if (nz < 0f) { nx = -nx; ny = -ny; nz = -nz }
        val diff = (nx * lx + ny * ly + nz * lz).coerceIn(0f, 1f)
        val t = (0.30f + 0.70f * diff).coerceIn(0f, 1f)
        var col = mix(face.dark, face.light, t)
        // мягкий блик
        if (diff > 0.86f) col = mix(col, Color.White, (diff - 0.86f) * 3.2f)
        val depth = r.sumOf { it.z.toDouble() }.toFloat() / r.size
        prepared += Prep(r, col, depth)
    }
    // художникова сортировка: дальние (меньший z) первыми
    prepared.sortBy { it.depth }

    for (pr in prepared) {
        val path = Path()
        pr.pts.forEachIndexed { i, v ->
            val o = project(v)
            if (i == 0) path.moveTo(o.x, o.y) else path.lineTo(o.x, o.y)
        }
        path.close()
        drawPath(path, color = pr.color)
        // тонкая огранка — очерчиваем фасет
        drawPath(path, color = Color.Black.copy(alpha = 0.10f), style = Stroke(width = 0.6f))
    }
}
