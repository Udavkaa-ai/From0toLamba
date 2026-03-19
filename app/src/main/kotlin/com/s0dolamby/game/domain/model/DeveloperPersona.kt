package com.s0dolamby.game.domain.model

enum class PersonaArchetype {
    BURATINO,        // Очевидный лжец, верит своим сказкам — аналог CLASSIC_SCAMMER
    KOT_V_SAPOGAKH, // Пафосный, ссылается на великих партнёров — аналог PSEUDO_PRO
    KARLSSON,        // Самовлюблённый энтузиаст, «лучший в мире» — аналог NAIVE_ENTHUSIAST
    KOSCHEI,         // Холодный, бессмертно-уверенный, говорит цифрами — аналог BUSINESS_SHARK
    ZOLUSHKA,        // Апеллирует к жалости и эмоциям, дедлайны — аналог SWEET_INFLUENCER
    BABA_YAGA,       // Отвечает загадками, технически подкован — аналог SILENT_TECHIE
    IVAN_DURAK       // Открыт про провалы, третий раз — может взлететь — аналог SERIAL_FOUNDER
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
