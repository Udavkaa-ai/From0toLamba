package com.s0dolamby.game.domain.config

import com.s0dolamby.game.domain.model.PersonaArchetype

data class MinigameDescriptor(
    val title: String,
    val goal: String,
    val secondsTotal: Int,
    val secondsReference: Int? = null
)

object MinigameInfo {
    private val descriptors: Map<PersonaArchetype, MinigameDescriptor> = mapOf(
        PersonaArchetype.BOYARIN to MinigameDescriptor(
            title = "Купеческая грамота",
            goal = "Найти 8 печатей-подделок среди 24",
            secondsTotal = 15
        ),
        PersonaArchetype.BURATINO to MinigameDescriptor(
            title = "Золотой ключик",
            goal = "Запомнить эталонный ключ, выбрать его в подмене",
            secondsTotal = 10,
            secondsReference = 10
        ),
        PersonaArchetype.KOSCHEI to MinigameDescriptor(
            title = "Память Кощея",
            goal = "Повторить последовательность вспышек",
            secondsTotal = 20
        ),
        PersonaArchetype.KOLOBOK to MinigameDescriptor(
            title = "Нора-нора-нора",
            goal = "Не дать Колобку улизнуть из нужной норы",
            secondsTotal = 10
        ),
        PersonaArchetype.ZOLUSHKA to MinigameDescriptor(
            title = "Падающие монеты",
            goal = "Поймать только настоящие монеты",
            secondsTotal = 15,
            secondsReference = 5
        ),
        PersonaArchetype.BABA_YAGA to MinigameDescriptor(
            title = "Котёл Бабы-яги",
            goal = "Повторить рецепт по памяти",
            secondsTotal = 15,
            secondsReference = 6
        ),
        PersonaArchetype.IVAN_DURAK to MinigameDescriptor(
            title = "Повторить карту",
            goal = "Запомнить расклад и собрать заново",
            secondsTotal = 15
        )
    )

    operator fun get(archetype: PersonaArchetype): MinigameDescriptor = descriptors.getValue(archetype)
}
