package com.s0dolamby.game.data.repository

import com.s0dolamby.game.data.db.dao.SettingsDao
import com.s0dolamby.game.data.db.entity.SettingsEntity
import com.s0dolamby.game.domain.model.AppSettings
import com.s0dolamby.game.domain.model.ThemeMode
import com.s0dolamby.game.domain.repository.SettingsRepository
import javax.inject.Inject

class SettingsRepositoryImpl @Inject constructor(
    private val settingsDao: SettingsDao
) : SettingsRepository {

    override suspend fun getSettings(): AppSettings = settingsDao.getSettings().toDomain()

    override suspend fun updateSettings(settings: AppSettings) {
        settingsDao.upsert(
            SettingsEntity(
                textModel = settings.textModel,
                imageGenerationEnabled = settings.imageGenerationEnabled,
                nickname = settings.nickname.take(20).trim(),
                themeMode = settings.themeMode.name,
                language = settings.language,
                soundEnabled = settings.soundEnabled,
                musicEnabled = settings.musicEnabled,
                notificationsEnabled = settings.notificationsEnabled,
                playerId = settings.playerId,
                tourShown = settings.tourShown
            )
        )
    }

    override fun observeSettings(): kotlinx.coroutines.flow.Flow<AppSettings> =
        kotlinx.coroutines.flow.flow {
            settingsDao.observeSettings().collect { entity ->
                emit(entity.toDomain())
            }
        }

    private fun SettingsEntity?.toDomain(): AppSettings =
        if (this == null) AppSettings()
        else AppSettings(
            textModel = textModel,
            imageGenerationEnabled = imageGenerationEnabled,
            nickname = nickname,
            themeMode = ThemeMode.fromName(themeMode),
            language = language.ifBlank { "ru" },
            soundEnabled = soundEnabled,
            musicEnabled = musicEnabled,
            notificationsEnabled = notificationsEnabled,
            playerId = playerId,
            tourShown = tourShown
        )
}
