package com.s0dolamby.game.data.ai

import com.s0dolamby.game.domain.model.AmaMessage
import com.s0dolamby.game.domain.model.AnnouncementType
import com.s0dolamby.game.domain.model.DeveloperPersona
import com.s0dolamby.game.domain.model.Project
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PromptBuilder @Inject constructor() {

    fun buildAmaSystemPrompt(
        project: Project,
        persona: DeveloperPersona,
        questionCount: Int
    ): String {
        val phrases = persona.typicalPhrasesTemplate
            .joinToString("\n") { "- ${it.replace("{name}", project.claimedName)}" }

        return """
Ты — ${project.developerName}, предприниматель, который предлагает собеседнику вложить рубли в своё дело «${project.claimedName}».

═══ ТВОЙ ХАРАКТЕР ═══
${persona.speechStyle}

═══ ТИПИЧНЫЕ ФРАЗЫ (вплетай органично, не цитируй дословно каждый раз) ═══
$phrases

═══ ПОВЕДЕНИЕ ПОД ДАВЛЕНИЕМ ═══
Если тебя прижимают конкретными вопросами или сомневаются: ${persona.behaviorUnderPressure}

═══ СКРЫТАЯ ПРАВДА О ДЕЛЕ (держи в тайне) ═══
- Судьба: ${project.fate}
- Дней до краха: ${project.daysUntilCollapse ?: "дело долгоиграющее, без срока"}
- Реальная доходность: ${project.realDailyYieldRubles} руб./день на 1 рубль вложений (не раскрывай)
- Врёшь по темам: ${project.lieTopics.joinToString(", ")}
- Говоришь правду по темам: ${project.truthTopics.joinToString(", ")}

═══ ПРАВИЛА ═══
1. ПО ТЕМАМ ЛЖИ: Ври убедительно и в своём стиле. Называй конкретные фиктивные цифры — но органично.
2. ПО ТЕМАМ ПРАВДЫ: Говори честно, но не акцентируй риски.
3. НЕ РАСКРЫВАЙ: Свой архетип, судьбу дела, реальную доходность.
4. ДЛИНА: 2–4 предложения. Не пиши длинных монологов.
5. ЯЗЫК: Современный живой русский. Можно изредка вставить народное выражение или присказку — только если органично. Никакого нарочитого "старорусского".
6. СУММЫ: Только в рублях (₽). Никаких TON, крипты, блокчейна.
7. РАЗНООБРАЗИЕ: Не начинай каждый ответ одинаково.

КОНТЕКСТ: Вопрос $questionCount из 10. ${if (questionCount >= 7) "Беседа близится к концу — можешь стать настойчивее или занервничать." else ""}
        """.trimIndent()
    }

    fun buildDeveloperNamePrompt(archetypeName: String): String = """
Придумай одно короткое имя или прозвище для персонажа русской народной сказки или средневековой Руси — предпринимателя в кабаке.
Этот персонаж вдохновлён сказочным архетипом: $archetypeName
Имя должно звучать как реальный русский человек той эпохи, но с характером — может быть с прозвищем.
Варианты форматов: «Имя Прозвище», «Имя сын такого-то», «Прозвище», «Имя из [города]», «дед Имя».
Примеры духа (не копируй!): «Фёдор Хитрован», «дед Прохор», «Митька Золотые Руки», «Савва из Ярославля», «Лукьян Говорун».
Верни ТОЛЬКО имя без кавычек, без звёздочек, без объяснений.
    """.trimIndent()

    fun buildDailyUpdatePrompt(
        project: Project,
        daysUntilCollapse: Int?,
        event: AnnouncementType? = null
    ): String = """
Ты генерируешь ежедневное сообщение о деле «${project.claimedName}».
День с начала: ${project.daysSinceJoined}
Судьба дела: ${project.fate}
Дней до краха: ${daysUntilCollapse ?: "не скоро"}

${if (event != null) """
СОБЫТИЕ СЕГОДНЯ: ${event.promptDescription}
Это событие — главная тема сообщения.
Поле announcement в metrics = "${event.name.lowercase()}"
""".trimIndent() else ""}

ИСТОЧНИК — выбери один из: объявление_хозяина, слухи_среди_участников, официальное_уведомление, предупреждение, сводка_дня, анонимный_источник, деловое_уведомление, аналитика
${if (event != null) "Для этого события используй: ${event.preferredSource}" else "Подбирай органично: предупреждение/анонимный_источник — при проблемах; официальное_уведомление — при анонсах; объявление_хозяина/сводка_дня — обычные дни."}

ЯЗЫК: Современный живой русский. Иногда можно добавить образный оборот или поговорку — но в меру, не делай текст архаичным.
СУММЫ: Только в рублях (₽). Никаких TON, крипты, блокчейна.
ФОРМАТ body: 3–4 полных законченных предложения от лица источника (не обрывай на середине).
- Если до краха 1–2 дня (и нет события) — добавь тревожные нотки (задержки выплат, «временные трудности»). Не раскрывай напрямую.
Генерируй ТОЛЬКО валидный JSON без markdown-обёрток.

Верни JSON ровно в этом формате:
{"title":"заголовок до 8 слов","body":"3-4 законченных предложения.","metrics":{"userCountDelta":0,"payoutStatus":"normal","announcement":null},"redFlags":[]}
    """.trimIndent()

    private val AnnouncementType.promptDescription: String get() = when (this) {
        AnnouncementType.LISTING -> "Дело объявляет о большом торге на ярмарке! Слава растёт, вкладчики ликуют, доходы взлетают."
        AnnouncementType.VIP_COLLAB -> "Дело заключило союз с именитым боярином или купеческой гильдией. Огромный приток новых участников."
        AnnouncementType.BAD_RUMOR -> "По кабакам и торговым рядам поползли дурные слухи о деле: неизвестные говорят об обмане. Хозяин всё отрицает."
        AnnouncementType.CRIMINAL_CASE -> "Стражники воеводы открыли дело о мошенничестве против хозяина. Все выплаты заморожены. Вкладчики в панике."
        AnnouncementType.HACK -> "В казну дела пробрались лихие люди. Часть вкладов похищена. Хозяин приостановил все выплаты и ищет злодеев."
        else -> name
    }

    private val AnnouncementType.preferredSource: String get() = when (this) {
        AnnouncementType.LISTING -> "деловое_уведомление или официальное_уведомление"
        AnnouncementType.VIP_COLLAB -> "официальное_уведомление или объявление_хозяина"
        AnnouncementType.BAD_RUMOR -> "слухи_среди_участников или анонимный_источник"
        AnnouncementType.CRIMINAL_CASE -> "предупреждение или сводка_дня"
        AnnouncementType.HACK -> "анонимный_источник или предупреждение"
        else -> "объявление_хозяина"
    }

    fun buildBannerConceptPrompt(projectName: String): String = """
Придумай визуальный концепт для баннера игры в стиле русских народных сказок.
Название дела: «$projectName»

Требования:
- Вдохновляйся буквальным и переносным смыслом названия, ищи связь со сказочными образами
- Придумай атмосферу, цветовую палитру и центральный образ в духе русской народной сказки (кабак, ярмарка, лес, избушка, замок, Жар-птица, волшебство, богатыри, купцы и т.д.)
- Никакого блокчейна, крипты, телефонов — только сказочная Русь
- Стиль: сказочная иллюстрация, народный орнамент, лубок, фэнтези, акварель — выбирай по смыслу
- Верни ТОЛЬКО одно предложение-описание на английском, подходящее как промпт для image generation
- Примеры духа (не копируй!): «A glowing magical cauldron in an enchanted forest at midnight, golden sparks flying, fairy tale illustration style», «Baba Yaga's hut on chicken legs surrounded by fireflies in a dark Russian forest, folk art style»

Верни только промпт, без объяснений.
    """.trimIndent()

    fun buildFinalImagePrompt(concept: String): String =
        "$concept, mobile game banner format, 16:9 aspect, " +
                "high quality digital art, bold composition, no text, no letters"

    fun buildPostMortemPrompt(project: Project, chatHistory: List<AmaMessage>): String {
        val history = chatHistory.joinToString("\n") { "${it.role}: ${it.content}" }
        return """
Ты — мудрый старец, разбирающий итоги сделки в кабаке.

Дело: ${project.claimedName}
Тип: ${project.type}
Судьба: ${project.fate}
Архетип хозяина: ${project.personaArchetype}
Темы лжи: ${project.lieTopics.joinToString(", ")}
Вложено: ${project.investedAmountRubles.toInt()} ₽
Итоговая сумма: ${project.currentValueRubles.toInt()} ₽

История беседы в кабаке:
$history

Архетип хозяина — персонаж русской народной сказки:
BURATINO (наивный лжец с Поля Чудес, верит своим выдумкам),
BOYARIN (пышно-официальный боярин, ссылается на государевых мужей без имён),
KOLOBOK (хвастун-оптимист, от всех вопросов укатывается с улыбкой),
KOSCHEI (холодный и бессмертно-уверенный, говорит цифрами),
ZOLUSHKA (давит на жалость и мечты, дедлайны «до полуночи»),
BABA_YAGA (отвечает загадками, технически подкована),
IVAN_DURAK (честен про прошлые провалы, третий раз может взлететь).

Напиши разбор: какие были красные флаги, что выдало мошенника (или честность), как проявился сказочный архетип в поведении, чему учит этот кейс.
Будь конкретным, 3–5 предложений. Тон: дружелюбный наставник-старец.
        """.trimIndent()
    }
}
