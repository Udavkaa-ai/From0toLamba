package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.registry.DeveloperNameBank
import com.s0dolamby.game.data.registry.PersonaRegistry
import com.s0dolamby.game.data.registry.ProjectRegistry
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
        rng: Random = Random.Default
    ): Result<Project> = runCatching {
        val template = if (isOnboarding) {
            projectRegistry.getOnboardingTemplate()
        } else {
            projectRegistry.getRandomTemplate(rng)
        }

        val archetype = personaRegistry.getCompatibleArchetype(template.compatiblePersonas, rng)
        val persona = personaRegistry.getPersona(archetype)

        val fate = if (isOnboarding) ProjectFate.HONEST_FAIL else selectFate(template.fateWeights, rng)
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

    private fun selectFate(weights: Map<String, Int>, rng: Random): ProjectFate {
        val total = weights.values.sum()
        var random = rng.nextInt(total)
        for ((key, weight) in weights) {
            random -= weight
            if (random < 0) return ProjectFate.valueOf(key)
        }
        return ProjectFate.SLOW_DRAIN
    }

    private fun calcDaysUntilCollapse(fate: ProjectFate, rng: Random): Int = when (fate) {
        ProjectFate.INSTANT_SCAM -> rng.nextInt(1, 4)
        ProjectFate.SLOW_DRAIN -> rng.nextInt(7, 22)
        ProjectFate.HONEST_FAIL -> rng.nextInt(14, 30)
        ProjectFate.SURVIVOR -> rng.nextInt(20, 31)
        ProjectFate.UNICORN -> rng.nextInt(20, 31)
    }

    private fun calcRealYield(fate: ProjectFate, rng: Random): Double = when (fate) {
        ProjectFate.INSTANT_SCAM -> 0.0
        ProjectFate.SLOW_DRAIN -> rng.nextDouble(0.001, 0.005)
        ProjectFate.HONEST_FAIL -> rng.nextDouble(0.002, 0.008)
        ProjectFate.SURVIVOR -> rng.nextDouble(0.003, 0.015)
        ProjectFate.UNICORN -> rng.nextDouble(0.02, 0.10)
    }
}
