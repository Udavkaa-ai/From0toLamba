package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.registry.DeveloperNameBank
import com.s0dolamby.game.data.registry.PersonaRegistry
import com.s0dolamby.game.data.registry.ProjectRegistry
import com.s0dolamby.game.domain.config.FateConfig
import com.s0dolamby.game.domain.model.*
import com.s0dolamby.game.domain.repository.ProjectRepository
import java.util.UUID
import javax.inject.Inject
import kotlin.random.Random

class GenerateProjectUseCase @Inject constructor(
    private val projectRegistry: ProjectRegistry,
    private val personaRegistry: PersonaRegistry,
    private val projectRepository: ProjectRepository
) {
    /**
     * @param rng источник случайности. По умолчанию — обычный Random;
     *   «Ярмарка недели» передаёт сюда Random(WeeklyFair.seed(...)) —
     *   тогда дело детерминировано и одинаково у всех игроков недели.
     *   UUID'ы (id, avatarSeed) сидом не связаны — они не влияют на геймплей.
     */
    suspend operator fun invoke(
        isOnboarding: Boolean = false,
        rng: Random = Random.Default,
        /** Сезонный модификатор «Ярмарки недели» (частота архетипов/судеб). */
        modifier: com.s0dolamby.game.domain.week.WeekModifier =
            com.s0dolamby.game.domain.week.WeekModifier.NONE
    ): Result<Project> = runCatching {
        // Сначала архетип РАВНОВЕРОЯТНО из всех семи, потом совместимый
        // с ним шаблон — иначе частые в compatiblePersonas дельцы (Боярин,
        // Буратино) вытесняют редких (Яга, Золушка).
        val template: com.s0dolamby.game.data.registry.ProjectRegistry.ProjectTemplate
        val archetype: PersonaArchetype
        if (isOnboarding) {
            template = projectRegistry.getOnboardingTemplate()
            archetype = personaRegistry.getCompatibleArchetype(template.compatiblePersonas, rng)
        } else {
            archetype = pickArchetype(rng, modifier)
            template = projectRegistry.getRandomTemplateFor(archetype.name.lowercase(), rng)
        }
        val persona = personaRegistry.getPersona(archetype)

        val fate = if (isOnboarding) ProjectFate.HONEST_FAIL
        else selectFate(applyFateBoost(template.fateWeights, modifier), rng)
        val daysUntilCollapse = calcDaysUntilCollapse(fate, rng)

        val developerName = DeveloperNameBank.all(archetype).random(rng)
        val claimedUserCount = rng.nextInt(template.claimedUserCountRange.first(), template.claimedUserCountRange.last())
        val claimedTeamSize = rng.nextInt(3, 20)
        val realYield = calcRealYield(fate, rng)

        val projectId = UUID.randomUUID().toString()
        val claimedName = template.buildName(rng)
        val project = Project(
            id = projectId,
            // bannerImageUrl не пишем — обложка подбирается на лету в UI через
            // rememberBannerUrl(archetype, type, projectId) из assets/banners/
            name = claimedName,
            type = template.type,
            developerPersonaId = persona.id,
            fate = fate,
            personaArchetype = archetype,
            daysUntilCollapse = daysUntilCollapse,
            realDailyYieldRubles = realYield,
            developerName = developerName,
            developerAvatarSeed = UUID.randomUUID().toString(),
            claimedName = claimedName,
            claimedAPY = rng.nextInt(template.claimedAPYRange.first(), template.claimedAPYRange.last()).toFloat(),
            claimedUserCount = claimedUserCount,
            claimedTeamSize = claimedTeamSize,
            roadmap = template.roadmapTemplates.random(rng),
            description = template.descriptionTemplates.random(rng),
            isActive = false,
            currentUserCount = rng.nextInt(template.claimedUserCountRange.first(), template.claimedUserCountRange.last())
        )

        projectRepository.saveProject(project)
        project
    }

    /** Равновероятный архетип; сезонный буст утраивает вес своего героя. */
    private fun pickArchetype(
        rng: Random,
        modifier: com.s0dolamby.game.domain.week.WeekModifier
    ): PersonaArchetype {
        val boosted = modifier.archetypeBoost
            ?: return PersonaArchetype.values().random(rng)
        val pool = PersonaArchetype.values().toList() + listOf(boosted, boosted)
        return pool.random(rng)
    }

    /** Сезонный буст судьбы: её вес в шаблоне удваивается. */
    private fun applyFateBoost(
        weights: Map<String, Int>,
        modifier: com.s0dolamby.game.domain.week.WeekModifier
    ): Map<String, Int> {
        val boosted = modifier.fateBoostKey ?: return weights
        return weights.mapValues { (key, w) -> if (key == boosted.name) w * 2 else w }
    }

    private fun selectFate(weights: Map<String, Int>, rng: Random): ProjectFate {
        val total = weights.values.sum()
        var random = rng.nextInt(total)
        for ((key, weight) in weights) {
            random -= weight
            if (random < 0) return ProjectFate.valueOf(key)
        }
        return ProjectFate.SLOW_DRAIN
    }

    // Срок жизни и дневная доходность берутся из FateConfig — единого
    // источника баланса (потолок Единорога ≤~495%). Раньше здесь были свои
    // завышенные диапазоны (Единорог до 0.10/день → тысячи процентов), из-за
    // чего даже честный провал уходил в плюс.
    private fun calcDaysUntilCollapse(fate: ProjectFate, rng: Random): Int {
        val days = FateConfig[fate].daysRange
        return rng.nextInt(days.first, days.last + 1)
    }

    private fun calcRealYield(fate: ProjectFate, rng: Random): Double {
        // INSTANT_SCAM без реального роста — деньги исчезают крахом.
        if (fate == ProjectFate.INSTANT_SCAM) return 0.0
        val y = FateConfig[fate].dailyYieldRange
        return rng.nextDouble(y.start, y.endInclusive)
    }
}
