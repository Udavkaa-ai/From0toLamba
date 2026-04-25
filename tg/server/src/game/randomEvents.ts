// Каталог случайных событий — мгновенные шаблоны без AI.
// Применяются в AdvanceDayService на каждое активное дело с шансом 15-25%.
// Эффект и текст подбираются под type+fate проекта: для «Зелейного дела»
// одни события, для «Артели» — другие; для скам-судеб чаще всплывают
// заманивающие позитивные новости.

import { ProjectType, ProjectFate } from './types'

export type EventKind = 'NEGATIVE' | 'POSITIVE' | 'NEUTRAL'

export type EventEffect =
  | { type: 'VALUE_DELTA_PERCENT'; min: number; max: number }   // ±% от currentValueRubles
  | { type: 'NONE' }

export interface RandomEvent {
  id: string
  kind: EventKind
  /** К каким типам дел применимо. 'ALL' — ко всем. */
  applicableTo: ProjectType[] | 'ALL'
  /** Для каких судеб событие особенно характерно — вес умножается на 3. */
  fateBias?: ProjectFate[]
  /** Базовый вес в группе кандидатов */
  weight: number
  title: string
  /** Шаблон тела с плейсхолдерами {name}, {amount} */
  body: string
  effect: EventEffect
}

// Шанс события на дело в день — рандомизируется в этом диапазоне (15-25%)
export const EVENT_CHANCE_MIN = 0.15
export const EVENT_CHANCE_MAX = 0.25

const ALL: 'ALL' = 'ALL'

export const RANDOM_EVENTS: RandomEvent[] = [
  // ── ОБЩИЕ (для всех типов дел) ────────────────────────────────────────────

  {
    id: 'voevoda_check',
    kind: 'NEGATIVE',
    applicableTo: ALL,
    weight: 10,
    title: 'Воевода нагрянул с проверкой',
    body: 'У {name} проверили учётную книгу — нашли неточности и взяли мзду в {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.05 },
  },
  {
    id: 'rich_patron',
    kind: 'POSITIVE',
    applicableTo: ALL,
    fateBias: [ProjectFate.INSTANT_SCAM, ProjectFate.SLOW_DRAIN], // заманка
    weight: 10,
    title: 'Богатый покровитель пришёл к делу',
    body: 'К {name} приехал именитый купец из стольного града — закинул свои рубли, дело подросло на {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.06, max: 0.12 },
  },
  {
    id: 'word_of_mouth',
    kind: 'POSITIVE',
    applicableTo: ALL,
    fateBias: [ProjectFate.SURVIVOR, ProjectFate.UNICORN, ProjectFate.INSTANT_SCAM],
    weight: 8,
    title: 'Молва пошла по ярмарке',
    body: 'О {name} зашептались на торговых рядах — народ потянулся, прибавило {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.04, max: 0.08 },
  },
  {
    id: 'tax_introduced',
    kind: 'NEGATIVE',
    applicableTo: ALL,
    weight: 7,
    title: 'Новая подать с купцов',
    body: 'Государев приказ ввёл новую подать — у {name} взяли {amount} ₽ в казну.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.08, max: -0.04 },
  },
  {
    id: 'elders_blessed',
    kind: 'POSITIVE',
    applicableTo: ALL,
    fateBias: [ProjectFate.INSTANT_SCAM, ProjectFate.SLOW_DRAIN, ProjectFate.SURVIVOR],
    weight: 6,
    title: 'Старейшины благословили дело',
    body: 'Совет старейшин ярмарки одобрил {name} — народ успокоился, прибавило {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.03, max: 0.07 },
  },
  {
    id: 'jesters_dance',
    kind: 'NEUTRAL',
    applicableTo: ALL,
    weight: 4,
    title: 'На ярмарке скоморохи плясали',
    body: 'Близ {name} развесёлая толпа собралась поглядеть на скоморохов — хозяин даже рубля не заработал на торговле в этот день.',
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

  // ── ЗЕЛЕЙНОЕ ДЕЛО (POTION_BREW) ───────────────────────────────────────────

  {
    id: 'potion_explosion',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.POTION_BREW],
    weight: 10,
    title: 'Котёл взорвался',
    body: 'Подмастерье у {name} нагрел котёл сверх меры — хлопок, потеря товара на {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.12, max: -0.06 },
  },
  {
    id: 'potion_herbs_bloomed',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.POTION_BREW],
    weight: 10,
    title: 'Травы зацвели обильно',
    body: 'Знахарь принёс к {name} необычайно богатый сбор — варево пошло споро, прибавило {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.06, max: 0.12 },
  },
  {
    id: 'potion_foreign_alchemist',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.POTION_BREW],
    weight: 8,
    title: 'Заморский алхимик с заказом',
    body: 'В {name} заглянул иноземный гость, заказал большую партию зелий — расчёт {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.08, max: 0.15 },
  },
  {
    id: 'potion_black_cat',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.POTION_BREW],
    weight: 6,
    title: 'Чёрная кошка склянки опрокинула',
    body: 'В {name} забралась лесная кошка, разбила полку с тинктурами — убыток {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.06, max: -0.03 },
  },

  // ── АРТЕЛЬ / ГИЛЬДИЯ (GUILD_SCHEME) ───────────────────────────────────────

  {
    id: 'guild_quarrel',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    weight: 10,
    title: 'Артельная ссора',
    body: 'В {name} мастера переругались за долю — кто-то ушёл, недосчитались {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.05 },
  },
  {
    id: 'guild_competitor',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    weight: 9,
    title: 'Конкурент перекупил мастеров',
    body: 'Соседняя артель сманила лучших у {name} — заказы встали, потеря {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.12, max: -0.06 },
  },
  {
    id: 'guild_new_master',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    weight: 9,
    title: 'Новый мастер со своим заказом',
    body: 'К {name} прибился умелец с большим заказом от воеводы — поднялись на {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.07, max: 0.12 },
  },
  {
    id: 'guild_starosta_blessing',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.GUILD_SCHEME],
    fateBias: [ProjectFate.INSTANT_SCAM, ProjectFate.SLOW_DRAIN],
    weight: 7,
    title: 'Городской староста благословил артель',
    body: 'Староста публично похвалил {name} — народ повалил вкладываться, прибыло {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.05, max: 0.10 },
  },

  // ── ТОРГОВЛЯ (HONEST_TRADE) ────────────────────────────────────────────────

  {
    id: 'trade_robbers',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    weight: 10,
    title: 'Налёт разбойников на обоз',
    body: 'Под Можайском обоз {name} ограбили — потеря товара на {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.18, max: -0.10 },
  },
  {
    id: 'trade_caravan',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    weight: 10,
    title: 'Караван заморских товаров',
    body: 'К {name} пришёл караван с пряностями — продали с большим барышом, +{amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.08, max: 0.14 },
  },
  {
    id: 'trade_spoiled',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    weight: 7,
    title: 'Партия товара испортилась в пути',
    body: 'У {name} в дороге подмочили мешки — часть товара пришлось списать, {amount} ₽ убытка.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.08, max: -0.04 },
  },
  {
    id: 'trade_rich_buyer',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.HONEST_TRADE],
    weight: 9,
    title: 'Богатый купец взял оптом',
    body: 'К {name} приехал именитый барин, выкупил всю партию — расчёт {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.10, max: 0.16 },
  },

  // ── ИГРА В КАРТЫ (CARD_GAME) ───────────────────────────────────────────────

  {
    id: 'cards_shulers',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.CARD_GAME],
    weight: 10,
    title: 'Шулера накрыли — выручку забрали',
    body: 'У {name} стража поймала шулеров за столом, всю выручку конфисковали — минус {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.14, max: -0.07 },
  },
  {
    id: 'cards_big_winner',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.CARD_GAME],
    weight: 10,
    title: 'Большой проигрыш заезжего барина',
    body: 'У {name} заезжий барин просадил всё за вечер — заведению досталось {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.12, max: 0.20 },
  },
  {
    id: 'cards_voevoda_close',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.CARD_GAME],
    weight: 7,
    title: 'Воевода грозился прикрыть заведение',
    body: 'У {name} были разговоры о закрытии — отдали мзду {amount} ₽, кое-как замяли.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.05 },
  },

  // ── ПОИСК КЛАДА (TREASURE_HUNT) ────────────────────────────────────────────

  {
    id: 'treasure_lost',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    weight: 10,
    title: 'Заблудились в дремучей чаще',
    body: 'Артель {name} неделю плутала в лесу — припасы съели, расходы {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.05 },
  },
  {
    id: 'treasure_old_hoard',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    weight: 9,
    title: 'Нашли старый клад под корнями',
    body: 'У {name} под старым дубом откопали клад с серебром — +{amount} ₽ в казну.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.14, max: 0.22 },
  },
  {
    id: 'treasure_beasts',
    kind: 'NEGATIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    weight: 7,
    title: 'Дикие звери разогнали артель',
    body: 'Медведь забрёл в лагерь {name} — народ разбежался, бросив снаряжение на {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: -0.10, max: -0.05 },
  },
  {
    id: 'treasure_old_map',
    kind: 'POSITIVE',
    applicableTo: [ProjectType.TREASURE_HUNT],
    weight: 8,
    title: 'Старая карта раскрыла новое место',
    body: 'У {name} нашлась карта с пометкой — пошли разведать, добыли на {amount} ₽.',
    effect: { type: 'VALUE_DELTA_PERCENT', min: 0.08, max: 0.15 },
  },
]

/**
 * Выбирает случайное событие для проекта с учётом типа дела и судьбы.
 * Возвращает null, если кубик за событие не выпал ИЛИ кандидатов нет.
 *
 * Кандидаты: события где `applicableTo` включает тип дела (или 'ALL'),
 * И для INSTANT_SCAM — только POSITIVE/NEUTRAL (скам молчит, не разоблачаем).
 *
 * Вес каждого кандидата: `weight * (fateBias.includes(fate) ? 3 : 1)`.
 */
export function pickRandomEvent(
  type: ProjectType,
  fate: ProjectFate,
  rngFn: () => number = Math.random,
): RandomEvent | null {
  // Базовый шанс события: рандом в диапазоне 15-25% — достаточно редко,
  // чтобы событие ощущалось важным, не каждодневной рутиной.
  const chance = EVENT_CHANCE_MIN + rngFn() * (EVENT_CHANCE_MAX - EVENT_CHANCE_MIN)
  if (rngFn() >= chance) return null

  const candidates = RANDOM_EVENTS.filter(e => {
    if (e.applicableTo !== 'ALL' && !e.applicableTo.includes(type)) return false
    // INSTANT_SCAM не получает негативных событий — иначе раскроется раньше времени.
    // Зато заманивающие позитивы и нейтрал'ы помогают «маскировке».
    if (fate === ProjectFate.INSTANT_SCAM && e.kind === 'NEGATIVE') return false
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

/** Применяет эффект события к currentValueRubles. Возвращает новое значение и абсолютную дельту в рублях. */
export function applyEventEffect(
  currentValue: number,
  effect: EventEffect,
  rngFn: () => number = Math.random,
): { newValue: number; deltaRubles: number; percent: number } {
  if (effect.type === 'NONE') {
    return { newValue: currentValue, deltaRubles: 0, percent: 0 }
  }
  // VALUE_DELTA_PERCENT
  const percent = effect.min + rngFn() * (effect.max - effect.min)
  const delta = currentValue * percent
  const newValue = Math.max(0, currentValue + delta)
  return { newValue, deltaRubles: delta, percent }
}
