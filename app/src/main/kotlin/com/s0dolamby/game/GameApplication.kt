package com.s0dolamby.game

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.s0dolamby.game.data.logging.AppLogger
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class GameApplication : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        AppLogger.init(this)
        installCrashHandler()
        createNotificationChannels()
    }

    private fun installCrashHandler() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            AppLogger.crash(throwable)
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            listOf(
                NotificationChannel(
                    CHANNEL_DAILY,
                    "Ежедневный симулятор",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply { description = "Напоминание о новом игровом дне" },
                NotificationChannel(
                    CHANNEL_PROJECT,
                    "Апдейты проектов",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply { description = "Новости из ваших проектов" },
                NotificationChannel(
                    CHANNEL_ALERT,
                    "Тревожные сигналы",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply { description = "Проект на грани закрытия" }
            ).forEach { manager.createNotificationChannel(it) }
        }
    }

    companion object {
        const val CHANNEL_DAILY = "channel_daily"
        const val CHANNEL_PROJECT = "channel_project"
        const val CHANNEL_ALERT = "channel_alert"
    }
}
