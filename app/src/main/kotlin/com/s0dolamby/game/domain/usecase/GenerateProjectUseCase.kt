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

        val lieTopics = persona.defaultLieTopics.shuffled().take(Random.nextInt(2, 5))
        val truthTopics = LieTopic.values().filter { it !in lieTopics }.shuffled().take(3)

        val developerName = generateDeveloperName(archetype)
        val claimedUserCount = Random.nextInt(template.claimedUserCountRange.first(), template.claimedUserCountRange.last())
        val claimedTeamSize = Random.nextInt(3, 20)
        val realYield = calcRealYield(fate)
        val npcTruthParams = generateNpcTruthParams(fate, template.type, claimedUserCount, claimedTeamSize, realYield)

        val project = Project(
            id = UUID.randomUUID().toString(),
            name = template.buildName(),
            type = template.type,
            developerPersonaId = persona.id,
            fate = fate,
            personaArchetype = archetype,
            daysUntilCollapse = daysUntilCollapse,
            realDailyYieldRubles = realYield,
            lieTopics = lieTopics,
            truthTopics = truthTopics,
            npcTruthParams = npcTruthParams,
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

    private fun generateNpcTruthParams(
        fate: ProjectFate,
        type: ProjectType,
        claimedUserCount: Int,
        claimedTeamSize: Int,
        realDailyYieldRubles: Double
    ): NpcTruthParams {
        val realPatronCount = when (fate) {
            ProjectFate.INSTANT_SCAM -> Random.nextInt(5, 50)
            ProjectFate.SLOW_DRAIN -> (claimedUserCount * Random.nextDouble(0.05, 0.2)).toInt().coerceAtLeast(10)
            ProjectFate.HONEST_FAIL -> (claimedUserCount * Random.nextDouble(0.3, 0.6)).toInt().coerceAtLeast(20)
            ProjectFate.SURVIVOR -> (claimedUserCount * Random.nextDouble(0.7, 1.0)).toInt().coerceAtLeast(50)
            ProjectFate.UNICORN -> (claimedUserCount * Random.nextDouble(0.9, 1.3)).toInt().coerceAtLeast(100)
        }
        val dailyPer100 = (realDailyYieldRubles * 100).toInt().coerceAtLeast(0)
        val realDailyProfitDesc = if (dailyPer100 == 0) "копейки, почти ничего" else "$dailyPer100 ₽ в день на каждые 100 вложенных"
        val realPayoutSchedule = when (fate) {
            ProjectFate.INSTANT_SCAM -> "как накопится, точной даты нет"
            ProjectFate.SLOW_DRAIN -> listOf("раз в месяц", "через 30 дней").random()
            ProjectFate.HONEST_FAIL -> listOf("каждые 14 дней", "раз в месяц").random()
            ProjectFate.SURVIVOR -> listOf("каждые 7 дней", "раз в две недели").random()
            ProjectFate.UNICORN -> listOf("каждые 3 дня", "каждую неделю").random()
        }
        val realGuildSize = when (fate) {
            ProjectFate.INSTANT_SCAM -> Random.nextInt(1, 3)
            ProjectFate.SLOW_DRAIN -> Random.nextInt(2, 5)
            else -> (claimedTeamSize * Random.nextDouble(0.6, 1.0)).toInt().coerceAtLeast(2)
        }
        val elderBlessingPassed = fate in listOf(ProjectFate.SURVIVOR, ProjectFate.UNICORN, ProjectFate.HONEST_FAIL)
        val nobleBacking: String? = when (fate) {
            ProjectFate.SURVIVOR -> listOf("Купеческая гильдия Новгорода", "Торговый дом Строгановых", null).random()
            ProjectFate.UNICORN -> listOf("Купеческий союз Москвы", "Артель Рябушинских").random()
            else -> null
        }
        val withdrawalPolicy = when (type) {
            ProjectType.POTION_BREW, ProjectType.GUILD_SCHEME -> "не более 25% от вложенного за одну операцию"
            ProjectType.CARD_GAME, ProjectType.TREASURE_HUNT -> "в любой момент, но с комиссией 25%"
            ProjectType.HONEST_TRADE -> "без ограничений и без комиссии"
        }
        return NpcTruthParams(
            realPatronCount = realPatronCount,
            realDailyProfitDesc = realDailyProfitDesc,
            realPayoutSchedule = realPayoutSchedule,
            realGuildSize = realGuildSize,
            elderBlessingPassed = elderBlessingPassed,
            nobleBacking = nobleBacking,
            withdrawalPolicy = withdrawalPolicy
        )
    }

    private fun calcRealYield(fate: ProjectFate): Double = when (fate) {
        ProjectFate.INSTANT_SCAM -> 0.0
        ProjectFate.SLOW_DRAIN -> Random.nextDouble(0.001, 0.005)
        ProjectFate.HONEST_FAIL -> Random.nextDouble(0.002, 0.008)
        ProjectFate.SURVIVOR -> Random.nextDouble(0.003, 0.015)
        ProjectFate.UNICORN -> Random.nextDouble(0.02, 0.10)
    }
}
