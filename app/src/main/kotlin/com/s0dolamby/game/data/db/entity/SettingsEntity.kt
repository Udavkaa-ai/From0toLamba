package com.s0dolamby.game.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "settings")
data class SettingsEntity(
    @PrimaryKey val id: Int = 1,
    val textModel: String = "qwen/qwen3.5-flash-02-23",
    val imageGenerationEnabled: Boolean = true
)
