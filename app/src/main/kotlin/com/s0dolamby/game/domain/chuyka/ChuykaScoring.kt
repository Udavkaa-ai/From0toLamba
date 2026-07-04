package com.s0dolamby.game.domain.chuyka

/**
 * Начисление очков чуйки за прогноз «Верю — не верю».
 *
 * Против фарма слепыми ставками:
 *  - штраф за промах (12) чуть больше награды за попадание (10):
 *    стратегия «всегда ставлю на обман» при базовых 55% обманов даёт
 *    EV ≈ 0.55×10 − 0.45×12 ≈ +0.1 — фармить бессмысленно;
 *  - сама ставка требует информации: на невзятое дело — минимум один
 *    вопрос дельцу, на взятое — реальные вложенные гроши;
 *  - серия верных прогнозов даёт бонус (+2 за каждый подряд сверх
 *    первого, потолок +10) — стабильно читающий дельцов игрок
 *    зарабатывает ощутимо больше монетки.
 */
object ChuykaScoring {

    const val CORRECT_BASE = 10
    const val WRONG_PENALTY = 12
    const val STREAK_BONUS_PER = 2
    const val STREAK_BONUS_CAP = 10

    /**
     * Дельта очков за разрешённый прогноз.
     * @param streakBefore серия верных прогнозов ДО этого разрешения.
     */
    fun delta(correct: Boolean, streakBefore: Int): Int =
        if (correct) CORRECT_BASE + (streakBefore * STREAK_BONUS_PER).coerceAtMost(STREAK_BONUS_CAP)
        else -WRONG_PENALTY

    /** Точность в процентах для витрины (0, если прогнозов ещё не было). */
    fun accuracyPercent(correct: Int, total: Int): Int =
        if (total <= 0) 0 else (correct * 100) / total
}
