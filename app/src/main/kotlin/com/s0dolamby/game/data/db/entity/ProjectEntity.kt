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
    val lieGuessCorrect: Boolean = false
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
