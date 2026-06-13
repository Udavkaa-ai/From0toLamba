package com.s0dolamby.game.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Результат прохождения мини-игры дельца. Если запись есть и
 * `errorCount <= 1 && !timeoutReached` — мини-игру повторно не запускаем,
 * во Входящих сразу ведём в беседу. Если `errorCount == 0` —
 * раскрываем все скрытые поля дела (idea / реальная судьба).
 *
 * projectId совпадает с Project.id (UUID-строка), что и есть первичный ключ.
 */
@Entity(tableName = "minigame_unlock")
data class MinigameUnlockEntity(
    @PrimaryKey val projectId: String,
    val errorCount: Int,
    val timeoutReached: Boolean
)
