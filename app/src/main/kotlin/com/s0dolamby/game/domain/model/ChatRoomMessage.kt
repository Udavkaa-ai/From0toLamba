package com.s0dolamby.game.domain.model

/** Одно сообщение общего игрового чата (для UI). */
data class ChatRoomMessage(
    val id: Int,
    val nickname: String,
    val text: String,
    /** Локальное время «ЧЧ:ММ». */
    val timeLabel: String,
    /** Моё ли сообщение — можно удалить, нельзя жаловаться. */
    val isMine: Boolean,
    val replyToNick: String?,
    val replyToText: String?
)
