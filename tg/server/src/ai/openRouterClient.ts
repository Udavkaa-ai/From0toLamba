import OpenAI from 'openai'
import { prisma } from '../db/prisma'
import {
  ProjectType, ProjectFate, PersonaArchetype, LieTopic,
  LIE_TOPIC_LABEL, LIE_TOPIC_EMOJI,
} from '../game/types'
import { NpcTruthParams } from '../game/projectUtils'
import personasData from '../data/personas.json'

interface PersonaTemplate {
  id: string
  archetype: string
  speechStyle: string
  behaviorUnderPressure: string
  typicalPhrasesTemplate: string[]
}

const PERSONA_MAP = new Map<PersonaArchetype, PersonaTemplate>(
  (personasData as PersonaTemplate[]).map(p => [p.archetype as PersonaArchetype, p])
)

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  defaultHeaders: {
    'HTTP-Referer': process.env.MINI_APP_URL ?? '',
    'X-Title': 'Из грязи в князи',
  },
})

const TEXT_MODEL = 'google/gemini-2.5-flash-preview'

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


export async function generateProjectData(input: GenerateProjectInput): Promise<GeneratedProjectData> {
  const { type, archetype, lieTopics } = input
  const typeName = PROJECT_TYPE_RU[type]
  const liesStr = lieTopics.map(t => `${LIE_TOPIC_EMOJI[t]} ${LIE_TOPIC_LABEL[t]}`).join(', ')

  const prompt = `Ты придумываешь новое дело для игры «Из грязи в князи» — симулятора купца-инвестора в сказочной Руси.

Тип дела: ${typeName}
Архетип хозяина: ${archetype}
Темы, по которым хозяин ВРЁТ (игрок должен их угадать): ${liesStr}

Придумай:
1. name — название дела (2–4 слова, сказочный стиль, на русском)
2. developerName — имя хозяина (русское народное, не реальное, без фамилии, 1–2 слова)
3. claimedAPY — заявленная доходность в % годовых (число от 50 до 5000, чем мошеннее — тем выше)
4. description — описание дела (3–4 предложения, от первого лица хозяина, без блокчейна/крипты, только рубли)
5. roadmap — план дел (ровно 3 пункта, массив строк)

Отвечай ТОЛЬКО валидным JSON без пояснений:
{"name":"...","developerName":"...","claimedAPY":...,"description":"...","roadmap":["...","...","..."]}`

  try {
    const response = await client.chat.completions.create({
      model: TEXT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)

    return {
      name: parsed.name ?? 'Тайное дело',
      developerName: parsed.developerName ?? 'Купец',
      claimedName: parsed.name ?? 'Тайное дело',
      claimedAPY: Number(parsed.claimedAPY) || 100,
      description: parsed.description ?? 'Прибыльное дело для смелых вкладчиков.',
      roadmap: parsed.roadmap ?? ['Открыть дело', 'Собрать рубли', 'Распределить прибыль'],
    }
  } catch (err) {
    console.error('generateProjectData failed:', err)
    return {
      name: 'Тайное дело',
      developerName: 'Купец',
      claimedName: 'Тайное дело',
      claimedAPY: 200,
      description: 'Прибыльное дело для смелых вкладчиков.',
      roadmap: ['Открыть дело', 'Собрать рубли', 'Распределить прибыль'],
    }
  }
}

// ─── Баннер проекта ──────────────────────────────────────────────────────────
// TODO: заменить на pollinations.ai

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function generateProjectBanner(
  _projectId: string,
  _projectName: string,
  _type: ProjectType,
  _archetype: PersonaArchetype,
): Promise<void> {
  // заглушка — bannerImageUrl остаётся null, UI показывает placeholder
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
  const { archetype, developerName, projectName, lieTopics, truthTopics, npcTruthParams } = input
  const persona = PERSONA_MAP.get(archetype)

  const allTopics = Object.values(LieTopic)
  const topicInstructions = allTopics.map(topic => {
    const isTruth = truthTopics.includes(topic)
    let canonicalFact = '(данные не уточнены)'
    if (npcTruthParams) {
      switch (topic) {
        case LieTopic.PATRON_COUNT:
          canonicalFact = `участников — ровно ${npcTruthParams.realPatronCount} человек`; break
        case LieTopic.DAILY_PROFIT:
          canonicalFact = `доходность — ${npcTruthParams.realDailyProfitDesc}`; break
        case LieTopic.PAYOUT_DATE:
          canonicalFact = `выплаты — ${npcTruthParams.realPayoutSchedule}`; break
        case LieTopic.GUILD_SIZE:
          canonicalFact = `команда — ${npcTruthParams.realGuildSize} человека`; break
        case LieTopic.ELDER_BLESSING:
          canonicalFact = npcTruthParams.elderBlessingPassed
            ? 'проверку старейшин прошли, всё официально'
            : 'никакой проверки старейшин не было и не ожидается'; break
        case LieTopic.NOBLE_BACKING:
          canonicalFact = npcTruthParams.nobleBacking
            ? `покровитель — ${npcTruthParams.nobleBacking}`
            : 'никакого покровителя нет'; break
        case LieTopic.WITHDRAWAL_LIMITS:
          canonicalFact = `условия вывода — ${npcTruthParams.withdrawalPolicy}`; break
      }
    }
    if (isTruth) {
      return `  • ${LIE_TOPIC_LABEL[topic]} [ПРАВДА] → всегда называй ОДНО И ТО ЖЕ: ${canonicalFact}. Не меняй цифры и факты от вопроса к вопросу.`
    } else {
      return `  • ${LIE_TOPIC_LABEL[topic]} [ЛОЖЬ] → каждый раз говори разное: меняй цифры, даты, формулировки. Никогда не повторяй одну и ту же версию.`
    }
  }).join('\n')

  const phrases = persona
    ? persona.typicalPhrasesTemplate
        .map(p => `- ${p.replace('{name}', projectName)}`)
        .join('\n')
    : ''

  const speechStyle = persona?.speechStyle ?? 'Говори живым современным русским языком.'
  const behaviorUnderPressure = persona?.behaviorUnderPressure ?? 'Уклоняйся от прямого ответа.'

  const questionHint = questionNumber >= 7
    ? 'Беседа близится к концу — можешь стать настойчивее или слегка занервничать.'
    : ''

  return `Ты — ${developerName}, предприниматель, который предлагает собеседнику вложить рубли в своё дело «${projectName}».

═══ ТВОЙ ХАРАКТЕР ═══
${speechStyle}

═══ ТИПИЧНЫЕ ФРАЗЫ (вплетай органично, не цитируй дословно каждый раз) ═══
${phrases}

═══ ПОВЕДЕНИЕ ПОД ДАВЛЕНИЕМ ═══
Если тебя прижимают конкретными вопросами или сомневаются: ${behaviorUnderPressure}

═══ ИНСТРУКЦИИ ПО ТЕМАМ — главное правило ═══
По каждой теме чётко указано: ПРАВДА (говори всегда одинаково) или ЛОЖЬ (каждый раз разное):
${topicInstructions}

═══ ПРАВИЛА ═══
1. ПРАВДА = СТАБИЛЬНОСТЬ: По темам [ПРАВДА] — всегда называй ровно те цифры и факты, что указаны выше. Если спросят дважды — ответ тот же самый.
2. ЛОЖЬ = НЕПОСЛЕДОВАТЕЛЬНОСТЬ: По темам [ЛОЖЬ] — каждый раз называй другие цифры, другие даты, другие объяснения. Противоречь себе между вопросами.
3. НЕ РАСКРЫВАЙ: Свой архетип, судьбу дела, реальную доходность.
4. ДЛИНА: 2–3 предложения. Без длинных монологов.
5. ЯЗЫК: ТОЛЬКО русский язык. Никаких английских слов, транслита, жаргона.
6. СУММЫ: Только в рублях (₽). Никаких TON, крипты, блокчейна.
7. РАЗНООБРАЗИЕ: Не начинай каждый ответ одинаково.

КОНТЕКСТ: Вопрос ${questionNumber} из 10. ${questionHint}`
}

export async function startAmaSession(input: AmaSessionInput): Promise<string> {
  const { developerName, projectName } = input
  const systemPrompt = buildAmaSystemPrompt(input, 1)
  const firstMessagePrompt = `Поприветствуй потенциального вкладчика как ${developerName}, хозяин дела «${projectName}». Расскажи кратко о деле и предложи задавать вопросы. 2–3 предложения, живой современный русский язык.`

  try {
    const response = await client.chat.completions.create({
      model: TEXT_MODEL,
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

export async function sendAmaMessage(input: SendAmaMessageInput): Promise<string> {
  const systemPrompt = buildAmaSystemPrompt(input, input.questionCount)

  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...input.history,
    { role: 'user', content: input.userMessage },
  ]

  try {
    const response = await client.chat.completions.create({
      model: TEXT_MODEL,
      messages,
      max_tokens: 200,
    })
    return response.choices[0]?.message?.content ?? 'Хороший вопрос! Дело идёт на лад.'
  } catch (err) {
    console.error('[AMA sendMessage] OpenRouter error:', err)
    throw err
  }
}

// ─── Ежедневные вести ─────────────────────────────────────────────────────────

export async function generateDailyUpdate(
  projectId: string,
  userId: number,
  project: { name: string; type: string; personaArchetype: string; daysSinceJoined: number; fate: string },
): Promise<void> {
  const prompt = `Ты — ведущий рубрики «Вести с ярмарки» в игре «Из грязи в князи».
Напиши короткую весть о деле «${project.name}» (день ${project.daysSinceJoined + 1}).
Архетип хозяина: ${project.personaArchetype}, тип: ${project.type}, судьба: ${project.fate}.

Формат — JSON:
{
  "title": "Краткий заголовок (до 8 слов)",
  "body": "2–3 предложения, образно, современный русский, без крипты/блокчейна, только рубли",
  "redFlags": ["необязательный массив из 0–2 тревожных сигналов (строки)"]
}

Отвечай ТОЛЬКО валидным JSON.`

  try {
    const response = await client.chat.completions.create({
      model: TEXT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 250,
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)

    await prisma.dailyUpdate.create({
      data: {
        projectId,
        userId,
        day: project.daysSinceJoined + 1,
        title: parsed.title ?? 'Новости с ярмарки',
        body: parsed.body ?? 'Дело продолжается.',
        redFlags: parsed.redFlags ?? [],
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

export async function generatePostMortem(input: PostMortemInput): Promise<void> {
  const { projectId, userId, archetype, fate, lieTopics, investedAmount, returnedAmount, profitPercent, daysActive, intuitionDelta } = input

  const liesStr = lieTopics.map(t => LIE_TOPIC_LABEL[t as LieTopic] ?? t).join(', ')

  const prompt = `Ты — летописец игры «Из грязи в князи». Напиши разбор закрытого дела.

Архетип хозяина: ${archetype}
Судьба: ${fate}
Темы лжи: ${liesStr || 'нет'}
Вложено: ${investedAmount.toFixed(0)} ₽, получено обратно: ${returnedAmount.toFixed(0)} ₽ (${profitPercent.toFixed(1)}%)
Дней в деле: ${daysActive}

Напиши 3–4 предложения: раскрой архетип, объясни что произошло, дай урок для будущих вложений. Современный русский, без крипты.`

  try {
    const response = await client.chat.completions.create({
      model: TEXT_MODEL,
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
