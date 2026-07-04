package com.s0dolamby.game.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.s0dolamby.game.data.db.dao.*
import com.s0dolamby.game.data.db.entity.*

@Database(
    entities = [
        ProjectEntity::class,
        GameStateEntity::class,
        AmaSessionEntity::class,
        AmaMessageEntity::class,
        UpdateEntity::class,
        PostMortemEntity::class,
        SettingsEntity::class,
        MinigameUnlockEntity::class
    ],
    // Phase 1 (Android port → server-first): кэш публичных полей tg/server.
    // Расширены GameStateEntity, ProjectEntity, AmaSessionEntity, UpdateEntity.
    // fallbackToDestructiveMigration: при server-first wipe безопасен — данные ресинкаются с API.
    // v13: вырезана Чуйка — lieTopics/truthTopics/npcTruthParams/lieGuessCorrect/
    // intuitionScore/isIntuitionEvaluated удалены из всех таблиц.
    // v14: добавлены tieLevelsJson / archetypeTokensJson в game_state
    // (отношения с дельцами + жетоны архетипов).
    // v15: добавлен unlockedAchievementsJson в game_state (каталог подвигов).
    // v16: добавлен nickname в settings (прозвище игрока на главной).
    // v17: добавлены themeMode + language в settings (две темы + i18n RU/EN).
    // v18: добавлена таблица minigame_unlock — результаты мини-игр переживают
    // ребут процесса, иначе после passing-перехода обратно к Inbox игроку
    // снова предлагают мини-игру.
    // v19: добавлен soundEnabled в settings (звуковые эффекты SoundEngine).
    // v20: добавлен musicEnabled в settings (фоновая музыка MusicEngine).
    // v21: eventDeltaRubles в daily_updates + yieldFreezeDays в projects
    // («Зоркий счёт» — реакция на тревожные вести).
    // v22: «Верю — не верю» — playerVerdict/verdictCorrect в projects,
    // chuyka*-поля рейтинга чуйки в game_state.
    // v23: «Наука старца» — scienceCardsJson (открытые карты приёмов).
    // v24: «Ярмарка недели» — weekKey/weekAdvances + снапшоты чуйки недели.
    // v25: notificationsEnabled в settings (тумблер напоминаний).
    version = 25,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun projectDao(): ProjectDao
    abstract fun playerDao(): PlayerDao
    abstract fun amaDao(): AmaDao
    abstract fun updateDao(): UpdateDao
    abstract fun settingsDao(): SettingsDao
    abstract fun minigameUnlockDao(): MinigameUnlockDao
}
