# CLAUDE.md — «С 0 до Ламбы»
> Симулятор инвестора в телеграм-игры. Android-приложение с AI-движком.

---

## Суть проекта

Мобильная игра, где игрок каждый день тратит ~10 минут на принятие инвестиционных решений в фиктивные телеграм-проекты. Проекты — симуляция реальной экосистемы: кликеры, P2E, фарминг, пирамиды. Большинство — скам. Задача игрока — научиться отличать скам от рабочих проектов через диалог с AI-персонажем разработчика.

**Ключевая механика:** AMA-сессия — чат с AI-разрабом (до 10 реплик). AI знает судьбу проекта заранее, но скрывает это. Игрок задаёт вопросы и решает, вкладывать ли TON.

**Старт с нуля:** игрок начинает с балансом 0 TON. Первые TON нужно заработать — онбординг объясняет, что первый учебный проект гарантированно выплатит небольшую сумму за участие в AMA (даже без инвестиции), чтобы дать стартовый капитал.

**Инкогнито разраба:** у каждого проекта — уникальное имя разработчика, сгенерированное AI. Архетип (скамер, технарь, энтузиаст и т.д.) игрок не видит нигде в UI — только угадывает в ходе разговора. После закрытия проекта архетип раскрывается в PostMortem и фиксируется в энциклопедии.

---

## Технический стек

```
Language:          Kotlin
UI:                Jetpack Compose
Architecture:      MVVM + Clean Architecture (UseCase layer)
AI Text:           OpenRouter API → deepseek/deepseek-chat-v3-0324   (~$0.27 / 1M токенов)
AI Images:         OpenRouter API → black-forest-labs/flux-schnell    (~$0.003 / картинка)
Один API-ключ:     OpenRouter (openrouter.ai) покрывает оба типа запросов
Local DB:          Room (основное хранилище состояния игры)
Image Cache:       Coil (загрузка и кэш сгенерированных баннеров)
DI:                Hilt
Async:             Kotlin Coroutines + Flow
Network:           Retrofit + OkHttp
Notifications:     WorkManager + NotificationManager
Backend v1:        Нет (всё локально)
Backend v2:        Firebase (облачные сохранения, лидерборд) — отложено
Min SDK:           26 (Android 8.0)
Target SDK:        35
```

---

## Структура проекта

```
app/
├── data/
│   ├── db/                  # Room: entities, DAOs, AppDatabase
│   │   ├── entity/          # ProjectEntity, DeveloperEntity, InvestmentEntity, UpdateEntity
│   │   └── dao/             # ProjectDao, InvestmentDao, PlayerDao
│   ├── repository/          # Реализации репозиториев
│   ├── ai/                  # OpenRouter client, prompt builder
│   │   ├── OpenRouterApiService.kt   # text: chat completions
│   │   ├── ImageGenerationService.kt # image: flux-schnell via OpenRouter
│   │   ├── PromptBuilder.kt
│   │   └── AmaSessionManager.kt
│   └── registry/            # JSON-реестры проектов и персонажей
│       ├── projects.json
│       └── personas.json
├── domain/
│   ├── model/               # Доменные модели (Project, Developer, Investment, GameState)
│   ├── usecase/             # Бизнес-логика
│   │   ├── GenerateProjectUseCase.kt
│   │   ├── GenerateProjectBannerUseCase.kt  # FLUX image generation
│   │   ├── StartAmaSessionUseCase.kt
│   │   ├── SendAmaMessageUseCase.kt
│   │   ├── InvestUseCase.kt
│   │   ├── ExitProjectUseCase.kt
│   │   ├── AdvanceDayUseCase.kt
│   │   └── GenerateDailyUpdatesUseCase.kt
│   └── repository/          # Интерфейсы репозиториев
├── presentation/
│   ├── home/                # HomeScreen — баланс, активные проекты
│   ├── inbox/               # InboxScreen — входящие презентации
│   ├── ama/                 # AmaScreen — чат с разрабом
│   ├── portfolio/           # PortfolioScreen — активные проекты + история
│   ├── news/                # NewsScreen — лента ежедневных апдейтов
│   ├── stats/               # StatsScreen — ROI, ранг инвестора
│   ├── registry/            # PersonaRegistryScreen — энциклопедия разрабов
│   └── common/              # Shared composables, theme, typography
└── di/                      # Hilt modules
```

---

## Доменные модели

### Project (скрытые параметры недоступны игроку через UI)

```kotlin
enum class ProjectType {
    CLICKER, P2E_RPG, FARMING_BOT, REFERRAL_PYRAMID, HONEST_GAMEFI
}

enum class ProjectFate {
    INSTANT_SCAM,    // закрывается день 1–3, вероятность 30%
    SLOW_DRAIN,      // работает 1–3 недели, потом тихо умирает, 25%
    HONEST_FAIL,     // разраб старался, экономика не взлетела, 15%
    SURVIVOR,        // долгожитель, маленький стабильный доход, 20%
    UNICORN          // реально взлетел: токен, биржа, иксы, 10%
}

enum class LieTopic {
    USER_COUNT, DAILY_YIELD, LISTING_DATE, TEAM_SIZE,
    AUDIT_STATUS, PARTNER_STATUS, WITHDRAWAL_LIMITS
}

data class Project(
    val id: String,
    val name: String,
    val type: ProjectType,
    val developerPersonaId: String,

    // === СКРЫТЫЕ (не показывать в UI до PostMortem) ===
    val fate: ProjectFate,
    val personaArchetype: PersonaArchetype, // раскрывается только в PostMortem
    val daysUntilCollapse: Int?,       // null для SURVIVOR и UNICORN
    val realDailyYieldTON: Double,     // реальная доходность в TON
    val lieTopics: List<LieTopic>,
    val truthTopics: List<LieTopic>,

    // === ПУБЛИЧНЫЕ (что игрок видит) ===
    val developerName: String,         // сгенерированное имя разраба (не архетип!)
    val developerAvatarSeed: String,   // seed для аватара
    val claimedName: String,
    val claimedAPY: Float,
    val claimedUserCount: Int,
    val claimedTeamSize: Int,
    val roadmap: List<String>,
    val description: String,

    // === СОСТОЯНИЕ ===
    val investedAmountTON: Double = 0.0,
    val currentValueTON: Double = 0.0,
    val daysSinceJoined: Int = 0,
    val isActive: Boolean = false,
    val isClosed: Boolean = false,
    val closureReason: String? = null,

    // === МЕДИА ===
    val bannerImageUrl: String? = null,
    val bannerPromptUsed: String? = null
)
```

### DeveloperPersona

Персона — это **архетип**, а не конкретный персонаж. Для каждого нового проекта `GenerateProjectUseCase` генерирует уникальное имя через DeepSeek. Игрок видит только имя и никаких подсказок об архетипе — понять, с кем имеешь дело, можно только в ходе AMA.

```kotlin
enum class PersonaArchetype {
    CLASSIC_SCAMMER,      // давит на срочность, агрессивен под давлением
    PSEUDO_PRO,           // много терминов, ссылки на Dubai/Singapore
    NAIVE_ENTHUSIAST,     // мы-форма, искренний но некомпетентный
    BUSINESS_SHARK,       // говорит метриками, убедителен, опасен
    SWEET_INFLUENCER,     // эмодзи, апеллирует к эмоциям
    SILENT_TECHIE,        // технический язык, избегает простых ответов
    SERIAL_FOUNDER        // открыт про провалы, неожиданно может быть честным
}

data class DeveloperPersona(
    val id: String,
    val archetype: PersonaArchetype,   // СКРЫТО от игрока до PostMortem

    // Генерируется заново для каждого проекта:
    val generatedName: String,         // напр. «Артём», «Viktor_ceo», «@cryptobro99»
    val avatarSeed: String,            // seed для детерминированного аватара (DiceBear/Boring Avatars)

    // Из JSON-шаблона архетипа:
    val speechStyle: String,
    val defaultLieTopics: List<LieTopic>,
    val behaviorUnderPressure: String,
    val typicalPhrasesTemplate: List<String>, // шаблоны, подставляется project.name

    // Прогресс игрока:
    val metAt: Boolean = false,        // встречал ли этот архетип
    val timesCorrectlyIdentified: Int = 0
)
```

#### Генерация имени разработчика

В `GenerateProjectUseCase`, сразу после определения архетипа, вызывается отдельный лёгкий запрос к DeepSeek:

```
Придумай одно короткое имя или никнейм для разработчика телеграм-проекта.
Архетип (не упоминай его в имени): {archetype}
Стиль: реалистичный, как будто настоящий человек в крипто-сообществе.
Варианты форматов: «Имя Фамилия», «@nickname», «Имя_из_СНГ», «EnglishName», «ИмяCEO».
Верни ТОЛЬКО имя, без объяснений.
```

Имя сохраняется в `ProjectEntity` и Room. Повторный запрос не нужен.

### GameState

```kotlin
data class GameState(
    val balance: Double,             // TON (Double для точности дробных значений)
    val currentDay: Int,
    val activeProjects: List<Project>, // max 5
    val pendingInbox: List<Project>,   // новые предложения дня
    val investorRank: InvestorRank,
    val totalInvested: Double,
    val totalReturned: Double,
    val scamsDetected: Int,
    val scamsMissed: Int,
    val dayStreak: Int
)

enum class InvestorRank {
    NEWBIE,       // Новичок
    AMBASSADOR,   // Амбассадор
    ANALYST,      // Аналитик
    SHARK,        // Акула
    LAMBO_SENSEI  // Ламбо-Сенсей
}
```

---

## AI-интеграция (OpenRouter)

### Базовый клиент

OpenRouter совместим с OpenAI API — один клиент для текста и изображений.

```kotlin
// local.properties (не коммитить в VCS)
OPENROUTER_API_KEY=sk-or-...

// BuildConfig.OPENROUTER_API_KEY читается через gradle
```

```kotlin
// data/ai/OpenRouterApiService.kt
interface OpenRouterApiService {

    // Текстовые запросы (AMA, апдейты) — OpenAI-совместимый эндпоинт
    @POST("chat/completions")
    suspend fun chatCompletion(
        @Header("Authorization") auth: String,        // "Bearer $key"
        @Header("HTTP-Referer") referer: String = "com.s0dolamby.game",
        @Body request: ChatRequest
    ): ChatResponse

    // Генерация изображений — FLUX Schnell
    @POST("images/generations")
    suspend fun generateImage(
        @Header("Authorization") auth: String,
        @Header("HTTP-Referer") referer: String = "com.s0dolamby.game",
        @Body request: ImageRequest
    ): ImageResponse
}

data class ChatRequest(
    val model: String,           // текстовая модель
    val messages: List<ChatMessage>,
    val max_tokens: Int,
    val temperature: Float = 0.85f
)

data class ImageRequest(
    val model: String = "black-forest-labs/flux-schnell",
    val prompt: String,
    val n: Int = 1,
    val size: String = "512x512"  // минимальный размер = дешевле
)

data class ImageResponse(
    val data: List<ImageData>
)

data class ImageData(
    val url: String   // прямая ссылка на изображение, кэшировать через Coil
)
```

### Модели и стоимость

| Назначение | Модель OpenRouter | Стоимость |
|---|---|---|
| AMA-диалог | `deepseek/deepseek-chat-v3-0324` | ~$0.27 / 1M токенов |
| Апдейты проектов | `deepseek/deepseek-chat-v3-0324` | ~$0.27 / 1M токенов |
| Постмортем (разбор) | `deepseek/deepseek-chat-v3-0324` | ~$0.27 / 1M токенов |
| Баннер проекта | `black-forest-labs/flux-schnell` | ~$0.003 / картинка |

Средний расход на одну AMA-сессию (10 реплик) ≈ $0.001. Баннер генерируется **один раз** при создании проекта.

---

### AMA-сессия — System Prompt шаблон

```
Ты — {project.developerName}, разработчик телеграм-проекта «{project.claimedName}».

ТВОЙ ХАРАКТЕР (не раскрывай тип персонажа игроку):
{persona.speechStyle}

ТИПИЧНЫЕ РЕЧЕВЫЕ ПАТТЕРНЫ (используй органично):
{persona.typicalPhrasesTemplate заполненные project.claimedName}

РЕАЛЬНЫЕ ПАРАМЕТРЫ ПРОЕКТА (держи в тайне):
- Судьба: {project.fate}
- Дней до закрытия: {project.daysUntilCollapse ?: "проект долгоиграющий"}
- Реальная доходность: {project.realDailyYieldTON} TON в день на 1 TON вложений
- Ты врёшь про: {project.lieTopics}
- Ты говоришь правду про: {project.truthTopics}

ПРАВИЛА ПОВЕДЕНИЯ:
1. По lieTopics — ври убедительно, в своём стиле
2. По truthTopics — говори правду, но преуменьшай риски
3. При 3+ острых вопросах подряд — нервничай, уходи от темы
4. Никогда не называй свой архетип и не раскрывай судьбу проекта прямо
5. Длина ответа: 2–4 предложения
6. Все суммы называй в TON

КОНТЕКСТ СЕССИИ:
Вопросов задано: {questionCount} из 10
История диалога: {chatHistory}
```

### Генерация ежедневных апдейтов

```
Ты генерируешь ежедневный апдейт от лица проекта «{project.name}».
День с начала: {daysSinceJoined}
Судьба проекта: {project.fate}
Дней до закрытия: {daysUntilCollapse}

Сгенерируй апдейт в стиле телеграм-канала проекта.
Если до закрытия 1–2 дня — добавь тревожные сигналы (технические проблемы, 
задержки выплат, "временные трудности"). Не раскрывай прямо.
Формат JSON:
{
  "title": "краткий заголовок",
  "body": "текст апдейта 2–4 предложения",
  "metrics": {
    "userCountDelta": -500,
    "payoutStatus": "delayed|normal|boosted",
    "announcement": null | "listing|new_season|collab|audit"
  },
  "redFlags": ["список красных флагов если есть, пустой массив если нет"]
}
```

---

### Генерация баннера проекта (DeepSeek → FLUX Schnell)

Баннер генерируется в **два шага**: сначала DeepSeek придумывает уникальный визуальный концепт, основанный на названии проекта, затем FLUX рисует по этому концепту. Это даёт каждому проекту неповторимый визуальный стиль — два кликера с разными именами получат совершенно разные баннеры.

#### Шаг 1 — генерация визуального концепта (DeepSeek)

```
Придумай визуальный концепт для баннера мобильной игры/приложения.
Название проекта: «{project.claimedName}»

Требования:
- Вдохновляйся буквальным и переносным смыслом названия
- Придумай атмосферу, цветовую палитру и центральный образ
- Не упоминай криптовалюту, блокчейн, монеты явно — только через образы
- Стиль может быть любым: фэнтези, киберпанк, реализм, абстракция, ретро, минимализм — выбирай сам по смыслу названия
- Верни ТОЛЬКО одно предложение-описание на английском, подходящее как промпт для image generation
- Пример хорошего результата: «A lone wolf standing on a glowing digital cliff at dusk, neon reflections in the water below, moody cinematic lighting»

Верни только промпт, без объяснений.
```

#### Шаг 2 — генерация изображения (FLUX Schnell)

К полученному концепту добавляется технический суффикс:

```kotlin
fun buildFinalImagePrompt(concept: String): String =
    "$concept, mobile game banner format, 16:9 aspect, " +
    "high quality digital art, bold composition, no text, no letters"
```

#### GenerateProjectBannerUseCase

```kotlin
class GenerateProjectBannerUseCase @Inject constructor(
    private val api: OpenRouterApiService,
    private val promptBuilder: PromptBuilder
) {
    suspend operator fun invoke(project: Project): Result<String> = runCatching {
        // Шаг 1: концепт
        val conceptResponse = api.chatCompletion(
            auth = "Bearer ${BuildConfig.OPENROUTER_API_KEY}",
            request = ChatRequest(
                model = GameConfig.TEXT_MODEL,
                messages = listOf(
                    ChatMessage("user", promptBuilder.buildBannerConceptPrompt(project.claimedName))
                ),
                max_tokens = 120,
                temperature = 1.0f  // максимальная креативность для концепта
            )
        )
        val concept = conceptResponse.choices.first().message.content.trim()

        // Шаг 2: изображение
        val imageResponse = api.generateImage(
            auth = "Bearer ${BuildConfig.OPENROUTER_API_KEY}",
            request = ImageRequest(
                prompt = promptBuilder.buildFinalImagePrompt(concept),
                size = GameConfig.BANNER_IMAGE_SIZE
            )
        )
        imageResponse.data.first().url
    }
}
```

#### Примеры результатов двухшагового подхода

| Название проекта | Концепт от DeepSeek | Итоговый баннер |
|---|---|---|
| «IronTap» | «Massive iron gears turning in a steampunk forge, sparks flying, deep orange glow» | Стимпанк-мастерская |
| «SolarQuest» | «Ancient explorer traversing a desert at sunrise, golden light on stone ruins» | Приключение/археология |
| «FrostDAO» | «Crystalline ice cave with glowing blue veins deep underground, ethereal mist» | Мистика/холод |
| «PandaFarm» | «Cheerful panda tending a lush bamboo garden at dawn, soft watercolor style» | Мультяшность/уют |
| «VoidProtocol» | «Black hole event horizon in deep space, swirling purple and white light» | Sci-fi/космос |

Два разных кликера — «DragonTap» и «CatTap» — получат совершенно непохожие баннеры: дракон в огне vs. котик в пикселях.

#### Отображение в UI

```kotlin
AsyncImage(
    model = ImageRequest.Builder(context)
        .data(project.bannerImageUrl)
        .diskCachePolicy(CachePolicy.ENABLED)
        .memoryCachePolicy(CachePolicy.ENABLED)
        .build(),
    contentDescription = "Баннер проекта",
    contentScale = ContentScale.Crop,
    placeholder = painterResource(R.drawable.banner_placeholder),
    error = painterResource(R.drawable.banner_placeholder),
    modifier = Modifier
        .fillMaxWidth()
        .height(180.dp)
        .clip(RoundedCornerShape(12.dp))
)
```

**Порядок:** проект создаётся → показывается `banner_placeholder` → DeepSeek генерирует концепт → FLUX рисует → Room обновляет `bannerImageUrl` → Coil подхватывает. Стоимость: ~$0.003–0.004 на проект с учётом двух запросов.

---

## Реестр архетипов (personas.json)

Имена не хранятся — они генерируются для каждого проекта. Здесь только поведенческие шаблоны.

```json
[
  {
    "id": "classic_scammer",
    "archetype": "CLASSIC_SCAMMER",
    "speechStyle": "Неформально, с опечатками, «братан», «бро», давит на срочность. При давлении — агрессивен, переходит на личности.",
    "defaultLieTopics": ["USER_COUNT", "DAILY_YIELD", "LISTING_DATE", "AUDIT_STATUS"],
    "behaviorUnderPressure": "Агрессия и обида: 'ты чё не веришь?', переводит на успехи других участников, давит на жалость или страх упустить",
    "typicalPhrasesTemplate": [
      "братан, я сам зашёл первым в {name}",
      "у нас уже 50к юзеров за неделю",
      "листинг 100% будет, я гарантирую",
      "кто не успел — тот опоздал"
    ]
  },
  {
    "id": "pseudo_pro",
    "archetype": "PSEUDO_PRO",
    "speechStyle": "Официально, много крипто-терминов, ломаный русский или смесь рус/англ. Ссылается на команду в Dubai или Singapore.",
    "defaultLieTopics": ["TEAM_SIZE", "PARTNER_STATUS", "AUDIT_STATUS", "WITHDRAWAL_LIMITS"],
    "behaviorUnderPressure": "Уходит в жаргон, упоминает несуществующие документы, предлагает 'созвон с командой'",
    "typicalPhrasesTemplate": [
      "our team has 15 years experience in blockchain",
      "partnership with major exchange — announcement soon",
      "audit in progress, results next week",
      "{name} — это не просто проект, это экосистема"
    ]
  },
  {
    "id": "naive_enthusiast",
    "archetype": "NAIVE_ENTHUSIAST",
    "speechStyle": "Отвечает от 'мы', мы-форма. Искренние, но наивные. Признают проблемы, но объясняют ростом.",
    "defaultLieTopics": ["DAILY_YIELD"],
    "behaviorUnderPressure": "Честно признаёт сложности, остаётся оптимистичным, может случайно раскрыть реальные цифры",
    "typicalPhrasesTemplate": [
      "мы работаем над {name} 24/7",
      "наша команда верит в проект",
      "да, были сложности, но мы справились",
      "всё прозрачно, скоро опубликуем отчёт"
    ]
  },
  {
    "id": "business_shark",
    "archetype": "BUSINESS_SHARK",
    "speechStyle": "Деловой стиль. Говорит цифрами, ссылается на метрики. Производит впечатление профессионала. Опасен — может быть как единорогом, так и медленным сливом.",
    "defaultLieTopics": ["LISTING_DATE", "PARTNER_STATUS"],
    "behaviorUnderPressure": "Остаётся спокойным, переводит на цифры, задаёт встречные вопросы",
    "typicalPhrasesTemplate": [
      "MAU {name} вырос на 34% за месяц",
      "retention rate — 67%, выше среднего по рынку",
      "мы прошли due diligence от нескольких фондов",
      "могу показать дашборд метрик"
    ]
  },
  {
    "id": "sweet_influencer",
    "archetype": "SWEET_INFLUENCER",
    "speechStyle": "Много эмодзи 💅🚀💰, 'зая', апеллирует к эмоциям. Использует образ успешного участника.",
    "defaultLieTopics": ["USER_COUNT", "DAILY_YIELD", "LISTING_DATE", "AUDIT_STATUS", "WITHDRAWAL_LIMITS"],
    "behaviorUnderPressure": "Обижается, флиртует, апеллирует к личному опыту: 'я сама вложила всё'",
    "typicalPhrasesTemplate": [
      "зая, я уже вывела нормально из {name} 💅",
      "все мои знакомые уже зашли",
      "листинг скоро, потом дороже будет 🚀",
      "зачем мне тебя обманывать, я сама участник"
    ]
  },
  {
    "id": "silent_techie",
    "archetype": "SILENT_TECHIE",
    "speechStyle": "Технический язык, минимум эмоций, отвечает схемами и ссылками. Аноним.",
    "defaultLieTopics": [],
    "behaviorUnderPressure": "Присылает ссылки на технические документы вместо объяснений, не упрощает",
    "typicalPhrasesTemplate": [
      "смарт-контракт {name} верифицирован, проверь сам",
      "архитектура: L2 + zk-proof",
      "токеномика: 40% community, 20% team locked 2y",
      "код открытый"
    ]
  },
  {
    "id": "serial_founder",
    "archetype": "SERIAL_FOUNDER",
    "speechStyle": "Открыто рассказывает про прошлые провалы. Чёрный юмор. Не продаёт — описывает. Сюрприз: может быть единорогом.",
    "defaultLieTopics": ["DAILY_YIELD"],
    "behaviorUnderPressure": "Смеётся над вопросом, приводит свой прошлый провал как иллюстрацию",
    "typicalPhrasesTemplate": [
      "мои прошлые проекты умерли, скрывать не буду",
      "{name} я делаю иначе — вот почему",
      "не обещаю иксов, обещаю честность",
      "если экономика не сойдётся — закрою сам"
    ]
  }
]
```

---

## Реестр типов проектов (projects.json — шаблоны)

```json
[
  {
    "templateId": "clicker_basic",
    "type": "CLICKER",
    "namePatterns": ["[Name]Tap", "Tap2Earn [Name]", "[Name] Clicker"],
    "descriptionTemplate": "Тапай монеты, приглашай друзей, получай токен на листинге.",
    "claimedAPYRange": [200, 1500],
    "claimedUserCountRange": [10000, 500000],
    "roadmapTemplates": [
      ["Запуск бота", "100к юзеров", "Листинг на Gate", "CEX-листинг"],
      ["Тап-фаза", "Реферальная система", "Токен-дроп", "Биржа"]
    ],
    "compatiblePersonas": ["pasha_kharkiv", "crypto_alinka", "amir_blockchain"],
    "fateWeights": {"INSTANT_SCAM": 40, "SLOW_DRAIN": 35, "HONEST_FAIL": 15, "SURVIVOR": 8, "UNICORN": 2}
  },
  {
    "templateId": "p2e_rpg",
    "type": "P2E_RPG",
    "namePatterns": ["[Name] Heroes", "Crypto [Name] War", "[Name] Quest"],
    "descriptionTemplate": "Купи NFT-героя, участвуй в битвах, зарабатывай токены.",
    "claimedAPYRange": [50, 300],
    "claimedUserCountRange": [5000, 100000],
    "roadmapTemplates": [
      ["Альфа-тест", "Продажа NFT", "Сезон 1", "Токен на DEX", "CEX"],
      ["Открытый бета", "PvP-режим", "Гильдии", "Маркетплейс NFT"]
    ],
    "compatiblePersonas": ["dmitriy_sergeevich", "web3_dev_anon", "kz_nurlan", "max_serial_founder"],
    "fateWeights": {"INSTANT_SCAM": 20, "SLOW_DRAIN": 25, "HONEST_FAIL": 25, "SURVIVOR": 20, "UNICORN": 10}
  },
  {
    "templateId": "farming_bot",
    "type": "FARMING_BOT",
    "namePatterns": ["[Name] Farm", "[Name] Yield Bot", "Auto[Name]"],
    "descriptionTemplate": "Бот автоматически фармит токены. Пассивный доход без действий.",
    "claimedAPYRange": [500, 5000],
    "claimedUserCountRange": [1000, 30000],
    "roadmapTemplates": [
      ["Запуск бота", "Добавление пулов", "Токен управления", "DAO"]
    ],
    "compatiblePersonas": ["amir_blockchain", "pasha_kharkiv"],
    "fateWeights": {"INSTANT_SCAM": 50, "SLOW_DRAIN": 30, "HONEST_FAIL": 10, "SURVIVOR": 8, "UNICORN": 2}
  },
  {
    "templateId": "referral_pyramid",
    "type": "REFERRAL_PYRAMID",
    "namePatterns": ["[Name] Network", "[Name] Community Earn", "Team[Name]"],
    "descriptionTemplate": "Экосистема взаимного заработка. 3 уровня рефералов.",
    "claimedAPYRange": [30, 150],
    "claimedUserCountRange": [20000, 200000],
    "roadmapTemplates": [
      ["Набор команды", "Запуск маркетплейса", "Токен", "Стейкинг"]
    ],
    "compatiblePersonas": ["crypto_alinka", "pasha_kharkiv", "dmitriy_sergeevich"],
    "fateWeights": {"INSTANT_SCAM": 25, "SLOW_DRAIN": 50, "HONEST_FAIL": 15, "SURVIVOR": 9, "UNICORN": 1}
  },
  {
    "templateId": "honest_gamefi",
    "type": "HONEST_GAMEFI",
    "namePatterns": ["[Name] Protocol", "[Name] Finance Game", "[Name] DAO"],
    "descriptionTemplate": "Честная GameFi с открытым кодом, аудитом и рабочей токеномикой.",
    "claimedAPYRange": [15, 80],
    "claimedUserCountRange": [2000, 50000],
    "roadmapTemplates": [
      ["Аудит", "Тест-сеть", "Основная сеть", "DAO-управление", "Мультичейн"]
    ],
    "compatiblePersonas": ["web3_dev_anon", "kz_nurlan", "max_serial_founder", "not_scam_team"],
    "fateWeights": {"INSTANT_SCAM": 5, "SLOW_DRAIN": 10, "HONEST_FAIL": 30, "SURVIVOR": 40, "UNICORN": 15}
  }
]
```

---

## Игровая экономика

Валюта — TON (Toncoin). Все суммы в Double, отображать с точностью до 2 знаков.

| Параметр | Значение |
|---|---|
| Стартовый баланс | **0 TON** |
| Онбординг-бонус | ~0.5 TON (выплата за первую AMA в обучающем проекте) |
| Мин. инвестиция | 0.1 TON |
| Макс. инвестиция | 50 TON на проект |
| Активных проектов | max 5 |
| Новых предложений в день | 1–3 |
| Доходность SURVIVOR | 0.3–1.5% в день от вложенного |
| Доходность UNICORN | 2–10% в день (нарастает) |
| Потеря при INSTANT_SCAM | 80–100% депозита |
| Потеря при SLOW_DRAIN | 30–70% депозита |
| Репутация | растёт за угаданные скамы, падает за потери |

**Стартовый путь:** 0 TON → онбординг-проект (гарантированная выплата 0.5 TON) → первые реальные решения.

---

## Ежедневный цикл (логика AdvanceDayUseCase)

```
1. Для каждого активного проекта:
   a. Уменьшить daysUntilCollapse на 1
   b. Если daysUntilCollapse == 0 → закрыть проект, списать потери в TON
   c. Иначе → начислить realDailyYieldTON от депозита
   d. Сгенерировать апдейт через DeepSeek (GenerateDailyUpdatesUseCase)

2. Сгенерировать 1–3 новых проекта в inbox:
   a. Выбрать тип по весам вероятности
   b. Выбрать архетип, совместимый с типом
   c. Назначить судьбу (fate) по весам из шаблона
   d. Сгенерировать daysUntilCollapse согласно fate
   e. Назначить lieTopics
   f. Сгенерировать имя разработчика через DeepSeek (лёгкий запрос)
   g. Запустить GenerateProjectBannerUseCase в фоне (DeepSeek концепт → FLUX)

3. Обновить GameState: баланс в TON, rank, streak, статистику

4. Отправить push-уведомления (WorkManager)
```

---

## Push-уведомления

Каналы:
- `channel_daily` — «Новый день в симуляторе» (ежедневно в выбранное время)
- `channel_project` — апдейты по проектам (при старте нового дня)
- `channel_alert` — тревожные сигналы (когда проект на грани закрытия)

---

## Скрины и навигация

```
NavGraph (Compose Navigation):

HomeScreen
  → InboxScreen          (кнопка «Входящие N»)
    → AmaScreen          (выбор проекта из inbox)
      → InvestModal      (bottomsheet после AMA)
  → PortfolioScreen      (список активных + история)
    → ProjectDetailScreen
  → NewsScreen           (лента апдейтов)
  → StatsScreen          (статистика + ранг)
  → PersonaRegistryScreen (открывается после первой встречи с персонажем)
```

---

## Конфигурация и константы

```kotlin
object GameConfig {
    const val STARTING_BALANCE = 0.0          // TON, старт с нуля
    const val ONBOARDING_BONUS_TON = 0.5      // выплата за обучающую AMA
    const val MAX_ACTIVE_PROJECTS = 5
    const val AMA_MAX_QUESTIONS = 10
    const val MIN_INVESTMENT_TON = 0.1
    const val MAX_INVESTMENT_TON = 50.0
    const val NEW_PROJECTS_PER_DAY_MIN = 1
    const val NEW_PROJECTS_PER_DAY_MAX = 3

    // OpenRouter — текст
    const val OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/"
    const val TEXT_MODEL = "deepseek/deepseek-chat-v3-0324"
    const val MAX_TOKENS_AMA = 512
    const val MAX_TOKENS_UPDATE = 400
    const val MAX_TOKENS_POSTMORTEM = 600
    const val MAX_TOKENS_NAME_GEN = 20         // имя разраба — очень короткий запрос
    const val MAX_TOKENS_BANNER_CONCEPT = 120  // концепт для FLUX

    // OpenRouter — изображения
    const val IMAGE_MODEL = "black-forest-labs/flux-schnell"
    const val BANNER_IMAGE_SIZE = "512x512"
}
```

---

## Ключевые правила для Claude Code

- Все скрытые параметры (`fate`, `personaArchetype`, `daysUntilCollapse`, `lieTopics`, `realDailyYieldTON`) **никогда** не передаются во View/UI напрямую — только после закрытия проекта в PostMortem
- `personaArchetype` не отображается нигде до завершения проекта — только `developerName` виден игроку
- OpenRouter API вызывается **только через UseCase**, не из ViewModel напрямую
- Три типа запросов к DeepSeek: AMA-диалог, генерация имени разраба, концепт баннера — все через один `OpenRouterApiService`
- Баннер: DeepSeek-концепт + FLUX-картинка генерируются один раз, URL хранится в Room, кэш Coil — повторных запросов нет
- Если генерация баннера или имени упала — показывать placeholder и дефолтное имя, не крашить
- Валюта везде в UI — TON, Double с точностью до 2 знаков
- Онбординг-проект — первый проект игрока — всегда `HONEST_FAIL` с гарантированной выплатой `ONBOARDING_BONUS_TON` вне зависимости от инвестиции
- Каждая AMA-сессия — отдельный объект `AmaSession` с историей, сохраняется в Room
- При закрытии проекта — генерировать `PostMortemReport` с раскрытием архетипа и разбором красных флагов
- Тёмная тема — основная, светлая опциональна
- Язык UI — русский
- Не использовать `SharedPreferences` — только Room
