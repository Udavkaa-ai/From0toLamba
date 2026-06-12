package com.s0dolamby.game.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.s0dolamby.game.domain.model.InvestorRank

@Entity(tableName = "game_state")
data class GameStateEntity(
    @PrimaryKey val id: Int = 1,  // singleton row
    val balance: Double = 0.0,
    val currentDay: Int = 1,
    val investorRank: String = InvestorRank.NEWBIE.name,
    val totalInvested: Double = 0.0,
    val totalReturned: Double = 0.0,
    val scamsDetected: Int = 0,
    val scamsMissed: Int = 0,
    val dayStreak: Int = 0,
    val isOnboardingComplete: Boolean = false,
    val balanceHistory: String = "[]",  // JSON array of Double — free balance per day
    val investedHistory: String = "[]", // JSON array of Double — active projects total value per day
    val pendingRankUp: String? = null,  // InvestorRank.name — set when rank increases, cleared after shown

    // --- Phase 1: server-first cache fields (mirror of tg/server GameState) ---
    // Дополнительные слоты для дел сверх лимита 5 (за 1000г или 10⭐).
    @androidx.room.ColumnInfo(defaultValue = "0")
    val extraSlotsBalance: Int = 0,
    // Map<PersonaArchetype, Int> — сколько жетонов архетипа потрачено (заработок считается на лету).
    @androidx.room.ColumnInfo(defaultValue = "{}")
    val archetypeTokensSpent: String = "{}",
    // Жетоны на пропуск 2ч-таймера «Следующий день».
    @androidx.room.ColumnInfo(defaultValue = "0")
    val timerSkipTokens: Int = 0,
    // Ежедневный стрик (вкладка «Сегодня»), независим от dayStreak.
    @androidx.room.ColumnInfo(defaultValue = "0")
    val loginStreak: Int = 0,
    val lastSeenDay: String? = null,           // YYYY-MM-DD MSK — когда стрик обновлялся
    val lastDailyClaim: String? = null,        // YYYY-MM-DD — день последней награды
    // Сколько дней игрок прошёл подряд без 2ч-кулдауна (сбрасывается после ожидания/рекламы).
    @androidx.room.ColumnInfo(defaultValue = "0")
    val consecutiveAdvances: Int = 0,
    // Снимок состояния на начало «ярмарочной недели» — для недельного лидерборда.
    @androidx.room.ColumnInfo(defaultValue = "0")
    val weekStartWealth: Double = 0.0,
    val weekStartAt: Long? = null,             // epoch millis
    @androidx.room.ColumnInfo(defaultValue = "'ru'")
    val preferredLanguage: String = "ru",
    @androidx.room.ColumnInfo(defaultValue = "1")
    val newsEnabled: Boolean = true,           // выключатель AI-новостей
    @androidx.room.ColumnInfo(defaultValue = "1")
    val nextDayNotified: Boolean = true,       // отправлено ли уведомление о доступности след. дня
    val lastUserActionAt: Long? = null,        // последнее РУЧНОЕ действие игрока (epoch millis)
    val lastAdvancedAt: Long? = null,          // последний advance-day (epoch millis)
    @androidx.room.ColumnInfo(defaultValue = "0")
    val marketAnnouncementSeen: Boolean = false,
    @androidx.room.ColumnInfo(defaultValue = "0")
    val marketAnnouncementRewardClaimed: Boolean = false
)
