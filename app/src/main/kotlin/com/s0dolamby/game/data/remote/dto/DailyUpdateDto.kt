package com.s0dolamby.game.data.remote.dto

/**
 * Ежедневная весть о деле — сырая запись из tg/server DailyUpdate.
 * Поля совпадают с Prisma-моделью `DailyUpdate`.
 *
 * day — игровой день когда вышла весть.
 * payoutStatus: "NORMAL" | "DELAYED" | "BOOSTED".
 * announcement: "LISTING" | "HACK" | "CRIMINAL_CASE" | "PARTNERSHIP" | null.
 * eventKind: "NEGATIVE" | "POSITIVE" | "NEUTRAL" | null — случайное событие.
 */
data class DailyUpdateDto(
    val id: Int,
    val projectId: String,
    val day: Int,
    val title: String,
    val body: String,
    val redFlags: List<String> = emptyList(),
    val payoutStatus: String = "NORMAL",
    val announcement: String? = null,
    val eventKind: String? = null,
    val userCountDelta: Int = 0,
    val createdAt: String,                 // ISO 8601
)
