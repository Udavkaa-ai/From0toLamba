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
        PostMortemEntity::class
    ],
    version = 5,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun projectDao(): ProjectDao
    abstract fun playerDao(): PlayerDao
    abstract fun amaDao(): AmaDao
    abstract fun updateDao(): UpdateDao
}
