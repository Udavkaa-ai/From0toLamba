package com.s0dolamby.game.data.db.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.s0dolamby.game.domain.model.AmaMessage
import com.s0dolamby.game.domain.model.AmaSession
import com.s0dolamby.game.domain.model.MessageRole

@Entity(tableName = "ama_sessions")
data class AmaSessionEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val questionCount: Int = 0,
    val isComplete: Boolean = false
)

@Entity(
    tableName = "ama_messages",
    foreignKeys = [ForeignKey(
        entity = AmaSessionEntity::class,
        parentColumns = ["id"],
        childColumns = ["sessionId"],
        onDelete = ForeignKey.CASCADE
    )],
    indices = [Index("sessionId")]
)
data class AmaMessageEntity(
    @PrimaryKey val id: String,
    val sessionId: String,
    val role: String,
    val content: String,
    val timestamp: Long = System.currentTimeMillis()
)

fun AmaMessageEntity.toDomain() = AmaMessage(
    id = id,
    sessionId = sessionId,
    role = MessageRole.valueOf(role),
    content = content,
    timestamp = timestamp
)

fun AmaMessage.toEntity() = AmaMessageEntity(
    id = id,
    sessionId = sessionId,
    role = role.name,
    content = content,
    timestamp = timestamp
)
