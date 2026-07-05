package com.s0dolamby.game.domain.config

import com.s0dolamby.game.domain.model.PersonaArchetype

data class MinigameDescriptor(
    val title: String,
    val goal: String,
    val secondsTotal: Int,
    val secondsReference: Int? = null,
    /** Пошаговое «как играть» для тренировочного зала. */
    val rules: List<String> = emptyList(),
    /** Короткий совет-подсказка. */
    val tip: String = ""
)

object MinigameInfo {
    private val descriptors: Map<PersonaArchetype, MinigameDescriptor> = mapOf(
        PersonaArchetype.BOYARIN to MinigameDescriptor(
            title = "Купеческая грамота",
            goal = "Найти поддельные печати среди настоящих",
            secondsTotal = 15,
            rules = listOf(
                "Сперва боярин крупно покажет эталонную печать — запомни её узор.",
                "Эталон прячется, а на грамоте остаётся сетка из 24 печатей.",
                "Тапай те печати, что отличаются от эталона: кривой контур, иной цвет, тусклый воск.",
                "Подделок каждый раз разное число — считать «всегда восемь» не выйдет."
            ),
            tip = "Свет падает каждый раз с новой стороны — сверяй сам узор, а не блик."
        ),
        PersonaArchetype.BURATINO to MinigameDescriptor(
            title = "Золотой ключик",
            goal = "Отлить точную копию показанного ключа",
            secondsTotal = 10,
            secondsReference = 10,
            rules = listOf(
                "Буратино покажет золотой ключик — запомни его форму: бородку, стержень, кисть.",
                "Ключ исчезнет, а перед тобой — верстак-конструктор из деталей.",
                "Собери такой же ключ, подбирая каждую деталь по памяти.",
                "Каждая неверная деталь — ошибка. Точная копия — идеал."
            ),
            tip = "Заготовка на верстаке всегда случайная — просто «Отлить» не прокатит, надо вспоминать."
        ),
        PersonaArchetype.KOSCHEI to MinigameDescriptor(
            title = "Память Кощея",
            goal = "Открыть все пары карт по памяти",
            secondsTotal = 20,
            rules = listOf(
                "Перед тобой карты рубашкой вверх. Переворачивай их по две.",
                "Совпали — пара остаётся открытой. Не совпали — закрываются обратно (это не ошибка).",
                "Запоминай, что где лежало, и открывай пары одну за другой.",
                "Ошибки считаются в конце: сколько пар осталось неоткрытыми к концу времени."
            ),
            tip = "Не тычь наугад — потрать пару секунд, чтобы запомнить расклад."
        ),
        PersonaArchetype.KOLOBOK to MinigameDescriptor(
            title = "Нора-нора-нора",
            goal = "Ловить зверей, но не трогать Колобка",
            secondsTotal = 10,
            rules = listOf(
                "Из нор выскакивают звери — заяц, волк, медведь, лиса — и сам Колобок.",
                "Успей тапнуть зверя, пока он не юркнул обратно.",
                "Колобка трогать нельзя! Тап по Колобку — ошибка.",
                "Пропустил зверя — тоже ошибка. Окно на реакцию короткое."
            ),
            tip = "Держи палец наготове, но глянь, кто выскочил, прежде чем бить."
        ),
        PersonaArchetype.ZOLUSHKA to MinigameDescriptor(
            title = "Зёрна Золушки",
            goal = "Повторить порядок зёрен по памяти",
            secondsTotal = 15,
            secondsReference = 5,
            rules = listOf(
                "Золушка подсветит зёрна в определённом порядке — запомни его.",
                "Повтори последовательность, тапая зёрна в том же порядке.",
                "Раунды растут: 3 → 5 → 7 зёрен. Начало то же — запоминай новый хвост.",
                "Неверное зерно — ошибка."
            ),
            tip = "Проговаривай цепочку про себя: пшеница — жёлудь — вишня…"
        ),
        PersonaArchetype.BABA_YAGA to MinigameDescriptor(
            title = "Котёл Бабы-яги",
            goal = "Сварить зелье по показанному рецепту",
            secondsTotal = 15,
            secondsReference = 6,
            rules = listOf(
                "Баба-яга покажет рецепт — порядок ингредиентов. Запомни его.",
                "Бросай ингредиенты в котёл в том же порядке.",
                "Хитрость: полка перемешивается после каждого броска.",
                "Запоминай сами ингредиенты (мухомор, кость, жаба…), а не их места на полке."
            ),
            tip = "Позиции из показа не помогут — держи в голове цепочку предметов."
        ),
        PersonaArchetype.IVAN_DURAK to MinigameDescriptor(
            title = "Повторить карту",
            goal = "Найти в руке карту, что показал Иван",
            secondsTotal = 15,
            rules = listOf(
                "Обычная колода 36 карт (6…Туз, масти ♠♥♦♣).",
                "Иван выкладывает карту в центр — найди такую же у себя в руке.",
                "Выбери верную карту, пока не вышло время раунда.",
                "Не успел или выбрал не ту — ошибка. И так несколько раундов."
            ),
            tip = "Масти привычные — читай номинал и масть, не тормози."
        )
    )

    operator fun get(archetype: PersonaArchetype): MinigameDescriptor = descriptors.getValue(archetype)

    /** Порядок для тренировочного зала — от простого к хитрому. */
    val trainingOrder: List<PersonaArchetype> = listOf(
        PersonaArchetype.KOLOBOK,
        PersonaArchetype.BURATINO,
        PersonaArchetype.ZOLUSHKA,
        PersonaArchetype.BOYARIN,
        PersonaArchetype.IVAN_DURAK,
        PersonaArchetype.KOSCHEI,
        PersonaArchetype.BABA_YAGA
    )
}
