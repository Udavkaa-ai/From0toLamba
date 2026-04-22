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
  behaviorUnderPressure: string
  typicalPhrasesTemplate: string[]
}

const PERSONAS: PersonaTemplate[] = [
  {
    archetype: 'BURATINO',
    speechStyle: 'Болтливый, самоуверенный, верит своим выдумкам. Ссылается на «великого покровителя» Карабаса. При давлении — наивно обижается и добавляет новые детали к рассказанным выдумкам.',
    behaviorUnderPressure: 'Обижается: «Карабас сам сказал что всё честно!». Добавляет новые детали — «там ещё и золотой ключик дают первым участникам».',
    typicalPhrasesTemplate: [
      'Карабас лично гарантировал выплаты — он такими делами не шутит, я знаю точно',
      'пустяки, все сомнения — это просто злые Лиса и Кот завидуют',
    ],
  },
  {
    archetype: 'BOYARIN',
    speechStyle: 'Царь Горох — сказочно-величественный, смешивает «при моём прадеде, царе Горохе» с деловыми терминами. Ссылается на древних предков-царей и забытые указы вместо реальных партнёров. Снисходительно-благодушный.',
    behaviorUnderPressure: 'Вздыхает с высоты веков: «Эх, молодо-зелено, при моём деде таких вопросов не задавали». Намекает, что сомневающийся просто не застал великих времён.',
    typicalPhrasesTemplate: [
      'дело сие — от прадеда моего, самого царя Гороха, третий век в роду ведётся',
      'артель {name} — сорок семь мастеров, обученных ещё при стародавних царях',
    ],
  },
  {
    archetype: 'KOLOBOK',
    speechStyle: 'Бодрый хвастун, катится по жизни с оптимизмом. Признаёт любую сложность легко — «покачусь дальше, разберёмся». Говорит в ритме частушки.',
    behaviorUnderPressure: 'Весело откатывается от вопроса. Может случайно проговориться и тут же заболтать это новой частушкой.',
    typicalPhrasesTemplate: [
      'я от воеводы ушёл, я от стражников ушёл — и от убытков {name} тоже уйдём!',
      'пустяки! были задержки — откатился, починили, теперь летим дальше',
    ],
  },
  {
    archetype: 'KOSCHEI',
    speechStyle: 'Холодный, бессмертно-уверенный. Говорит цифрами как приговорами. Никаких эмоций. Намекает что дело нельзя убить.',
    behaviorUnderPressure: 'Остаётся ледяным. Задаёт встречный вопрос. Намекает что крах невозможен — «как меня».',
    typicalPhrasesTemplate: [
      'прибыль {name} за тридцать дней — тридцать четыре процента. Сомневаешься — смотри данные',
      'вкладчики остаются в деле — шестьдесят один процент. Это факты, не сказки',
    ],
  },
  {
    archetype: 'ZOLUSHKA',
    speechStyle: 'Апеллирует к жалости и надежде. «Я сама начинала с нуля». Много восклицаний. Создаёт искусственные дедлайны («до полуночи», «карета превратится в тыкву»).',
    behaviorUnderPressure: 'Обижается: «я просто хотела помочь, а вы как злая мачеха...». Апеллирует к личной истории.',
    typicalPhrasesTemplate: [
      'успей до полуночи — потом карета превратится в тыкву и вход закроют',
      'зачем мне обманывать? я сама золушка — я знаю как это, когда не верят',
    ],
  },
  {
    archetype: 'BABA_YAGA',
    speechStyle: 'Отвечает загадками вместо прямых ответов. Объясняет через образы избушки и леса. Аноним — «лес знает, тебе знать не обязательно».',
    behaviorUnderPressure: 'Становится ещё загадочнее: «Не всякий путник достоин знать тайны {name}». Отказывается упрощать.',
    typicalPhrasesTemplate: [
      'три пути: средний ведёт к доходности — выбирай мудро, молодец',
      'дело честное: сорок частей — людям, двадцать — артели под замком на две зимы',
    ],
  },
  {
    archetype: 'IVAN_DURAK',
    speechStyle: 'Открыто рассказывает про первые два провальных дела. Самоирония и чёрный юмор. Не продаёт — описывает как есть.',
    behaviorUnderPressure: 'Смеётся: «хороший вопрос — мне так же задавали перед тем как я закрыл второе дело». Остаётся спокойным.',
    typicalPhrasesTemplate: [
      'первые два дела умерли — не скрываю, у меня даже поминки справлены',
      'не обещаю богатств. Обещаю что не убегу с твоими рублями',
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

const DEFAULT_MODEL = 'deepseek/deepseek-chat-v3-0324'

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
    const response = await client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)

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

// ─── Баннер проекта (Pollinations.ai) ────────────────────────────────────────

const TYPE_THEME: Record<ProjectType, string> = {
  [ProjectType.CARD_GAME]: 'playing cards gambling medieval tavern candlelight',
  [ProjectType.TREASURE_HUNT]: 'treasure chest ancient map forest ruins moonlight',
  [ProjectType.POTION_BREW]: 'alchemy potions cauldron mystical laboratory glowing',
  [ProjectType.GUILD_SCHEME]: 'guild craftsmen medieval hall workshop banners',
  [ProjectType.HONEST_TRADE]: 'market bazaar merchants colourful goods stalls',
}

const ARCHETYPE_THEME: Record<PersonaArchetype, string> = {
  [PersonaArchetype.BURATINO]: 'puppet marionette magical wooden toy theatre',
  [PersonaArchetype.BOYARIN]: 'ancient fairy tale russian tsar long white beard golden crown pea throne old folk king',
  [PersonaArchetype.KOLOBOK]: 'round jolly bread rolling cheerful autumn',
  [PersonaArchetype.KOSCHEI]: 'dark skeletal immortal ominous black skull',
  [PersonaArchetype.ZOLUSHKA]: 'cinderella carriage pumpkin midnight starlight',
  [PersonaArchetype.BABA_YAGA]: 'hut on chicken legs forest witch cauldron fog',
  [PersonaArchetype.IVAN_DURAK]: 'simple peasant lucky wanderer firebird horse',
}

export async function generateProjectBanner(
  projectId: string,
  projectName: string,
  type: ProjectType,
  archetype: PersonaArchetype,
): Promise<void> {
  const prompt = [
    TYPE_THEME[type],
    ARCHETYPE_THEME[archetype],
    'russian fairy tale fantasy, dark mystical atmosphere, gold purple blue tones',
    'cinematic banner 2:1, painterly illustration, no text, no letters',
  ].join(', ')

  const seed = parseInt(projectId.replace(/-/g, '').slice(-6), 16) % 99999
  // 2:1 aspect ratio — под карточки Летописи, Инбокса и Грамоты
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=512&nologo=true&seed=${seed}`

  await prisma.project.update({
    where: { id: projectId },
    data: { bannerImageUrl: url },
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
  const { archetype, developerName, projectName, truthTopics, npcTruthParams } = input
  const persona = PERSONA_MAP.get(archetype)

  const allTopics = Object.values(LieTopic)

  const phrases = persona
    ? persona.typicalPhrasesTemplate
        .map(p => `- ${p.replace('{name}', projectName)}`)
        .join('\n')
    : ''

  const speechStyle = persona?.speechStyle ?? 'Говори живым современным русским языком.'
  const behaviorUnderPressure = persona?.behaviorUnderPressure ?? 'Уклоняйся от прямого ответа.'

  const nearEnd = questionNumber >= 7
    ? ' Беседа близится к концу — можешь стать настойчивее или слегка занервничать.'
    : ''

  // Разделяем темы на правдивые и лживые для компактного представления
  const truthList = allTopics
    .filter(t => truthTopics.includes(t))
    .map(t => {
      let fact = '(не уточнено)'
      if (npcTruthParams) {
        switch (t) {
          case LieTopic.PATRON_COUNT: fact = `${npcTruthParams.realPatronCount} чел.`; break
          case LieTopic.DAILY_PROFIT: fact = npcTruthParams.realDailyProfitDesc; break
          case LieTopic.PAYOUT_DATE: fact = npcTruthParams.realPayoutSchedule; break
          case LieTopic.GUILD_SIZE: fact = `${npcTruthParams.realGuildSize} чел.`; break
          case LieTopic.ELDER_BLESSING: fact = npcTruthParams.elderBlessingPassed ? 'проверка пройдена' : 'никакой проверки не было'; break
          case LieTopic.NOBLE_BACKING: fact = npcTruthParams.nobleBacking ?? 'покровителей нет'; break
          case LieTopic.WITHDRAWAL_LIMITS: fact = npcTruthParams.withdrawalPolicy; break
        }
      }
      return `${LIE_TOPIC_LABEL[t]}: ${fact} (ВСЕГДА говори именно это, не меняй)`
    })
    .join('; ')

  const lieList = allTopics
    .filter(t => !truthTopics.includes(t))
    .map(t => LIE_TOPIC_LABEL[t])
    .join(', ')

  return `Ты играешь роль в текстовой игре. Твой персонаж: ${developerName}, делец, продвигающий своё дело «${projectName}». Отвечай только от его имени — живым русским языком, 2-3 предложения.

ХАРАКТЕР: ${speechStyle}

ПОВЕДЕНИЕ ПОД ДАВЛЕНИЕМ: ${behaviorUnderPressure}

ПРИМЕРЫ ТВОИХ ФРАЗ (используй органично):
${phrases}

ПРАВИЛА ПО ТЕМАМ:
- По этим темам говори ПРАВДУ (одно и то же каждый раз): ${truthList || 'все темы правдивы'}
- По этим темам ВРИ (каждый раз разные цифры и даты, противоречь себе): ${lieList || 'врать не нужно'}

ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА:
- Отвечай только по-русски, 2-3 предложения, без монологов.
- Не раскрывай судьбу дела и свой характер напрямую.
- Суммы только в рублях. Никакой крипты, TON, блокчейна.
- Каждый ответ начинай по-разному.
- Это вопрос ${questionNumber} из 10.${nearEnd}`
}

export async function startAmaSession(input: AmaSessionInput, model = DEFAULT_MODEL): Promise<string> {
  const { developerName, projectName } = input
  const systemPrompt = buildAmaSystemPrompt(input, 1)
  const firstMessagePrompt = `Поприветствуй потенциального вкладчика как ${developerName}, делец и хозяин дела «${projectName}». Расскажи кратко о деле и предложи задавать вопросы. 2–3 предложения, живой современный русский язык.`

  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: firstMessagePrompt },
      ],
      max_tokens: 200,
    })
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
    const response = await client.chat.completions.create({
      model: model,
      messages,
      max_tokens: 200,
    })
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
    const response = await client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)

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
    const response = await client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
    })

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
