package com.s0dolamby.game.domain.repository

import com.s0dolamby.game.domain.model.ChatRoomMessage

/**
 * Общий игровой чат через mobile-backend. Всё сетевое — офлайн вернёт
 * неуспех, игру это не ломает.
 */
interface ChatRepository {
    /** Забрать ленту (последние сообщения). */
    suspend fun fetch(): Result<List<ChatRoomMessage>>

    /** Отправить сообщение (опционально — ответ на другое). */
    suspend fun send(text: String, replyToId: Int?): Result<Unit>

    /** Удалить своё сообщение. */
    suspend fun delete(messageId: Int): Result<Unit>

    /** Пожаловаться на сообщение. */
    suspend fun report(messageId: Int): Result<Unit>
}
