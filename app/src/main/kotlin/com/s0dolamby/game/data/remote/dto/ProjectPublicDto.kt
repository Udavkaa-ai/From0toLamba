package com.s0dolamby.game.data.remote.dto

import com.google.gson.annotations.SerializedName

/**
 * Публичное представление дела — соответствует серверному ProjectPublicDTO
 * (см. tg/server/src/game/types.ts → ProjectPublicDTO). Скрытые поля (fate,
 * lieTopics, npcTruthParams, realDailyYieldRubles, daysUntilCollapse) на клиент
 * НЕ приходят — они открываются только в PostMortemDto после закрытия дела.
 *
 * personaArchetype — публичен (игрок сразу видит личину хозяина), но судьба
 * (fate) и темы лжи остаются на сервере до разбора.
 */
data class ProjectPublicDto(
    val id: String,
    val name: String,
    val type: String,                       // ProjectType.name
    val personaArchetype: String,           // PersonaArchetype.name

    val isInbox: Boolean,
    val isActive: Boolean,
    val isClosed: Boolean,

    val developerName: String,
    val developerAvatarSeed: String,
    val claimedName: String,
    val claimedAPY: Double,
    val claimedUserCount: Int,
    val claimedTeamSize: Int,
    val description: String,
    val roadmap: List<String> = emptyList(),

    val investedAmountRubles: Double = 0.0,
    val currentValueRubles: Double = 0.0,
    val totalWithdrawnRubles: Double = 0.0,
    // Кумулятивно вложено за всё время (сумма INVEST + ADD из Transaction) —
    // для честного profit% даже после partialWithdraw.
    val totalInvestedRubles: Double = 0.0,

    val daysSinceJoined: Int = 0,
    val isWithdrawalLocked: Boolean = false,
    val closureReason: String? = null,
    val bannerImageUrl: String? = null,

    val currentUserCount: Int = 0,
    val userCountHistory: List<Int> = emptyList(),
    val apyHistory: List<Double> = emptyList(),
    val valueHistory: List<Double> = emptyList(),

    // VIP от спонсорского канала. promocode на клиент не приходит — проверка только серверная.
    val isSponsor: Boolean = false,
    val sponsorChannelUrl: String? = null,
    val sponsorPromoVerified: Boolean = false,

    // Серверные поля, иногда отсутствуют в ответе старых эндпоинтов — Gson проставит null/0.
    @SerializedName("mafiaOfferIssued")
    val mafiaOfferIssued: Boolean = false,
    @SerializedName("isExtraSlot")
    val isExtraSlot: Boolean = false,
)
