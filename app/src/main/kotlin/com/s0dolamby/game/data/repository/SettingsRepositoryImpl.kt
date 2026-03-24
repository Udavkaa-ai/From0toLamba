package com.s0dolamby.game.data.repository

import com.s0dolamby.game.data.db.dao.SettingsDao
import com.s0dolamby.game.data.db.entity.SettingsEntity
import com.s0dolamby.game.domain.model.AppSettings
import com.s0dolamby.game.domain.repository.SettingsRepository
import javax.inject.Inject

class SettingsRepositoryImpl @Inject constructor(
    private val settingsDao: SettingsDao
) : SettingsRepository {

    override suspend fun getSettings(): AppSettings {
        val entity = settingsDao.getSettings() ?: return AppSettings()
        return AppSettings(
            textModel = entity.textModel,
            imageGenerationEnabled = entity.imageGenerationEnabled
        )
    }

    override suspend fun updateSettings(settings: AppSettings) {
        settingsDao.upsert(
            SettingsEntity(
                textModel = settings.textModel,
                imageGenerationEnabled = settings.imageGenerationEnabled
            )
        )
    }
}
