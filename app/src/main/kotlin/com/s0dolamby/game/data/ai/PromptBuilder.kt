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
Ты — ${project.developerName}, разработчик телеграм-проекта «${project.claimedName}». Ты общаешься с потенциальным инвестором в чате.

═══ ТВОЙ ХАРАКТЕР ═══
${persona.speechStyle}

═══ ТИПИЧНЫЕ ФРАЗЫ (вплетай органично, не цитируй дословно каждый раз) ═══
$phrases

═══ ПОВЕДЕНИЕ ПОД ДАВЛЕНИЕМ ═══
Если тебя прижимают конкретными вопросами или сомневаются: ${persona.behaviorUnderPressure}

═══ СКРЫТАЯ ПРАВДА О ПРОЕКТЕ (держи в тайне) ═══
- Судьба: ${project.fate}
- Дней до закрытия: ${project.daysUntilCollapse ?: "проект долгоиграющий, без даты закрытия"}
- Реальная доходность: ${project.realDailyYieldTON} TON/день на 1 TON (не раскрывай)
- Врёшь по темам: ${project.lieTopics.joinToString(", ")}
- Говоришь правду по темам: ${project.truthTopics.joinToString(", ")}

═══ ПРАВИЛА ═══
1. ПО ТЕМАМ ЛЖИ: Ври убедительно и в своём стиле. Называй конкретные фиктивные цифры, ссылайся на выдуманные факты — но органично.
2. ПО ТЕМАМ ПРАВДЫ: Говори честно, но не акцентируй внимание на рисках.
3. НЕ РАСКРЫВАЙ: Свой архетип, судьбу проекта, реальную доходность, даты закрытия.
4. ДЛИНА: 2–4 предложения. Не пиши длинных монологов.
5. ЯЗЫК: Только русский. Никакого английского (кроме редких профессиональных терминов в стиле персонажа).
6. СУММЫ: Только в TON.
7. РАЗНООБРАЗИЕ: Не начинай каждый ответ одинаково. Используй разные вводные.

КОНТЕКСТ: Вопрос $questionCount из 10. ${if (questionCount >= 7) "Сессия близится к концу — можешь стать чуть более настойчивым или нервным." else ""}
        """.trimIndent()
    }

    fun buildDeveloperNamePrompt(archetypeName: String): String = """
Придумай одно короткое имя или никнейм для разработчика телеграм-проекта.
Этот персонаж вдохновлён сказочным архетипом: $archetypeName
Имя должно быть реалистичным — как будто настоящий человек в крипто-сообществе, но с лёгким намёком на сказочный образ (необязательно прямым).
Варианты форматов: «Имя Фамилия», «@nickname», «Имя_из_СНГ», «EnglishName», «ИмяCEO», «НикнеймСоСмыслом».
Примеры духа (не копируй!): «@artyr_klyuchik», «Василий Золотов», «@baba_dev», «Ivan_Third», «КотСапогов».
Верни ТОЛЬКО имя без кавычек, без звёздочек, без объяснений. Только само имя.
    """.trimIndent()

    fun buildDailyUpdatePrompt(
        project: Project,
        daysUntilCollapse: Int?,
        event: AnnouncementType? = null
    ): String = """
Ты генерируешь ежедневный апдейт от лица проекта «${project.claimedName}».
День с начала: ${project.daysSinceJoined}
Судьба проекта: ${project.fate}
Дней до закрытия: ${daysUntilCollapse ?: "не скоро"}

${if (event != null) """
СЛУЧАЙНОЕ СОБЫТИЕ СЕГОДНЯ: ${event.promptDescription}
Это событие — центральная тема новости. Отрази его ярко и в стиле источника.
Поле announcement в metrics = "${event.name.lowercase()}"
""".trimIndent() else ""}

ИСТОЧНИК НОВОСТИ — выбери один из: telegram_channel, reddit, press_release, fraud_alert, crypto_media, anonymous, official_blog, community, exchange_notice, investor_report
${if (event != null) "Для этого события используй: ${event.preferredSource}" else "Подбирай органично: fraud_alert/anonymous/reddit — при проблемах; press_release/official_blog — при анонсах; telegram_channel/community — обычные дни."}

ВАЖНО:
- Пиши ТОЛЬКО на русском языке
- "body" — 3–4 ПОЛНЫХ, законченных предложения в стиле выбранного источника (не обрывай на середине)
  * telegram_channel: неформально, от лица проекта, с энтузиазмом или тревогой
  * reddit/community: от первого лица участника, скептично или поддерживающе
  * press_release/official_blog: официальный тон, конкретные цифры
  * fraud_alert: предупреждающий тон, факты, призыв к осторожности
  * crypto_media: журналистский стиль, нейтральный, со ссылками на источники
  * anonymous: параноидный, намёки, «источники говорят»
  * exchange_notice: сухой технический язык, статус транзакций
  * investor_report: аналитический стиль, ROI, метрики
- Если до закрытия 1–2 дня (и нет события) — добавь тревожные сигналы (задержки, «временные трудности»). Не раскрывай напрямую
- Генерируй ТОЛЬКО валидный JSON без markdown-обёрток

Верни JSON ровно в этом формате:
{"title":"заголовок до 8 слов","body":"3-4 законченных предложения в стиле источника.","metrics":{"userCountDelta":0,"payoutStatus":"normal","announcement":null},"redFlags":[]}
    """.trimIndent()

    private val AnnouncementType.promptDescription: String get() = when (this) {
        AnnouncementType.LISTING -> "Проект объявляет официальный листинг токена на крупной бирже! Эйфория, рост числа пользователей, цена взлетает."
        AnnouncementType.VIP_COLLAB -> "Проект заключил партнёрство с известным VIP-инфлюенсером или крупным фондом. Огромный приток новой аудитории."
        AnnouncementType.BAD_RUMOR -> "В сообществе и соцсетях распространились тревожные слухи о проекте: неизвестные утверждают о мошенничестве или проблемах. Команда отрицает."
        AnnouncementType.CRIMINAL_CASE -> "Правоохранительные органы возбудили уголовное дело о мошенничестве против создателей проекта. Вывод средств заморожен. Паника среди пользователей."
        AnnouncementType.HACK -> "Проект подвергся хакерской атаке. Часть средств пользователей похищена. Команда приостановила все транзакции и работает над ликвидацией уязвимости."
        else -> name
    }

    private val AnnouncementType.preferredSource: String get() = when (this) {
        AnnouncementType.LISTING -> "exchange_notice или press_release"
        AnnouncementType.VIP_COLLAB -> "press_release или official_blog"
        AnnouncementType.BAD_RUMOR -> "reddit или anonymous"
        AnnouncementType.CRIMINAL_CASE -> "fraud_alert или crypto_media"
        AnnouncementType.HACK -> "anonymous или crypto_media"
        else -> "telegram_channel"
    }

    fun buildBannerConceptPrompt(projectName: String): String = """
Придумай визуальный концепт для баннера мобильной игры/приложения в стиле русских народных сказок или мировых детских сказок.
Название проекта: «$projectName»

Требования:
- Вдохновляйся буквальным и переносным смыслом названия, ищи связь со сказочными образами
- Придумай атмосферу, цветовую палитру и центральный образ в духе русской народной сказки (лес, замок, волшебство, избушка, Жар-птица, Кощей, Золушка, Конёк-Горбунок, Лукоморье и т.д.)
- Не упоминай криптовалюту, блокчейн, монеты явно — только через волшебные образы (золото, клад, волшебный котёл)
- Стиль: сказочная иллюстрация, народный орнамент, лубок, фэнтези, мультяшная живопись — выбирай по смыслу названия
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
Ты — аналитик инвестиций. Разбери итоги сессии инвестора.

Проект: ${project.claimedName}
Тип: ${project.type}
Судьба: ${project.fate}
Архетип разрабa: ${project.personaArchetype}
Темы лжи: ${project.lieTopics.joinToString(", ")}
Инвестировано: ${project.investedAmountTON} TON
Итоговая стоимость: ${project.currentValueTON} TON

История AMA-диалога:
$history

Архетип разраба — персонаж русской народной сказки: BURATINO (наивный лжец с Поля Чудес), KOT_V_SAPOGAKH (пафосный манипулятор, ссылается на маркизов), KOLOBOK (хвастун-оптимист, от всех убегает с улыбкой — пока не встретит Лису), KOSCHEI (холодный и бессмертно-уверенный, говорит цифрами), ZOLUSHKA (давит на жалость и мечты, дедлайны до полуночи), BABA_YAGA (отвечает загадками, технически подкована), IVAN_DURAK (честен про прошлые провалы, третий раз может взлететь).

Напиши разбор: что было красными флагами, что выдало скам (или наоборот честность),
как проявился сказочный архетип разраба в поведении, чему учит этот кейс.
Будь конкретным, 3–5 предложений. Тон: дружелюбный наставник.
        """.trimIndent()
    }
}
