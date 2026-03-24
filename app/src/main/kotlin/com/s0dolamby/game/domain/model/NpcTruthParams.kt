package com.s0dolamby.game.domain.model

/**
 * Канонические факты о деле, которые хранятся при генерации проекта.
 * По темам из truthTopics делец всегда называет одно и то же значение.
 * По темам из lieTopics — каждый раз говорит разное.
 */
data class NpcTruthParams(
    /** PATRON_COUNT — реальное количество участников на момент запуска */
    val realPatronCount: Int,
    /** DAILY_PROFIT — человекочитаемое описание реальной доходности */
    val realDailyProfitDesc: String,
    /** PAYOUT_DATE — реальный график выплат */
    val realPayoutSchedule: String,
    /** GUILD_SIZE — реальный размер команды */
    val realGuildSize: Int,
    /** ELDER_BLESSING — прошло ли дело проверку старейшин */
    val elderBlessingPassed: Boolean,
    /** NOBLE_BACKING — реальный покровитель или null, если нет */
    val nobleBacking: String?,
    /** WITHDRAWAL_LIMITS — реальные условия вывода */
    val withdrawalPolicy: String
)
