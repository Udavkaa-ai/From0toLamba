package com.s0dolamby.game.domain.today

import java.time.LocalDate
import java.time.ZoneId

/**
 * Стрик + ежедневная награда — 1:1 повторение TG `todayService.ts`.
 * Логика чисто детерминированная — никакой БД/корутин здесь нет,
 * только формулы и сравнение дат в MSK.
 */
object TodayRewards {

    private val MSK = ZoneId.of("Europe/Moscow")

    /** Дневной ключ в MSK: «YYYY-MM-DD». */
    fun todayKey(): String = LocalDate.now(MSK).toString()
    fun yesterdayKey(): String = LocalDate.now(MSK).minusDays(1).toString()

    /** Лестница серии: день стрика → бонус-вешка в грошах. */
    val MILESTONES: Map<Int, Int> = mapOf(
        3 to 50,
        5 to 70,
        7 to 100,
        10 to 150,
        15 to 300,
        20 to 500,
        30 to 1000
    )

    /** Базовая ежедневная награда: 10 + min(streak, 10) × 5 (потолок 60г). */
    fun baseReward(streak: Int): Int = 10 + minOf(streak, 10) * 5

    /** Разовый бонус за прохождение вешки (или 0, если день стрика не в [MILESTONES]). */
    fun milestoneBonus(streak: Int): Int = MILESTONES[streak] ?: 0

    /** Полная награда за сегодня = база + бонус. */
    fun totalReward(streak: Int): Int = baseReward(streak) + milestoneBonus(streak)

    /**
     * Обновление стрика при заходе на экран «Сегодня».
     *
     * Возвращает пару `(новый стрик, был ли это первый заход за сегодня)`.
     * - если уже заходили сегодня — стрик не меняется, флаг = false
     * - если вчера тоже заходили — стрик += 1
     * - иначе серия сбрасывается на 1
     */
    fun computeOnVisit(lastSeenDay: String?, currentStreak: Int): Pair<Int, Boolean> {
        val today = todayKey()
        if (lastSeenDay == today) return currentStreak to false
        val newStreak = if (lastSeenDay == yesterdayKey()) (currentStreak + 1) else 1
        return newStreak to true
    }
}
