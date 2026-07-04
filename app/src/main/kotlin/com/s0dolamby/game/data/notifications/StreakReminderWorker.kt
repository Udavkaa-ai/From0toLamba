package com.s0dolamby.game.data.notifications

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.s0dolamby.game.GameApplication
import com.s0dolamby.game.MainActivity
import com.s0dolamby.game.R
import com.s0dolamby.game.data.db.dao.PlayerDao
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.repository.SettingsRepository
import com.s0dolamby.game.domain.today.TodayRewards
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.time.Duration
import java.time.LocalDateTime
import java.time.LocalTime
import java.util.concurrent.TimeUnit

/**
 * Вечернее напоминание: если игрок сегодня не заглядывал на ярмарку —
 * серия догорает. Срабатывает раз в сутки около [REMINDER_HOUR]:00
 * по местному времени; молчит, если игрок уже заходил, если напоминания
 * выключены в настройках или разрешение на уведомления не выдано.
 */
@HiltWorker
class StreakReminderWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val playerDao: PlayerDao,
    private val settingsRepository: SettingsRepository
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val settings = settingsRepository.getSettings()
        if (!settings.notificationsEnabled) return Result.success()

        val state = playerDao.getGameState() ?: return Result.success()
        if (state.lastSeenDay == TodayRewards.todayKey()) return Result.success()

        val granted = ContextCompat.checkSelfPermission(
            applicationContext, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED ||
            android.os.Build.VERSION.SDK_INT < 33
        if (!granted) return Result.success()

        val ru = settings.language != "en"
        val streak = state.loginStreak
        val title = when {
            !ru -> "🔥 Your streak is burning out"
            streak > 1 -> "🔥 Серия из $streak дней догорает"
            else -> "🎪 Ярмарка ждёт"
        }
        val body = when {
            !ru && streak > 1 -> "Drop by the fair before midnight — keep your $streak-day streak alive."
            !ru -> "New charters and the daily reward are waiting at the fair."
            streak > 1 -> "Загляни на ярмарку до полуночи — серия не оборвётся, а награда за день ждёт."
            else -> "Новые грамоты и дневная награда ждут на ярмарке."
        }

        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = android.app.PendingIntent.getActivity(
            applicationContext, 0, intent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(applicationContext, GameApplication.CHANNEL_DAILY)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build()

        runCatching {
            NotificationManagerCompat.from(applicationContext).notify(NOTIFICATION_ID, notification)
            AppLogger.i("StreakReminder", "posted (streak=$streak)")
        }
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "streak_reminder"
        private const val NOTIFICATION_ID = 1001

        /** Час напоминания по местному времени. */
        const val REMINDER_HOUR = 18

        /**
         * Ежедневный воркер около 18:00 местного времени. KEEP — уже
         * запланированный не пересоздаётся (не сбивает расписание).
         */
        fun schedule(context: Context) {
            val now = LocalDateTime.now()
            var next = now.toLocalDate().atTime(LocalTime.of(REMINDER_HOUR, 0))
            if (!next.isAfter(now)) next = next.plusDays(1)
            val initialDelay = Duration.between(now, next)

            val request = PeriodicWorkRequestBuilder<StreakReminderWorker>(1, TimeUnit.DAYS)
                .setInitialDelay(initialDelay.toMinutes(), TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request
            )
        }
    }
}
