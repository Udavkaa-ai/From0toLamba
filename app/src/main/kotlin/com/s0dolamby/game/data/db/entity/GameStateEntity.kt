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
    val balanceHistory: String = "[]"   // JSON array of Double snapshots per game day
)
