package com.s0dolamby.game.presentation.common.i18n

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import com.s0dolamby.game.domain.achievements.Achievement
import com.s0dolamby.game.domain.achievements.AchievementCategory
import com.s0dolamby.game.domain.model.InvestorRank

/**
 * Локализация подвигов и их категорий. Achievement остаётся плоским
 * data class в domain (без зависимостей на Compose/i18n), а перевод
 * подбирается уже в UI по `Achievement.id` через @Composable-обёртки.
 *
 * Для динамических подвигов (bestiary.archetype.*, rank.*) ключи
 * собираются по префиксу id и форматируются с подставленным именем
 * архетипа/чина — это позволяет одной строкой словаря «Знакомец: %s»
 * покрыть все 7 архетипов.
 */
@Composable
@ReadOnlyComposable
fun AchievementCategory.localizedTitle(): String =
    Strings.t("ach.cat.${this.name}")

@Composable
@ReadOnlyComposable
fun Achievement.localizedTitle(): String = when {
    id.startsWith("bestiary.archetype.") -> {
        val archName = id.removePrefix("bestiary.archetype.").uppercase()
        Strings.t("ach.bestiary.archetype.title", Strings.t("persona.$archName"))
    }
    id.startsWith("rank.") -> {
        val rankName = id.removePrefix("rank.").uppercase()
        Strings.t(rankNameToKey(rankName))
    }
    else -> Strings.t("ach.$id.title").takeUnless { it == "ach.$id.title" } ?: title
}

@Composable
@ReadOnlyComposable
fun Achievement.localizedDescription(): String = when {
    id.startsWith("bestiary.archetype.") -> {
        val archName = id.removePrefix("bestiary.archetype.").uppercase()
        Strings.t("ach.bestiary.archetype.desc", Strings.t("persona.$archName"))
    }
    id.startsWith("rank.") -> {
        val rankName = id.removePrefix("rank.").uppercase()
        Strings.t("ach.rank.desc", Strings.t(rankNameToKey(rankName)))
    }
    else -> Strings.t("ach.$id.desc").takeUnless { it == "ach.$id.desc" } ?: description
}

private fun rankNameToKey(rankName: String): String = when (rankName) {
    InvestorRank.NEWBIE.name -> "rank.skomoroh"
    InvestorRank.AMBASSADOR.name -> "rank.kupec"
    InvestorRank.ANALYST.name -> "rank.mudrec"
    InvestorRank.SHARK.name -> "rank.boyarin"
    InvestorRank.LAMBO_SENSEI.name -> "rank.knyaz"
    else -> "rank.skomoroh"
}
