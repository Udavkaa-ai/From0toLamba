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
    suspend operator fun invoke(isOnboarding: Boolean = false): Result<Project> = runCatching {
        val template = if (isOnboarding) {
            projectRegistry.getOnboardingTemplate()
        } else {
            projectRegistry.getRandomTemplate()
        }

        val archetype = personaRegistry.getCompatibleArchetype(template.compatiblePersonas)
        val persona = personaRegistry.getPersona(archetype)

        val fate = if (isOnboarding) ProjectFate.HONEST_FAIL else selectFate(template.fateWeights)
        val daysUntilCollapse = calcDaysUntilCollapse(fate)

        val developerName = generateDeveloperName(archetype)
        val claimedUserCount = Random.nextInt(template.claimedUserCountRange.first(), template.claimedUserCountRange.last())
        val claimedTeamSize = Random.nextInt(3, 20)
        val realYield = calcRealYield(fate)

        val projectId = UUID.randomUUID().toString()
        val project = Project(
            id = projectId,
            // bannerImageUrl не пишем — обложка подбирается на лету в UI через
            // rememberBannerUrl(archetype, type, projectId) из assets/banners/
            name = template.buildName(),
            type = template.type,
            developerPersonaId = persona.id,
            fate = fate,
            personaArchetype = archetype,
            daysUntilCollapse = daysUntilCollapse,
            realDailyYieldRubles = realYield,
            developerName = developerName,
            developerAvatarSeed = UUID.randomUUID().toString(),
            claimedName = template.buildName(),
            claimedAPY = Random.nextInt(template.claimedAPYRange.first(), template.claimedAPYRange.last()).toFloat(),
            claimedUserCount = claimedUserCount,
            claimedTeamSize = claimedTeamSize,
            roadmap = template.roadmapTemplates.random(),
            description = template.descriptionTemplates.random(),
            isActive = false,
            currentUserCount = Random.nextInt(template.claimedUserCountRange.first(), template.claimedUserCountRange.last())
        )

        projectRepository.saveProject(project)
        project
    }

    private fun generateDeveloperName(archetype: PersonaArchetype): String =
        DeveloperNameBank.random(archetype)

    private fun selectFate(weights: Map<String, Int>): ProjectFate {
        val total = weights.values.sum()
        var random = Random.nextInt(total)
        for ((key, weight) in weights) {
            random -= weight
            if (random < 0) return ProjectFate.valueOf(key)
        }
        return ProjectFate.SLOW_DRAIN
    }

    private fun calcDaysUntilCollapse(fate: ProjectFate): Int = when (fate) {
        ProjectFate.INSTANT_SCAM -> Random.nextInt(1, 4)
        ProjectFate.SLOW_DRAIN -> Random.nextInt(7, 22)
        ProjectFate.HONEST_FAIL -> Random.nextInt(14, 30)
        ProjectFate.SURVIVOR -> Random.nextInt(20, 31)
        ProjectFate.UNICORN -> Random.nextInt(20, 31)
    }

    private fun calcRealYield(fate: ProjectFate): Double = when (fate) {
        ProjectFate.INSTANT_SCAM -> 0.0
        ProjectFate.SLOW_DRAIN -> Random.nextDouble(0.001, 0.005)
        ProjectFate.HONEST_FAIL -> Random.nextDouble(0.002, 0.008)
        ProjectFate.SURVIVOR -> Random.nextDouble(0.003, 0.015)
        ProjectFate.UNICORN -> Random.nextDouble(0.02, 0.10)
    }
}
