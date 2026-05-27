package com.s0dolamby.game.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.s0dolamby.game.domain.model.AnnouncementType
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.model.PayoutStatus

@Entity(tableName = "daily_updates")
data class UpdateEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val projectName: String,
    val day: Int,
    val title: String,
    val body: String,
    val userCountDelta: Int,
    val payoutStatus: String,
    val announcement: String?,
    val redFlags: String,   // JSON array
    val timestamp: Long = System.currentTimeMillis(),

    // --- Phase 1: server-first ---
    // Случайное событие (см. tg/server randomEvents.ts): NEGATIVE | POSITIVE | NEUTRAL | null.
    // null = обычная ежедневная весть.
    val eventKind: String? = null
)

fun UpdateEntity.toDomain(gson: com.google.gson.Gson) = DailyUpdate(
    id = id,
    projectId = projectId,
    projectName = projectName,
    day = day,
    title = title,
    body = body,
    userCountDelta = userCountDelta,
    payoutStatus = PayoutStatus.valueOf(payoutStatus),
    announcement = announcement?.let { AnnouncementType.valueOf(it) },
    redFlags = gson.fromJson(redFlags, Array<String>::class.java).toList(),
    timestamp = timestamp
)

fun DailyUpdate.toEntity(gson: com.google.gson.Gson) = UpdateEntity(
    id = id,
    projectId = projectId,
    projectName = projectName,
    day = day,
    title = title,
    body = body,
    userCountDelta = userCountDelta,
    payoutStatus = payoutStatus.name,
    announcement = announcement?.name,
    redFlags = gson.toJson(redFlags),
    timestamp = timestamp
)
