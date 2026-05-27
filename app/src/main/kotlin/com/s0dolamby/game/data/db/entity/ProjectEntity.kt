package com.s0dolamby.game.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.s0dolamby.game.domain.model.*

@Entity(tableName = "projects")
data class ProjectEntity(
    @PrimaryKey val id: String,
    val name: String,
    val type: String,
    val developerPersonaId: String,

    // Скрытые поля
    val fate: String,
    val personaArchetype: String,
    val daysUntilCollapse: Int?,
    val realDailyYieldRubles: Double,
    val lieTopics: String,       // JSON array as string
    val truthTopics: String,     // JSON array as string
    val npcTruthParams: String = "{}",  // JSON object

    // Публичные поля
    val developerName: String,
    val developerAvatarSeed: String,
    val claimedName: String,
    val claimedAPY: Float,
    val claimedUserCount: Int,
    val claimedTeamSize: Int,
    val roadmap: String,         // JSON array as string
    val description: String,

    // Состояние
    val investedAmountRubles: Double = 0.0,
    val currentValueRubles: Double = 0.0,
    val daysSinceJoined: Int = 0,
    val isActive: Boolean = false,
    val isClosed: Boolean = false,
    val closureReason: String? = null,

    // Медиа
    val bannerImageUrl: String? = null,
    val bannerPromptUsed: String? = null,

    // Динамическое состояние
    val isWithdrawalLocked: Boolean = false,
    val currentUserCount: Int = 0,
    val userCountHistory: String = "[]",
    val apyHistory: String = "[]",

    @androidx.room.ColumnInfo(defaultValue = "0")
    val lieGuessCorrect: Boolean = false,

    // --- Phase 1: server-first public-field mirror (tg/server ProjectPublicDTO) ---
    // Явный флаг inbox (сервер использует его как источник). На клиенте логика
    // запросов пока остаётся «!isActive && !isClosed» — поле дублирует для совместимости.
    @androidx.room.ColumnInfo(defaultValue = "1")
    val isInbox: Boolean = true,
    // Сгенерировано заранее, ждёт следующего advance-day для попадания в инбокс.
    @androidx.room.ColumnInfo(defaultValue = "0")
    val isPreloaded: Boolean = false,
    // Кумулятивная сумма всех выводов (после комиссии) — для корректного profit%.
    @androidx.room.ColumnInfo(defaultValue = "0")
    val totalWithdrawnRubles: Double = 0.0,
    // «Предложение от которого нельзя отказаться» — выдано за 2-3 дня до автозакрытия.
    @androidx.room.ColumnInfo(defaultValue = "0")
    val mafiaOfferIssued: Boolean = false,
    // Дело занимает дополнительный слот (купленный за extraSlotsBalance).
    @androidx.room.ColumnInfo(defaultValue = "0")
    val isExtraSlot: Boolean = false,
    // История стоимости дела для графика — последние 30 дней.
    @androidx.room.ColumnInfo(defaultValue = "[]")
    val valueHistory: String = "[]",
    // VIP-дело от спонсорского канала: фиксированный возврат 3× за durationDays.
    @androidx.room.ColumnInfo(defaultValue = "0")
    val isSponsor: Boolean = false,
    val sponsorChannelUrl: String? = null,
    @androidx.room.ColumnInfo(defaultValue = "0")
    val sponsorPromoVerified: Boolean = false,
    // Промокод для VIP-дела: клиент шлёт plain текст на верификацию, сервер сравнивает case-insensitive.
    val promocode: String? = null
)

fun ProjectEntity.toDomain(gson: com.google.gson.Gson): Project = Project(
    id = id,
    name = name,
    type = ProjectType.valueOf(type),
    developerPersonaId = developerPersonaId,
    fate = ProjectFate.valueOf(fate),
    personaArchetype = PersonaArchetype.valueOf(personaArchetype),
    daysUntilCollapse = daysUntilCollapse,
    realDailyYieldRubles = realDailyYieldRubles,
    lieTopics = gson.fromJson(lieTopics, Array<LieTopic>::class.java).toList(),
    truthTopics = gson.fromJson(truthTopics, Array<LieTopic>::class.java).toList(),
    npcTruthParams = runCatching { gson.fromJson(npcTruthParams, NpcTruthParams::class.java) }.getOrNull()
        ?: NpcTruthParams(0, "", "", 0, false, null, ""),
    developerName = developerName,
    developerAvatarSeed = developerAvatarSeed,
    claimedName = claimedName,
    claimedAPY = claimedAPY,
    claimedUserCount = claimedUserCount,
    claimedTeamSize = claimedTeamSize,
    roadmap = gson.fromJson(roadmap, Array<String>::class.java).toList(),
    description = description,
    investedAmountRubles = investedAmountRubles,
    currentValueRubles = currentValueRubles,
    daysSinceJoined = daysSinceJoined,
    isActive = isActive,
    isClosed = isClosed,
    closureReason = closureReason,
    bannerImageUrl = bannerImageUrl,
    bannerPromptUsed = bannerPromptUsed,
    isWithdrawalLocked = isWithdrawalLocked,
    currentUserCount = currentUserCount,
    userCountHistory = gson.fromJson(userCountHistory, Array<Int>::class.java).toList(),
    apyHistory = gson.fromJson(apyHistory, Array<Float>::class.java).toList(),
    lieGuessCorrect = lieGuessCorrect
)

fun Project.toEntity(gson: com.google.gson.Gson): ProjectEntity = ProjectEntity(
    id = id,
    name = name,
    type = type.name,
    developerPersonaId = developerPersonaId,
    fate = fate.name,
    personaArchetype = personaArchetype.name,
    daysUntilCollapse = daysUntilCollapse,
    realDailyYieldRubles = realDailyYieldRubles,
    lieTopics = gson.toJson(lieTopics),
    truthTopics = gson.toJson(truthTopics),
    npcTruthParams = gson.toJson(npcTruthParams),
    developerName = developerName,
    developerAvatarSeed = developerAvatarSeed,
    claimedName = claimedName,
    claimedAPY = claimedAPY,
    claimedUserCount = claimedUserCount,
    claimedTeamSize = claimedTeamSize,
    roadmap = gson.toJson(roadmap),
    description = description,
    investedAmountRubles = investedAmountRubles,
    currentValueRubles = currentValueRubles,
    daysSinceJoined = daysSinceJoined,
    isActive = isActive,
    isClosed = isClosed,
    closureReason = closureReason,
    bannerImageUrl = bannerImageUrl,
    bannerPromptUsed = bannerPromptUsed,
    isWithdrawalLocked = isWithdrawalLocked,
    currentUserCount = currentUserCount,
    userCountHistory = gson.toJson(userCountHistory),
    apyHistory = gson.toJson(apyHistory),
    lieGuessCorrect = lieGuessCorrect
)
