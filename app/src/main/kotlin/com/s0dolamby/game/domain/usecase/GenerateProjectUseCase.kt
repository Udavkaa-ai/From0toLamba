package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.ai.ChatRequest
import com.s0dolamby.game.data.ai.ChatMessage
import com.s0dolamby.game.data.ai.OpenRouterApiService
import com.s0dolamby.game.data.ai.PromptBuilder
import com.s0dolamby.game.data.registry.PersonaRegistry
import com.s0dolamby.game.data.registry.ProjectRegistry
import com.s0dolamby.game.domain.model.*
import com.s0dolamby.game.domain.repository.GameConfig
import com.s0dolamby.game.domain.repository.ProjectRepository
import java.util.UUID
import javax.inject.Inject
import kotlin.random.Random

class GenerateProjectUseCase @Inject constructor(
    private val api: OpenRouterApiService,
    private val promptBuilder: PromptBuilder,
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

        val project = Project(
            id = UUID.randomUUID().toString(),
            name = template.buildName(),
            type = template.type,
            developerPersonaId = persona.id,
            fate = fate,
            personaArchetype = archetype,
            daysUntilCollapse = daysUntilCollapse,
            realDailyYieldRubles = calcRealYield(fate),
            lieTopics = lieTopics,
            truthTopics = truthTopics,
            developerName = developerName,
            developerAvatarSeed = UUID.randomUUID().toString(),
            claimedName = template.buildName(),
            claimedAPY = Random.nextInt(template.claimedAPYRange.first(), template.claimedAPYRange.last()).toFloat(),
            claimedUserCount = Random.nextInt(template.claimedUserCountRange.first(), template.claimedUserCountRange.last()),
            claimedTeamSize = Random.nextInt(3, 20),
            roadmap = template.roadmapTemplates.random(),
            description = template.descriptionTemplates.random(),
            isActive = false,
            currentUserCount = Random.nextInt(template.claimedUserCountRange.first(), template.claimedUserCountRange.last())
        )

        projectRepository.saveProject(project)
        project
    }

    private suspend fun generateDeveloperName(archetype: PersonaArchetype): String = try {
        val response = api.chatCompletion(
            auth = "Bearer ${BuildConfig.OPENROUTER_API_KEY}",
            request = ChatRequest(
                model = GameConfig.TEXT_MODEL,
                messages = listOf(ChatMessage("user", promptBuilder.buildDeveloperNamePrompt(archetype.name))),
                maxTokens = GameConfig.MAX_TOKENS_NAME_GEN
            )
        )
        response.choices.first().message.content.trim()
            .replace(Regex("\\*\\*(.+?)\\*\\*"), "$1")
            .replace(Regex("\\*(.+?)\\*"), "$1")
            .replace(Regex("`(.+?)`"), "$1")
            .replace("\"", "").replace("'", "").trim()
            .take(40)
    } catch (e: Exception) {
        "Аноним"
    }

    private fun selectFate(weights: Map<String, Int>): ProjectFate {
        val total = weights.values.sum()
        var random = Random.nextInt(total)
        for ((key, weight) in weights) {
            random -= weight
            if (random < 0) return ProjectFate.valueOf(key)
        }
        return ProjectFate.SLOW_DRAIN
    }

    private fun calcDaysUntilCollapse(fate: ProjectFate): Int? = when (fate) {
        ProjectFate.INSTANT_SCAM -> Random.nextInt(3, 6)
        ProjectFate.SLOW_DRAIN -> Random.nextInt(7, 22)
        ProjectFate.HONEST_FAIL -> Random.nextInt(14, 30)
        ProjectFate.SURVIVOR, ProjectFate.UNICORN -> null
    }

    private fun calcRealYield(fate: ProjectFate): Double = when (fate) {
        ProjectFate.INSTANT_SCAM -> 0.0
        ProjectFate.SLOW_DRAIN -> Random.nextDouble(0.001, 0.005)
        ProjectFate.HONEST_FAIL -> Random.nextDouble(0.002, 0.008)
        ProjectFate.SURVIVOR -> Random.nextDouble(0.003, 0.015)
        ProjectFate.UNICORN -> Random.nextDouble(0.02, 0.10)
    }
}
