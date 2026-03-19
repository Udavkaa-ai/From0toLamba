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
            val names = listOf(
                // Сказочные персонажи (русские народные)
                "Колобок", "Василиса", "Аленушка", "Финист", "Добрыня", "Иванушка",
                "Марья", "Снегурка", "Алёнка", "Богатырь", "Дюймовочка", "Русалка",
                // Волшебные существа
                "Жар", "Дракон", "Феникс", "Домовой", "Леший", "Жарптица",
                "Кикимора", "Водяной", "Светлячок", "Единорог",
                // Сказочные предметы
                "Ковёр", "Горшочек", "Клубок", "Ключик", "Зеркало",
                "Перо", "Яблоко", "Хрусталь", "Жемчуг", "Злато",
                // Сказочные места и миры
                "Тридевятый", "Лукоморье", "Берендей", "Беловодье", "Буян",
                // Братья Гримм / мировые сказки
                "Рапунцель", "Гензель", "Бременский", "Дюймо", "Румпель",
                // Советские сказочные персонажи
                "Буратино", "Карлсон", "Чебурашка", "Незнайка", "Мурзилка",
                // Природные / волшебные образы
                "Заря", "Звезда", "Луна", "Вьюга", "Гроза", "Радуга",
                "Гром", "Туман", "Роса", "Иней"
            )
            return pattern.replace("[Name]", names.random())
        }
    }
}
