package com.s0dolamby.game.domain.achievements

import com.s0dolamby.game.domain.model.GameState
import com.s0dolamby.game.domain.model.Project

/** Категория подвига — для группировки в UI. */
enum class AchievementCategory(val title: String, val icon: String) {
    CHARTERS("Грамоты", "📜"),
    VENTURES("Дела", "⚖️"),
    WEALTH("Богатство", "💰"),
    RANK("Чин", "🏆"),
    TIES("Связи", "🤝"),
    BESTIARY("Бестиарий", "🗂️")
}

/**
 * Одна запись из каталога подвигов. condition вызывается с актуальным
 * GameState и плоским списком всех проектов (active + closed).
 *
 * Подвиги выдаются один раз — после разблокировки их id попадает в
 * GameState.unlockedAchievements и больше не пересчитывается.
 */
data class Achievement(
    val id: String,
    val category: AchievementCategory,
    val title: String,
    val description: String,
    val emoji: String,
    val condition: (GameState, List<Project>) -> Boolean
)

/** Снимок прогресса для UI — отсортированный по категориям + флаги. */
data class AchievementProgress(
    val achievement: Achievement,
    val unlocked: Boolean
)
