package com.s0dolamby.game.domain.repository

import com.s0dolamby.game.domain.model.AppSettings

interface SettingsRepository {
    suspend fun getSettings(): AppSettings
    suspend fun updateSettings(settings: AppSettings)
    fun observeSettings(): kotlinx.coroutines.flow.Flow<AppSettings>
}
