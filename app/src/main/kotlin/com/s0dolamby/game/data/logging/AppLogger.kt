package com.s0dolamby.game.data.logging

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Simple file-based logger. Writes tagged entries to logs/app.log in internal storage.
 * Max 500 lines — oldest entries are trimmed automatically.
 * Call AppLogger.share(context) to open Android share sheet (send to Telegram, email, etc.)
 */
object AppLogger {

    private const val MAX_LINES = 500
    private val fmt = SimpleDateFormat("MM-dd HH:mm:ss", Locale.US)
    private lateinit var logFile: File

    fun init(context: Context) {
        val dir = File(context.filesDir, "logs")
        dir.mkdirs()
        logFile = File(dir, "app.log")
        i("AppLogger", "=== App started ===")
    }

    fun i(tag: String, msg: String) = write("I", tag, msg)
    fun e(tag: String, msg: String, t: Throwable? = null) {
        write("E", tag, msg)
        t?.let { write("E", tag, it.stackTraceToString().take(1000)) }
    }

    fun crash(t: Throwable) {
        write("CRASH", "UncaughtException", t.stackTraceToString())
    }

    private fun write(level: String, tag: String, msg: String) {
        try {
            val line = "${fmt.format(Date())} $level/$tag: $msg\n"
            logFile.appendText(line)
            trim()
        } catch (_: Exception) {
            // Never crash the app because of logging
        }
    }

    private fun trim() {
        val lines = logFile.readLines()
        if (lines.size > MAX_LINES) {
            logFile.writeText(lines.takeLast(MAX_LINES).joinToString("\n") + "\n")
        }
    }

    fun readLog(): String = if (::logFile.isInitialized && logFile.exists()) {
        logFile.readText().takeLast(8000)   // last ~8k chars for display
    } else {
        "Лог пуст"
    }

    /**
     * Последний НЕпоказанный краш для диагностического снэкбара. После
     * чтения ставит маркер «показано» — иначе один и тот же старый краш
     * всплывает при каждом открытии Казны, пока не вытеснится из лога
     * (лог переживает и сброс игры, и обновление приложения).
     */
    fun consumeLastCrash(): String? {
        if (!::logFile.isInitialized || !logFile.exists()) return null
        val text = runCatching { logFile.readText() }.getOrDefault("")
        val fresh = text.substringAfterLast("CrashDiag: shown")
        val crash = fresh.substringAfterLast("CRASH/UncaughtException:", "").trim()
        if (crash.isEmpty()) return null
        i("CrashDiag", "shown")
        return crash
    }

    /** Полная очистка лога — при «Начать заново». */
    fun clear() {
        if (::logFile.isInitialized) {
            runCatching { logFile.writeText("") }
            i("AppLogger", "=== Log cleared (game reset) ===")
        }
    }

    fun share(context: Context) {
        try {
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                logFile
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "С0доЛамбы лог")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(intent, "Поделиться логом").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        } catch (e: Exception) {
            e("AppLogger", "share failed", e)
        }
    }
}
