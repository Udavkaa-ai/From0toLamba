package com.s0dolamby.game.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.s0dolamby.game.domain.model.*

@Entity(tableName = "post_mortems")
data class PostMortemEntity(
    @PrimaryKey val projectId: String,
    val projectName: String,
    val revealedArchetype: String,
    val fate: String,
    val redFlagsFound: String,     // JSON
    val redFlagsMissed: String,    // JSON
    val profitLossRubles: Double,
    val analysis: String
)

fun PostMortemEntity.toDomain(gson: com.google.gson.Gson) = PostMortemReport(
    projectId = projectId,
    projectName = projectName,
    revealedArchetype = PersonaArchetype.valueOf(revealedArchetype),
    fate = ProjectFate.valueOf(fate),
    redFlagsFound = gson.fromJson(redFlagsFound, Array<String>::class.java).toList(),
    redFlagsMissed = gson.fromJson(redFlagsMissed, Array<String>::class.java).toList(),
    profitLossRubles = profitLossRubles,
    analysis = analysis
)

fun PostMortemReport.toEntity(gson: com.google.gson.Gson) = PostMortemEntity(
    projectId = projectId,
    projectName = projectName,
    revealedArchetype = revealedArchetype.name,
    fate = fate.name,
    redFlagsFound = gson.toJson(redFlagsFound),
    redFlagsMissed = gson.toJson(redFlagsMissed),
    profitLossRubles = profitLossRubles,
    analysis = analysis
)
