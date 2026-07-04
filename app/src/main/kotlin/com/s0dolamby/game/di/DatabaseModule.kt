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

/** Аддитивная миграция v18 → v19: колонка soundEnabled в settings. */
private val MIGRATION_18_19 = object : Migration(18, 19) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE `settings` ADD COLUMN `soundEnabled` INTEGER NOT NULL DEFAULT 1")
    }
}

/** Аддитивная миграция v19 → v20: колонка musicEnabled в settings. */
private val MIGRATION_19_20 = object : Migration(19, 20) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE `settings` ADD COLUMN `musicEnabled` INTEGER NOT NULL DEFAULT 1")
    }
}

/** Аддитивная миграция v20 → v21: поля «Зоркого счёта». */
private val MIGRATION_20_21 = object : Migration(20, 21) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE `daily_updates` ADD COLUMN `eventDeltaRubles` REAL NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE `projects` ADD COLUMN `yieldFreezeDays` INTEGER NOT NULL DEFAULT 0")
    }
}

/** Аддитивная миграция v21 → v22: «Верю — не верю» + рейтинг чуйки. */
private val MIGRATION_21_22 = object : Migration(21, 22) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE `projects` ADD COLUMN `playerVerdict` TEXT")
        db.execSQL("ALTER TABLE `projects` ADD COLUMN `verdictCorrect` INTEGER")
        db.execSQL("ALTER TABLE `game_state` ADD COLUMN `chuykaPoints` INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE `game_state` ADD COLUMN `chuykaTotal` INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE `game_state` ADD COLUMN `chuykaCorrect` INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE `game_state` ADD COLUMN `chuykaStreak` INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE `game_state` ADD COLUMN `chuykaBestStreak` INTEGER NOT NULL DEFAULT 0")
    }
}

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "game_database")
            .addMigrations(MIGRATION_17_18, MIGRATION_18_19, MIGRATION_19_20, MIGRATION_20_21, MIGRATION_21_22)
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun provideProjectDao(db: AppDatabase): ProjectDao = db.projectDao()
    @Provides fun providePlayerDao(db: AppDatabase): PlayerDao = db.playerDao()
    @Provides fun provideAmaDao(db: AppDatabase): AmaDao = db.amaDao()
    @Provides fun provideUpdateDao(db: AppDatabase): UpdateDao = db.updateDao()
    @Provides fun provideSettingsDao(db: AppDatabase): SettingsDao = db.settingsDao()
    @Provides fun provideMinigameUnlockDao(db: AppDatabase): MinigameUnlockDao = db.minigameUnlockDao()
}
