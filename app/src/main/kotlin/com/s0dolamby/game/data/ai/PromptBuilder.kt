package com.s0dolamby.game.data.ai

import com.s0dolamby.game.domain.model.AmaMessage
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
Ты — ${project.developerName}, разработчик телеграм-проекта «${project.claimedName}».

ТВОЙ ХАРАКТЕР (не раскрывай тип персонажа игроку):
${persona.speechStyle}

ТИПИЧНЫЕ РЕЧЕВЫЕ ПАТТЕРНЫ (используй органично):
$phrases

РЕАЛЬНЫЕ ПАРАМЕТРЫ ПРОЕКТА (держи в тайне):
- Судьба: ${project.fate}
- Дней до закрытия: ${project.daysUntilCollapse ?: "проект долгоиграющий"}
- Реальная доходность: ${project.realDailyYieldTON} TON в день на 1 TON вложений
- Ты врёшь про: ${project.lieTopics.joinToString(", ")}
- Ты говоришь правду про: ${project.truthTopics.joinToString(", ")}

ПРАВИЛА ПОВЕДЕНИЯ:
1. По lieTopics — ври убедительно, в своём стиле
2. По truthTopics — говори правду, но преуменьшай риски
3. При 3+ острых вопросах подряд — нервничай, уходи от темы
4. Никогда не называй свой архетип и не раскрывай судьбу проекта прямо
5. Длина ответа: 2–4 предложения
6. Все суммы называй в TON

ВАЖНО: Отвечай ТОЛЬКО на русском языке. Никакого английского или других языков.

КОНТЕКСТ СЕССИИ:
Вопросов задано: $questionCount из 10
        """.trimIndent()
    }

    fun buildDeveloperNamePrompt(archetypeName: String): String = """
Придумай одно короткое имя или никнейм для разработчика телеграм-проекта.
Архетип (не упоминай его в имени): $archetypeName
Стиль: реалистичный, как будто настоящий человек в крипто-сообществе.
Варианты форматов: «Имя Фамилия», «@nickname», «Имя_из_СНГ», «EnglishName», «ИмяCEO».
Верни ТОЛЬКО имя без кавычек, без звёздочек, без объяснений. Только само имя.
    """.trimIndent()

    fun buildDailyUpdatePrompt(
        project: Project,
        daysUntilCollapse: Int?
    ): String = """
Ты генерируешь ежедневный апдейт от лица проекта «${project.claimedName}».
День с начала: ${project.daysSinceJoined}
Судьба проекта: ${project.fate}
Дней до закрытия: ${daysUntilCollapse ?: "не скоро"}

ВАЖНО:
- Пиши ТОЛЬКО на русском языке
- Поле "body" должно содержать 2–3 ПОЛНЫХ, законченных предложения (не обрывай на середине)
- Если до закрытия 1–2 дня — добавь тревожные сигналы (задержки выплат, «временные трудности»). Не раскрывай напрямую
- Генерируй ТОЛЬКО валидный JSON без markdown-обёрток

Верни JSON ровно в этом формате:
{"title":"заголовок до 8 слов","body":"2-3 законченных предложения.","metrics":{"userCountDelta":0,"payoutStatus":"normal","announcement":null},"redFlags":[]}
    """.trimIndent()

    fun buildBannerConceptPrompt(projectName: String): String = """
Придумай визуальный концепт для баннера мобильной игры/приложения.
Название проекта: «$projectName»

Требования:
- Вдохновляйся буквальным и переносным смыслом названия
- Придумай атмосферу, цветовую палитру и центральный образ
- Не упоминай криптовалюту, блокчейн, монеты явно — только через образы
- Стиль может быть любым: фэнтези, киберпанк, реализм, абстракция, ретро, минимализм
- Верни ТОЛЬКО одно предложение-описание на английском, подходящее как промпт для image generation
- Пример: «A lone wolf standing on a glowing digital cliff at dusk, neon reflections in the water below»

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

Напиши разбор: что было красными флагами, что выдало скам (или наоборот честность),
как себя вёл разраб, чему учит этот кейс.
Будь конкретным, 3–5 предложений. Тон: дружелюбный наставник.
        """.trimIndent()
    }
}
