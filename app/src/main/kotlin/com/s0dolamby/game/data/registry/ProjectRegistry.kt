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
        val descriptionTemplates: List<String>,
        val claimedAPYRange: List<Int>,
        val claimedUserCountRange: List<Int>,
        val roadmapTemplates: List<List<String>>,
        val compatiblePersonas: List<String>,
        val fateWeights: Map<String, Int>
    ) {
        fun buildName(): String {
            val pattern = namePatterns.random()
            val name = fairyTaleNames.random()
            return pattern
                .replace("[Name]", name.nom)
                .replace("[NameGen]", name.gen)
        }
    }

    private data class FairyTaleName(val nom: String, val gen: String)

    private val fairyTaleNames = listOf(
        // Русские народные персонажи
        FairyTaleName("Колобок", "Колобка"),
        FairyTaleName("Василиса", "Василисы"),
        FairyTaleName("Аленушка", "Аленушки"),
        FairyTaleName("Финист", "Финиста"),
        FairyTaleName("Добрыня", "Добрыни"),
        FairyTaleName("Иванушка", "Иванушки"),
        FairyTaleName("Марья", "Марьи"),
        FairyTaleName("Снегурка", "Снегурки"),
        FairyTaleName("Богатырь", "Богатыря"),
        FairyTaleName("Дюймовочка", "Дюймовочки"),
        FairyTaleName("Русалка", "Русалки"),
        // Волшебные существа
        FairyTaleName("Жар-Птица", "Жар-Птицы"),
        FairyTaleName("Дракон", "Дракона"),
        FairyTaleName("Феникс", "Феникса"),
        FairyTaleName("Домовой", "Домового"),
        FairyTaleName("Леший", "Лешего"),
        FairyTaleName("Кикимора", "Кикиморы"),
        FairyTaleName("Водяной", "Водяного"),
        FairyTaleName("Светлячок", "Светлячка"),
        FairyTaleName("Единорог", "Единорога"),
        // Волшебные предметы
        FairyTaleName("Горшочек", "Горшочка"),
        FairyTaleName("Ключик", "Ключика"),
        FairyTaleName("Зеркало", "Зеркала"),
        FairyTaleName("Перо", "Пера"),
        FairyTaleName("Яблоко", "Яблока"),
        FairyTaleName("Злато", "Злата"),
        FairyTaleName("Клубок", "Клубка"),
        FairyTaleName("Жемчуг", "Жемчуга"),
        // Сказочные места
        FairyTaleName("Лукоморье", "Лукоморья"),
        FairyTaleName("Берендей", "Берендея"),
        FairyTaleName("Беловодье", "Беловодья"),
        FairyTaleName("Буян", "Буяна"),
        // Советские сказочные персонажи
        FairyTaleName("Буратино", "Буратино"),
        FairyTaleName("Карлсон", "Карлсона"),
        FairyTaleName("Чебурашка", "Чебурашки"),
        FairyTaleName("Незнайка", "Незнайки"),
        // Природные образы
        FairyTaleName("Заря", "Зари"),
        FairyTaleName("Гром", "Грома"),
        FairyTaleName("Роса", "Росы"),
        FairyTaleName("Иней", "Инея"),
        FairyTaleName("Вьюга", "Вьюги"),
        FairyTaleName("Снежок", "Снежка"),
    )
}
