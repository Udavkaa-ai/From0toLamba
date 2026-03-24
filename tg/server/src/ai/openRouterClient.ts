import OpenAI from 'openai'
import { prisma } from '../db/prisma'
import {
  ProjectType, ProjectFate, PersonaArchetype, LieTopic,
  LIE_TOPIC_LABEL, LIE_TOPIC_EMOJI,
} from '../game/types'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  defaultHeaders: {
    'HTTP-Referer': process.env.MINI_APP_URL ?? '',
    'X-Title': 'Из грязи в князи',
  },
})

const TEXT_MODEL = 'deepseek/deepseek-chat-v3-0324'
const IMAGE_MODEL = 'black-forest-labs/flux-schnell'

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

const ARCHETYPE_SYSTEM: Record<PersonaArchetype, string> = {
  [PersonaArchetype.BURATINO]: 'Ты Буратино — наивный лжец, который сам верит своим выдумкам. Говоришь с детской непосредственностью.',
  [PersonaArchetype.BOYARIN]: 'Ты Боярин — пышно-официальный, ссылаешься на великих партнёров без конкретных имён. Говоришь торжественно.',
  [PersonaArchetype.KOLOBOK]: 'Ты Колобок — хвастун-оптимист, от любых неудобных вопросов укатываешься с улыбкой. Всегда позитивен.',
  [PersonaArchetype.KOSCHEI]: 'Ты Кощей — холодный и бессмертно-уверенный, оперируешь цифрами и статистикой. Лаконичен и жёсток.',
  [PersonaArchetype.ZOLUSHKA]: 'Ты Золушка — давишь на жалость и мечты, упоминаешь дедлайны «до полуночи». Говоришь с надеждой и обидой.',
  [PersonaArchetype.BABA_YAGA]: 'Ты Баба-яга — отвечаешь загадками, технически подкована, сбиваешь с толку. Загадочна и мудра.',
  [PersonaArchetype.IVAN_DURAK]: 'Ты Иван-дурак — открыт про прошлые провалы, убеждён что на третий раз взлетит. Простодушен.',
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

export async function generateProjectBanner(
  projectId: string,
  projectName: string,
  type: ProjectType,
  archetype: PersonaArchetype,
): Promise<void> {
  try {
    // Сначала DeepSeek генерирует концепт промпта для FLUX
    const conceptPrompt = `Create a short image generation prompt (max 20 words, English) for a fairy-tale Russian merchant game project banner. Project: "${projectName}", type: ${type}, persona: ${archetype}. Style: mystical medieval Russian illustration, gold and purple tones, no text.`

    const conceptResp = await client.chat.completions.create({
      model: TEXT_MODEL,
      messages: [{ role: 'user', content: conceptPrompt }],
      max_tokens: 60,
    })

    const imagePrompt = conceptResp.choices[0]?.message?.content?.trim()
      ?? 'Mystical Russian fairy-tale merchant scene, gold purple tones'

    // FLUX генерирует изображение
    const imageResp = await client.images.generate({
      model: IMAGE_MODEL,
      prompt: imagePrompt,
      size: '512x512',
      n: 1,
    } as Parameters<typeof client.images.generate>[0])

    const imageUrl = (imageResp.data?.[0] as { url?: string } | undefined)?.url
    if (imageUrl) {
      await prisma.project.update({
        where: { id: projectId },
        data: { bannerImageUrl: imageUrl, bannerPromptUsed: imagePrompt },
      })
    }
  } catch (err) {
    console.error('generateProjectBanner failed:', err)
    // Не крашим — placeholder покажется в UI
  }
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
}

export async function startAmaSession(input: AmaSessionInput): Promise<string> {
  const { archetype, developerName, projectName, type, claimedAPY, description, lieTopics } = input

  const systemPrompt = buildAmaSystemPrompt(input)

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

interface SendAmaMessageInput {
  archetype: PersonaArchetype
  developerName: string
  projectName: string
  type: ProjectType
  lieTopics: LieTopic[]
  truthTopics: LieTopic[]
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  userMessage: string
}

function buildAmaSystemPrompt(input: AmaSessionInput | SendAmaMessageInput): string {
  const { archetype, developerName, lieTopics, truthTopics } = input
  const lieStr = lieTopics.map(t => `${LIE_TOPIC_EMOJI[t]} ${LIE_TOPIC_LABEL[t]}`).join(', ')
  const truthStr = truthTopics.map(t => `${LIE_TOPIC_EMOJI[t]} ${LIE_TOPIC_LABEL[t]}`).join(', ')

  return `${ARCHETYPE_SYSTEM[archetype]}

Тебя зовут ${developerName}. Ты отвечаешь на вопросы о своём деле.

ВАЖНО — правила лжи и правды:
- По темам [${lieStr}] — ты ВРЁШЬ убедительно, но не грубо. Цифры завышай, уклоняйся, выдумывай.
- По темам [${truthStr}] — отвечаешь честно.
- Никогда не признавайся что врёшь.
- Говори современным живым русским языком. Изредка можно народную присказку, но не в каждом ответе.
- Ответ — не более 3 предложений.
- Никакого блокчейна, крипты, TON — только рубли (₽).`
}

export async function sendAmaMessage(input: SendAmaMessageInput): Promise<string> {
  const systemPrompt = buildAmaSystemPrompt(input)

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
