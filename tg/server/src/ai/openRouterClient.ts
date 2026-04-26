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
      'я тут на Поле Чудес рубли закопал — а к утру дерево с монетами выросло, вот те крест!',
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
      'не обещаю сказочных богатств. Обещаю что не убегу с твоими рублями.',
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
  claimedAPY: number
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


export async function generateProjectData(input: GenerateProjectInput, model = DEFAULT_MODEL): Promise<GeneratedProjectData> {
  const { type, archetype, lieTopics } = input
  const typeName = PROJECT_TYPE_RU[type]
  const liesStr = lieTopics.map(t => `${LIE_TOPIC_EMOJI[t]} ${LIE_TOPIC_LABEL[t]}`).join(', ')

  const prompt = `Ты придумываешь новое дело для игры «Из грязи в князи» — симулятора купца-инвестора в сказочной Руси.

Тип дела: ${typeName}
Архетип хозяина: ${PERSONA_LABEL[archetype] ?? archetype}
Темы, по которым хозяин ВРЁТ (игрок должен их угадать): ${liesStr}

Придумай:
1. name — название дела (2–4 слова, сказочный стиль, на русском)
2. developerName — имя хозяина с прозвищем или фамилией в народном стиле (ОБЯЗАТЕЛЬНО 2–3 слова: имя + прозвище или фамилия-прилагательное). Примеры: "Емеля Дурило", "Фёдор Казна-Цела", "Никита Золотозуб", "Вахромей Трепетило", "Гаврила Хитрован", "Пётр Кривошей", "Аника-воин", "Степан Ловкач-Рублёв". Имя должно быть колоритным и запоминающимся.
3. claimedAPY — заявленная доходность в % годовых (число от 50 до 5000, чем мошеннее — тем выше)
4. description — описание дела (3–4 предложения, от первого лица хозяина, без блокчейна/крипты, только рубли)
5. roadmap — план дел (ровно 3 пункта, массив строк)

Отвечай ТОЛЬКО валидным JSON без пояснений:
{"name":"...","developerName":"...","claimedAPY":...,"description":"...","roadmap":["...","...","..."]}`

  try {
    console.log(`[AI:project] model=${model}`)
    // reasoning: { enabled: false } — DeepSeek V4 MoE по умолчанию много думает,
    // и при max_tokens=300 output обрезался прямо посреди JSON
    // (finish_reason=length). Для коротких JSON-задач рассуждения не нужны.
    const response = await client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
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

    return {
      name: parsed.name ?? 'Тайное дело',
      developerName: parsed.developerName ?? 'Ефим Лукавый',
      claimedName: parsed.name ?? 'Тайное дело',
      claimedAPY: Number(parsed.claimedAPY) || 100,
      description: parsed.description ?? 'Прибыльное дело для смелых вкладчиков.',
      roadmap: parsed.roadmap ?? ['Открыть дело', 'Собрать рубли', 'Распределить прибыль'],
    }
  } catch (err) {
    console.error('generateProjectData failed:', err)
    return {
      name: 'Тайное дело',
      developerName: 'Ефим Лукавый',
      claimedName: 'Тайное дело',
      claimedAPY: 200,
      description: 'Прибыльное дело для смелых вкладчиков.',
      roadmap: ['Открыть дело', 'Собрать рубли', 'Распределить прибыль'],
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

/** Детерминированный вариант 1–5 из projectId */
function bannerVariant(projectId: string): number {
  const hash = parseInt(projectId.replace(/-/g, '').slice(-8), 16)
  return (hash % 5) + 1
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
}

function buildAmaSystemPrompt(input: AmaSessionInput | SendAmaMessageInput, questionNumber = 1): string {
  const { archetype, developerName, projectName } = input
  const persona = PERSONA_MAP.get(archetype)

  const phrases = persona
    ? persona.typicalPhrasesTemplate
        .map(p => `- ${p.replace('{name}', projectName)}`)
        .join('\n')
    : ''

  const speechStyle = persona?.speechStyle ?? 'Говори живым современным русским языком.'
  const favoriteTopics = persona?.favoriteTopics ?? ''

  return `Ты играешь роль в текстовой игре «Из грязи в князи» — сказочная Русь, болтовня с дельцом для развлечения. Это НЕ допрос — это балагур-беседа. Игрок может спрашивать о чём угодно: о тебе, о деле, о жизни, попросить байку.

Твой персонаж: ${developerName}, хозяин дела «${projectName}». Отвечай только от его имени.

ХАРАКТЕР И МАНЕРА РЕЧИ: ${speechStyle}

ЛЮБИМЫЕ ТЕМЫ ДЛЯ БОЛТОВНИ: ${favoriteTopics}

ХАРАКТЕРНЫЕ ФРАЗЫ (используй как образец стиля, не копируй дословно):
${phrases}

ПРАВИЛА:
- Отвечай 2-3 предложения, живым современным русским. Без длинных монологов.
- Шути, рассказывай байки, привирай и хвастайся в характере персонажа — это часть твоей роли. Не нужно выдавать «правду о деле».
- Не выходи из роли. Каждый ответ начинай по-разному.
- Суммы — только в рублях. Никакой крипты, TON, блокчейна.
- Не объясняй игроку «я персонаж такой-то». Просто будь им.
- Если игрок задал странный/мета-вопрос — отшутись в характере и переведи тему на свои любимые байки.`
}

export async function startAmaSession(input: AmaSessionInput, model = DEFAULT_MODEL): Promise<string> {
  const { developerName, projectName } = input
  const systemPrompt = buildAmaSystemPrompt(input, 1)
  const firstMessagePrompt = `Поприветствуй потенциального вкладчика как ${developerName}, делец и хозяин дела «${projectName}». Расскажи кратко о деле и предложи задавать вопросы. 2–3 предложения, живой современный русский язык.`

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
    return response.choices[0]?.message?.content ?? `Здравствуй! Я ${developerName}, хозяин дела «${projectName}». Задавай вопросы!`
  } catch (err) {
    console.error('[AMA startSession] OpenRouter error:', err)
    throw err
  }
}

export async function sendAmaMessage(input: SendAmaMessageInput, model = DEFAULT_MODEL): Promise<string> {
  const systemPrompt = buildAmaSystemPrompt(input, input.questionCount)

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
): Promise<void> {
  const userCountStr = userCountDelta > 0 ? `+${userCountDelta}` : String(userCountDelta)
  const payoutStatusRu = payoutStatus === 'DELAYED' ? 'ЗАДЕРЖАНЫ' : payoutStatus === 'BOOSTED' ? 'ПОВЫШЕНЫ' : 'ОБЫЧНЫЙ'

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
  const prompt = `Ты — ведущий рубрики «Вести с ярмарки» в игре «Из грязи в князи».
Напиши короткую весть о деле «${project.name}» (день ${dayNumber}).
Архетип хозяина: ${archetypeLabel}, тип: ${project.type}, судьба: ${fateLabel}.
Изменение числа вкладчиков сегодня: ${userCountStr} чел.
Статус выплат: ${payoutStatusRu}
В тексте НЕ употребляй английские кодовые слова (BURATINO, ZOLUSHKA, INSTANT_SCAM, PATRON_COUNT и т.п.) — только русские названия.

Формат — JSON:
{
  "title": "Краткий заголовок (до 8 слов)",
  "body": "2–3 предложения, образно, современный русский, без крипты/блокчейна, только рубли. Отрази изменение вкладчиков и статус выплат в тексте.",
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

export async function generatePostMortem(input: PostMortemInput, model = DEFAULT_MODEL): Promise<void> {
  const { projectId, userId, archetype, fate, lieTopics, investedAmount, returnedAmount, profitPercent, daysActive, intuitionDelta } = input

  const liesStr = lieTopics.map(t => LIE_TOPIC_LABEL[t as LieTopic] ?? t).join(', ')
  const archetypeLabel = PERSONA_LABEL[archetype as PersonaArchetype] ?? archetype
  const fateLabel = FATE_LABEL[fate as ProjectFate] ?? fate

  const prompt = `Ты — летописец игры «Из грязи в князи». Напиши разбор закрытого дела.

Архетип хозяина: ${archetypeLabel}
Судьба: ${fateLabel}
Темы лжи: ${liesStr || 'нет'}
Вложено: ${investedAmount.toFixed(0)} ₽, получено обратно: ${returnedAmount.toFixed(0)} ₽ (${profitPercent.toFixed(1)}%)
Дней в деле: ${daysActive}

Напиши 3–4 предложения: раскрой архетип, объясни что произошло, дай урок для будущих вложений. В тексте употребляй именно русское имя архетипа («${archetypeLabel}»), а не код. Современный русский, без крипты, без английских слов, без markdown-звёздочек.`

  try {
    console.log(`[AI:postmortem] model=${model} projectId=${projectId}`)
    const response = await client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      reasoning: { enabled: false },
    } as any)

    const analysis = response.choices[0]?.message?.content ?? 'Дело закрылось.'

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
