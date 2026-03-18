package com.s0dolamby.game.domain.model

enum class PersonaArchetype {
    CLASSIC_SCAMMER,
    PSEUDO_PRO,
    NAIVE_ENTHUSIAST,
    BUSINESS_SHARK,
    SWEET_INFLUENCER,
    SILENT_TECHIE,
    SERIAL_FOUNDER
}

data class DeveloperPersona(
    val id: String,
    val archetype: PersonaArchetype,

    // Generated per project
    val generatedName: String,
    val avatarSeed: String,

    // From JSON template
    val speechStyle: String,
    val defaultLieTopics: List<LieTopic>,
    val behaviorUnderPressure: String,
    val typicalPhrasesTemplate: List<String>,

    // Player progress
    val metAt: Boolean = false,
    val timesCorrectlyIdentified: Int = 0
)
