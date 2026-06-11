package com.s0dolamby.game.data.registry

import com.s0dolamby.game.domain.model.AnnouncementType
import com.s0dolamby.game.domain.model.PayoutStatus
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.model.ProjectFate
import com.s0dolamby.game.domain.model.ProjectType
import kotlin.random.Random

/**
 * Локальный банк шаблонов для ежедневных вестей. Заменяет LLM-вызов
 * `GenerateDailyUpdatesUseCase`. Шаблоны подбираются по контексту дела:
 * payout-статус, судьба, тип, опциональное событие.
 *
 * Placeholder'ы:
 * - `{name}`  → имя дельца (developerName)
 * - `{deal}`  → название дела (claimedName)
 * - `{day}`   → день жизни дела (daysSinceJoined)
 * - `{users}` → текущее число вкладчиков
 *
 * Каждый pick возвращает рандомный title+body из своей категории.
 */
object NewsTemplateBank {

    data class Sample(val title: String, val body: String, val redFlags: List<String>)

    fun pick(project: Project, event: AnnouncementType? = null): Sample {
        // Событие всегда побеждает обычный pick — у него своя категория
        if (event != null) {
            return EVENT_TEMPLATES.getValue(event).random().substitute(project)
        }
        val payout = currentPayoutStatus(project)
        val category = pickCategory(payout, project.fate, project.type)
        return CATEGORY_TEMPLATES.getValue(category).random().substitute(project)
    }

    fun pickPayoutStatus(project: Project): PayoutStatus = currentPayoutStatus(project)

    /** Изредка дельцы DELAY-ят или BOOST-ят выплаты в зависимости от судьбы. */
    private fun currentPayoutStatus(project: Project): PayoutStatus {
        val rand = Random.nextDouble()
        return when (project.fate) {
            ProjectFate.INSTANT_SCAM -> if (rand < 0.30) PayoutStatus.DELAYED else PayoutStatus.NORMAL
            ProjectFate.SLOW_DRAIN ->
                when {
                    rand < 0.15 -> PayoutStatus.DELAYED
                    rand < 0.20 -> PayoutStatus.BOOSTED  // ложный сигнал — заманивает
                    else -> PayoutStatus.NORMAL
                }
            ProjectFate.HONEST_FAIL -> if (rand < 0.10) PayoutStatus.DELAYED else PayoutStatus.NORMAL
            ProjectFate.SURVIVOR ->
                when {
                    rand < 0.05 -> PayoutStatus.DELAYED  // редкий сбой
                    rand < 0.20 -> PayoutStatus.BOOSTED  // изредка бонусы
                    else -> PayoutStatus.NORMAL
                }
            ProjectFate.UNICORN ->
                if (rand < 0.30) PayoutStatus.BOOSTED else PayoutStatus.NORMAL
        }
    }

    private enum class Category {
        BOOSTED_GENERIC,
        DELAYED_GENERIC,
        NORMAL_SURVIVOR,
        NORMAL_SLOW_DRAIN,
        NORMAL_INSTANT_SCAM,
        NORMAL_HONEST_FAIL,
        NORMAL_UNICORN,
        NORMAL_CARD_GAME,
        NORMAL_TREASURE_HUNT,
        NORMAL_POTION_BREW,
        NORMAL_GUILD_SCHEME,
        NORMAL_HONEST_TRADE
    }

    private fun pickCategory(payout: PayoutStatus, fate: ProjectFate, type: ProjectType): Category {
        if (payout == PayoutStatus.BOOSTED) return Category.BOOSTED_GENERIC
        if (payout == PayoutStatus.DELAYED) return Category.DELAYED_GENERIC
        // NORMAL — сначала по судьбе (если есть характерный пул), иначе по типу
        return when (fate) {
            ProjectFate.SURVIVOR -> Category.NORMAL_SURVIVOR
            ProjectFate.SLOW_DRAIN -> Category.NORMAL_SLOW_DRAIN
            ProjectFate.INSTANT_SCAM -> Category.NORMAL_INSTANT_SCAM
            ProjectFate.HONEST_FAIL -> Category.NORMAL_HONEST_FAIL
            ProjectFate.UNICORN -> Category.NORMAL_UNICORN
        }.takeIf { Random.nextDouble() < 0.6 }
            ?: when (type) {
                ProjectType.CARD_GAME -> Category.NORMAL_CARD_GAME
                ProjectType.TREASURE_HUNT -> Category.NORMAL_TREASURE_HUNT
                ProjectType.POTION_BREW -> Category.NORMAL_POTION_BREW
                ProjectType.GUILD_SCHEME -> Category.NORMAL_GUILD_SCHEME
                ProjectType.HONEST_TRADE -> Category.NORMAL_HONEST_TRADE
            }
    }

    private data class Template(
        val title: String,
        val body: String,
        val redFlags: List<String> = emptyList()
    ) {
        fun substitute(project: Project): Sample {
            val replace: (String) -> String = { raw ->
                raw.replace("{name}", project.developerName)
                    .replace("{deal}", project.claimedName)
                    .replace("{day}", "${project.daysSinceJoined}")
                    .replace("{users}", formatUsers(project.currentUserCount))
            }
            return Sample(replace(title), replace(body), redFlags.map(replace))
        }
    }

    private fun formatUsers(n: Int): String = when {
        n >= 1_000_000 -> "%.1fМ".format(n / 1_000_000.0)
        n >= 1_000 -> "%.0fК".format(n / 1_000.0)
        else -> "$n"
    }

    // ─── Шаблоны по категориям ───────────────────────────────────────────

    private val CATEGORY_TEMPLATES: Map<Category, List<Template>> = mapOf(
        Category.BOOSTED_GENERIC to listOf(
            Template("Касса полна! {deal} расщедрился",
                "{name} отчитался: «Сегодня выплачиваем вдвое больше обычного. Кому не успели вчера — берите сегодня». В лавке очередь."),
            Template("День удачи у {deal}",
                "У {name} большая выручка — обещает поделиться с вкладчиками. На дворе тепло, в кассе монеты звенят."),
            Template("{deal} платит щедро",
                "Бочка золота открыта: каждый вкладчик получает повышенную долю. Уже {users} вкладчиков получили свой кусок пирога."),
            Template("Большая раздача от {name}",
                "По случаю удачной недели хозяин раздаёт удвоенные доли. Вкладчики тянутся к лавке с самого утра."),
            Template("Праздник кошелька на {deal}",
                "{name} в благостном расположении духа — сегодня платят больше обычного. Кто не пришёл — пожалеет."),
            Template("Касса {deal} переполнена",
                "Выплаты идут двойными порциями. {name} говорит: «Заработали — делимся, не жадничаем»."),
            Template("Удачный день для вкладчиков",
                "Сегодня у {deal} большой улов — каждый получит больше обычного. Очередь у лавки до самой ярмарки."),
            Template("{name} раздаёт сверх обычного",
                "На День {day} жизни дела хозяин решил расщедриться: премия каждому вкладчику. В лавке толкотня."),
            Template("Звон золота на {deal}",
                "Хозяин неделя как улыбается. Выплаты сегодня двойные. {users} вкладчиков уже отчитались о получении."),
            Template("Бонус от {name}",
                "По случаю успешной партии — повышенные выплаты всем. Хозяин говорит: «Делиться удачей — старинная купеческая традиция»."),
            Template("Сегодня {deal} платит сполна",
                "Касса набита, и {name} раздаёт без скупости. На ярмарке только и разговоров что про эту лавку."),
            Template("Большой день у {deal}",
                "Выплаты увеличены вдвое — таково решение хозяина. {users} человек уже получили свои монеты.")
        ),

        Category.DELAYED_GENERIC to listOf(
            Template("Касса замёрзла — {deal} молчит",
                "{name} сегодня в лавке не появился, выплат нет. На двери записка: «Вернусь, как разрешится». Очередь стоит, ропщет.",
                listOf("Выплаты задержаны без объяснения")),
            Template("{name} сетует на трудные времена",
                "Хозяин клянётся, что вернёт всё «когда оттает». Сегодня кассы нет. {users} вкладчиков ждут.",
                listOf("Отсрочка выплат — третий день подряд")),
            Template("Выплаты в {deal} откладываются",
                "{name} нашёл повод: «Подвозы запаздывают, в среду всё будет». Слухи говорят разное.",
                listOf("Хозяин избегает прямых ответов")),
            Template("Тёмная история у {deal}",
                "{name} вторые сутки молчит. Лавка закрыта. Стражники прохаживаются мимо.",
                listOf("Хозяин не выходит к вкладчикам", "Стражники интересуются делом")),
            Template("Касса {deal} пуста",
                "Хозяин разводит руками: «Не наступит счастья сегодня, придите завтра». Вкладчики недовольны.",
                listOf("Касса пуста уже два дня")),
            Template("{name} тянет с выплатами",
                "День {day}, а монет так и не дали. Хозяин обещает «вот-вот», но ничего не выходит.",
                listOf("Прерывистые выплаты")),
            Template("В {deal} большая задержка",
                "{name} ссылается на дальние края — мол, караваны застряли. Очередь не расходится, шумит.",
                listOf("Невнятные оправдания хозяина")),
            Template("На {deal} пришёл сторож",
                "Лавка закрыта на замок. Сторож говорит: «Хозяина нет, придите в другой день». {users} человек переминаются.",
                listOf("Хозяин не появляется в лавке")),
            Template("Долгое ожидание у {deal}",
                "{name} объявил «временную приостановку выплат». Вкладчики бормочут, что это уже знакомо.",
                listOf("Объявлена приостановка выплат")),
            Template("{deal} молчит про деньги",
                "Хозяин отшучивается: «Будет — и всё будет». Но монет нет. Кто-то уже шепчется про обман.",
                listOf("Хозяин уходит от прямых ответов о деньгах"))
        ),

        Category.NORMAL_SURVIVOR to listOf(
            Template("Всё по чести у {deal}",
                "{name} раздал выплаты как часы — в обед, минута в минуту. Вкладчики кивают, довольны."),
            Template("{deal} держит своё слово",
                "Уже {day} день дело идёт без сбоев. {users} человек получают долю стабильно."),
            Template("Спокойный день у {name}",
                "В лавке как обычно: выплаты в срок, очереди нет, цены не меняются."),
            Template("Делу {day} день — порядок есть",
                "{name} сидит в лавке с раннего утра. Всё чисто, монеты звенят честно."),
            Template("{deal} платит как обещал",
                "Без задержек, без скачков, без сюрпризов. {users} вкладчиков — каждому своё."),
            Template("Стабильный день у {deal}",
                "Хозяин даже шутит: «Скучно жить честно? Тогда я скучный — мне нравится»."),
            Template("Дело {name} идёт ровно",
                "День {day}, выручка такая же как вчера. Никаких новостей — и это хорошая новость."),
            Template("Ничего нового у {deal}",
                "{name} в обычном настроении, выплаты сделаны, дверь лавки открыта до вечера."),
            Template("Тишь да гладь у {deal}",
                "Хозяин выдал монеты, поговорил с вкладчиками, закрыл лавку до завтра. Так оно и идёт."),
            Template("{name} ведёт дело по старинке",
                "Без шумихи, без громких слов. Просто: пришёл — получил — ушёл. {users} человек довольны.")
        ),

        Category.NORMAL_SLOW_DRAIN to listOf(
            Template("{deal} ползёт без новостей",
                "{name} сегодня в задумчивости. Выплаты сделал, но какие-то меньшие, чем ожидалось.",
                listOf("Выплаты меньше обещанных")),
            Template("Тихо ползёт {deal}",
                "Лавка работает, но как-то вяло. Хозяин уходит от разговоров про доход."),
            Template("Уныние в {deal}",
                "{name} жалуется на конкурентов и налоги. Монеты дал, но без улыбки."),
            Template("{name} темнит про доход",
                "Когда вкладчик спросил «сколько прибыли в этом месяце?» — хозяин начал говорить про погоду.",
                listOf("Хозяин избегает разговоров о доходе")),
            Template("Скучная неделя у {deal}",
                "Никаких новостей, никаких событий. Только выплаты в обычном порядке — и то меньшие."),
            Template("{deal} день за днём",
                "Хозяин выкладывает монеты молча. День {day} — ничем не отличается от предыдущих."),
            Template("Лавка {name} полупустая",
                "Когда-то здесь была толпа, теперь только {users} человек заглядывают. Хозяин говорит «затишье».",
                listOf("Поток вкладчиков снижается")),
            Template("Никаких новостей от {deal}",
                "{name} сегодня словно неживой — даже выплачивая, не поднимает глаз."),
            Template("В {deal} вяло",
                "Без видимых проблем, но и без бодрости. Хозяин сетует на «непростые времена».")
        ),

        Category.NORMAL_INSTANT_SCAM to listOf(
            Template("В лавке {deal} нервная обстановка",
                "{name} говорит много, машет руками, но монет даёт по чуть-чуть. Уверяет что «завтра всё будет».",
                listOf("Хозяин нервничает, выплаты по чуть-чуть")),
            Template("{deal} в спешке",
                "{name} собирает мешки, говорит «к маме нужно съездить». Вкладчики переглядываются.",
                listOf("Хозяин говорит про срочную поездку")),
            Template("Странности у {deal}",
                "Сегодня {name} был в лавке полчаса всего. Сказал «дела поджимают», ушёл.",
                listOf("Хозяин почти не появился в лавке")),
            Template("Слишком хорошо у {name}",
                "Сегодня обещал двойные выплаты — приходи завтра. Завтра уже сейчас, а его нет.",
                listOf("Невыполненные обещания о выплатах")),
            Template("{name} мечется",
                "Бегает между лавкой и пристанью. На вопросы отвечает невпопад.",
                listOf("Странное поведение хозяина", "Хозяин бегает по делам"))
        ),

        Category.NORMAL_HONEST_FAIL to listOf(
            Template("{name} извиняется перед вкладчиками",
                "«Старался изо всех сил, но не всё вышло как задумал». Выплаты сегодня меньше, но честные."),
            Template("Тяжёлый день у {deal}",
                "Хозяин сетует на ошибки молодости — рассчитывал больше, чем смог. {users} человек смотрят с пониманием."),
            Template("{deal} борется",
                "{name} обещает «постараться сильнее». Сегодня монет дал, но не сколько обещал. Без обмана, по-честному."),
            Template("Честно о потерях у {deal}",
                "Хозяин признал: «Прогорел на закупке. Зато не утаил». Вкладчики уважают за откровенность."),
            Template("{name} держится",
                "Дело {day} день, идёт со скрипом. Но монеты — есть, хоть и меньше. Тёплые слова — тоже.")
        ),

        Category.NORMAL_UNICORN to listOf(
            Template("Большая выручка у {deal}!",
                "{name} раздаёт двойные доли и улыбается всем. Слухи о деле уже на ярмарке — {users} вкладчиков!"),
            Template("Дело {deal} взлетело",
                "Очередь у лавки — небывалая. {name} принимает новых, а старых щедро благодарит."),
            Template("Сенсация у {name}",
                "Сегодня — рекордные выплаты. Вкладчики возвращаются с горстями монет."),
            Template("На {deal} собралась толпа",
                "Купцы со всей округи стучатся в дверь. {name} держит марку: «Делимся честно»."),
            Template("Звон золота у {deal}",
                "День {day} — лавка ломится от вкладчиков. Хозяин говорит: «Сами не ожидали такого успеха»."),
            Template("Большая удача у {deal}",
                "Каждый вкладчик получил больше, чем ожидал. {users} человек уносят монеты с улыбкой.")
        ),

        Category.NORMAL_CARD_GAME to listOf(
            Template("Игра на {deal} в разгаре",
                "{name} собрал большой стол. Призовой фонд — больше обычного. Вкладчики делят выигрыш."),
            Template("Удачные кости у {deal}",
                "Сегодня хозяин рассказывает о вечернем турнире — большой котёл. Кто пришёл — играет."),
            Template("Партия дня в {deal}",
                "{name} провёл турнир. Победитель забрал шапку монет. Все остальные — по своей доле.")
        ),

        Category.NORMAL_TREASURE_HUNT to listOf(
            Template("Разведчики {deal} вернулись",
                "{name} говорит: «Карта точная, осталось снарядить отряд». Вкладчики ждут весточек."),
            Template("Экспедиция {deal} в пути",
                "Сегодня отряд переправился через реку. {name} получает сообщения каждый день — пока всё по плану."),
            Template("{deal} ищет схрон",
                "Поисковая артель уже неделю в лесу. Хозяин обещает: «Найдём — сразу делёж»."),
            Template("Хорошие вести от артели {deal}",
                "{name} получил весть с похода: «Идём по верному следу». Вкладчики приободрились.")
        ),

        Category.NORMAL_POTION_BREW to listOf(
            Template("Горшочек {deal} варит",
                "{name} сегодня раздал зелье — пахнет травами, продаётся на ура. Доход идёт каждому."),
            Template("Новая партия снадобья у {deal}",
                "На ярмарке расхватали — {name} говорит «надо ещё варить». Выплаты идут как часы."),
            Template("Алхимия {deal} в работе",
                "{name} закупил новые травы, варит зелье второй день. Запах на полквартала."),
            Template("Зельеварня {deal} процветает",
                "Сегодня хозяин расплатился со всеми и ещё прислал гостинцы — пузырьки с настойкой.")
        ),

        Category.NORMAL_GUILD_SCHEME to listOf(
            Template("Артель {deal} принимает новых",
                "{name} говорит: «Мы растём — теперь нас {users}». Доли разлетаются."),
            Template("Гильдия {deal} крепнет",
                "Хозяин показал реестр — каждый месяц новые имена. Вкладчики получают свои доли."),
            Template("В {deal} приходят новые",
                "{name} принял ещё пятерых в артель. Доходы делятся пропорционально, по уставу.")
        ),

        Category.NORMAL_HONEST_TRADE to listOf(
            Template("Лавка {deal} работает",
                "{name} разложил товар, торговля идёт. Выплаты как обычно — точно и без обмана."),
            Template("Тихий день у {deal}",
                "{name} сделал свою выручку, расплатился с вкладчиками. День {day} — ничем не отличается."),
            Template("{deal} торгует ровно",
                "Без шумихи, без сюрпризов: {users} вкладчиков, понятная доля каждому, прозрачный учёт."),
            Template("Купец {name} в работе",
                "Лавка открыта с утра до вечера. Покупателей много, расчёт честный.")
        )
    )

    // ─── Шаблоны под события (AnnouncementType) ──────────────────────────

    private val EVENT_TEMPLATES: Map<AnnouncementType, List<Template>> = mapOf(
        AnnouncementType.LISTING to listOf(
            Template("Большой листинг у {deal}!",
                "{name} объявил: «Наши доли теперь на главной торговой площади столицы». Цена растёт, желающих вложиться — толпа."),
            Template("{deal} вышел на большую ярмарку",
                "Хозяин подписал бумагу: доли {deal} теперь будут торговать на царской площади. Уже сегодня — рост."),
            Template("Сенсация: {deal} в главном торжище",
                "{name} попал на самый важный реестр купеческих долей. Ожидается приток вкладчиков.")
        ),
        AnnouncementType.NEW_SEASON to listOf(
            Template("Новый сезон {deal}",
                "{name} объявил начало второго сезона. Условия меняются, бонусы новые. Старые вкладчики получают плюшки."),
            Template("Перезапуск у {deal}",
                "Хозяин говорит: «Делаем второй заход. Кто остался — тому почёт».")
        ),
        AnnouncementType.COLLAB to listOf(
            Template("Партнёрство у {deal}",
                "{name} объединился с соседней лавкой. Доход пойдёт на оба дела. Перспективы туманные, но любопытные."),
            Template("{deal} объединяется",
                "Хозяин подписал договор с купцом из Твери. Будут торговать вместе.")
        ),
        AnnouncementType.AUDIT to listOf(
            Template("Проверка у {deal}",
                "Старейшины пришли смотреть бумаги. {name} держится бодро, говорит «всё по чести». Результаты завтра."),
            Template("Старейшины пришли в {deal}",
                "Сегодня проверка. {name} разложил все свитки. Вкладчики ждут вердикта.")
        ),
        AnnouncementType.BAD_RUMOR to listOf(
            Template("Слухи о {deal}",
                "На ярмарке шепчут: «Дело {name} пахнет дымом». Хозяин уверяет — пустая болтовня.",
                listOf("Распространяются слухи о проблемах в деле")),
            Template("Молва против {deal}",
                "Кто-то распускает истории про {name}: «Утаил, обманул, спрятал». Хозяин отрицает.",
                listOf("Тёмные слухи на ярмарке"))
        ),
        AnnouncementType.VIP_COLLAB to listOf(
            Template("Воевода благоволит {deal}!",
                "{name} объявил: дело получило благословение знатной особы. Вкладчиков прибавилось.")
        ),
        AnnouncementType.CRIMINAL_CASE to listOf(
            Template("Стража у {deal}",
                "Сегодня в лавку пришли стражники. {name} объясняется. Выплаты пока приостановлены.",
                listOf("Стража интересуется делом", "Выплаты приостановлены")),
            Template("Уголовное дело против {name}",
                "Воевода открыл следствие. {deal} временно закрыто. Вкладчики в смятении.",
                listOf("Открыто уголовное дело", "Дело временно закрыто"))
        ),
        AnnouncementType.HACK to listOf(
            Template("Грабёж в {deal}",
                "{name} рассказывает: ночью пробрались лиходеи, унесли мешок монет. Часть выплат под угрозой.",
                listOf("Произошёл грабёж — средства под угрозой")),
            Template("Чёрная весть из {deal}",
                "Ночные тати взломали лавку. {name} собирает уцелевшее. Что-то вернёт, а что-то — увы.",
                listOf("Взлом лавки", "Часть средств утрачена"))
        )
    )
}
