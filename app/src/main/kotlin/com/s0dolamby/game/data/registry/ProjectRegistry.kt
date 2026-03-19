package com.s0dolamby.game.data.registry

import android.content.Context
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.s0dolamby.game.domain.model.ProjectType
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.random.Random

@Singleton
class ProjectRegistry @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gson: Gson
) {
    private val templates: List<ProjectTemplate> by lazy { loadTemplates() }

    fun getRandomTemplate(): ProjectTemplate =
        templates.filter { it.templateId != "onboarding" }.random()

    fun getOnboardingTemplate(): ProjectTemplate =
        templates.firstOrNull { it.type == ProjectType.HONEST_GAMEFI }
            ?: templates.first()

    private fun loadTemplates(): List<ProjectTemplate> {
        val json = context.assets.open("registry/projects.json").bufferedReader().readText()
        return gson.fromJson(json, Array<ProjectTemplate>::class.java).toList()
    }

    data class ProjectTemplate(
        val templateId: String,
        val type: ProjectType,
        val namePatterns: List<String>,
        val descriptionTemplate: String,
        val claimedAPYRange: List<Int>,
        val claimedUserCountRange: List<Int>,
        val roadmapTemplates: List<List<String>>,
        val compatiblePersonas: List<String>,
        val fateWeights: Map<String, Int>
    ) {
        fun buildName(): String {
            val pattern = namePatterns.random()
            val names = listOf(
                // Classic crypto vibes
                "Moon", "Star", "Dragon", "Wolf", "Iron", "Solar", "Frost",
                "Void", "Neon", "Fire", "Sky", "Cyber", "Nova", "Apex",
                // Animals (absurd)
                "Hamster", "Capybara", "Sloth", "Platypus", "Narwhal",
                "Crab", "Penguin", "Raccoon", "Otter", "Alpaca", "Shrimp",
                "Hedgehog", "Axolotl", "Flamingo", "Tapir",
                // Foods & objects
                "Avocado", "Boba", "Banana", "Mango", "Potato", "Pickle",
                "Sushi", "Pancake", "Donut", "Nacho", "Toaster", "Pillow",
                // Crypto meme culture
                "Sigma", "Chad", "Lambo", "Hodl", "Pepe", "Wojak", "Pump",
                "Degen", "Based", "Gigabrain", "Diamond",
                // Geo/aspirational
                "Dubai", "Bali", "Monaco", "Sahara", "Everest", "Amazon",
                // Tech-sounding
                "Quantum", "Pixel", "Vector", "Cipher", "Nexus", "Prism",
                "Matrix", "Helix", "Proton", "Zenith",
                // Nature/elemental
                "Mushroom", "Cactus", "Lotus", "Tornado", "Thunder", "Cobalt",
                "Obsidian", "Crimson", "Velvet", "Aurora"
            )
            return pattern.replace("[Name]", names.random())
        }
    }
}
