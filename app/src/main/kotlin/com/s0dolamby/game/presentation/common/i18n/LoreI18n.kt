package com.s0dolamby.game.presentation.common.i18n

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import com.s0dolamby.game.domain.achievements.RevealKind
import com.s0dolamby.game.domain.achievements.RevealTopic

/**
 * «Летопись» — справочник по породам дел, личинам хозяев и судьбам.
 * Порт tg/client/src/game/lore.ts + его EN-переводов из i18n/index.ts.
 *
 * Запись раскрывается игроку через справочный подвиг (Achievement.revealTopic)
 * в «Успехах» — когда такое дело закроется в первый раз.
 */
data class LoreEntry(
    val emoji: String,
    val name: String,
    /** Одна строка-подзаголовок. */
    val title: String,
    /** 3-5 предложений сказочным купеческим слогом. */
    val description: String,
    /** Короткие подсказки-приметы. */
    val hints: List<String>
)

@Composable
@ReadOnlyComposable
fun loreFor(topic: RevealTopic): LoreEntry? {
    val en = LocalLanguage.current == "en"
    return when (topic.kind) {
        RevealKind.TYPE -> (if (en) TYPE_LORE_EN else TYPE_LORE_RU)[topic.id]
        RevealKind.ARCHETYPE -> (if (en) ARCHETYPE_LORE_EN else ARCHETYPE_LORE_RU)[topic.id]
        RevealKind.FATE -> (if (en) FATE_LORE_EN else FATE_LORE_RU)[topic.id]
    }
}

// ─── Породы дел (ProjectType) ─────────────────────────────────────────────

private val TYPE_LORE_RU = mapOf(
    "CARD_GAME" to LoreEntry(
        emoji = "🎴",
        name = "Азартная игра",
        title = "Карты, кости, сукно зелёное",
        description = "Дело на весёлой удаче. Хозяева держат игорный дом: собирают гроши с игроков, часть обещают вкладчикам, часть кладут себе в карман. Прибыль бешеная, но и падение резкое: разорится один вечер — и дело сгорит. Вывести гроши можно когда угодно, но за вывод возьмут четверть — такова плата за суету.",
        hints = listOf("Вывод в любое время, но комиссия 25%", "Часто вспыхивают и быстро гаснут")
    ),
    "TREASURE_HUNT" to LoreEntry(
        emoji = "🗺️",
        name = "Поиск клада",
        title = "Снарядись с охотником за кладом",
        description = "Ходят слухи о зарытых сундуках, припрятанных под курганами да в глухих лесах. Хозяин собирает гроши на снаряжение и обещает делить добычу со вкладчиками. Ждать долго, найти могут что угодно — от царских златников до ржавого ножа. Вывести деньги можно в любой день, но четверть уйдёт в артель на лошадей да заступов.",
        hints = listOf("Вывод в любое время, комиссия 25%", "Если повезёт — небывалый куш")
    ),
    "POTION_BREW" to LoreEntry(
        emoji = "🧪",
        name = "Зелейное дело",
        title = "Варево, которое само даёт прибыль",
        description = "Зельевары сулят пассивный доход: вложил гроши — и капает каждый день, как из котелка. На вид — самое спокойное ремесло, но в зельях много чар, и котёл может треснуть внезапно. Забрать можно не более четверти от вложенного за раз — остальное «ещё не настоялось».",
        hints = listOf("Ограничение вывода: четверть от вложенного за раз", "Спокойный доход… пока всё не осыплется")
    ),
    "GUILD_SCHEME" to LoreEntry(
        emoji = "⚙️",
        name = "Артель",
        title = "Гильдия мастеров — или пирамида?",
        description = "В артель зовут подмастерьев, обещая долю с общего котла. Чем больше вошло — тем больше доход у первых. А если поток иссяк — последние остаются ни с чем. Вывод строго ограничен: за раз не больше четверти — «артель не бросают второпях, старшой».",
        hints = listOf("Вывод: четверть за раз", "Живёт пока идёт приток новых людей")
    ),
    "HONEST_TRADE" to LoreEntry(
        emoji = "🤝",
        name = "Честная торговля",
        title = "Купец с лавкой на ярмарке",
        description = "Самое понятное ремесло: купил подешевле, продал подороже, с прибыли платит вкладчикам. Без чудес — но без пирамид и котлов. Вывести гроши можно в любой день и без комиссии, только честные дела редко дают бешеные иксы — зато и сгорают реже.",
        hints = listOf("Вывод в любое время, без комиссии", "Редко взлетает, но и редко шумит")
    )
)

private val TYPE_LORE_EN = mapOf(
    "CARD_GAME" to LoreEntry(
        emoji = "🎴",
        name = "Card Game",
        title = "Cards, dice, green felt",
        description = "A venture of jolly chance. The owners run a gambling house: they collect kopecks from players, promise a share to investors, and pocket the rest. Profits are wild, but the fall is sharp — one bad evening and the venture burns down. You can withdraw any time, but a quarter is taken as commission — the price of the hustle.",
        hints = listOf("Withdraw any time, but 25% commission", "Often flare up and burn out quickly")
    ),
    "TREASURE_HUNT" to LoreEntry(
        emoji = "🗺️",
        name = "Treasure Hunt",
        title = "Outfit yourself with a treasure hunter",
        description = "Rumours circulate of buried chests hidden under ancient mounds and in deep forests. The owner collects kopecks for equipment and promises to share the spoils with investors. The wait is long, and what you find can be anything — from royal gold coins to a rusty knife. You can withdraw any day, but a quarter goes to the crew for horses and shovels.",
        hints = listOf("Withdraw any time, 25% commission", "If luck holds — an extraordinary windfall")
    ),
    "POTION_BREW" to LoreEntry(
        emoji = "🧪",
        name = "Potion Brew",
        title = "A brew that yields profit on its own",
        description = "Potion-brewers promise passive income: put in kopecks and they drip in daily, like from a cauldron. On the surface — the calmest of trades, but potions hold many spells, and the cauldron can crack without warning. You can take no more than a quarter of your invested amount at once — the rest is \"still steeping\".",
        hints = listOf("Withdrawal limit: a quarter of invested amount at a time", "Steady income… until everything crumbles")
    ),
    "GUILD_SCHEME" to LoreEntry(
        emoji = "⚙️",
        name = "Guild Scheme",
        title = "A guild of masters — or a pyramid?",
        description = "The guild calls in apprentices, promising a share of the common pot. The more who join — the greater the income for the first ones in. And if the flow dries up — the last ones are left with nothing. Withdrawal is strictly limited: no more than a quarter at a time — \"you don't abandon a guild in haste, elder\".",
        hints = listOf("Withdrawal: a quarter at a time", "Lives as long as new people keep joining")
    ),
    "HONEST_TRADE" to LoreEntry(
        emoji = "🤝",
        name = "Honest Trade",
        title = "A merchant with a market stall",
        description = "The most straightforward trade: buy cheap, sell dear, pay investors from the profit. No miracles — but no pyramids or cauldrons either. You can withdraw any day without commission, but honest ventures rarely give wild returns — yet they burn out less often too.",
        hints = listOf("Withdraw any time, no commission", "Rarely exciting, but rarely a disaster")
    )
)

// ─── Личины хозяев (PersonaArchetype) ─────────────────────────────────────

private val ARCHETYPE_LORE_RU = mapOf(
    "BURATINO" to LoreEntry(
        emoji = "🤥",
        name = "Буратино",
        title = "Болтливый мечтатель",
        description = "Сам себя убедил, что ведёт дело века. Ссылается на «великого покровителя Карабаса», который якобы всё подтвердил. Когда прижмёшь вопросами — обижается и начинает сочинять новые подробности прямо на ходу. Врёт не со злобы, а от детской веры в собственные сказки.",
        hints = listOf("Ссылается на таинственного покровителя", "Под давлением — добавляет всё новые детали")
    ),
    "BOYARIN" to LoreEntry(
        emoji = "👑",
        name = "Царь Горох",
        title = "Пышный боярин из старины",
        description = "Говорит величаво, как с престола: «при моём прадеде, царе Горохе» да «сорок семь мастеров, обученных стародавних лет». Ссылается не на реальных партнёров, а на забытых предков и указы, которых никто не видел. Снисходителен: сомневающийся просто «молод и не застал».",
        hints = listOf("Ссылки на стародавние указы и прадедов", "Снисходит свысока — но доказательств нет")
    ),
    "KOLOBOK" to LoreEntry(
        emoji = "🥮",
        name = "Колобок",
        title = "Весёлый ловкач",
        description = "Катится по жизни без забот — любой вопрос превращает в частушку. «Я от воеводы ушёл, от стражников ушёл — и от убытков тоже уйдём». Если проговорился — тут же заболтает новой присказкой. Опасен лёгкостью: поверишь в его оптимизм и не заметишь, что дело уже трещит.",
        hints = listOf("Говорит в ритме присказок и частушек", "Любую сложность объявляет пустяком")
    ),
    "KOSCHEI" to LoreEntry(
        emoji = "💀",
        name = "Кощей",
        title = "Хладнокровный счётчик",
        description = "Никаких эмоций, только цифры, словно приговоры: «прибыль тридцать четыре процента, вкладчики шестьдесят один процент». Намекает, что его дело, как и он сам, бессмертно. На давление не ведётся — задаёт встречный вопрос. Самый убедительный из всех, потому и самый опасный.",
        hints = listOf("Оперирует конкретными процентами", "Ледяное спокойствие — ни капли сомнения")
    ),
    "ZOLUSHKA" to LoreEntry(
        emoji = "👠",
        name = "Золушка",
        title = "Жалостливая просительница",
        description = "Апеллирует к сердцу: «я сама начинала с нуля, я знаю как тяжело». Придумывает срочные дедлайны — «до полуночи, иначе карета превратится в тыкву». Если сомневаешься — обижается: «я просто хотела помочь, а вы как злая мачеха». Давит не цифрами, а чувствами.",
        hints = listOf("Искусственные сроки («до полуночи»)", "Играет на жалости и личной истории")
    ),
    "BABA_YAGA" to LoreEntry(
        emoji = "🏚️",
        name = "Баба-яга",
        title = "Таинственная затворница",
        description = "Отвечает загадками, образами избушки и леса. Прямой ответ считает оскорблением: «не всякий путник достоин знать тайны». Когда начинаешь копать глубже — становится только загадочнее. Туман вместо фактов — и ты сам додумываешь в её пользу.",
        hints = listOf("Загадки и образы вместо прямых ответов", "Отказывается упрощать под предлогом тайны")
    ),
    "IVAN_DURAK" to LoreEntry(
        emoji = "🙃",
        name = "Иван-дурак",
        title = "Честный самоиронист",
        description = "Открыто рассказывает, как закрыл два дела до этого: «даже поминки справил». Не продаёт — описывает как есть, со всей самоиронией. На тревожный вопрос отвечает спокойно: «мне так же задавали перед закрытием второго дела». Единственный архетип, у которого честность — не уловка.",
        hints = listOf("Сам рассказывает о прошлых провалах", "Обещает не богатства, а что не сбежит")
    )
)

private val ARCHETYPE_LORE_EN = mapOf(
    "BURATINO" to LoreEntry(
        emoji = "🤥",
        name = "Buratino",
        title = "The babbling dreamer",
        description = "Convinced himself he runs the deal of the century. References \"the great patron Karabas\" who supposedly confirmed everything. When pressed with questions — takes offence and starts inventing new details on the spot. Lies not out of malice, but from a child-like belief in his own fairy tales.",
        hints = listOf("References a mysterious patron", "Under pressure — adds ever more new details")
    ),
    "BOYARIN" to LoreEntry(
        emoji = "👑",
        name = "Tsar Gorokh",
        title = "The pompous boyar of old",
        description = "Speaks grandly as if from a throne: \"in my great-grandfather's time, Tsar Gorokh\" and \"forty-seven masters trained in the old ways\". References not real partners, but forgotten ancestors and decrees no one has seen. Condescending: a doubter is simply \"too young to remember\".",
        hints = listOf("References ancient decrees and great-grandfathers", "Talks down from above — but offers no proof")
    ),
    "KOLOBOK" to LoreEntry(
        emoji = "🥮",
        name = "Kolobok",
        title = "The jolly trickster",
        description = "Rolls through life without a care — turns every question into a ditty. \"I rolled away from the governor, from the guards — and we'll roll away from losses too.\" If he slips up — immediately buries it with a new catchphrase. Dangerous in his lightness: you'll believe his optimism and miss that the venture is already cracking.",
        hints = listOf("Speaks in the rhythm of folk ditties", "Declares every difficulty a trifle")
    ),
    "KOSCHEI" to LoreEntry(
        emoji = "💀",
        name = "Koschei",
        title = "The cold-blooded accountant",
        description = "No emotions, only numbers like verdicts: \"profit thirty-four percent, investors sixty-one percent.\" Hints that his venture, like himself, is immortal. Doesn't yield to pressure — counters with a question instead. The most convincing of all, which is why he's the most dangerous.",
        hints = listOf("Operates with specific percentages", "Icy calm — not a hint of doubt")
    ),
    "ZOLUSHKA" to LoreEntry(
        emoji = "👠",
        name = "Cinderella",
        title = "The pitiful petitioner",
        description = "Appeals to the heart: \"I started from zero myself, I know how hard it is.\" Invents urgent deadlines — \"by midnight, or the carriage turns to a pumpkin.\" If you hesitate — takes offence: \"I just wanted to help, and you're being like the evil stepmother.\" Pressures not with numbers, but with feelings.",
        hints = listOf("Artificial deadlines (\"by midnight\")", "Plays on sympathy and personal history")
    ),
    "BABA_YAGA" to LoreEntry(
        emoji = "🏚️",
        name = "Baba Yaga",
        title = "The mysterious recluse",
        description = "Answers in riddles, in images of the hut and the forest. Considers a direct answer an insult: \"not every traveller deserves to know the secrets.\" The deeper you dig — the more mysterious she becomes. Fog instead of facts — and you fill in the gaps in her favour yourself.",
        hints = listOf("Riddles and imagery instead of direct answers", "Refuses to simplify under the guise of secrecy")
    ),
    "IVAN_DURAK" to LoreEntry(
        emoji = "🙃",
        name = "Ivan the Fool",
        title = "The honest self-deprecator",
        description = "Openly tells how he closed two ventures before this one: \"even held a wake for the last one.\" Doesn't sell — describes things as they are, with full self-deprecation. Answers a worried question calmly: \"someone asked me the same before my second venture closed.\" The only archetype whose honesty is not a trick.",
        hints = listOf("Tells his own past failures openly", "Promises not riches, but that he won't run away")
    )
)

// ─── Судьбы дел (ProjectFate) ─────────────────────────────────────────────

private val FATE_LORE_RU = mapOf(
    "INSTANT_SCAM" to LoreEntry(
        emoji = "💀",
        name = "Сбежал с деньгами",
        title = "Хозяин исчез с казной",
        description = "Самая подлая судьба. Дело живёт два-пять дней, приманивая большой прибылью, а потом хозяин в одну ночь исчезает со всеми грошами вкладчиков. Без предупреждений, без вестей, без возможности вывести. Только грамота и чутьё могут уберечь — вести и графики скама не выдадут.",
        hints = listOf("Живёт 2–5 дней", "Ни вестей тревожных, ни блокировки вывода — исчезает разом")
    ),
    "SLOW_DRAIN" to LoreEntry(
        emoji = "🌫️",
        name = "Тихо угас",
        title = "Дело медленно истлевает",
        description = "Держится неделю-другую, потом начинает тихо сдуваться. За два дня до краха блокирует вывод и шлёт запоздалые вести. Потеряешь треть или две трети — как повезёт. Хороший глаз заметит отток вкладчиков и задержки выплат заранее.",
        hints = listOf("Живёт 1–3 недели", "За 2 дня до конца блокирует вывод", "Вестники начинают задерживаться")
    ),
    "HONEST_FAIL" to LoreEntry(
        emoji = "😔",
        name = "Честный провал",
        title = "Старался, но не получилось",
        description = "Хозяин реально старался, но конъюнктура подвела. Вернёт от 60% до 90% вложенного — без обмана, просто не задалось. Самая «нестрашная» из печальных судеб: деньги не украдут, но и прибыли ждать не стоит.",
        hints = listOf("Потеря 10–40% от вложенного", "Хозяин честно признаёт неудачу")
    ),
    "SURVIVOR" to LoreEntry(
        emoji = "⚓",
        name = "Выжил",
        title = "Настоящее дело-долгожитель",
        description = "Редкая удача для купца. Дело живёт 15–30 дней, стабильно даёт 1–5% в день — за срок набегает 20–150% сверху вложенного. Закрывается по истечении срока — обычно дело перекупают столичные купцы или гильдия, и вкладчикам честно выплачивают прибыль. Такие дела — основа капитала.",
        hints = listOf("Доход 1–5% в день, за жизнь — 20–150% сверху", "Живёт 15–30 дней, закрывается с прибылью")
    ),
    "UNICORN" to LoreEntry(
        emoji = "🔥",
        name = "Жар-птица за хвост",
        title = "Поймал Жар-птицу",
        description = "Один случай из двадцати. Дело приносит 10–16% в день двадцать-тридцать дней подряд — до +500% за всю жизнь, потолок купеческой удачи. Закроется передачей столичным купцам или самому государю — и вкладчики получают иксы. Поймать Жар-птицу за хвост — главная мечта купца; но подделок под неё в кабаках хватает: ловят перо, а в руке — куриное.",
        hints = listOf("Доход 10–16% в день, до +500% за жизнь", "Живёт 20–30 дней, уходит к столичным купцам")
    )
)

private val FATE_LORE_EN = mapOf(
    "INSTANT_SCAM" to LoreEntry(
        emoji = "💀",
        name = "Ran off with coins",
        title = "The owner vanished with the treasury",
        description = "The most treacherous fate. The venture lives two to five days, luring investors with big profits, then the owner vanishes overnight with all the kopecks. No warnings, no dispatches, no chance to withdraw. Only the charter and your intuition can protect you — dispatches and charts won't give a scammer away.",
        hints = listOf("Lives 2–5 days", "No warning dispatches, no withdrawal block — just vanishes")
    ),
    "SLOW_DRAIN" to LoreEntry(
        emoji = "🌫️",
        name = "Slowly faded",
        title = "The venture slowly withers",
        description = "Holds on for a week or two, then starts quietly deflating. Two days before collapse it blocks withdrawals and sends belated dispatches. You'll lose a third or two-thirds — as luck would have it. A sharp eye will spot the investor outflow and delayed payouts in advance.",
        hints = listOf("Lives 1–3 weeks", "Blocks withdrawals 2 days before the end", "Dispatches start coming late")
    ),
    "HONEST_FAIL" to LoreEntry(
        emoji = "😔",
        name = "Honest failure",
        title = "Tried, but it didn't work out",
        description = "The owner genuinely tried, but circumstances got in the way. Returns 60% to 90% of what was invested — no deception, just bad luck. The least scary of the sad fates: the money won't be stolen, but don't expect a profit either.",
        hints = listOf("Loss of 10–40% of invested amount", "The owner honestly acknowledges the failure")
    ),
    "SURVIVOR" to LoreEntry(
        emoji = "⚓",
        name = "Survived",
        title = "A true long-lived venture",
        description = "Rare luck for a merchant. The venture lives 15–30 days, steadily yielding 1–5% per day — 20–150% on top over its lifetime. Closes at the end of its term — usually bought out by capital merchants or the guild, and investors are honestly paid their profit. These ventures are the foundation of capital.",
        hints = listOf("Return 1–5% per day, 20–150% on top over a lifetime", "Lives 15–30 days, closes with profit")
    ),
    "UNICORN" to LoreEntry(
        emoji = "🔥",
        name = "Caught the Firebird",
        title = "Caught the Firebird by the tail",
        description = "One in twenty chances. The venture yields 10–16% per day for twenty to thirty days running — up to +500% over its lifetime, the ceiling of merchant luck. It closes with a handover to capital merchants or the sovereign himself — and investors receive multiples. Catching the Firebird by the tail is every merchant's dream; but there are plenty of imitations in the taverns: they catch a feather, and find a chicken's in their hand.",
        hints = listOf("Return 10–16% per day, up to +500% per lifetime", "Lives 20–30 days, handed over to capital merchants")
    )
)
