package com.s0dolamby.game.domain.events

import com.s0dolamby.game.domain.model.ProjectFate
import com.s0dolamby.game.domain.model.ProjectType
import kotlin.random.Random

/**
 * Каталог случайных событий — прямой порт tg/server/src/game/randomEvents.ts.
 *
 * Применяется в AdvanceDayUseCase на каждое активное дело с шансом 20-35%.
 * Эффект и текст подбираются под type+fate проекта:
 *  - INSTANT_SCAM получает только POSITIVE/NEUTRAL (скрывает природу до последнего);
 *  - fateBias утраивает вес события для указанных судеб;
 *  - шаблоны {name} и {amount} рендерятся в тексте вести.
 */

enum class EventKind { NEGATIVE, POSITIVE, NEUTRAL }

data class RandomEvent(
    val id: String,
    val kind: EventKind,
    /** null = применимо ко всем типам дел. */
    val applicableTo: List<ProjectType>?,
    /** Для каких судеб вес умножается на 3. */
    val fateBias: List<ProjectFate> = emptyList(),
    val weight: Int,
    val title: String,
    val body: String,
    /** Диапазон изменения currentValue в долях (например +0.06..+0.12). null = без эффекта. */
    val effectMin: Double? = null,
    val effectMax: Double? = null
)

object RandomEvents {

    /** Шанс события на дело в день (равномерно из диапазона). */
    const val EVENT_CHANCE_MIN = 0.20
    const val EVENT_CHANCE_MAX = 0.35

    /**
     * Выбор события для дела: шанс 20-35%, фильтр по типу, INSTANT_SCAM
     * не получает NEGATIVE, вес × 3 при совпадении fateBias.
     * Вернёт null, если события сегодня нет.
     */
    fun pick(type: ProjectType, fate: ProjectFate, positiveOnly: Boolean = false): RandomEvent? {
        val chance = EVENT_CHANCE_MIN + Random.nextDouble() * (EVENT_CHANCE_MAX - EVENT_CHANCE_MIN)
        if (Random.nextDouble() > chance) return null
        val hideNegative = positiveOnly || fate == ProjectFate.INSTANT_SCAM
        val candidates = ALL.filter { e ->
            (e.applicableTo == null || type in e.applicableTo) &&
                !(hideNegative && e.kind == EventKind.NEGATIVE)
        }
        if (candidates.isEmpty()) return null
        val weights = candidates.map { e -> e.weight * (if (fate in e.fateBias) 3 else 1) }
        var roll = Random.nextInt(weights.sum())
        for ((i, w) in weights.withIndex()) {
            roll -= w
            if (roll < 0) return candidates[i]
        }
        return candidates.last()
    }

    /** Применяет эффект: возвращает (новая стоимость, дельта). */
    fun applyEffect(event: RandomEvent, currentValue: Double): Pair<Double, Double> {
        val min = event.effectMin ?: return currentValue to 0.0
        val max = event.effectMax ?: return currentValue to 0.0
        val percent = min + Random.nextDouble() * (max - min)
        val delta = currentValue * percent
        val newValue = maxOf(0.0, currentValue + delta)
        return newValue to (newValue - currentValue)
    }

    /** Рендер тела вести: {name} → имя дела, {amount} → |дельта| в грошах. */
    fun renderBody(event: RandomEvent, projectName: String, amountDelta: Double): String =
        event.body
            .replace("{name}", "«$projectName»")
            .replace("{amount}", "%.0f".format(kotlin.math.abs(amountDelta)))

    val ALL: List<RandomEvent> = listOf(
        RandomEvent(
            id = "rich_patron",
            kind = EventKind.POSITIVE,
            applicableTo = null,
            fateBias = listOf(ProjectFate.INSTANT_SCAM, ProjectFate.SLOW_DRAIN, ProjectFate.UNICORN),
            weight = 10,
            title = "Богатый покровитель пришёл к делу",
            body = "К {name} приехал именитый купец из стольного града — закинул свои гроши, дело подросло на {amount} г.",
            effectMin = 0.06,
            effectMax = 0.12
        ),
        RandomEvent(
            id = "word_of_mouth",
            kind = EventKind.POSITIVE,
            applicableTo = null,
            fateBias = listOf(ProjectFate.SURVIVOR, ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM),
            weight = 9,
            title = "Молва пошла по ярмарке",
            body = "О {name} зашептались на торговых рядах — народ потянулся, прибавило {amount} г.",
            effectMin = 0.04,
            effectMax = 0.09
        ),
        RandomEvent(
            id = "elders_blessed",
            kind = EventKind.POSITIVE,
            applicableTo = null,
            fateBias = listOf(ProjectFate.INSTANT_SCAM, ProjectFate.SLOW_DRAIN, ProjectFate.SURVIVOR, ProjectFate.UNICORN),
            weight = 8,
            title = "Старейшины благословили дело",
            body = "Совет старейшин ярмарки одобрил {name} — народ успокоился, прибавило {amount} г.",
            effectMin = 0.03,
            effectMax = 0.07
        ),
        RandomEvent(
            id = "royal_trade_decree",
            kind = EventKind.POSITIVE,
            applicableTo = null,
            fateBias = listOf(ProjectFate.INSTANT_SCAM, ProjectFate.UNICORN),
            weight = 8,
            title = "Государев указ о свободной торговле",
            body = "Новый царский указ снял пошлины с {name} — дело подросло на {amount} г.",
            effectMin = 0.05,
            effectMax = 0.1
        ),
        RandomEvent(
            id = "foreign_investor",
            kind = EventKind.POSITIVE,
            applicableTo = null,
            fateBias = listOf(ProjectFate.INSTANT_SCAM, ProjectFate.UNICORN),
            weight = 8,
            title = "Иноземный купец заинтересовался",
            body = "Из-за моря прослышали о {name} — иноземец вложил свои монеты, прибавило {amount} г.",
            effectMin = 0.08,
            effectMax = 0.14
        ),
        RandomEvent(
            id = "pilgrim_wave",
            kind = EventKind.POSITIVE,
            applicableTo = null,
            fateBias = listOf(ProjectFate.UNICORN, ProjectFate.SURVIVOR),
            weight = 7,
            title = "Богомольцы принесли монеты",
            body = "Волна богомольцев проходила мимо {name} и оставила немало — прибавило {amount} г.",
            effectMin = 0.04,
            effectMax = 0.09
        ),
        RandomEvent(
            id = "fair_festival",
            kind = EventKind.POSITIVE,
            applicableTo = null,
            fateBias = listOf(ProjectFate.INSTANT_SCAM, ProjectFate.UNICORN, ProjectFate.SURVIVOR),
            weight = 7,
            title = "Ярмарочный праздник собрал толпы",
            body = "В честь именин государя устроили гуляния — у {name} небывалый наплыв, +{amount} г.",
            effectMin = 0.05,
            effectMax = 0.11
        ),
        RandomEvent(
            id = "guild_endorsement",
            kind = EventKind.POSITIVE,
            applicableTo = null,
            fateBias = listOf(ProjectFate.SURVIVOR, ProjectFate.UNICORN),
            weight = 6,
            title = "Купеческая гильдия рекомендовала дело",
            body = "Уважаемые купцы внесли {name} в список надёжных дел — поток вкладчиков вырос, +{amount} г.",
            effectMin = 0.04,
            effectMax = 0.08
        ),
        RandomEvent(
            id = "harvest_surplus",
            kind = EventKind.POSITIVE,
            applicableTo = null,
            weight = 6,
            title = "Богатый урожай — у людей завелись деньги",
            body = "Небывалый урожай наполнил кошельки крестьян — часть монет потекла в {name}, +{amount} г.",
            effectMin = 0.03,
            effectMax = 0.07
        ),
        RandomEvent(
            id = "famous_traveler",
            kind = EventKind.POSITIVE,
            applicableTo = null,
            fateBias = listOf(ProjectFate.INSTANT_SCAM, ProjectFate.UNICORN),
            weight = 6,
            title = "Знаменитый путешественник упомянул дело",
            body = "Заморский гость написал в своих записках о {name} — слава разошлась, прибавило {amount} г.",
            effectMin = 0.06,
            effectMax = 0.11
        ),
        RandomEvent(
            id = "weather_blessing",
            kind = EventKind.POSITIVE,
            applicableTo = null,
            weight = 5,
            title = "Благодатная погода — торговля бойкая",
            body = "Тепло и солнце выманили народ на ярмарку — у {name} выручка выросла на {amount} г.",
            effectMin = 0.03,
            effectMax = 0.06
        ),
        RandomEvent(
            id = "voevoda_check",
            kind = EventKind.NEGATIVE,
            applicableTo = null,
            weight = 10,
            title = "Воевода нагрянул с проверкой",
            body = "У {name} проверили учётную книгу — нашли неточности и взяли мзду в {amount} г.",
            effectMin = -0.1,
            effectMax = -0.05
        ),
        RandomEvent(
            id = "tax_introduced",
            kind = EventKind.NEGATIVE,
            applicableTo = null,
            weight = 9,
            title = "Новая подать с купцов",
            body = "Государев приказ ввёл новую подать — у {name} взяли {amount} г в казну.",
            effectMin = -0.08,
            effectMax = -0.04
        ),
        RandomEvent(
            id = "market_slump",
            kind = EventKind.NEGATIVE,
            applicableTo = null,
            weight = 8,
            title = "Ярмарка захирела — народ не идёт",
            body = "Торговля на ярмарке встала: у {name} выручка просела на {amount} г.",
            effectMin = -0.08,
            effectMax = -0.04
        ),
        RandomEvent(
            id = "drought_season",
            kind = EventKind.NEGATIVE,
            applicableTo = null,
            weight = 7,
            title = "Засуха — народ затягивает пояса",
            body = "Неурожай опустошил кошельки покупателей — у {name} прибыль упала на {amount} г.",
            effectMin = -0.07,
            effectMax = -0.04
        ),
        RandomEvent(
            id = "early_frost",
            kind = EventKind.NEGATIVE,
            applicableTo = null,
            weight = 6,
            title = "Ранние морозы побили урожай",
            body = "Холода ударили раньше срока — у {name} пострадали запасы на {amount} г.",
            effectMin = -0.07,
            effectMax = -0.03
        ),
        RandomEvent(
            id = "plague_scare",
            kind = EventKind.NEGATIVE,
            applicableTo = null,
            weight = 6,
            title = "Мор в городе — люди разбегаются",
            body = "Слухи о хвори опустели ярмарку — у {name} убыток {amount} г.",
            effectMin = -0.09,
            effectMax = -0.05
        ),
        RandomEvent(
            id = "bridge_collapse",
            kind = EventKind.NEGATIVE,
            applicableTo = null,
            weight = 5,
            title = "Мост обрушился — дороги закрыты",
            body = "Переправа сломалась — товары и вкладчики не могут добраться до {name}, потеря {amount} г.",
            effectMin = -0.08,
            effectMax = -0.04
        ),
        RandomEvent(
            id = "fire_in_market",
            kind = EventKind.NEGATIVE,
            applicableTo = null,
            weight = 5,
            title = "Пожар на ярмарке",
            body = "Огонь прошёлся по торговым рядам — {name} не уцелело, сгорело на {amount} г.",
            effectMin = -0.12,
            effectMax = -0.06
        ),
        RandomEvent(
            id = "rumor_of_fraud",
            kind = EventKind.NEGATIVE,
            applicableTo = null,
            fateBias = listOf(ProjectFate.SURVIVOR, ProjectFate.UNICORN),
            weight = 5,
            title = "Слухи о мошенничестве на рынке",
            body = "По ярмарке поползли слухи о нечестных купцах — вкладчики {name} занервничали, убыток {amount} г.",
            effectMin = -0.09,
            effectMax = -0.05
        ),
        RandomEvent(
            id = "potion_herbs_bloomed",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.POTION_BREW),
            weight = 10,
            title = "Травы зацвели обильно",
            body = "Знахарь принёс к {name} необычайно богатый сбор — варево пошло споро, прибавило {amount} г.",
            effectMin = 0.06,
            effectMax = 0.12
        ),
        RandomEvent(
            id = "potion_foreign_alchemist",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.POTION_BREW),
            weight = 9,
            title = "Заморский алхимик с заказом",
            body = "В {name} заглянул иноземный гость, заказал большую партию зелий — расчёт {amount} г.",
            effectMin = 0.08,
            effectMax = 0.15
        ),
        RandomEvent(
            id = "potion_plague_demand",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.POTION_BREW),
            fateBias = listOf(ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM),
            weight = 9,
            title = "Хворь в округе — зелья нарасхват",
            body = "В соседних сёлах начался мор — все бегут к {name} за снадобьями, +{amount} г.",
            effectMin = 0.12,
            effectMax = 0.2
        ),
        RandomEvent(
            id = "potion_rare_ingredient",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.POTION_BREW),
            fateBias = listOf(ProjectFate.UNICORN),
            weight = 8,
            title = "Редкий ингредиент с Востока",
            body = "Торговец привёз диковинный корень — варево у {name} стало втрое сильнее, +{amount} г.",
            effectMin = 0.1,
            effectMax = 0.16
        ),
        RandomEvent(
            id = "potion_old_recipe",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.POTION_BREW),
            weight = 7,
            title = "Нашли старинный рецепт в погребе",
            body = "В {name} обнаружили древний свиток — новое зелье раскупили за день, +{amount} г.",
            effectMin = 0.07,
            effectMax = 0.13
        ),
        RandomEvent(
            id = "potion_healer_fame",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.POTION_BREW),
            fateBias = listOf(ProjectFate.SURVIVOR, ProjectFate.UNICORN),
            weight = 7,
            title = "Знахарь прославился на всю округу",
            body = "После удачного исцеления боярина слух о {name} разлетелся — очередь стоит, +{amount} г.",
            effectMin = 0.08,
            effectMax = 0.14
        ),
        RandomEvent(
            id = "potion_explosion",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.POTION_BREW),
            weight = 10,
            title = "Котёл взорвался",
            body = "Подмастерье у {name} нагрел котёл сверх меры — хлопок, потеря товара на {amount} г.",
            effectMin = -0.12,
            effectMax = -0.06
        ),
        RandomEvent(
            id = "potion_black_cat",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.POTION_BREW),
            weight = 7,
            title = "Чёрная кошка склянки опрокинула",
            body = "В {name} забралась лесная кошка, разбила полку с тинктурами — убыток {amount} г.",
            effectMin = -0.06,
            effectMax = -0.03
        ),
        RandomEvent(
            id = "potion_wrong_ingredient",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.POTION_BREW),
            weight = 8,
            title = "Подмастерье перепутал травы",
            body = "Вся партия у {name} пошла насмарку — пришлось выбросить зелья на {amount} г.",
            effectMin = -0.1,
            effectMax = -0.05
        ),
        RandomEvent(
            id = "potion_shortage",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.POTION_BREW),
            weight = 7,
            title = "Засуха выкосила запасы трав",
            body = "Нет сырья — {name} встало на неделю, потеря {amount} г.",
            effectMin = -0.08,
            effectMax = -0.04
        ),
        RandomEvent(
            id = "potion_poisoning",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.POTION_BREW),
            weight = 6,
            title = "Покупатель отравился — слухи поползли",
            body = "Один из клиентов {name} слёг после зелья — молва отпугнула покупателей, убыток {amount} г.",
            effectMin = -0.11,
            effectMax = -0.07
        ),
        RandomEvent(
            id = "potion_rival",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.POTION_BREW),
            weight = 6,
            title = "Конкурент открыл лавку напротив",
            body = "Соседний зелейник переманил половину клиентов {name} — выручка упала на {amount} г.",
            effectMin = -0.08,
            effectMax = -0.04
        ),
        RandomEvent(
            id = "guild_new_master",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.GUILD_SCHEME),
            weight = 9,
            title = "Новый мастер со своим заказом",
            body = "К {name} прибился умелец с большим заказом от воеводы — поднялись на {amount} г.",
            effectMin = 0.07,
            effectMax = 0.12
        ),
        RandomEvent(
            id = "guild_starosta_blessing",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.GUILD_SCHEME),
            fateBias = listOf(ProjectFate.INSTANT_SCAM, ProjectFate.SLOW_DRAIN, ProjectFate.UNICORN),
            weight = 8,
            title = "Городской староста благословил артель",
            body = "Староста публично похвалил {name} — народ повалил вкладываться, прибыло {amount} г.",
            effectMin = 0.05,
            effectMax = 0.1
        ),
        RandomEvent(
            id = "guild_voevoda_order",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.GUILD_SCHEME),
            fateBias = listOf(ProjectFate.UNICORN, ProjectFate.SURVIVOR),
            weight = 9,
            title = "Воевода заказал крепостную стену",
            body = "Воевода нанял {name} строить новую стену — казённый заказ принёс {amount} г.",
            effectMin = 0.1,
            effectMax = 0.16
        ),
        RandomEvent(
            id = "guild_big_contract",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.GUILD_SCHEME),
            fateBias = listOf(ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM),
            weight = 8,
            title = "Большой казённый подряд",
            body = "{name} выиграло торги на строительство — аванс поступил, +{amount} г.",
            effectMin = 0.09,
            effectMax = 0.15
        ),
        RandomEvent(
            id = "guild_fair_prize",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.GUILD_SCHEME),
            fateBias = listOf(ProjectFate.SURVIVOR, ProjectFate.UNICORN),
            weight = 7,
            title = "Взяли приз на ярмарке мастерства",
            body = "{name} увезло главный кубок — заказы посыпались со всей округи, +{amount} г.",
            effectMin = 0.07,
            effectMax = 0.12
        ),
        RandomEvent(
            id = "guild_apprentices",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.GUILD_SCHEME),
            weight = 6,
            title = "Умелые подмастерья ускорили работу",
            body = "Новая смена в {name} взяла темп — сдали заказ раньше срока, премия {amount} г.",
            effectMin = 0.05,
            effectMax = 0.09
        ),
        RandomEvent(
            id = "guild_quarrel",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.GUILD_SCHEME),
            weight = 10,
            title = "Артельная ссора",
            body = "В {name} мастера переругались за долю — кто-то ушёл, недосчитались {amount} г.",
            effectMin = -0.1,
            effectMax = -0.05
        ),
        RandomEvent(
            id = "guild_competitor",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.GUILD_SCHEME),
            weight = 9,
            title = "Конкурент перекупил мастеров",
            body = "Соседняя артель сманила лучших у {name} — заказы встали, потеря {amount} г.",
            effectMin = -0.12,
            effectMax = -0.06
        ),
        RandomEvent(
            id = "guild_strike",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.GUILD_SCHEME),
            weight = 8,
            title = "Мастера потребовали прибавки — встали",
            body = "Работники {name} бросили инструмент до переговоров — простой обошёлся в {amount} г.",
            effectMin = -0.09,
            effectMax = -0.05
        ),
        RandomEvent(
            id = "guild_material_shortage",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.GUILD_SCHEME),
            weight = 7,
            title = "Нет сырья — заказы стоят",
            body = "Поставка леса к {name} задержалась на три седмицы — штраф заказчика {amount} г.",
            effectMin = -0.08,
            effectMax = -0.04
        ),
        RandomEvent(
            id = "guild_defective_batch",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.GUILD_SCHEME),
            weight = 7,
            title = "Бракованная партия — возврат",
            body = "Заказчик вернул кривые брёвна {name} — пришлось переделывать за свой счёт, минус {amount} г.",
            effectMin = -0.1,
            effectMax = -0.06
        ),
        RandomEvent(
            id = "guild_fire",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.GUILD_SCHEME),
            weight = 5,
            title = "Пожар в мастерской",
            body = "Ночью вспыхнул склад {name} — сгорело инструментов и заготовок на {amount} г.",
            effectMin = -0.14,
            effectMax = -0.08
        ),
        RandomEvent(
            id = "trade_caravan",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.HONEST_TRADE),
            weight = 10,
            title = "Караван заморских товаров",
            body = "К {name} пришёл караван с пряностями — продали с большим барышом, +{amount} г.",
            effectMin = 0.08,
            effectMax = 0.14
        ),
        RandomEvent(
            id = "trade_rich_buyer",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.HONEST_TRADE),
            weight = 9,
            title = "Богатый купец взял оптом",
            body = "К {name} приехал именитый барин, выкупил всю партию — расчёт {amount} г.",
            effectMin = 0.1,
            effectMax = 0.16
        ),
        RandomEvent(
            id = "trade_new_route",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.HONEST_TRADE),
            fateBias = listOf(ProjectFate.SURVIVOR, ProjectFate.UNICORN),
            weight = 8,
            title = "Открыли новый торговый путь",
            body = "Разведчики {name} нашли короткую дорогу к богатым сёлам — доход вырос на {amount} г.",
            effectMin = 0.08,
            effectMax = 0.14
        ),
        RandomEvent(
            id = "trade_rare_goods",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.HONEST_TRADE),
            fateBias = listOf(ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM),
            weight = 8,
            title = "Редкий товар с Востока",
            body = "К {name} попал диковинный шёлк — продали втридорога, +{amount} г.",
            effectMin = 0.1,
            effectMax = 0.18
        ),
        RandomEvent(
            id = "trade_seasonal_surge",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.HONEST_TRADE),
            weight = 7,
            title = "Сезонный спрос взлетел",
            body = "Перед зимой народ бросился скупать запасы у {name} — выручка +{amount} г.",
            effectMin = 0.07,
            effectMax = 0.12
        ),
        RandomEvent(
            id = "trade_lucky_deal",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.HONEST_TRADE),
            fateBias = listOf(ProjectFate.INSTANT_SCAM, ProjectFate.UNICORN),
            weight = 7,
            title = "Удачная сделка с иноземцами",
            body = "Заморские купцы заплатили за товар {name} золотом сверх договора — лишние {amount} г.",
            effectMin = 0.08,
            effectMax = 0.14
        ),
        RandomEvent(
            id = "trade_robbers",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.HONEST_TRADE),
            weight = 10,
            title = "Налёт разбойников на обоз",
            body = "Под Можайском обоз {name} ограбили — потеря товара на {amount} г.",
            effectMin = -0.18,
            effectMax = -0.1
        ),
        RandomEvent(
            id = "trade_spoiled",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.HONEST_TRADE),
            weight = 8,
            title = "Партия товара испортилась в пути",
            body = "У {name} в дороге подмочили мешки — часть товара пришлось списать, убыток {amount} г.",
            effectMin = -0.08,
            effectMax = -0.04
        ),
        RandomEvent(
            id = "trade_flood",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.HONEST_TRADE),
            weight = 7,
            title = "Весенний лёд сломал мосты",
            body = "Половодье разрушило переправы — обоз {name} застрял на неделю, убыток {amount} г.",
            effectMin = -0.1,
            effectMax = -0.06
        ),
        RandomEvent(
            id = "trade_tariff",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.HONEST_TRADE),
            weight = 7,
            title = "Новая таможенная пошлина",
            body = "Государев откупщик повысил сборы — {name} заплатило лишних {amount} г на границе.",
            effectMin = -0.09,
            effectMax = -0.05
        ),
        RandomEvent(
            id = "trade_betrayal",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.HONEST_TRADE),
            weight = 6,
            title = "Партнёр обманул с товаром",
            body = "Поставщик {name} подсунул негодный товар — пришлось судиться и терять {amount} г.",
            effectMin = -0.11,
            effectMax = -0.07
        ),
        RandomEvent(
            id = "trade_counterfeit",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.HONEST_TRADE),
            weight = 5,
            title = "Рынок залили дешёвой подделкой",
            body = "Жулики наводнили ярмарку фальшивым товаром под маркой {name} — репутация и выручка упали на {amount} г.",
            effectMin = -0.1,
            effectMax = -0.06
        ),
        RandomEvent(
            id = "cards_big_winner",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.CARD_GAME),
            weight = 10,
            title = "Большой проигрыш заезжего барина",
            body = "У {name} заезжий барин просадил всё за вечер — заведению досталось {amount} г.",
            effectMin = 0.12,
            effectMax = 0.2
        ),
        RandomEvent(
            id = "cards_tournament",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.CARD_GAME),
            fateBias = listOf(ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM),
            weight = 9,
            title = "Приезжий вельможа устроил турнир",
            body = "Знатный гость выбрал {name} для большого турнира — заведение собрало {amount} г.",
            effectMin = 0.14,
            effectMax = 0.22
        ),
        RandomEvent(
            id = "cards_high_rollers",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.CARD_GAME),
            fateBias = listOf(ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM),
            weight = 8,
            title = "Компания богатых купцов засела играть",
            body = "Целая артель купцов провела у {name} три ночи — касса пополнилась на {amount} г.",
            effectMin = 0.1,
            effectMax = 0.18
        ),
        RandomEvent(
            id = "cards_private_party",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.CARD_GAME),
            fateBias = listOf(ProjectFate.SURVIVOR, ProjectFate.UNICORN),
            weight = 8,
            title = "Закрытая вечеринка для воеводы",
            body = "Воевода заказал {name} приватный вечер — оплата вперёд, касса выросла на {amount} г.",
            effectMin = 0.09,
            effectMax = 0.15
        ),
        RandomEvent(
            id = "cards_lucky_streak",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.CARD_GAME),
            weight = 7,
            title = "Ночь везения — все ставки сыграли",
            body = "В {name} выдалась фартовая ночь — банк остался за заведением, +{amount} г.",
            effectMin = 0.08,
            effectMax = 0.14
        ),
        RandomEvent(
            id = "cards_new_game",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.CARD_GAME),
            fateBias = listOf(ProjectFate.INSTANT_SCAM, ProjectFate.UNICORN),
            weight = 6,
            title = "Новая игра собрала толпу",
            body = "{name} придумало новую забаву — любопытные несут монеты, касса +{amount} г.",
            effectMin = 0.07,
            effectMax = 0.12
        ),
        RandomEvent(
            id = "cards_shulers",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.CARD_GAME),
            weight = 10,
            title = "Шулера накрыли — выручку забрали",
            body = "У {name} стража поймала шулеров за столом, всю выручку конфисковали — минус {amount} г.",
            effectMin = -0.14,
            effectMax = -0.07
        ),
        RandomEvent(
            id = "cards_voevoda_threat",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.CARD_GAME),
            weight = 8,
            title = "Воевода грозился прикрыть заведение",
            body = "У {name} были разговоры о закрытии — отдали мзду {amount} г, кое-как замяли.",
            effectMin = -0.1,
            effectMax = -0.05
        ),
        RandomEvent(
            id = "cards_raid",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.CARD_GAME),
            weight = 8,
            title = "Стражники устроили облаву",
            body = "Ночная облава разогнала игроков {name} — заведение простояло пустым, убыток {amount} г.",
            effectMin = -0.12,
            effectMax = -0.07
        ),
        RandomEvent(
            id = "cards_scandal",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.CARD_GAME),
            weight = 7,
            title = "Скандал с подозрением в мошенничестве",
            body = "Проигравший боярин обвинил {name} в нечестной игре — молва разошлась, минус {amount} г.",
            effectMin = -0.1,
            effectMax = -0.06
        ),
        RandomEvent(
            id = "cards_robbery",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.CARD_GAME),
            weight = 6,
            title = "Ночью ограбили кассу",
            body = "Лихие люди влезли в {name} и унесли дневную выручку — минус {amount} г.",
            effectMin = -0.13,
            effectMax = -0.08
        ),
        RandomEvent(
            id = "cards_bad_reputation",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.CARD_GAME),
            weight = 5,
            title = "Дурная слава отпугнула игроков",
            body = "По городу пошёл слух что в {name} нечисто — постоянные клиенты перестали ходить, убыток {amount} г.",
            effectMin = -0.09,
            effectMax = -0.05
        ),
        RandomEvent(
            id = "treasure_old_hoard",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.TREASURE_HUNT),
            weight = 10,
            title = "Нашли старый клад под корнями",
            body = "У {name} под старым дубом откопали клад с серебром — +{amount} г в казну.",
            effectMin = 0.14,
            effectMax = 0.22
        ),
        RandomEvent(
            id = "treasure_old_map",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.TREASURE_HUNT),
            weight = 9,
            title = "Старая карта раскрыла новое место",
            body = "У {name} нашлась карта с пометкой — пошли разведать, добыли на {amount} г.",
            effectMin = 0.08,
            effectMax = 0.15
        ),
        RandomEvent(
            id = "treasure_coin_river",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.TREASURE_HUNT),
            fateBias = listOf(ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM),
            weight = 9,
            title = "Русло реки открыло монеты",
            body = "Весенний паводок вымыл на берег старинные монеты — {name} собрало на {amount} г.",
            effectMin = 0.12,
            effectMax = 0.2
        ),
        RandomEvent(
            id = "treasure_ancient_artifact",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.TREASURE_HUNT),
            fateBias = listOf(ProjectFate.UNICORN),
            weight = 8,
            title = "Нашли древний артефакт",
            body = "Артель {name} откопала старинный идол — коллекционер заплатил {amount} г не торгуясь.",
            effectMin = 0.15,
            effectMax = 0.25
        ),
        RandomEvent(
            id = "treasure_hermit_tip",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.TREASURE_HUNT),
            fateBias = listOf(ProjectFate.SURVIVOR, ProjectFate.UNICORN),
            weight = 7,
            title = "Отшельник указал заветное место",
            body = "Лесной старец за краюху хлеба показал {name} схрон — добыли на {amount} г.",
            effectMin = 0.1,
            effectMax = 0.17
        ),
        RandomEvent(
            id = "treasure_seasonal_reveal",
            kind = EventKind.POSITIVE,
            applicableTo = listOf(ProjectType.TREASURE_HUNT),
            weight = 6,
            title = "Оттепель обнажила схрон",
            body = "Таявший снег открыл в земле старый сундук — {name} не упустило случай, +{amount} г.",
            effectMin = 0.09,
            effectMax = 0.15
        ),
        RandomEvent(
            id = "treasure_lost",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.TREASURE_HUNT),
            weight = 10,
            title = "Заблудились в дремучей чаще",
            body = "Артель {name} неделю плутала в лесу — припасы съели, расходы {amount} г.",
            effectMin = -0.1,
            effectMax = -0.05
        ),
        RandomEvent(
            id = "treasure_beasts",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.TREASURE_HUNT),
            weight = 8,
            title = "Дикие звери разогнали артель",
            body = "Медведь забрёл в лагерь {name} — народ разбежался, бросив снаряжение на {amount} г.",
            effectMin = -0.1,
            effectMax = -0.05
        ),
        RandomEvent(
            id = "treasure_rival_gang",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.TREASURE_HUNT),
            weight = 8,
            title = "Конкуренты опередили артель",
            body = "Другая ватага добралась до места раньше {name} — место выработано, потери {amount} г.",
            effectMin = -0.1,
            effectMax = -0.06
        ),
        RandomEvent(
            id = "treasure_cave_collapse",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.TREASURE_HUNT),
            weight = 6,
            title = "Обрушение в пещере",
            body = "Своды рухнули пока {name} копало — потеряли снаряжение и часть добычи на {amount} г.",
            effectMin = -0.12,
            effectMax = -0.07
        ),
        RandomEvent(
            id = "treasure_false_lead",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.TREASURE_HUNT),
            weight = 6,
            title = "Ложный след обошёлся дорого",
            body = "{name} потратило две недели на пустое место — припасы и жалованье вышли в {amount} г.",
            effectMin = -0.09,
            effectMax = -0.05
        ),
        RandomEvent(
            id = "treasure_storm",
            kind = EventKind.NEGATIVE,
            applicableTo = listOf(ProjectType.TREASURE_HUNT),
            weight = 5,
            title = "Буря уничтожила лагерь",
            body = "Ночная гроза снесла палатки {name} и смыла часть добычи — убыток {amount} г.",
            effectMin = -0.11,
            effectMax = -0.06
        ),
    )
}