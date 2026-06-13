package com.s0dolamby.game.di

import android.content.Context
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.s0dolamby.game.data.db.AppDatabase
import com.s0dolamby.game.data.db.dao.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Аддитивная миграция v17 → v18: создаём новую таблицу `minigame_unlock`,
 * остальные таблицы (game_state, projects, ama_sessions и т.д.) не трогаем.
 *
 * Это сохраняет прогресс игрока — баланс, активные дела, историю бесед —
 * при обновлении на сборку с персистом мини-игр. Без миграции
 * fallbackToDestructiveMigration() стёр бы всё.
 */
private val MIGRATION_17_18 = object : Migration(17, 18) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `minigame_unlock` (
                `projectId` TEXT NOT NULL,
                `errorCount` INTEGER NOT NULL,
                `timeoutReached` INTEGER NOT NULL,
                PRIMARY KEY(`projectId`)
            )
            """.trimIndent()
        )
    }
}

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "game_database")
            .addMigrations(MIGRATION_17_18)
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun provideProjectDao(db: AppDatabase): ProjectDao = db.projectDao()
    @Provides fun providePlayerDao(db: AppDatabase): PlayerDao = db.playerDao()
    @Provides fun provideAmaDao(db: AppDatabase): AmaDao = db.amaDao()
    @Provides fun provideUpdateDao(db: AppDatabase): UpdateDao = db.updateDao()
    @Provides fun provideSettingsDao(db: AppDatabase): SettingsDao = db.settingsDao()
    @Provides fun provideMinigameUnlockDao(db: AppDatabase): MinigameUnlockDao = db.minigameUnlockDao()
}
