package com.s0dolamby.game.presentation.common.format

/**
 * Форматирование грошей в стиле «1 234 567 г» (русские разряды через
 * non-breaking space) и компактное «1.2 тыс. г» / «3.4 млн г» для
 * крупных сумм.
 *
 * Везде где раньше было "%.0f г".format(x) — теперь `formatGroshes(x)`.
 */

private const val NBSP = ' '

/** Полное число с пробелами разрядов: «12 345 г», «1 234 567 г». */
fun formatGroshes(amount: Double): String {
    val rounded = amount.toLong()
    val absStr = Math.abs(rounded).toString()
    val withSpaces = absStr.reversed().chunked(3).joinToString(NBSP.toString()).reversed()
    val sign = if (rounded < 0) "-" else ""
    return "$sign$withSpaces${NBSP}г"
}

/** Компактная запись для тесных мест: «99 г», «12 тыс. г», «1.2 млн г». */
fun formatGroshesCompact(amount: Double): String = when {
    Math.abs(amount) >= 1_000_000 -> "%.1f${NBSP}млн${NBSP}г".format(amount / 1_000_000)
    Math.abs(amount) >= 10_000 -> "%.0f${NBSP}тыс.${NBSP}г".format(amount / 1_000)
    Math.abs(amount) >= 1_000 -> "%.1f${NBSP}тыс.${NBSP}г".format(amount / 1_000)
    else -> "%.0f${NBSP}г".format(amount)
}

/** Знаковая разница (для P&L): «+1 234 г», «-567 г». */
fun formatGroshesSigned(amount: Double): String {
    val rounded = amount.toLong()
    val withSpaces = formatGroshes(Math.abs(amount.toDouble()))
    return if (rounded >= 0) "+$withSpaces" else "-${withSpaces}"
}
