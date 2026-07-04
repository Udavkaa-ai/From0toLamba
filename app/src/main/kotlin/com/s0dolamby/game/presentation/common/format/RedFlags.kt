package com.s0dolamby.game.presentation.common.format

/**
 * Красные флаги из свежих шаблонов — уже человеческие русские фразы.
 * Но в старых сохранениях (эпоха AI-генерации вестей) могли остаться
 * код-стиль флаги вида «PAYOUT_DELAY» или «paymentDelay» — их нельзя
 * показывать игроку сырыми.
 *
 * Правило: латиница с подчёркиваниями/camelCase → разбиваем на слова
 * и приводим к виду обычной фразы. Всё остальное (включая любые
 * русские фразы) возвращается как есть — без порчи регистра.
 */
fun String.humanizeRedFlag(): String {
    val latinOnly = all { !it.isLetter() || it in 'A'..'Z' || it in 'a'..'z' || it == '_' || it == ' ' }
    val codeLike = latinOnly && (contains('_') || contains(Regex("[a-z][A-Z]")))
    if (!codeLike) return this
    return replace('_', ' ')
        .replace(Regex("([a-z])([A-Z])"), "$1 $2")
        .lowercase()
        .replaceFirstChar { it.uppercase() }
}
