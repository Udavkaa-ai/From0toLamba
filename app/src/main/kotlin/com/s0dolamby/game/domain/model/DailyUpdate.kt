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

enum class AnnouncementType {
    // Regular announcements
    LISTING, NEW_SEASON, COLLAB, AUDIT,
    // Random events
    BAD_RUMOR, VIP_COLLAB, CRIMINAL_CASE, HACK
}

enum class NewsSource(val emoji: String, val label: String) {
    TELEGRAM_CHANNEL("📢", "Telegram-канал"),
    REDDIT("🧵", "Reddit / форум"),
    PRESS_RELEASE("📋", "Пресс-релиз"),
    FRAUD_ALERT("🚨", "Сигнал о мошенничестве"),
    CRYPTO_MEDIA("📰", "Крипто-медиа"),
    ANONYMOUS("👤", "Анонимный источник"),
    OFFICIAL_BLOG("📝", "Официальный блог"),
    COMMUNITY("💬", "Сообщество"),
    EXCHANGE_NOTICE("🏦", "Уведомление биржи"),
    INVESTOR_REPORT("📊", "Отчёт инвестора")
}

/** Deterministic source based on update properties — no DB storage needed. */
fun DailyUpdate.computedSource(): NewsSource {
    // Event types have fixed sources
    when (announcement) {
        AnnouncementType.CRIMINAL_CASE -> return NewsSource.FRAUD_ALERT
        AnnouncementType.HACK -> return NewsSource.ANONYMOUS
        AnnouncementType.VIP_COLLAB -> return NewsSource.PRESS_RELEASE
        AnnouncementType.LISTING -> return NewsSource.EXCHANGE_NOTICE
        AnnouncementType.BAD_RUMOR -> return NewsSource.REDDIT
        else -> {}
    }

    val hash = id.hashCode()
    return when {
        redFlags.isNotEmpty() && payoutStatus == PayoutStatus.DELAYED ->
            NewsSource.FRAUD_ALERT
        redFlags.size >= 2 ->
            if (hash % 2 == 0) NewsSource.ANONYMOUS else NewsSource.FRAUD_ALERT
        payoutStatus == PayoutStatus.DELAYED ->
            listOf(NewsSource.COMMUNITY, NewsSource.REDDIT, NewsSource.ANONYMOUS)[kotlin.math.abs(hash) % 3]
        announcement != null ->
            if (hash % 2 == 0) NewsSource.PRESS_RELEASE else NewsSource.OFFICIAL_BLOG
        payoutStatus == PayoutStatus.BOOSTED ->
            listOf(NewsSource.OFFICIAL_BLOG, NewsSource.EXCHANGE_NOTICE, NewsSource.INVESTOR_REPORT)[kotlin.math.abs(hash) % 3]
        redFlags.isNotEmpty() ->
            listOf(NewsSource.REDDIT, NewsSource.ANONYMOUS, NewsSource.CRYPTO_MEDIA)[kotlin.math.abs(hash) % 3]
        else -> {
            val pool = listOf(
                NewsSource.TELEGRAM_CHANNEL, NewsSource.CRYPTO_MEDIA, NewsSource.COMMUNITY,
                NewsSource.INVESTOR_REPORT, NewsSource.OFFICIAL_BLOG, NewsSource.TELEGRAM_CHANNEL
            )
            pool[kotlin.math.abs(hash) % pool.size]
        }
    }
}
