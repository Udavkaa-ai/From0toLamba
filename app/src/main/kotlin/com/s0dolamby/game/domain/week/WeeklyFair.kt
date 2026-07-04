package com.s0dolamby.game.domain.week

import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.model.ProjectFate
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.IsoFields
import kotlin.math.abs

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

    /**
     * Сезонный модификатор недели — детерминирован от ключа, одинаков у
     * всех игроков. Влияет на генерацию новых дел (частота архетипов и
     * судеб); уже взятые дела не трогает.
     */
    fun modifierFor(weekKey: String): WeekModifier {
        val pool = WeekModifier.ROTATION
        return pool[abs(weekKey.hashCode()) % pool.size]
    }
}

/**
 * Каталог сезонных модификаторов «Ярмарки недели».
 *
 * @param archetypeBoost архетип встречается втрое чаще обычного
 * @param fateBoostKey   вес этой судьбы в шаблонах удваивается
 */
enum class WeekModifier(
    val emoji: String,
    /** Ключ строк словаря: week.mod.<key>.title / .desc */
    val stringKey: String,
    val archetypeBoost: PersonaArchetype? = null,
    val fateBoostKey: ProjectFate? = null
) {
    NONE("🎪", "none"),
    KOSCHEI_INVASION("💀", "koschei", archetypeBoost = PersonaArchetype.KOSCHEI),
    ZOLUSHKA_BALL("👠", "zolushka", archetypeBoost = PersonaArchetype.ZOLUSHKA),
    YAGA_SABBATH("🧙", "yaga", archetypeBoost = PersonaArchetype.BABA_YAGA),
    FIREBIRD_WEEK("🔥", "firebird", fateBoostKey = ProjectFate.UNICORN),
    ROGUE_WEEK("🗡", "rogue", fateBoostKey = ProjectFate.INSTANT_SCAM),
    HONEST_ROWS("🤝", "honest", fateBoostKey = ProjectFate.SURVIVOR);

    companion object {
        /**
         * Ротация недель: обычные недели попадаются чаще (NONE дважды),
         * остальные — по разу. Порядок влияет только на то, какой хэш
         * какую неделю вытянет.
         */
        val ROTATION: List<WeekModifier> = listOf(
            NONE, KOSCHEI_INVASION, FIREBIRD_WEEK, NONE,
            ZOLUSHKA_BALL, ROGUE_WEEK, YAGA_SABBATH, HONEST_ROWS
        )
    }
}
