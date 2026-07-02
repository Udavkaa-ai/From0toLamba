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
    /** Род случайного события из каталога RandomEvents (null = обычная весть). */
    val eventKind: DailyEventKind? = null,
    val timestamp: Long = System.currentTimeMillis()
)

enum class PayoutStatus { DELAYED, NORMAL, BOOSTED }

// Случайное событие при advance-day (соответствует server-полю DailyUpdate.eventKind).
// null = обычная ежедневная весть, иначе — выпавшее событие, подсвечивается в ленте.
enum class DailyEventKind { NEGATIVE, POSITIVE, NEUTRAL }

enum class AnnouncementType {
    // Обычные события
    LISTING, NEW_SEASON, COLLAB, AUDIT,
    // Случайные события
    BAD_RUMOR, VIP_COLLAB, CRIMINAL_CASE, HACK
}

enum class NewsSource(val emoji: String, val label: String) {
    TOWN_CRIER("📯", "Глашатай"),
    TAVERN_RUMOR("🍺", "Слухи в кабаке"),
    ROYAL_DECREE("📜", "Царский указ"),
    GUARD_WARNING("⚔", "Стражники воеводы"),
    CHRONICLE("📖", "Летопись"),
    MYSTERIOUS_TRAVELER("🎭", "Таинственный странник"),
    GUILD_NOTICE("🔔", "Объявление гильдии"),
    MARKET_SQUARE("🏪", "Торговая площадь"),
    MERCHANT_NOTICE("💰", "Купеческое уведомление"),
    WISE_ELDER("🧙", "Мудрый старец")
}

/** Детерминированный источник на основе свойств вести — не нужно хранить в БД. */
fun DailyUpdate.computedSource(): NewsSource {
    when (announcement) {
        AnnouncementType.CRIMINAL_CASE -> return NewsSource.GUARD_WARNING
        AnnouncementType.HACK -> return NewsSource.MYSTERIOUS_TRAVELER
        AnnouncementType.VIP_COLLAB -> return NewsSource.ROYAL_DECREE
        AnnouncementType.LISTING -> return NewsSource.MERCHANT_NOTICE
        AnnouncementType.BAD_RUMOR -> return NewsSource.TAVERN_RUMOR
        else -> {}
    }

    val hash = id.hashCode()
    return when {
        redFlags.isNotEmpty() && payoutStatus == PayoutStatus.DELAYED ->
            NewsSource.GUARD_WARNING
        redFlags.size >= 2 ->
            if (hash % 2 == 0) NewsSource.MYSTERIOUS_TRAVELER else NewsSource.GUARD_WARNING
        payoutStatus == PayoutStatus.DELAYED ->
            listOf(NewsSource.MARKET_SQUARE, NewsSource.TAVERN_RUMOR, NewsSource.MYSTERIOUS_TRAVELER)[kotlin.math.abs(hash) % 3]
        announcement != null ->
            if (hash % 2 == 0) NewsSource.ROYAL_DECREE else NewsSource.GUILD_NOTICE
        payoutStatus == PayoutStatus.BOOSTED ->
            listOf(NewsSource.GUILD_NOTICE, NewsSource.MERCHANT_NOTICE, NewsSource.WISE_ELDER)[kotlin.math.abs(hash) % 3]
        redFlags.isNotEmpty() ->
            listOf(NewsSource.TAVERN_RUMOR, NewsSource.MYSTERIOUS_TRAVELER, NewsSource.CHRONICLE)[kotlin.math.abs(hash) % 3]
        else -> {
            val pool = listOf(
                NewsSource.TOWN_CRIER, NewsSource.CHRONICLE, NewsSource.MARKET_SQUARE,
                NewsSource.WISE_ELDER, NewsSource.GUILD_NOTICE, NewsSource.TOWN_CRIER
            )
            pool[kotlin.math.abs(hash) % pool.size]
        }
    }
}
