package com.s0dolamby.game.domain.week

/**
 * Календарь игровой недели. Дни идут 1..7 (Пн..Вс); воскресенье (7-й день) —
 * выходной: переход с него на новую неделю разделён ожиданием или рекламой
 * (гейт живёт в GameState.weekGateUntil). Всё выводится из currentDay.
 */
object GameWeek {
    const val DAYS_IN_WEEK = 7

    /** Кулдаун выходного перед новой неделей — 3 часа реального времени. */
    const val WEEK_GATE_MS = 3L * 60 * 60 * 1000

    /** 1..7, где 1 — понедельник, 7 — воскресенье. */
    fun dayOfWeek(currentDay: Int): Int = ((currentDay - 1).mod(DAYS_IN_WEEK)) + 1

    /** Номер недели, начиная с 1. */
    fun weekNumber(currentDay: Int): Int = (currentDay - 1) / DAYS_IN_WEEK + 1

    /** Воскресенье — выходной, за которым начинается новая неделя. */
    fun isRestDay(currentDay: Int): Boolean = dayOfWeek(currentDay) == DAYS_IN_WEEK

    /** Следующий тап переносит в новую неделю (сейчас воскресенье). */
    fun crossesIntoNewWeek(currentDay: Int): Boolean = isRestDay(currentDay)

    fun dayName(currentDay: Int): String = when (dayOfWeek(currentDay)) {
        1 -> "Понедельник"
        2 -> "Вторник"
        3 -> "Среда"
        4 -> "Четверг"
        5 -> "Пятница"
        6 -> "Суббота"
        else -> "Воскресенье"
    }

    fun dayShort(currentDay: Int): String = when (dayOfWeek(currentDay)) {
        1 -> "Пн"; 2 -> "Вт"; 3 -> "Ср"; 4 -> "Чт"; 5 -> "Пт"; 6 -> "Сб"; else -> "Вс"
    }
}
