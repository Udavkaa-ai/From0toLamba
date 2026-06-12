package com.s0dolamby.game.domain.model

enum class PersonaArchetype {
    BURATINO,        // Очевидный лжец, верит своим сказкам
    BOYARIN, // Пафосный, ссылается на великих партнёров
    KOLOBOK,         // Хвастун-энтузиаст, от всех убегает с улыбкой
    KOSCHEI,         // Холодный, бессмертно-уверенный, говорит цифрами
    ZOLUSHKA,        // Апеллирует к жалости и эмоциям, дедлайны
    BABA_YAGA,       // Отвечает загадками, технически подкована
    IVAN_DURAK       // Открыт про провалы, третий раз — может взлететь
}

data class DeveloperPersona(
    val id: String,
    val archetype: PersonaArchetype,

    // Generated per project
    val generatedName: String,
    val avatarSeed: String,

    // From JSON template
    val speechStyle: String,
    val behaviorUnderPressure: String,
    val typicalPhrasesTemplate: List<String>,

    // Player progress
    val metAt: Boolean = false,
    val timesCorrectlyIdentified: Int = 0
)
