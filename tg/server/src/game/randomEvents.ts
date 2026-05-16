// Каталог случайных событий — мгновенные шаблоны без AI.
// Применяются в AdvanceDayService на каждое активное дело с шансом 20-35%.
// Эффект и текст подбираются под type+fate проекта.
// INSTANT_SCAM получает только POSITIVE/NEUTRAL (скрывает природу до последнего).
// UNICORN получает ~75% позитив через fateBias.

import { ProjectType, ProjectFate } from './types'

export type EventKind = 'NEGATIVE' | 'POSITIVE' | 'NEUTRAL'

export type EventEffect =
  | { type: 'VALUE_DELTA_PERCENT'; min: number; max: number }
  | { type: 'NONE' }

export interface RandomEvent {
  id: string
  kind: EventKind
  applicableTo: ProjectType[] | 'ALL'
  /** Для каких судеб вес умножается на 3 */
  fateBias?: ProjectFate[]
  weight: number
  title: string
  body: string
  effect: EventEffect
}

// Шанс события на дело в день
export const EVENT_CHANCE_MIN = 0.20
export const EVENT_CHANCE_MAX = 0.35

const ALL: 'ALL' = 'ALL'

export const RANDOM_EVENTS: RandomEvent[] = [

  // ══════════════════════════════════════════════════════════════════
  // ОБЩИЕ — для всех типов дел
  // ══════════════════════════════════════════════════════════════════

  // ── Позитивные ────────────────────────────────────────────────────

  {
    id: 'rich_patron',
    kind: 'POSITIVE',
    applicableTo: ALL,
    fateBias: [ProjectFate.INSTANT_SCAM, ProjectFate.SLOW_DRAIN, ProjectFate.UNICORN],
    weight: 10,
    title: 'Богатый покровитель пришёл к делу',
    body: 'К {name} приехал именитый купец из стольного града — закинул свои гроши, дело подросло на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.06, max: 0.12 },
  },
  {
    id: 'word_of_mouth',
    kind: 'POSITIVE',
    applicableTo: ALL,
    fateBias: [ProjectFate.SURVIVOR, ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM],
    weight: 9,
    title: 'Молва пошла по ярмарке',
    body: 'О {name} зашептались на торговых рядах — народ потянулся, прибавило {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.04, max: 0.09 },
  },
  {
    id: 'elders_blessed',
    kind: 'POSITIVE',
    applicableTo: ALL,
    fateBias: [ProjectFate.INSTANT_SCAM, ProjectFate.SLOW_DRAIN, ProjectFate.SURVIVOR, ProjectFate.UNICORN],
    weight: 8,
    title: 'Старейшины благословили дело',
    body: 'Совет старейшин ярмарки одобрил {name} — народ успокоился, прибавило {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.03, max: 0.07 },
  },
  {
    id: 'royal_trade_decree',
    kind: 'POSITIVE',
    applicableTo: ALL,
    fateBias: [ProjectFate.INSTANT_SCAM, ProjectFate.UNICORN],
    weight: 8,
    title: 'Государев указ о свободной торговле',
    body: 'Новый царский указ снял пошлины с {name} — дело подросло на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.05, max: 0.10 },
  },
  {
    id: 'foreign_investor',
    kind: 'POSITIVE',
    applicableTo: ALL,
    fateBias: [ProjectFate.INSTANT_SCAM, ProjectFate.UNICORN],
    weight: 8,
    title: 'Иноземный купец заинтересовался',
    body: 'Из-за моря прослышали о {name} — иноземец вложил свои монеты, прибавило {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.08, max: 0.14 },
  },
  {
    id: 'pilgrim_wave',
    kind: 'POSITIVE',
    applicableTo: ALL,
    fateBias: [ProjectFate.UNICORN, ProjectFate.SURVIVOR],
    weight: 7,
    title: 'Богомольцы принесли монеты',
    body: 'Волна богомольцев проходила мимо {name} и оставила немало — прибавило {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.04, max: 0.09 },
  },
  {
    id: 'fair_festival',
    kind: 'POSITIVE',
    applicableTo: ALL,
    fateBias: [ProjectFate.INSTANT_SCAM, ProjectFate.UNICORN, ProjectFate.SURVIVOR],
    weight: 7,
    title: 'Ярмарочный праздник собрал толпы',
    body: 'В честь именин государя устроили гуляния — у {name} небывалый наплыв, +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.05, max: 0.11 },
  },
  {
    id: 'guild_endorsement',
    kind: 'POSITIVE',
    applicableTo: ALL,
    fateBias: [ProjectFate.SURVIVOR, ProjectFate.UNICORN],
    weight: 6,
    title: 'Купеческая гильдия рекомендовала дело',
    body: 'Уважаемые купцы внесли {name} в список надёжных дел — поток вкладчиков вырос, +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.04, max: 0.08 },
  },
  {
    id: 'harvest_surplus',
    kind: 'POSITIVE',
    applicableTo: ALL,
    weight: 6,
    title: 'Богатый урожай — у людей завелись деньги',
    body: 'Небывалый урожай наполнил кошельки крестьян — часть монет потекла в {name}, +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.03, max: 0.07 },
  },
  {
    id: 'famous_traveler',
    kind: 'POSITIVE',
    applicableTo: ALL,
    fateBias: [ProjectFate.INSTANT_SCAM, ProjectFate.UNICORN],
    weight: 6,
    title: 'Знаменитый путешественник упомянул дело',
    body: 'Заморский гость написал в своих записках о {name} — слава разошлась, прибавило {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.06, max: 0.11 },
  },
  {
    id: 'weather_blessing',
    kind: 'POSITIVE',
    applicableTo: ALL,
    weight: 5,
    title: 'Благодатная погода — торговля бойкая',
    body: 'Тепло и солнце выманили народ на ярмарку — у {name} выручка выросла на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.03, max: 0.06 },
  },

  // ── Негативные ────────────────────────────────────────────────────

  {
    id: 'voevoda_check',
    kind: 'NEGATIVE',
    applicableTo: ALL,
    weight: 10,
    title: 'Воевода нагрянул с проверкой',
    body: 'У {name} проверили учётную книгу — нашли неточности и взяли мзду в {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.05 },
  },
  {
    id: 'tax_introduced',
    kind: 'NEGATIVE',
    applicableTo: ALL,
    weight: 9,
    title: 'Новая подать с купцов',
    body: 'Государев приказ ввёл новую подать — у {name} взяли {amount} г в казну.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.08, max: -0.04 },
  },
  {
    id: 'market_slump',
    kind: 'NEGATIVE',
    applicableTo: ALL,
    weight: 8,
    title: 'Ярмарка захирела — народ не идёт',
    body: 'Торговля на ярмарке встала: у {name} выручка просела на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.08, max: -0.04 },
  },
  {
    id: 'drought_season',
    kind: 'NEGATIVE',
    applicableTo: ALL,
    weight: 7,
    title: 'Засуха — народ затягивает пояса',
    body: 'Неурожай опустошил кошельки покупателей — у {name} прибыль упала на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.07, max: -0.04 },
  },
  {
    id: 'early_frost',
    kind: 'NEGATIVE',
    applicableTo: ALL,
    weight: 6,
    title: 'Ранние морозы побили урожай',
    body: 'Холода ударили раньше срока — у {name} пострадали запасы на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.07, max: -0.03 },
  },
  {
    id: 'plague_scare',
    kind: 'NEGATIVE',
    applicableTo: ALL,
    weight: 6,
    title: 'Мор в городе — люди разбегаются',
    body: 'Слухи о хвори опустели ярмарку — у {name} убыток {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.09, max: -0.05 },
  },
  {
    id: 'bridge_collapse',
    kind: 'NEGATIVE',
    applicableTo: ALL,
    weight: 5,
    title: 'Мост обрушился — дороги закрыты',
    body: 'Переправа сломалась — товары и вкладчики не могут добраться до {name}, потеря {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.08, max: -0.04 },
  },
  {
    id: 'fire_in_market',
    kind: 'NEGATIVE',
    applicableTo: ALL,
    weight: 5,
    title: 'Пожар на ярмарке',
    body: 'Огонь прошёлся по торговым рядам — {name} не уцелело, сгорело на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.12, max: -0.06 },
  },
  {
    id: 'rumor_of_fraud',
    kind: 'NEGATIVE',
    applicableTo: ALL,
    fateBias: [ProjectFate.SURVIVOR, ProjectFate.UNICORN],
    weight: 5,
    title: 'Слухи о мошенничестве на рынке',
    body: 'По ярмарке поползли слухи о нечестных купцах — вкладчики {name} занервничали, убыток {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.09, max: -0.05 },
  },

  // ── Нейтральные ───────────────────────────────────────────────────

  {
    id: 'jesters_dance',
    kind: 'NEUTRAL',
    applicableTo: ALL,
    weight: 4,
    title: 'На ярмарке скоморохи плясали',
    body: 'Близ {name} развесёлая толпа собралась поглядеть на скоморохов — торговля замерла, но и убытков нет.',
    effect: { type: 'NONE' },
  },
  {
    id: 'long_rain',
    kind: 'NEUTRAL',
    applicableTo: ALL,
    weight: 4,
    title: 'Дождь две седмицы кряду',
    body: 'У {name} притихла торговля — но и убытков особых нет, переждут.',
    effect: { type: 'NONE' },
  },

  // ══════════════════════════════════════════════════════════════════
  // ЗЕЛЕЙНОЕ ДЕЛО (POTION_BREW)
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'potion_herbs_bloomed',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.POTION_BREW],
    weight: 10,
    title: 'Травы зацвели обильно',
    body: 'Знахарь принёс к {name} необычайно богатый сбор — варево пошло споро, прибавило {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.06, max: 0.12 },
  },
  {
    id: 'potion_foreign_alchemist',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.POTION_BREW],
    weight: 9,
    title: 'Заморский алхимик с заказом',
    body: 'В {name} заглянул иноземный гость, заказал большую партию зелий — расчёт {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.08, max: 0.15 },
  },
  {
    id: 'potion_plague_demand',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.POTION_BREW],
    fateBias: [ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM],
    weight: 9,
    title: 'Хворь в округе — зелья нарасхват',
    body: 'В соседних сёлах начался мор — все бегут к {name} за снадобьями, +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.12, max: 0.20 },
  },
  {
    id: 'potion_rare_ingredient',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.POTION_BREW],
    fateBias: [ProjectFate.UNICORN],
    weight: 8,
    title: 'Редкий ингредиент с Востока',
    body: 'Торговец привёз диковинный корень — варево у {name} стало втрое сильнее, +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.10, max: 0.16 },
  },
  {
    id: 'potion_old_recipe',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.POTION_BREW],
    weight: 7,
    title: 'Нашли старинный рецепт в погребе',
    body: 'В {name} обнаружили древний свиток — новое зелье раскупили за день, +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.07, max: 0.13 },
  },
  {
    id: 'potion_healer_fame',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.POTION_BREW],
    fateBias: [ProjectFate.SURVIVOR, ProjectFate.UNICORN],
    weight: 7,
    title: 'Знахарь прославился на всю округу',
    body: 'После удачного исцеления боярина слух о {name} разлетелся — очередь стоит, +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.08, max: 0.14 },
  },
  {
    id: 'potion_explosion',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.POTION_BREW],
    weight: 10,
    title: 'Котёл взорвался',
    body: 'Подмастерье у {name} нагрел котёл сверх меры — хлопок, потеря товара на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.12, max: -0.06 },
  },
  {
    id: 'potion_black_cat',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.POTION_BREW],
    weight: 7,
    title: 'Чёрная кошка склянки опрокинула',
    body: 'В {name} забралась лесная кошка, разбила полку с тинктурами — убыток {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.06, max: -0.03 },
  },
  {
    id: 'potion_wrong_ingredient',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.POTION_BREW],
    weight: 8,
    title: 'Подмастерье перепутал травы',
    body: 'Вся партия у {name} пошла насмарку — пришлось выбросить зелья на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.05 },
  },
  {
    id: 'potion_shortage',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.POTION_BREW],
    weight: 7,
    title: 'Засуха выкосила запасы трав',
    body: 'Нет сырья — {name} встало на неделю, потеря {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.08, max: -0.04 },
  },
  {
    id: 'potion_poisoning',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.POTION_BREW],
    weight: 6,
    title: 'Покупатель отравился — слухи поползли',
    body: 'Один из клиентов {name} слёг после зелья — молва отпугнула покупателей, убыток {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.11, max: -0.07 },
  },
  {
    id: 'potion_rival',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.POTION_BREW],
    weight: 6,
    title: 'Конкурент открыл лавку напротив',
    body: 'Соседний зелейник переманил половину клиентов {name} — выручка упала на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.08, max: -0.04 },
  },

  // ══════════════════════════════════════════════════════════════════
  // АРТЕЛЬ / ГИЛЬДИЯ (GUILD_SCHEME)
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'guild_new_master',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    weight: 9,
    title: 'Новый мастер со своим заказом',
    body: 'К {name} прибился умелец с большим заказом от воеводы — поднялись на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.07, max: 0.12 },
  },
  {
    id: 'guild_starosta_blessing',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    fateBias: [ProjectFate.INSTANT_SCAM, ProjectFate.SLOW_DRAIN, ProjectFate.UNICORN],
    weight: 8,
    title: 'Городской староста благословил артель',
    body: 'Староста публично похвалил {name} — народ повалил вкладываться, прибыло {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.05, max: 0.10 },
  },
  {
    id: 'guild_voevoda_order',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    fateBias: [ProjectFate.UNICORN, ProjectFate.SURVIVOR],
    weight: 9,
    title: 'Воевода заказал крепостную стену',
    body: 'Воевода нанял {name} строить новую стену — казённый заказ принёс {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.10, max: 0.16 },
  },
  {
    id: 'guild_big_contract',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    fateBias: [ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM],
    weight: 8,
    title: 'Большой казённый подряд',
    body: '{name} выиграло торги на строительство — аванс поступил, +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.09, max: 0.15 },
  },
  {
    id: 'guild_fair_prize',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    fateBias: [ProjectFate.SURVIVOR, ProjectFate.UNICORN],
    weight: 7,
    title: 'Взяли приз на ярмарке мастерства',
    body: '{name} увезло главный кубок — заказы посыпались со всей округи, +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.07, max: 0.12 },
  },
  {
    id: 'guild_apprentices',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    weight: 6,
    title: 'Умелые подмастерья ускорили работу',
    body: 'Новая смена в {name} взяла темп — сдали заказ раньше срока, премия {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.05, max: 0.09 },
  },
  {
    id: 'guild_quarrel',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    weight: 10,
    title: 'Артельная ссора',
    body: 'В {name} мастера переругались за долю — кто-то ушёл, недосчитались {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.05 },
  },
  {
    id: 'guild_competitor',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    weight: 9,
    title: 'Конкурент перекупил мастеров',
    body: 'Соседняя артель сманила лучших у {name} — заказы встали, потеря {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.12, max: -0.06 },
  },
  {
    id: 'guild_strike',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    weight: 8,
    title: 'Мастера потребовали прибавки — встали',
    body: 'Работники {name} бросили инструмент до переговоров — простой обошёлся в {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.09, max: -0.05 },
  },
  {
    id: 'guild_material_shortage',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    weight: 7,
    title: 'Нет сырья — заказы стоят',
    body: 'Поставка леса к {name} задержалась на три седмицы — штраф заказчика {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.08, max: -0.04 },
  },
  {
    id: 'guild_defective_batch',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    weight: 7,
    title: 'Бракованная партия — возврат',
    body: 'Заказчик вернул кривые брёвна {name} — пришлось переделывать за свой счёт, минус {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.06 },
  },
  {
    id: 'guild_fire',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    weight: 5,
    title: 'Пожар в мастерской',
    body: 'Ночью вспыхнул склад {name} — сгорело инструментов и заготовок на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.14, max: -0.08 },
  },

  // ══════════════════════════════════════════════════════════════════
  // ТОРГОВЛЯ (HONEST_TRADE)
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'trade_caravan',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    weight: 10,
    title: 'Караван заморских товаров',
    body: 'К {name} пришёл караван с пряностями — продали с большим барышом, +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.08, max: 0.14 },
  },
  {
    id: 'trade_rich_buyer',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    weight: 9,
    title: 'Богатый купец взял оптом',
    body: 'К {name} приехал именитый барин, выкупил всю партию — расчёт {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.10, max: 0.16 },
  },
  {
    id: 'trade_new_route',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    fateBias: [ProjectFate.SURVIVOR, ProjectFate.UNICORN],
    weight: 8,
    title: 'Открыли новый торговый путь',
    body: 'Разведчики {name} нашли короткую дорогу к богатым сёлам — доход вырос на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.08, max: 0.14 },
  },
  {
    id: 'trade_rare_goods',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    fateBias: [ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM],
    weight: 8,
    title: 'Редкий товар с Востока',
    body: 'К {name} попал диковинный шёлк — продали втридорога, +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.10, max: 0.18 },
  },
  {
    id: 'trade_seasonal_surge',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    weight: 7,
    title: 'Сезонный спрос взлетел',
    body: 'Перед зимой народ бросился скупать запасы у {name} — выручка +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.07, max: 0.12 },
  },
  {
    id: 'trade_lucky_deal',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    fateBias: [ProjectFate.INSTANT_SCAM, ProjectFate.UNICORN],
    weight: 7,
    title: 'Удачная сделка с иноземцами',
    body: 'Заморские купцы заплатили за товар {name} золотом сверх договора — лишние {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.08, max: 0.14 },
  },
  {
    id: 'trade_robbers',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    weight: 10,
    title: 'Налёт разбойников на обоз',
    body: 'Под Можайском обоз {name} ограбили — потеря товара на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.18, max: -0.10 },
  },
  {
    id: 'trade_spoiled',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    weight: 8,
    title: 'Партия товара испортилась в пути',
    body: 'У {name} в дороге подмочили мешки — часть товара пришлось списать, убыток {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.08, max: -0.04 },
  },
  {
    id: 'trade_flood',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    weight: 7,
    title: 'Весенний лёд сломал мосты',
    body: 'Половодье разрушило переправы — обоз {name} застрял на неделю, убыток {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.06 },
  },
  {
    id: 'trade_tariff',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    weight: 7,
    title: 'Новая таможенная пошлина',
    body: 'Государев откупщик повысил сборы — {name} заплатило лишних {amount} г на границе.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.09, max: -0.05 },
  },
  {
    id: 'trade_betrayal',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    weight: 6,
    title: 'Партнёр обманул с товаром',
    body: 'Поставщик {name} подсунул негодный товар — пришлось судиться и терять {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.11, max: -0.07 },
  },
  {
    id: 'trade_counterfeit',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    weight: 5,
    title: 'Рынок залили дешёвой подделкой',
    body: 'Жулики наводнили ярмарку фальшивым товаром под маркой {name} — репутация и выручка упали на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.06 },
  },

  // ══════════════════════════════════════════════════════════════════
  // ИГРА В КАРТЫ (CARD_GAME)
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'cards_big_winner',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.CARD_GAME],
    weight: 10,
    title: 'Большой проигрыш заезжего барина',
    body: 'У {name} заезжий барин просадил всё за вечер — заведению досталось {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.12, max: 0.20 },
  },
  {
    id: 'cards_tournament',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.CARD_GAME],
    fateBias: [ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM],
    weight: 9,
    title: 'Приезжий вельможа устроил турнир',
    body: 'Знатный гость выбрал {name} для большого турнира — заведение собрало {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.14, max: 0.22 },
  },
  {
    id: 'cards_high_rollers',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.CARD_GAME],
    fateBias: [ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM],
    weight: 8,
    title: 'Компания богатых купцов засела играть',
    body: 'Целая артель купцов провела у {name} три ночи — касса пополнилась на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.10, max: 0.18 },
  },
  {
    id: 'cards_private_party',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.CARD_GAME],
    fateBias: [ProjectFate.SURVIVOR, ProjectFate.UNICORN],
    weight: 8,
    title: 'Закрытая вечеринка для воеводы',
    body: 'Воевода заказал {name} приватный вечер — оплата вперёд, касса выросла на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.09, max: 0.15 },
  },
  {
    id: 'cards_lucky_streak',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.CARD_GAME],
    weight: 7,
    title: 'Ночь везения — все ставки сыграли',
    body: 'В {name} выдалась фартовая ночь — банк остался за заведением, +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.08, max: 0.14 },
  },
  {
    id: 'cards_new_game',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.CARD_GAME],
    fateBias: [ProjectFate.INSTANT_SCAM, ProjectFate.UNICORN],
    weight: 6,
    title: 'Новая игра собрала толпу',
    body: '{name} придумало новую забаву — любопытные несут монеты, касса +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.07, max: 0.12 },
  },
  {
    id: 'cards_shulers',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.CARD_GAME],
    weight: 10,
    title: 'Шулера накрыли — выручку забрали',
    body: 'У {name} стража поймала шулеров за столом, всю выручку конфисковали — минус {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.14, max: -0.07 },
  },
  {
    id: 'cards_voevoda_threat',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.CARD_GAME],
    weight: 8,
    title: 'Воевода грозился прикрыть заведение',
    body: 'У {name} были разговоры о закрытии — отдали мзду {amount} г, кое-как замяли.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.05 },
  },
  {
    id: 'cards_raid',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.CARD_GAME],
    weight: 8,
    title: 'Стражники устроили облаву',
    body: 'Ночная облава разогнала игроков {name} — заведение простояло пустым, убыток {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.12, max: -0.07 },
  },
  {
    id: 'cards_scandal',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.CARD_GAME],
    weight: 7,
    title: 'Скандал с подозрением в мошенничестве',
    body: 'Проигравший боярин обвинил {name} в нечестной игре — молва разошлась, минус {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.06 },
  },
  {
    id: 'cards_robbery',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.CARD_GAME],
    weight: 6,
    title: 'Ночью ограбили кассу',
    body: 'Лихие люди влезли в {name} и унесли дневную выручку — минус {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.13, max: -0.08 },
  },
  {
    id: 'cards_bad_reputation',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.CARD_GAME],
    weight: 5,
    title: 'Дурная слава отпугнула игроков',
    body: 'По городу пошёл слух что в {name} нечисто — постоянные клиенты перестали ходить, убыток {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.09, max: -0.05 },
  },

  // ══════════════════════════════════════════════════════════════════
  // ПОИСК КЛАДА (TREASURE_HUNT)
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'treasure_old_hoard',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    weight: 10,
    title: 'Нашли старый клад под корнями',
    body: 'У {name} под старым дубом откопали клад с серебром — +{amount} г в казну.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.14, max: 0.22 },
  },
  {
    id: 'treasure_old_map',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    weight: 9,
    title: 'Старая карта раскрыла новое место',
    body: 'У {name} нашлась карта с пометкой — пошли разведать, добыли на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.08, max: 0.15 },
  },
  {
    id: 'treasure_coin_river',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    fateBias: [ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM],
    weight: 9,
    title: 'Русло реки открыло монеты',
    body: 'Весенний паводок вымыл на берег старинные монеты — {name} собрало на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.12, max: 0.20 },
  },
  {
    id: 'treasure_ancient_artifact',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    fateBias: [ProjectFate.UNICORN],
    weight: 8,
    title: 'Нашли древний артефакт',
    body: 'Артель {name} откопала старинный идол — коллекционер заплатил {amount} г не торгуясь.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.15, max: 0.25 },
  },
  {
    id: 'treasure_hermit_tip',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    fateBias: [ProjectFate.SURVIVOR, ProjectFate.UNICORN],
    weight: 7,
    title: 'Отшельник указал заветное место',
    body: 'Лесной старец за краюху хлеба показал {name} схрон — добыли на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.10, max: 0.17 },
  },
  {
    id: 'treasure_seasonal_reveal',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    weight: 6,
    title: 'Оттепель обнажила схрон',
    body: 'Таявший снег открыл в земле старый сундук — {name} не упустило случай, +{amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.09, max: 0.15 },
  },
  {
    id: 'treasure_lost',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    weight: 10,
    title: 'Заблудились в дремучей чаще',
    body: 'Артель {name} неделю плутала в лесу — припасы съели, расходы {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.05 },
  },
  {
    id: 'treasure_beasts',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    weight: 8,
    title: 'Дикие звери разогнали артель',
    body: 'Медведь забрёл в лагерь {name} — народ разбежался, бросив снаряжение на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.05 },
  },
  {
    id: 'treasure_rival_gang',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    weight: 8,
    title: 'Конкуренты опередили артель',
    body: 'Другая ватага добралась до места раньше {name} — место выработано, потери {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.06 },
  },
  {
    id: 'treasure_cave_collapse',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    weight: 6,
    title: 'Обрушение в пещере',
    body: 'Своды рухнули пока {name} копало — потеряли снаряжение и часть добычи на {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.12, max: -0.07 },
  },
  {
    id: 'treasure_false_lead',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    weight: 6,
    title: 'Ложный след обошёлся дорого',
    body: '{name} потратило две недели на пустое место — припасы и жалованье вышли в {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.09, max: -0.05 },
  },
  {
    id: 'treasure_storm',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    weight: 5,
    title: 'Буря уничтожила лагерь',
    body: 'Ночная гроза снесла палатки {name} и смыла часть добычи — убыток {amount} г.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.11, max: -0.06 },
  },
]

/**
 * Выбирает случайное событие для проекта с учётом типа дела и судьбы.
 * INSTANT_SCAM получает только POSITIVE/NEUTRAL — не разоблачается раньше времени.
 * Вес кандидата: weight * (fateBias.includes(fate) ? 3 : 1).
 */
export function pickRandomEvent(
  type: ProjectType,
  fate: ProjectFate,
  rngFn: () => number = Math.random,
  opts: { positiveOnly?: boolean; chance?: number } = {},
): RandomEvent | null {
  const chance = opts.chance ?? (EVENT_CHANCE_MIN + rngFn() * (EVENT_CHANCE_MAX - EVENT_CHANCE_MIN))
  if (rngFn() >= chance) return null

  const candidates = RANDOM_EVENTS.filter(e => {
    if (e.applicableTo !== 'ALL' && !e.applicableTo.includes(type)) return false
    if (fate === ProjectFate.INSTANT_SCAM && e.kind === 'NEGATIVE') return false
    if (opts.positiveOnly && e.kind === 'NEGATIVE') return false
    return true
  })

  if (candidates.length === 0) return null

  const totalWeight = candidates.reduce((sum, e) => {
    return sum + e.weight * (e.fateBias?.includes(fate) ? 3 : 1)
  }, 0)
  let r = rngFn() * totalWeight
  for (const e of candidates) {
    const w = e.weight * (e.fateBias?.includes(fate) ? 3 : 1)
    r -= w
    if (r <= 0) return e
  }
  return candidates[candidates.length - 1]
}

/** Подставляет {name} и {amount} в шаблон body */
export function renderEventBody(template: string, projectName: string, amountRubles: number): string {
  const amount = Math.max(1, Math.round(Math.abs(amountRubles)))
  return template.replace(/\{name\}/g, projectName).replace(/\{amount\}/g, String(amount))
}

/** Применяет эффект события к currentValueRubles */
export function applyEventEffect(
  currentValue: number,
  effect: EventEffect,
  rngFn: () => number = Math.random,
): { newValue: number; deltaRubles: number; percent: number } {
  if (effect.type === 'NONE') {
    return { newValue: currentValue, deltaRubles: 0, percent: 0 }
  }
  const percent = effect.min + rngFn() * (effect.max - effect.min)
  const delta = currentValue * percent
  const newValue = Math.max(0, currentValue + delta)
  return { newValue, deltaRubles: delta, percent }
}
