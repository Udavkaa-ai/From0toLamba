package com.s0dolamby.game.data.remote.auth

import okhttp3.Interceptor
import okhttp3.Response
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * OkHttp-интерсептор для запросов к Fastify-серверу. Добавляет:
 *   - X-Android-Device-Id  — стабильный device-id для серверного upsert User
 *   - Accept-Language      — для серверного выбора preferredLanguage у нового аккаунта
 *
 * Серверный middleware (telegramAuthHook) распознаёт X-Android-Device-Id как
 * альтернативу X-Telegram-Init-Data и работает с User.androidDeviceId.
 */
@Singleton
class AndroidAuthInterceptor @Inject constructor(
    private val deviceIdProvider: DeviceIdProvider,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val request = original.newBuilder()
            .header(HEADER_DEVICE_ID, deviceIdProvider.get())
            .header(HEADER_ACCEPT_LANGUAGE, Locale.getDefault().language)
            .build()
        return chain.proceed(request)
    }

    private companion object {
        const val HEADER_DEVICE_ID = "X-Android-Device-Id"
        const val HEADER_ACCEPT_LANGUAGE = "Accept-Language"
    }
}
