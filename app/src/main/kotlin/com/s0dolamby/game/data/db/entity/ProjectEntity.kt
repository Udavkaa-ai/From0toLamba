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

    // Hidden fields
    val fate: String,
    val personaArchetype: String,
    val daysUntilCollapse: Int?,
    val realDailyYieldTON: Double,
    val lieTopics: String,       // JSON array as string
    val truthTopics: String,     // JSON array as string

    // Public fields
    val developerName: String,
    val developerAvatarSeed: String,
    val claimedName: String,
    val claimedAPY: Float,
    val claimedUserCount: Int,
    val claimedTeamSize: Int,
    val roadmap: String,         // JSON array as string
    val description: String,

    // State
    val investedAmountTON: Double = 0.0,
    val currentValueTON: Double = 0.0,
    val daysSinceJoined: Int = 0,
    val isActive: Boolean = false,
    val isClosed: Boolean = false,
    val closureReason: String? = null,

    // Media
    val bannerImageUrl: String? = null,
    val bannerPromptUsed: String? = null,

    // Dynamic state
    val isWithdrawalLocked: Boolean = false,
    val currentUserCount: Int = 0,
    val userCountHistory: String = "[]",
    val apyHistory: String = "[]",

    // Player progress on this project
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
    realDailyYieldTON = realDailyYieldTON,
    lieTopics = gson.fromJson(lieTopics, Array<LieTopic>::class.java).toList(),
    truthTopics = gson.fromJson(truthTopics, Array<LieTopic>::class.java).toList(),
    developerName = developerName,
    developerAvatarSeed = developerAvatarSeed,
    claimedName = claimedName,
    claimedAPY = claimedAPY,
    claimedUserCount = claimedUserCount,
    claimedTeamSize = claimedTeamSize,
    roadmap = gson.fromJson(roadmap, Array<String>::class.java).toList(),
    description = description,
    investedAmountTON = investedAmountTON,
    currentValueTON = currentValueTON,
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
    realDailyYieldTON = realDailyYieldTON,
    lieTopics = gson.toJson(lieTopics),
    truthTopics = gson.toJson(truthTopics),
    developerName = developerName,
    developerAvatarSeed = developerAvatarSeed,
    claimedName = claimedName,
    claimedAPY = claimedAPY,
    claimedUserCount = claimedUserCount,
    claimedTeamSize = claimedTeamSize,
    roadmap = gson.toJson(roadmap),
    description = description,
    investedAmountTON = investedAmountTON,
    currentValueTON = currentValueTON,
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
