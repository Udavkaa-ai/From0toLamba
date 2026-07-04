package com.s0dolamby.game.domain.week

import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.IsoFields

/**
 * «Ярмарка недели» — соревновательное окно с понедельника по воскресенье (МСК).
 *
 * Общий сид: предложения дел генерируются от seed(weekKey, номер прожитого
 * дня недели, слот) — игроки, прожившие одинаковое число дней на одной
 * неделе, видят ОДИНАКОВЫЕ грамоты с одинаковыми судьбами. Сравнение
 * результатов становится честным: разница — в решениях, не в раздаче.
 *
 * Счёт недели: прирост богатства с начала недели + чуйка за неделю.
 */
object WeeklyFair {

    private val MSK = ZoneId.of("Europe/Moscow")

    /** Ключ недели вида «2026-W27» (ISO-неделя, МСК). */
    fun weekKey(): String {
        val d = LocalDate.now(MSK)
        return "%d-W%02d".format(
            d.get(IsoFields.WEEK_BASED_YEAR),
            d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR)
        )
    }

    /** Номер недели для витрины («Ярмарка недели 27»). */
    fun weekNumber(key: String): Int =
        key.substringAfter("-W").toIntOrNull() ?: 0

    /** Сколько дней осталось до конца недели, включая сегодня (1..7). */
    fun daysLeft(): Int = 8 - LocalDate.now(MSK).dayOfWeek.value

    /**
     * Детерминированный сид генерации: одна неделя + один прожитый день +
     * один слот → одно и то же дело у всех игроков.
     */
    fun seed(weekKey: String, advanceIndex: Int, slot: Int = 0): Long =
        weekKey.hashCode().toLong() * 1_000_003L +
            advanceIndex.toLong() * 101L +
            slot.toLong()
}
