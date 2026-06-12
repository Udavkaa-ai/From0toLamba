package com.s0dolamby.game.data.registry

import android.content.Context
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.s0dolamby.game.domain.model.DeveloperPersona
import com.s0dolamby.game.domain.model.PersonaArchetype
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PersonaRegistry @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gson: Gson
) {
    private val personas: List<PersonaTemplate> by lazy { loadPersonas() }

    fun getPersona(archetype: PersonaArchetype): DeveloperPersona {
        val template = personas.first { it.archetype.equals(archetype.name, ignoreCase = true) }
        return template.toDomain()
    }

    fun getCompatibleArchetype(compatibleIds: List<String>): PersonaArchetype {
        val compatibleArchetypes = personas
            .filter { it.id in compatibleIds }
            .mapNotNull { runCatching { PersonaArchetype.valueOf(it.archetype.uppercase()) }.getOrNull() }
        return if (compatibleArchetypes.isEmpty()) PersonaArchetype.values().random()
        else compatibleArchetypes.random()
    }

    private fun loadPersonas(): List<PersonaTemplate> {
        val json = context.assets.open("registry/personas.json").bufferedReader().readText()
        return gson.fromJson(json, Array<PersonaTemplate>::class.java).toList()
    }

    private data class PersonaTemplate(
        val id: String,
        val archetype: String,
        @SerializedName("speechStyle") val speechStyle: String,
        @SerializedName("behaviorUnderPressure") val behaviorUnderPressure: String,
        @SerializedName("typicalPhrasesTemplate") val typicalPhrasesTemplate: List<String>
    ) {
        fun toDomain() = DeveloperPersona(
            id = id,
            archetype = PersonaArchetype.valueOf(archetype.uppercase()),
            generatedName = "Аноним",
            avatarSeed = UUID.randomUUID().toString(),
            speechStyle = speechStyle,
            behaviorUnderPressure = behaviorUnderPressure,
            typicalPhrasesTemplate = typicalPhrasesTemplate
        )
    }
}
