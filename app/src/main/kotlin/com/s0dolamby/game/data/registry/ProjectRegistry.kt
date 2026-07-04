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

    fun getRandomTemplate(rng: Random = Random.Default): ProjectTemplate =
        templates.filter { it.templateId != "onboarding" }.random(rng)

    fun getOnboardingTemplate(): ProjectTemplate =
        templates.firstOrNull { it.type == ProjectType.HONEST_TRADE }
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
        fun buildName(rng: Random = Random.Default): String {
            val pattern = namePatterns.random(rng)
            val name = fairyTaleNames.random(rng)
            return pattern
                .replace("[Name]", name.nom)
                .replace("[NameGen]", name.gen)
        }
    }
}

private data class FairyTaleName(val nom: String, val gen: String)

private val fairyTaleNames = listOf(
        // ── Русские народные персонажи ─────────────────────────────────
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
        FairyTaleName("Емеля", "Емели"),
        FairyTaleName("Илья", "Ильи"),
        FairyTaleName("Алёша", "Алёши"),
        FairyTaleName("Никитич", "Никитича"),
        FairyTaleName("Микула", "Микулы"),
        FairyTaleName("Святогор", "Святогора"),
        FairyTaleName("Снегурочка", "Снегурочки"),
        FairyTaleName("Купава", "Купавы"),
        FairyTaleName("Морозко", "Морозко"),
        FairyTaleName("Хаврошечка", "Хаврошечки"),
        FairyTaleName("Терёшечка", "Терёшечки"),
        FairyTaleName("Крошечка-Хаврошечка", "Крошечки"),
        FairyTaleName("Морозушка", "Морозушки"),
        FairyTaleName("Прекрасная", "Прекрасной"),
        FairyTaleName("Премудрая", "Премудрой"),

        // ── Волшебные существа ─────────────────────────────────────────
        FairyTaleName("Жар-Птица", "Жар-Птицы"),
        FairyTaleName("Дракон", "Дракона"),
        FairyTaleName("Феникс", "Феникса"),
        FairyTaleName("Домовой", "Домового"),
        FairyTaleName("Леший", "Лешего"),
        FairyTaleName("Кикимора", "Кикиморы"),
        FairyTaleName("Водяной", "Водяного"),
        FairyTaleName("Светлячок", "Светлячка"),
        FairyTaleName("Единорог", "Единорога"),
        FairyTaleName("Грифон", "Грифона"),
        FairyTaleName("Сирин", "Сирина"),
        FairyTaleName("Алконост", "Алконоста"),
        FairyTaleName("Гамаюн", "Гамаюна"),
        FairyTaleName("Полевик", "Полевика"),
        FairyTaleName("Банник", "Банника"),
        FairyTaleName("Овинник", "Овинника"),
        FairyTaleName("Дворовой", "Дворового"),
        FairyTaleName("Кот-Баюн", "Кота-Баюна"),
        FairyTaleName("Соловей", "Соловья"),
        FairyTaleName("Сирена", "Сирены"),
        FairyTaleName("Лебедь", "Лебедя"),
        FairyTaleName("Сокол", "Сокола"),

        // ── Волшебные предметы ─────────────────────────────────────────
        FairyTaleName("Горшочек", "Горшочка"),
        FairyTaleName("Ключик", "Ключика"),
        FairyTaleName("Зеркало", "Зеркала"),
        FairyTaleName("Перо", "Пера"),
        FairyTaleName("Яблоко", "Яблока"),
        FairyTaleName("Злато", "Злата"),
        FairyTaleName("Клубок", "Клубка"),
        FairyTaleName("Жемчуг", "Жемчуга"),
        FairyTaleName("Самоцвет", "Самоцвета"),
        FairyTaleName("Скатёрка", "Скатёрки"),
        FairyTaleName("Сапоги", "Сапог"),
        FairyTaleName("Шапка", "Шапки"),
        FairyTaleName("Меч", "Меча"),
        FairyTaleName("Гусли", "Гусель"),
        FairyTaleName("Подкова", "Подковы"),
        FairyTaleName("Самовар", "Самовара"),
        FairyTaleName("Сундук", "Сундука"),
        FairyTaleName("Веретено", "Веретена"),
        FairyTaleName("Лопата", "Лопаты"),
        FairyTaleName("Мешочек", "Мешочка"),
        FairyTaleName("Сапфир", "Сапфира"),
        FairyTaleName("Изумруд", "Изумруда"),
        FairyTaleName("Рубин", "Рубина"),

        // ── Сказочные места ────────────────────────────────────────────
        FairyTaleName("Лукоморье", "Лукоморья"),
        FairyTaleName("Берендей", "Берендея"),
        FairyTaleName("Беловодье", "Беловодья"),
        FairyTaleName("Буян", "Буяна"),
        FairyTaleName("Тридевятый", "Тридевятого"),
        FairyTaleName("Китеж", "Китежа"),
        FairyTaleName("Лесогорье", "Лесогорья"),
        FairyTaleName("Заречье", "Заречья"),
        FairyTaleName("Заозерье", "Заозерья"),
        FairyTaleName("Подгорье", "Подгорья"),
        FairyTaleName("Дальневидье", "Дальневидья"),
        FairyTaleName("Светлогорье", "Светлогорья"),
        FairyTaleName("Чернолесье", "Чернолесья"),
        FairyTaleName("Дубрава", "Дубравы"),
        FairyTaleName("Велесполь", "Велесполя"),

        // ── Советские сказочные персонажи ──────────────────────────────
        FairyTaleName("Буратино", "Буратино"),
        FairyTaleName("Конёк", "Конька"),
        FairyTaleName("Чебурашка", "Чебурашки"),
        FairyTaleName("Незнайка", "Незнайки"),
        FairyTaleName("Карлсон", "Карлсона"),
        FairyTaleName("Винни-Пух", "Винни-Пуха"),
        FairyTaleName("Чиполлино", "Чиполлино"),
        FairyTaleName("Мальвина", "Мальвины"),
        FairyTaleName("Артемон", "Артемона"),

        // ── Природные образы ───────────────────────────────────────────
        FairyTaleName("Заря", "Зари"),
        FairyTaleName("Гром", "Грома"),
        FairyTaleName("Роса", "Росы"),
        FairyTaleName("Иней", "Инея"),
        FairyTaleName("Вьюга", "Вьюги"),
        FairyTaleName("Снежок", "Снежка"),
        FairyTaleName("Стужа", "Стужи"),
        FairyTaleName("Ясность", "Ясности"),
        FairyTaleName("Закат", "Заката"),
        FairyTaleName("Рассвет", "Рассвета"),
        FairyTaleName("Месяц", "Месяца"),
        FairyTaleName("Полнолуние", "Полнолуния"),
        FairyTaleName("Северное-Сияние", "Северного-Сияния"),
        FairyTaleName("Перун", "Перуна"),
        FairyTaleName("Стрибог", "Стрибога"),
        FairyTaleName("Сварог", "Сварога"),
        FairyTaleName("Велес", "Велеса"),
        FairyTaleName("Дажьбог", "Дажьбога"),
        FairyTaleName("Лада", "Лады"),
        FairyTaleName("Мокошь", "Мокоши"),

        // ── Травы, ягоды, зелья (для POTION_BREW особенно) ─────────────
        FairyTaleName("Зверобой", "Зверобоя"),
        FairyTaleName("Чертополох", "Чертополоха"),
        FairyTaleName("Папоротник", "Папоротника"),
        FairyTaleName("Ландыш", "Ландыша"),
        FairyTaleName("Шиповник", "Шиповника"),
        FairyTaleName("Боярышник", "Боярышника"),
        FairyTaleName("Тысячелистник", "Тысячелистника"),
        FairyTaleName("Чабрец", "Чабреца"),
        FairyTaleName("Душица", "Душицы"),
        FairyTaleName("Полынь", "Полыни"),
        FairyTaleName("Девясил", "Девясила"),
        FairyTaleName("Бессмертник", "Бессмертника"),
    )
