package com.s0dolamby.game.data.remote.dto

/**
 * POST /api/invest/:projectId — первое вложение.
 * extraSlot = "groshy" | "stars" | null — оплата дополнительного слота
 * (если активных дел уже 5). null = берётся базовый слот.
 */
data class InvestBody(
    val amount: Double,
    val extraSlot: String? = null,
)

/**
 * Ответ /api/invest/:projectId — luckShift отражает сдвиг fate в сторону
 * SURVIVOR/UNICORN (положительный) или INSTANT_SCAM (отрицательный) от
 * качества «беседы» / интуиции игрока. Используется для UI-фидбека.
 */
data class InvestResponse(
    val success: Boolean,
    val luckShift: Double = 0.0,
)

/** POST /api/invest/:projectId/add — довложить в активное дело. */
data class AddInvestBody(
    val amount: Double,
)

/** POST /api/invest/:projectId/withdraw — частичный вывод. */
data class WithdrawBody(
    val amount: Double,
)

/** Ответ /withdraw и /exit: сколько грошей реально получил игрок (после комиссии). */
data class WithdrawResponse(
    val success: Boolean,
    val received: Double,
)
