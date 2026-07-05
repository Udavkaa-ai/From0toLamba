package com.s0dolamby.game.presentation.feedback

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.PixelCopy
import java.io.ByteArrayOutputStream

/**
 * Снимок текущего экрана для заметки тестера. PixelCopy забирает готовый
 * буфер окна (работает и с Compose, и с видео) — в отличие от deprecated
 * drawingCache. API 24+, у нас minSdk 26.
 */
fun captureWindow(activity: Activity, onResult: (Bitmap?) -> Unit) {
    val window = activity.window ?: return onResult(null)
    val view = window.decorView
    if (view.width <= 0 || view.height <= 0) return onResult(null)

    val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
    try {
        val loc = IntArray(2)
        view.getLocationInWindow(loc)
        val rect = Rect(loc[0], loc[1], loc[0] + view.width, loc[1] + view.height)
        PixelCopy.request(
            window, rect, bitmap,
            { result -> onResult(if (result == PixelCopy.SUCCESS) bitmap else null) },
            Handler(Looper.getMainLooper())
        )
    } catch (_: Exception) {
        onResult(null)
    }
}

/**
 * Ужимаем скрин до разумного размера: ширина ≤ [maxWidth], JPEG [quality].
 * Результат — base64 без переносов (~50–130 КБ), готов лечь в JSON-заметку.
 */
fun Bitmap.toBase64Jpeg(maxWidth: Int = 720, quality: Int = 55): String {
    val scaled = if (width > maxWidth) {
        val h = (height.toLong() * maxWidth / width).toInt().coerceAtLeast(1)
        Bitmap.createScaledBitmap(this, maxWidth, h, true)
    } else this
    val baos = ByteArrayOutputStream()
    scaled.compress(Bitmap.CompressFormat.JPEG, quality, baos)
    return Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
}
