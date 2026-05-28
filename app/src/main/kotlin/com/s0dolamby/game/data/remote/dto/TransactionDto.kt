package com.s0dolamby.game.data.remote.dto

/**
 * Запись движения средств — из tg/server Transaction.
 * type: "INVEST" | "ADD" | "WITHDRAW" | "EXIT" | "RETURNED" | "GIFT" | "REFERRAL_BONUS" | …
 *   (см. tg/server/src/game/InvestService.ts и game.ts — список типов открытый).
 *
 * projectName может содержать i18n-ключ вида "tx:gift" — клиент его подменяет
 * на локализованную строку. Иначе — человекочитаемое имя дела.
 */
data class TransactionDto(
    val id: Int,
    val projectId: String?,
    val projectName: String,
    val type: String,
    val amount: Double,
    val day: Int = 0,
    val createdAt: String,                 // ISO 8601
)
