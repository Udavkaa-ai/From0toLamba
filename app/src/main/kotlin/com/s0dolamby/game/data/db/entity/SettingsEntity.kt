package com.s0dolamby.game.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.s0dolamby.game.domain.model.DEFAULT_TEXT_MODEL

@Entity(tableName = "settings")
data class SettingsEntity(
    @PrimaryKey val id: Int = 1,
    val textModel: String = DEFAULT_TEXT_MODEL,
    val imageGenerationEnabled: Boolean = false,
    @androidx.room.ColumnInfo(defaultValue = "''")
    val nickname: String = "",
    @androidx.room.ColumnInfo(defaultValue = "'DARK_FAIRY'")
    val themeMode: String = "DARK_FAIRY",
    @androidx.room.ColumnInfo(defaultValue = "'ru'")
    val language: String = "ru",
    // Звуковые эффекты (SoundEngine): true = включены.
    @androidx.room.ColumnInfo(defaultValue = "1")
    val soundEnabled: Boolean = true
)
