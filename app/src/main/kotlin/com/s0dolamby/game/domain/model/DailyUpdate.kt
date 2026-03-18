package com.s0dolamby.game.domain.model

data class DailyUpdate(
    val id: String,
    val projectId: String,
    val projectName: String,
    val day: Int,
    val title: String,
    val body: String,
    val userCountDelta: Int,
    val payoutStatus: PayoutStatus,
    val announcement: AnnouncementType?,
    val redFlags: List<String>,
    val timestamp: Long = System.currentTimeMillis()
)

enum class PayoutStatus { DELAYED, NORMAL, BOOSTED }
enum class AnnouncementType { LISTING, NEW_SEASON, COLLAB, AUDIT }
