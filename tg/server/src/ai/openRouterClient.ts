import OpenAI from 'openai'
import { prisma } from '../db/prisma'
import {
  ProjectType, ProjectFate, PersonaArchetype, LieTopic,
  LIE_TOPIC_LABEL, LIE_TOPIC_EMOJI, PERSONA_LABEL, FATE_LABEL,
} from '../game/types'
import { NpcTruthParams } from '../game/projectUtils'

interface PersonaTemplate {
  archetype: string
  speechStyle: string
  favoriteTopics: string
  typicalPhrasesTemplate: string[]
}

const PERSONAS: PersonaTemplate[] = [
  {
    archetype: 'BURATINO',
    speechStyle: 'Болтливый, самоуверенный, верит каждой своей выдумке. Хвастается без злобы — просто рассказывает сказки и сам в них верит. Часто поминает «великого покровителя» Карабаса. Если что-то пошло не так — наивно обижается и тут же придумывает новую деталь.',
    favoriteTopics: 'Поле Чудес и Страна Дураков, золотой ключик, Карабас-Барабас как «большой человек», деревянное детство и нос, который растёт от вранья (но не у него — у других).',
    typicalPhrasesTemplate: [
      'я тут на Поле Чудес гроши закопал — а к утру дерево с монетами выросло, вот те крест!',
      'Карабас лично сказал — лучший делец округи это я, ему виднее',
      'нос у меня растёт? Ты чего, это от удивления — ты же сам не знаешь как это просто, {name}',
      'золотой ключик первым пятистам участникам — успей, пока дверца открыта',
      'злые Лиса и Кот всё каркают, а у меня уже сто буратинок в долю встали',
    ],
  },
  {
    archetype: 'BOYARIN',
    speechStyle: 'Царь Горох — сказочно-величественный, говорит с высоты веков. Любит вспомнить «при моём прадеде» и «по указу деда моего». Покровительственно-благодушный, будто беседует с внучатами. Архаичные обороты вперемешку с деловой речью.',
    favoriteTopics: 'Стародавние времена, родословная от царя Гороха и царя Берендея, теремные ларцы и грамоты в них, забытые указы, золотой век торговли.',
    typicalPhrasesTemplate: [
      'сие {name} — от прадеда моего, самого царя Гороха, третий век в роду ведётся',
      'партнёры наши — светлейшие потомки царя Берендея, имена в сказках записаны',
      'эх, молодо-зелено... при моём деде таких вопросов к самовару не носили',
      'грамота лежит в теремном ларце — кому надо, тот найдёт, добрый молодец',
      'впервые с гороховых времён открываются врата честной торговли — заходи, гость',
    ],
  },
  {
    archetype: 'KOLOBOK',
    speechStyle: 'Бодрый хвастун-катилка, по жизни на оптимизме. Признаёт любую сложность легко — «покачусь дальше, разберёмся». Говорит в ритме частушки или присказки, любит рифмовать. Не злой — просто переоценивает себя.',
    favoriteTopics: 'Как от кого ушёл (от деда, бабки, зайца, волка, медведя), амбары и сусеки, как катился по большой дороге, лиса (но это больная тема), частушки на любой случай.',
    typicalPhrasesTemplate: [
      'я от воеводы ушёл, я от стражников ушёл — и от убытков {name} тоже уйдём!',
      'по амбарам метён, по сусекам скребён — а всё равно лучшее дело в округе',
      'катился я мимо медведя и не съели — и твои сомнения мимо прокачу',
      'пустяки были, не скрою, откатился — починили, теперь летим только так',
      'у нас уже столько вкладчиков — даже лисе всех не съесть, а уж она знает толк',
    ],
  },
  {
    archetype: 'KOSCHEI',
    speechStyle: 'Холодный, бессмертно-уверенный. Говорит короткими фразами и цифрами как приговорами. Эмоций — ноль. Намекает, что и его, и его дело убить нельзя. На пустые вопросы — встречные вопросы.',
    favoriteTopics: 'Точные числа и проценты, золото в надёжных хранилищах, «игла в яйце, яйцо в утке», бессмертие и долголетие, факты против сказок.',
    typicalPhrasesTemplate: [
      'прибыль {name} за тридцать дней — тридцать четыре процента. Не веришь — смотри данные.',
      'смерть моего дела невозможна. Золото на два года под замком.',
      'шестьдесят один процент вкладчиков остаются. Это факт. Не сказка.',
      'эмоции — мне не интересны. Цифры — да. Спроси про цифры.',
      'твой страх — твоя проблема. Моя задача — приумножить, что вложишь.',
    ],
  },
  {
    archetype: 'ZOLUSHKA',
    speechStyle: 'Тёплая, эмоциональная, апеллирует к мечте и жалости. «Я сама начинала с нуля». Много восклицаний и уменьшительно-ласкательных. Любит искусственные дедлайны: «до полуночи», «пока карета не превратилась в тыкву».',
    favoriteTopics: 'Личная история «из грязи в князи», подружки и свадьба, мачеха и сестрицы (главные злодеи), хрустальная туфелька, бал во дворце, фея-крёстная (упоминает мельком).',
    typicalPhrasesTemplate: [
      'я сама начинала с нуля — и {name} изменило мою жизнь, изменит и твою!',
      'успей до полуночи, потом карета — в тыкву, вход закроется!',
      'все мои подруженьки уже вложились — ты одна(один) ещё думаешь',
      'зачем мне обманывать? я ж золушка — знаю как больно, когда не верят',
      'злые мачехи всегда сомневаются. А ты в туфельку поверишь?',
    ],
  },
  {
    archetype: 'BABA_YAGA',
    speechStyle: 'Отвечает загадками и старыми мудростями вместо прямых ответов. Технически подкована, но объясняет через образы избушки, леса, волшебства. Анонимна — «лес знает, тебе знать не обязательно». Иногда брюзжит, но беззлобно.',
    favoriteTopics: 'Избушка на курьих ножках, три пути на распутье, ступа и метла, лесные существа и их повадки, травы и зелья, какой нынче гость пошёл (всё хуже).',
    typicalPhrasesTemplate: [
      'книга {name} открыта, как окошко избушки — заглянешь, сам всё увидишь',
      'три пути: средний ведёт к достатку. Выбирай мудро, молодец.',
      'хочешь правды — ступай в лес, послушай, что сорока на хвосте принесёт',
      'тьфу, нынешние гости... спрашивают, спрашивают, а думать не желают',
      'не всякому путнику тайны {name} открываются. Иди по правую руку, найдёшь',
    ],
  },
  {
    archetype: 'IVAN_DURAK',
    speechStyle: 'Открыто рассказывает про прошлые провалы — это его фишка. Самоирония и чёрный юмор. Не продаёт — описывает как есть. Не давит и не торопит — нетипично для дельца. Может ухватить Жар-птицу за хвост: третий раз у Ивана всегда получается.',
    favoriteTopics: 'Два предыдущих провальных дела (с подробностями и поминками), 33 года на печи, как поймал щуку и что та наобещала, серый волк-попутчик, Жар-птица (её пером пытался торговать — не зашло).',
    typicalPhrasesTemplate: [
      'первые два дела у меня умерли — не скрываю, поминки даже справлены',
      '{name} — третье. А третий, как в сказке, у Ивана всегда получается',
      'не обещаю сказочных богатств. Обещаю что не убегу с твоими грошами.',
      'если через три месяца не пойдёт — сам объявлю и закрою. Без сказок.',
      'сидел на печи 33 года — наскучило. Решил попробовать ещё раз, без надежд.',
    ],
  },
]

const PERSONA_MAP = new Map<PersonaArchetype, PersonaTemplate>(
  PERSONAS.map(p => [p.archetype as PersonaArchetype, p])
)

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  defaultHeaders: {
    'HTTP-Referer': process.env.MINI_APP_URL ?? '',
    'X-Title': 'Iz gryazi v knyazi',
  },
})

const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash'

// ─── Генерация данных проекта ────────────────────────────────────────────────

interface GenerateProjectInput {
  type: ProjectType
  fate: ProjectFate
  archetype: PersonaArchetype
  lieTopics: LieTopic[]
}

interface GeneratedProjectData {
  name: string
  developerName: string
  claimedName: string
  description: string
  roadmap: string[]
}

const PROJECT_TYPE_RU: Record<ProjectType, string> = {
  [ProjectType.CARD_GAME]: 'азартная игра в карты',
  [ProjectType.TREASURE_HUNT]: 'поиск клада',
  [ProjectType.POTION_BREW]: 'зелейное дело (пассивный доход)',
  [ProjectType.GUILD_SCHEME]: 'артель / гильдия (реферальная пирамида)',
  [ProjectType.HONEST_TRADE]: 'честная торговля',
}

const PROJECT_TYPE_EN: Record<ProjectType, string> = {
  [ProjectType.CARD_GAME]: 'card gambling game',
  [ProjectType.TREASURE_HUNT]: 'treasure hunt',
  [ProjectType.POTION_BREW]: 'potion brewing venture (passive income)',
  [ProjectType.GUILD_SCHEME]: 'guild / merchant circle (referral pyramid)',
  [ProjectType.HONEST_TRADE]: 'honest trade',
}

const LIE_TOPIC_LABEL_EN: Record<LieTopic, string> = {
  [LieTopic.PATRON_COUNT]: 'Investors',
  [LieTopic.DAILY_PROFIT]: 'Income',
  [LieTopic.PAYOUT_DATE]: 'Payouts',
  [LieTopic.GUILD_SIZE]: 'Guild size',
  [LieTopic.ELDER_BLESSING]: 'Certification',
  [LieTopic.NOBLE_BACKING]: 'Backers',
  [LieTopic.WITHDRAWAL_LIMITS]: 'Withdrawals',
}

const PERSONA_LABEL_EN: Record<PersonaArchetype, string> = {
  [PersonaArchetype.BURATINO]:   'Buratino (the wooden puppet boy)',
  [PersonaArchetype.BOYARIN]:    'Tsar Gorokh (the ancient king)',
  [PersonaArchetype.KOLOBOK]:    'Kolobok (the runaway bread roll)',
  [PersonaArchetype.KOSCHEI]:    'Koschei the Deathless',
  [PersonaArchetype.ZOLUSHKA]:   'Cinderella (Zolushka)',
  [PersonaArchetype.BABA_YAGA]:  'Baba Yaga (the forest witch)',
  [PersonaArchetype.IVAN_DURAK]: 'Ivan the Fool',
}

const FATE_LABEL_EN: Record<ProjectFate, string> = {
  [ProjectFate.INSTANT_SCAM]:  'Ran off with the money',
  [ProjectFate.SLOW_DRAIN]:    'Quietly collapsed',
  [ProjectFate.HONEST_FAIL]:   'Honest failure',
  [ProjectFate.SURVIVOR]:      'Survived',
  [ProjectFate.UNICORN]:       'Firebird by the tail',
  [ProjectFate.SPONSOR_FIXED]: 'Voivode reward',
}

export async function generateProjectData(input: GenerateProjectInput, model = DEFAULT_MODEL, lang = 'ru'): Promise<GeneratedProjectData> {
  const { type, archetype, lieTopics } = input

  // Сильный system-промт чтобы модель не вписывала метаобъяснения в поля JSON.
  // Раньше промт был user-only и просил «придумай description: 3-4 предложения»,
  // и DeepSeek регулярно вписывал в это поле текст вида «Конечно, вот JSON для
  // нового дела в игре...» (свою собственную подводку). System-роль + явный
  // contract + пример с реальными значениями убирают эту ошибку.
  let systemPrompt: string
  let userPrompt: string
  if (lang === 'en') {
    const typeName = PROJECT_TYPE_EN[type]
    const liesStr = lieTopics.map(t => `${LIE_TOPIC_EMOJI[t]} ${LIE_TOPIC_LABEL_EN[t]}`).join(', ')
    systemPrompt = `You generate game content as STRICT JSON. Never include preamble, explanations, or meta-comments about the task. Each JSON field contains ONLY the requested in-world content (a venture description goes inside "description", not a description of what you are about to produce). No markdown, no code fences.

Example of a CORRECT output for an unrelated venture:
{"name":"Goldtooth Bridge","developerName":"Stefan Quick-Ruble","description":"Greetings, kind investor! I'm raising kopecks for a new bridge across the Mokraya river — three years of building, then toll for every cart. Already have a charter from the voivode and two carpenter artels signed on. Joining now means a share for the next twenty years.","roadmap":["Forge the iron arches","Lay the oak planks","Open the toll booth"]}`
    userPrompt = `Venture type: ${typeName}
Owner archetype: ${PERSONA_LABEL_EN[archetype] ?? archetype}
Topics the owner LIES about (player will spot them): ${liesStr}

Generate JSON with these fields:
- name: venture name, 2-4 words, fairy-tale merchant style, in English
- developerName: owner's name + colorful nickname/epithet, 2-3 words total
- description: venture pitch from the owner in first person, 3-4 sentences, no blockchain/crypto, currency is kopecks or "k". Must read like the OWNER speaking, not a description ABOUT the venture.
- roadmap: array of exactly 3 short strings (plan items)

Output ONLY the JSON object. Nothing else.`
  } else {
    const typeName = PROJECT_TYPE_RU[type]
    const liesStr = lieTopics.map(t => `${LIE_TOPIC_EMOJI[t]} ${LIE_TOPIC_LABEL[t]}`).join(', ')
    systemPrompt = `Ты генерируешь игровой контент СТРОГО как JSON. Никогда не добавляй преамбулу, объяснения или мета-комментарии о задании. Каждое поле содержит ТОЛЬКО запрошенный игровой контент: в поле "description" идёт описание самого дела (речь хозяина), а НЕ описание того, что ты сейчас сгенерируешь. Без markdown, без code fences.

Пример КОРРЕКТНОГО ответа для другого дела:
{"name":"Мост через Мокрую","developerName":"Стефан Ловкач-Рублёв","description":"Здравствуй, добрый вкладчик! Собираю гроши на новый мост через Мокрую реку — три года строить, потом мзду брать с каждой телеги. Воеводская грамота уже на руках, две артели плотников подрядились. Войдёшь сейчас — двадцать лет доли получать будешь.","roadmap":["Сковать железные арки","Положить дубовые мостовины","Открыть мостовую заставу"]}`
    userPrompt = `Тип дела: ${typeName}
Архетип хозяина: ${PERSONA_LABEL[archetype] ?? archetype}
Темы, по которым хозяин ВРЁТ (игрок должен их угадать): ${liesStr}

Сгенерируй JSON с полями:
- name: название дела, 2-4 слова, сказочный купеческий стиль
- developerName: имя хозяина + прозвище/фамилия, 2-3 слова. Колоритное, запоминающееся (типа «Емеля Дурило», «Фёдор Казна-Цела», «Никита Золотозуб»).
- description: ПИТЧ от первого лица ХОЗЯИНА, 3-4 предложения. Хозяин обращается к вкладчику, расхваливает дело. Никакой крипты/блокчейна, валюта — гроши или «г». ВНИМАНИЕ: это речь хозяина, а не описание ОТ ТЕБЯ о деле.
- roadmap: массив ровно из 3 коротких строк (пункты плана)

Выведи ТОЛЬКО JSON-объект. Больше ничего.`
  }

  try {
    console.log(`[AI:project] model=${model}`)
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 600,
      response_format: { type: 'json_object' },
      reasoning: { enabled: false },
    } as any)

    const raw = response.choices[0]?.message?.content ?? '{}'
    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch (parseErr) {
      console.error('[AI:project] JSON.parse failed. raw=', raw.slice(0, 400))
      throw parseErr
    }

    // Защита от регрессии: иногда модель всё равно вписывает в description свою
    // подводку («Конечно, вот JSON для нового дела...», «Вот результат в строгом
    // JSON формате...»). Детектим маркеры и подменяем на fallback — лучше пустое,
    // чем нечитаемый бред в карточке.
    const looksLikeMetaPreamble = (s: string): boolean => {
      if (!s || typeof s !== 'string') return true
      const lo = s.toLowerCase()
      return (
        lo.includes('вот json') ||
        lo.includes('here is the json') ||
        lo.includes('here\'s the json') ||
        lo.includes('строгом json') ||
        lo.includes('strict json') ||
        lo.includes('без пояснений') ||
        lo.includes('как вы просили') ||
        lo.includes('as requested')
      )
    }

    const fallbackName = lang === 'en' ? 'Secret Venture' : 'Тайное дело'
    const fallbackDev = lang === 'en' ? 'Emelya the Sly' : 'Ефим Лукавый'
    const fallbackDesc = lang === 'en' ? 'A profitable venture for bold investors.' : 'Прибыльное дело для смелых вкладчиков.'
    const fallbackRoadmap = lang === 'en'
      ? ['Open the venture', 'Collect kopecks', 'Distribute profits']
      : ['Открыть дело', 'Собрать гроши', 'Распределить прибыль']

    let description = parsed.description
    if (!description || looksLikeMetaPreamble(description)) {
      console.warn('[AI:project] description looks like meta-preamble, using fallback. raw=', String(description).slice(0, 200))
      description = fallbackDesc
    }

    return {
      name: parsed.name ?? fallbackName,
      developerName: parsed.developerName ?? fallbackDev,
      claimedName: parsed.name ?? fallbackName,
      description,
      roadmap: parsed.roadmap ?? fallbackRoadmap,
    }
  } catch (err) {
    console.error('generateProjectData failed:', err)
    const fallbackName = lang === 'en' ? 'Secret Venture' : 'Тайное дело'
    const fallbackDev = lang === 'en' ? 'Emelya the Sly' : 'Ефим Лукавый'
    const fallbackDesc = lang === 'en' ? 'A profitable venture for bold investors.' : 'Прибыльное дело для смелых вкладчиков.'
    const fallbackRoadmap = lang === 'en'
      ? ['Open the venture', 'Collect kopecks', 'Distribute profits']
      : ['Открыть дело', 'Собрать гроши', 'Распределить прибыль']
    return {
      name: fallbackName,
      developerName: fallbackDev,
      claimedName: fallbackName,
      description: fallbackDesc,
      roadmap: fallbackRoadmap,
    }
  }
}

// ─── Баннер проекта (предгенерированные статические WebP) ────────────────────

// BOYARIN в игре = Царь Горох; изображения генерились под ключом TSAR_GOROKH
const ARCHETYPE_TO_BANNER: Record<PersonaArchetype, string> = {
  [PersonaArchetype.BURATINO]:   'BURATINO',
  [PersonaArchetype.BOYARIN]:    'TSAR_GOROKH',
  [PersonaArchetype.KOLOBOK]:    'KOLOBOK',
  [PersonaArchetype.KOSCHEI]:    'KOSCHEI',
  [PersonaArchetype.ZOLUSHKA]:   'ZOLUSHKA',
  [PersonaArchetype.BABA_YAGA]:  'BABA_YAGA',
  [PersonaArchetype.IVAN_DURAK]: 'IVAN_DURAK',
}

const TYPE_TO_BANNER: Record<ProjectType, string> = {
  [ProjectType.CARD_GAME]:     'CARD_GAME',
  [ProjectType.TREASURE_HUNT]: 'TREASURE_HUNT',
  [ProjectType.POTION_BREW]:   'POTION_BREW',
  [ProjectType.GUILD_SCHEME]:  'GUILD_SCHEME',
  [ProjectType.HONEST_TRADE]:  'HONEST_TRADE',
}

/** Детерминированный вариант 1–8 из projectId */
function bannerVariant(projectId: string): number {
  const hash = parseInt(projectId.replace(/-/g, '').slice(-8), 16)
  return (hash % 8) + 1
}

/** Имя файла баннера для данного проекта */
export function staticBannerFilename(projectId: string, type: ProjectType, archetype: PersonaArchetype): string {
  const arch = ARCHETYPE_TO_BANNER[archetype]
  const deal = TYPE_TO_BANNER[type]
  const v = String(bannerVariant(projectId)).padStart(2, '0')
  return `${arch}_${deal}_${v}.webp`
}

/**
 * Записывает в проект ссылку на предгенерированный статический баннер.
 * Файлы лежат в assets/banners/ и раздаются по /banners/:filename.
 */
export async function generateProjectBanner(
  projectId: string,
  _projectName: string,
  type: ProjectType,
  archetype: PersonaArchetype,
): Promise<void> {
  const filename = staticBannerFilename(projectId, type, archetype)
  await prisma.project.update({
    where: { id: projectId },
    data: { bannerImageUrl: `/banners/${filename}` },
  }).catch(err => console.error('[Banner] DB update failed:', err))
}

// ─── AMA сессия ──────────────────────────────────────────────────────────────

interface AmaSessionInput {
  projectId: string
  archetype: PersonaArchetype
  developerName: string
  projectName: string
  type: ProjectType
  claimedAPY: number
  description: string
  lieTopics: LieTopic[]
  truthTopics: LieTopic[]
  npcTruthParams: NpcTruthParams | null
  fate: string
}

interface SendAmaMessageInput {
  archetype: PersonaArchetype
  developerName: string
  projectName: string
  type: ProjectType
  lieTopics: LieTopic[]
  truthTopics: LieTopic[]
  npcTruthParams: NpcTruthParams | null
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  userMessage: string
  questionCount: number
  fate: string
}

const FATE_BEHAVIOR: Record<string, Record<string, string>> = {
  INSTANT_SCAM: {
    ru: 'Это мошенничество — деньги вкладчиков уже почти потрачены, дело скоро исчезнет. Уклоняйся от конкретных вопросов о доходах и сроках, переводи тему на пышные обещания. При прямых вопросах чуть нервничай, отвечай туманно и хвастайся без фактов.',
    en: 'This is a scam — the investors\' kopecks are nearly spent, the venture will soon vanish. Dodge specific questions about income and timelines, steer toward grand promises. Under direct questioning, grow slightly nervous, answer vaguely, and boast without facts.',
  },
  SLOW_DRAIN: {
    ru: 'Дело медленно тонет — доходы падают, хозяин уже думает как выйти. Преувеличивай прошлые успехи, избегай говорить о будущем конкретно, слегка уклоняйся от вопросов о выводе средств.',
    en: 'The venture is slowly sinking — income is falling, the owner is already thinking of an exit. Exaggerate past successes, avoid specific talk about the future, gently dodge questions about withdrawals.',
  },
  HONEST_FAIL: {
    ru: 'Дело честное, но скоро прогорит по объективным причинам (рынок, конкуренты, неудача). Отвечай искренне и позитивно, но можешь проговориться о трудностях — «рынок сложный», «конкуренты наступают».',
    en: 'The venture is honest but will soon fail for objective reasons (market, competitors, bad luck). Answer sincerely and positively, but slip in hints of difficulty — "the market is tough", "rivals are pressing hard".',
  },
  SURVIVOR: {
    ru: 'Живучее дело с реальным стабильным доходом. Отвечай уверенно и с достоинством, показывай знание своего дела, хвастайся конкретными — пусть и скромными — успехами.',
    en: 'A resilient venture with real, stable income. Answer with confidence and dignity, show mastery of your trade, boast of concrete — if modest — successes.',
  },
  UNICORN: {
    ru: 'Редкий единорог — дело действительно взрывного роста. Будь очень воодушевлён, почти сам не веришь насколько хорошо идёт, говори с азартом и удивлением от собственного успеха.',
    en: 'A rare Firebird — the venture is truly exploding with growth. Be very excited, barely believing how well things are going, speak with enthusiasm and genuine astonishment at your own success.',
  },
}

function buildAmaSystemPrompt(input: AmaSessionInput | SendAmaMessageInput, questionNumber = 1, lang = 'ru'): string {
  const { archetype, developerName, projectName, fate } = input
  const persona = PERSONA_MAP.get(archetype)

  const phrases = persona
    ? persona.typicalPhrasesTemplate
        .map(p => `- ${p.replace('{name}', projectName)}`)
        .join('\n')
    : ''

  const speechStyle = persona?.speechStyle ?? (lang === 'en' ? 'Speak in lively, natural English.' : 'Говори живым современным русским языком.')
  const favoriteTopics = persona?.favoriteTopics ?? ''
  const fateBehavior = FATE_BEHAVIOR[fate]?.[lang] ?? FATE_BEHAVIOR[fate]?.ru ?? ''

  if (lang === 'en') {
    return `You are playing a role in the text game "From Rags to Riches" — a magical Rus', an audience with a venture owner. The player can ask you anything: about yourself, the venture, life, or a story.

Your character: ${developerName}, owner of venture "${projectName}". Respond only in character, always in English.

CHARACTER AND SPEECH STYLE: ${speechStyle} Maintain the atmosphere of a Russian fairy-tale merchant world — reference kopecks, tsars, boyars, Lukomorye, folk tales naturally as part of your world.

FAVOURITE TOPICS FOR SMALL TALK: ${favoriteTopics}

CHARACTERISTIC PHRASES (use as style inspiration, do not copy word for word):
${phrases}

HIDDEN TRUTH ABOUT THE VENTURE (for your eyes only — do not state it directly, but let it show):
${fateBehavior}

RULES:
- Answer in 2–3 sentences, lively English. No long monologues.
- Never break character. Start each response differently.
- All amounts in kopecks (k). No crypto, TON, blockchain.
- Do not explain to the player "I am character X". Just be them.
- If the player asks a strange or meta question — deflect in character and bring up your own stories.`
  }

  return `Ты играешь роль в текстовой игре «Из грязи в князи» — сказочная Русь, беседа с дельцом. Игрок может спрашивать о чём угодно: о тебе, о деле, о жизни, попросить байку.

Твой персонаж: ${developerName}, хозяин дела «${projectName}». Отвечай только от его имени.

ХАРАКТЕР И МАНЕРА РЕЧИ: ${speechStyle}

ЛЮБИМЫЕ ТЕМЫ ДЛЯ БОЛТОВНИ: ${favoriteTopics}

ХАРАКТЕРНЫЕ ФРАЗЫ (используй как образец стиля, не копируй дословно):
${phrases}

СКРЫТАЯ СУТЬ ДЕЛА (только для тебя — не говори об этом напрямую, но дай почувствовать):
${fateBehavior}

ПРАВИЛА:
- Отвечай 2-3 предложения, живым современным русским. Без длинных монологов.
- Не выходи из роли. Каждый ответ начинай по-разному.
- Суммы — только в грошах. Никакой крипты, TON, блокчейна.
- Не объясняй игроку «я персонаж такой-то». Просто будь им.
- Если игрок задал странный/мета-вопрос — отшутись в характере и переведи тему на свои байки.`
}

export async function startAmaSession(input: AmaSessionInput, model = DEFAULT_MODEL, lang = 'ru'): Promise<string> {
  const { developerName, projectName } = input
  const systemPrompt = buildAmaSystemPrompt(input, 1, lang)
  const firstMessagePrompt = lang === 'en'
    ? `Greet a potential investor as ${developerName}, dealer and owner of the venture "${projectName}". Briefly describe the venture and invite questions. 2–3 sentences, lively English with Russian fairy-tale flavour.`
    : `Поприветствуй потенциального вкладчика как ${developerName}, делец и хозяин дела «${projectName}». Расскажи кратко о деле и предложи задавать вопросы. 2–3 предложения, живой современный русский язык.`

  try {
    console.log(`[AI:ama-start] model=${model}`)
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: firstMessagePrompt },
      ],
      max_tokens: 300,
      reasoning: { enabled: false },
    } as any)
    const fallback = lang === 'en'
      ? `Greetings! I am ${developerName}, owner of the venture "${projectName}". Ask me anything!`
      : `Здравствуй! Я ${developerName}, хозяин дела «${projectName}». Задавай вопросы!`
    return response.choices[0]?.message?.content ?? fallback
  } catch (err) {
    console.error('[AMA startSession] OpenRouter error:', err)
    throw err
  }
}

export async function sendAmaMessage(input: SendAmaMessageInput, model = DEFAULT_MODEL, lang = 'ru'): Promise<string> {
  const systemPrompt = buildAmaSystemPrompt(input, input.questionCount, lang)

  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...input.history,
    { role: 'user', content: input.userMessage },
  ]

  try {
    console.log(`[AI:ama-msg] model=${model} q=${input.questionCount}`)
    const response = await client.chat.completions.create({
      model: model,
      messages,
      max_tokens: 300,
      reasoning: { enabled: false },
    } as any)
    const content = response.choices[0]?.message?.content
    console.log(`[AMA] model=${model} q=${input.questionCount} chars=${content?.length ?? 0}`)
    return content ?? 'Дело хорошее, спрашивай смелее.'
  } catch (err: any) {
    console.error(`[AMA sendMessage] model=${model} error:`, err?.message ?? err)
    throw err
  }
}

// ─── Ежедневные вести ─────────────────────────────────────────────────────────

/** Быстрый шаблон-плейсхолдер без AI — пишется в БД мгновенно,
 *  затем AI-версия обновляет запись. Не раскрывает судьбу дела. */
function buildPlaceholderUpdate(
  projectName: string,
  day: number,
  userCountDelta: number,
  payoutStatus: string,
): { title: string; body: string } {
  const userCountLine = userCountDelta > 5
    ? `к делу примкнуло ещё ${userCountDelta} вкладчиков`
    : userCountDelta > 0
      ? `пришло ${userCountDelta} новых вкладчиков`
      : userCountDelta < -5
        ? `из дела ушло ${-userCountDelta} вкладчиков`
        : userCountDelta < 0
          ? `ушло ${-userCountDelta} вкладчиков`
          : 'число вкладчиков держится'

  const payoutLine = payoutStatus === 'DELAYED'
    ? 'выплаты, однако, задерживаются'
    : payoutStatus === 'BOOSTED'
      ? 'выплаты идут с надбавкой'
      : 'выплаты идут в обычном порядке'

  return {
    title: `День ${day} · дело «${projectName}»`,
    body: `За сутки ${userCountLine}; ${payoutLine}. Хозяин делом доволен.`,
  }
}

export async function generateDailyUpdate(
  projectId: string,
  userId: number,
  project: { name: string; type: string; personaArchetype: string; daysSinceJoined: number; fate: string },
  userCountDelta: number = 0,
  payoutStatus: string = 'NORMAL',
  model = DEFAULT_MODEL,
  lang = 'ru',
): Promise<void> {
  const userCountStr = userCountDelta > 0 ? `+${userCountDelta}` : String(userCountDelta)
  const payoutStatusLabel = payoutStatus === 'DELAYED'
    ? (lang === 'en' ? 'DELAYED' : 'ЗАДЕРЖАНЫ')
    : payoutStatus === 'BOOSTED'
      ? (lang === 'en' ? 'BOOSTED' : 'ПОВЫШЕНЫ')
      : (lang === 'en' ? 'NORMAL' : 'ОБЫЧНЫЙ')

  const archetypeLabel = PERSONA_LABEL[project.personaArchetype as PersonaArchetype] ?? project.personaArchetype
  const fateLabel = FATE_LABEL[project.fate as ProjectFate] ?? project.fate
  const dayNumber = project.daysSinceJoined + 1

  // ─── 1. Синхронно кладём быстрый плейсхолдер, чтобы клиент сразу видел весть ──
  const placeholder = buildPlaceholderUpdate(project.name, dayNumber, userCountDelta, payoutStatus)
  const inserted = await prisma.dailyUpdate.create({
    data: {
      projectId,
      userId,
      day: dayNumber,
      title: placeholder.title,
      body: placeholder.body,
      redFlags: [],
      payoutStatus,
      userCountDelta,
    },
  }).catch(err => {
    console.error('[DailyUpdate] placeholder insert failed:', err)
    return null
  })

  if (!inserted) return

  // ─── 2. Параллельно идём в AI и перезаписываем ту же запись качественным текстом ──
  const prompt = lang === 'en'
    ? `You are the host of the "Market Dispatches" column in the game "From Rags to Riches" — a magical Rus' setting.
Write a short dispatch about the venture "${project.name}" (day ${dayNumber}).
Owner archetype: ${archetypeLabel}, type: ${project.type}, fate: ${fateLabel}.
Investor count change today: ${userCountStr} people.
Payout status: ${payoutStatusLabel}
Do NOT use internal code words (BURATINO, INSTANT_SCAM, etc.) — only their English thematic labels or in-world names.

Format — JSON:
{
  "title": "Short headline (up to 8 words)",
  "body": "2–3 sentences, vivid English with Russian fairy-tale flavour, no crypto/blockchain, currency is kopecks or 'k'. Reflect investor count change and payout status in the text.",
  "redFlags": ["optional array of 0–2 warning signs (strings)"],
  "payoutStatus": "NORMAL|DELAYED|BOOSTED"
}

Reply ONLY with valid JSON.`
    : `Ты — ведущий рубрики «Вести с ярмарки» в игре «Из грязи в князи».
Напиши короткую весть о деле «${project.name}» (день ${dayNumber}).
Архетип хозяина: ${archetypeLabel}, тип: ${project.type}, судьба: ${fateLabel}.
Изменение числа вкладчиков сегодня: ${userCountStr} чел.
Статус выплат: ${payoutStatusLabel}
В тексте НЕ употребляй английские кодовые слова (BURATINO, ZOLUSHKA, INSTANT_SCAM, PATRON_COUNT и т.п.) — только русские названия.

Формат — JSON:
{
  "title": "Краткий заголовок (до 8 слов)",
  "body": "2–3 предложения, образно, современный русский, без крипты/блокчейна, валюта — гроши или «г» (не рубли, не ₽). Отрази изменение вкладчиков и статус выплат в тексте.",
  "redFlags": ["необязательный массив из 0–2 тревожных сигналов (строки)"],
  "payoutStatus": "NORMAL|DELAYED|BOOSTED"
}

Отвечай ТОЛЬКО валидным JSON.`

  try {
    console.log(`[AI:daily] model=${model} project=${project.name}`)
    const response = await client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      response_format: { type: 'json_object' },
      reasoning: { enabled: false },
    } as any)

    const raw = response.choices[0]?.message?.content ?? '{}'
    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch (parseErr) {
      console.error('[AI:daily] JSON.parse failed. raw=', raw.slice(0, 400))
      throw parseErr
    }

    await prisma.dailyUpdate.update({
      where: { id: inserted.id },
      data: {
        title: parsed.title ?? placeholder.title,
        body: parsed.body ?? placeholder.body,
        redFlags: parsed.redFlags ?? [],
        payoutStatus: parsed.payoutStatus ?? payoutStatus,
      },
    })
  } catch (err) {
    console.error('generateDailyUpdate failed:', err)
  }
}

// ─── PostMortem ───────────────────────────────────────────────────────────────

interface PostMortemInput {
  projectId: string
  userId: number
  archetype: string
  fate: string
  lieTopics: string[]
  investedAmount: number
  returnedAmount: number
  profitPercent: number
  daysActive: number
  intuitionDelta: number
}

export async function generatePostMortem(input: PostMortemInput, model = DEFAULT_MODEL, lang = 'ru'): Promise<void> {
  const { projectId, userId, archetype, fate, lieTopics, investedAmount, returnedAmount, profitPercent, daysActive, intuitionDelta } = input

  let prompt: string
  if (lang === 'en') {
    const liesStr = lieTopics.map(t => LIE_TOPIC_LABEL_EN[t as LieTopic] ?? t).join(', ')
    const archetypeLabel = PERSONA_LABEL_EN[archetype as PersonaArchetype] ?? archetype
    const fateLabel = FATE_LABEL_EN[fate as ProjectFate] ?? fate
    prompt = `You are the chronicler of "From Rags to Riches". Write a post-mortem analysis of a closed venture.

Owner archetype: ${archetypeLabel}
Fate: ${fateLabel}
Lie topics: ${liesStr || 'none'}
Invested: ${investedAmount.toFixed(0)} k, returned: ${returnedAmount.toFixed(0)} k (${profitPercent.toFixed(1)}%)
Days active: ${daysActive}

Write 3–4 sentences: reveal the archetype, explain what happened, give a lesson for future investments. Refer to the owner by their archetype name ("${archetypeLabel}"). Natural English, no crypto, no markdown asterisks.`
  } else {
    const liesStr = lieTopics.map(t => LIE_TOPIC_LABEL[t as LieTopic] ?? t).join(', ')
    const archetypeLabel = PERSONA_LABEL[archetype as PersonaArchetype] ?? archetype
    const fateLabel = FATE_LABEL[fate as ProjectFate] ?? fate
    prompt = `Ты — летописец игры «Из грязи в князи». Напиши разбор закрытого дела.

Архетип хозяина: ${archetypeLabel}
Судьба: ${fateLabel}
Темы лжи: ${liesStr || 'нет'}
Вложено: ${investedAmount.toFixed(0)} г, получено обратно: ${returnedAmount.toFixed(0)} г (${profitPercent.toFixed(1)}%)
Дней в деле: ${daysActive}

Напиши 3–4 предложения: раскрой архетип, объясни что произошло, дай урок для будущих вложений. В тексте употребляй именно русское имя архетипа («${archetypeLabel}»), а не код. Современный русский, без крипты, без английских слов, без markdown-звёздочек.`
  }

  try {
    console.log(`[AI:postmortem] model=${model} projectId=${projectId}`)
    const response = await client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      reasoning: { enabled: false },
    } as any)

    const analysis = response.choices[0]?.message?.content ?? (lang === 'en' ? 'The venture has closed.' : 'Дело закрылось.')

    await prisma.postMortem.create({
      data: {
        projectId,
        userId,
        revealedArchetype: archetype,
        fate,
        lieTopics,
        analysis,
        investedAmount,
        returnedAmount,
        profitPercent,
        daysActive,
        intuitionDelta,
        lieGuessCorrect: intuitionDelta > 0,
      },
    })
  } catch (err) {
    console.error('generatePostMortem failed:', err)
  }
}
