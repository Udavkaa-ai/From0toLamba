package com.s0dolamby.game.di

import com.google.gson.Gson
import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.ai.OpenRouterApiService
import com.s0dolamby.game.data.remote.api.GameApi
import com.s0dolamby.game.data.remote.auth.AndroidAuthInterceptor
import com.s0dolamby.game.domain.repository.GameConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Qualifier
import javax.inject.Singleton

/**
 * Аннотации для разведения двух HTTP-клиентов:
 *   OpenRouter — внешний AI-провайдер (Bearer-ключ из BuildConfig).
 *   GameApi    — наш Fastify-сервер (X-Android-Device-Id из DeviceIdProvider).
 */
@Qualifier @Retention(AnnotationRetention.BINARY) annotation class OpenRouterClient
@Qualifier @Retention(AnnotationRetention.BINARY) annotation class GameApiClient

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideGson(): Gson = Gson()

    @Provides
    @Singleton
    fun provideHttpLogger(): HttpLoggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    // ---- OpenRouter ----

    @Provides
    @Singleton
    @OpenRouterClient
    fun provideOpenRouterClient(logger: HttpLoggingInterceptor): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(logger)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()

    @Provides
    @Singleton
    @OpenRouterClient
    fun provideOpenRouterRetrofit(
        @OpenRouterClient client: OkHttpClient,
        gson: Gson,
    ): Retrofit = Retrofit.Builder()
        .baseUrl(GameConfig.OPENROUTER_BASE_URL)
        .client(client)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .build()

    @Provides
    @Singleton
    fun provideOpenRouterApiService(@OpenRouterClient retrofit: Retrofit): OpenRouterApiService =
        retrofit.create(OpenRouterApiService::class.java)

    // ---- Game API (Fastify) ----

    @Provides
    @Singleton
    @GameApiClient
    fun provideGameApiClient(
        logger: HttpLoggingInterceptor,
        authInterceptor: AndroidAuthInterceptor,
    ): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(logger)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    @GameApiClient
    fun provideGameRetrofit(
        @GameApiClient client: OkHttpClient,
        gson: Gson,
    ): Retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL.trimEnd('/') + "/")
        .client(client)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .build()

    @Provides
    @Singleton
    fun provideGameApi(@GameApiClient retrofit: Retrofit): GameApi =
        retrofit.create(GameApi::class.java)
}
