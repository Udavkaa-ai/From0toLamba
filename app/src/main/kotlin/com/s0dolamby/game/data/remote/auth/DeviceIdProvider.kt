package com.s0dolamby.game.data.remote.auth

import android.content.Context
import android.content.SharedPreferences
import android.provider.Settings
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Возвращает стабильный device-id для авторизации на Fastify-сервере.
 *
 * Приоритет источника:
 *   1. UUID из SharedPreferences (если был выписан ранее) — устойчив к factory reset
 *      пока пользователь не удалил приложение. Backup'нется через Android Auto Backup
 *      если включён.
 *   2. Settings.Secure.ANDROID_ID — стабилен между переустановками на одном
 *      устройстве (с Android 8+ привязан к подписи APK), но обнуляется при
 *      factory reset.
 *   3. Свежий UUID — fallback если ANDROID_ID недоступен (мок-устройства, тесты).
 *
 * Формат: 8..128 символов из [A-Za-z0-9_-] (требование серверного middleware).
 * Все источники этому удовлетворяют (UUID — 36, ANDROID_ID — 16 hex).
 */
@Singleton
class DeviceIdProvider @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    @Volatile
    private var cached: String? = null

    fun get(): String {
        cached?.let { return it }
        synchronized(this) {
            cached?.let { return it }
            val resolved = prefs.getString(KEY_DEVICE_ID, null) ?: resolveAndPersist()
            cached = resolved
            return resolved
        }
    }

    private fun resolveAndPersist(): String {
        val androidId = runCatching {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        }.getOrNull()

        val id = if (!androidId.isNullOrBlank() && androidId != "9774d56d682e549c") {
            // 9774d56d682e549c — известный баг-значение на старых Android-устройствах,
            // одинаковое для всех. Отбрасываем и используем UUID.
            "and_$androidId"
        } else {
            "uuid_${UUID.randomUUID().toString().replace("-", "")}"
        }

        prefs.edit().putString(KEY_DEVICE_ID, id).apply()
        return id
    }

    private companion object {
        const val PREFS_NAME = "device_auth"
        const val KEY_DEVICE_ID = "device_id"
    }
}
