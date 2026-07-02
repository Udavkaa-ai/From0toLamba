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

/** Что раскрывает справочный подвиг: породу дела, личину хозяина или судьбу. */
enum class RevealKind { TYPE, ARCHETYPE, FATE }

/**
 * Ссылка подвига на запись «летописи» — справочника пород/личин/судеб.
 * [id] — имя соответствующего enum'а (ProjectType / PersonaArchetype /
 * ProjectFate). Текст самой записи живёт в i18n (LoreI18n).
 */
data class RevealTopic(val kind: RevealKind, val id: String)

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
    val revealTopic: RevealTopic? = null,
    val condition: (GameState, List<Project>) -> Boolean
)

/** Снимок прогресса для UI — отсортированный по категориям + флаги. */
data class AchievementProgress(
    val achievement: Achievement,
    val unlocked: Boolean
)
