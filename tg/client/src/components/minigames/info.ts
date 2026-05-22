// Справочник мини-игр по архетипам: имя для шапки экрана + подсказка интро + текст кнопки.
// Используется в IntroScreen для не-BOYARIN, в заголовке CharterPage и в phaseCaption.
//
// Тексты живут в i18n (RU + EN под ключом `minigame.<ARCHETYPE>`). Старый
// `MINIGAME_INFO` оставлен для обратной совместимости и используется только
// как fallback, если t не передан.

import type { Translations } from '@/i18n'

export interface MiniGameInfo {
  name: string         // отображается в шапке (заменяет «Купеческая грамота»)
  hint: string         // подсказка на интро-экране перед запуском
  startBtn: string     // текст кнопки запуска
}

const ARCHETYPES = ['BOYARIN', 'BURATINO', 'KOSCHEI', 'KOLOBOK', 'ZOLUSHKA', 'BABA_YAGA', 'IVAN_DURAK'] as const
type Archetype = typeof ARCHETYPES[number]

export const MINIGAME_INFO: Record<string, MiniGameInfo> = {
  BOYARIN: {
    name: 'Купеческая грамота',
    hint: 'Хозяин покажет 24 печати. Запомни эталон, потом найди подделки. 15 секунд. 0 ошибок — раскроется намёк о деле; 1 ошибка — увидишь тип и посул; ≥2 — вложиться можно только за звёзды.',
    startBtn: 'Принять испытание →',
  },
  BURATINO: {
    name: 'Золотой ключик',
    hint: 'Буратино покажет ключ-образец на 10 секунд. Затем найди в точности такой же среди 7 ключей за 10 секунд.',
    startBtn: 'Принять испытание →',
  },
  KOSCHEI: {
    name: 'Память Кощея',
    hint: '12 карт лицом вниз. Открывай по две и собирай 6 пар: дуб, сундук, заяц, утка, яйцо, игла. 20 секунд на всё. Соберёшь все пары — раскроется совет чуйки; не успеешь — только за звёзды.',
    startBtn: 'Принять испытание →',
  },
  KOLOBOK: {
    name: 'Нора-нора-нора',
    hint: 'Из норок выскакивают зверушки (+1) и Колобок (−3). 15 секунд. 7 баллов — пройти, 12 — раскрыть совет чуйки.',
    startBtn: 'Принять испытание →',
  },
  ZOLUSHKA: {
    name: 'Золушкино счастье',
    hint: 'Запомни эталонную монету (5 сек), потом лови её среди падающих. Настоящая +1, подделка −2. 20 секунд. 6 — пройти, 10 — раскрыть совет чуйки.',
    startBtn: 'Принять испытание →',
  },
  BABA_YAGA: {
    name: 'Котёл Бабы Яги',
    hint: 'Запомни рецепт из 5 ингредиентов (6 секунд). Бросай их в котёл по порядку. Тапнул не тот — ошибка засчитана, но шаг остаётся, выбирай заново. 20 секунд на всё. 0 ошибок — совет чуйки; 1 — пройдёшь без подсказок; ≥2 — только за звёзды.',
    startBtn: 'Принять испытание →',
  },
  IVAN_DURAK: {
    name: 'Переводной дурак',
    hint: 'У тебя в руке всегда 7 карт. Иван открывает одну — у тебя такая же есть, тапай. На каждый ход 2 секунды, карты перетасовываются. Всего 7 ходов. 0 ошибок — совет чуйки; 1 — пройдёшь без подсказок; ≥2 — только за звёзды.',
    startBtn: 'Принять испытание →',
  },
}

/** Получает локализованный MiniGameInfo. Если архетип неизвестен или t.minigame
 *  ещё не подгружен — возвращает значение из MINIGAME_INFO (RU fallback). */
export function getMiniGameInfo(archetype: string, t: Translations): MiniGameInfo | undefined {
  if (!(ARCHETYPES as readonly string[]).includes(archetype)) return undefined
  const localized = (t.minigame as Record<Archetype, MiniGameInfo> | undefined)?.[archetype as Archetype]
  return localized ?? MINIGAME_INFO[archetype]
}

export function isMiniGameArchetype(archetype: string | undefined | null): boolean {
  return !!archetype && archetype in MINIGAME_INFO
}
