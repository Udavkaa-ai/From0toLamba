# CLAUDE.md — «Из грязи в князи»
> Симулятор купца-инвестора в сказочной Руси. Android-приложение с AI-движком.

---

## Суть проекта

Мобильная игра, где игрок каждый день тратит ~10 минут на принятие решений о вложении рублей в сказочные дела (аналоги крипто-проектов). Большинство дел — обман. Задача — научиться отличать честных хозяев от жуликов через беседу с AI-персонажем.

**Ключевая механика:** AMA-сессия (беседа) — чат с AI-хозяином дела (до 10 вопросов). AI знает судьбу дела заранее, но скрывает это. Игрок задаёт вопросы и решает, вкладывать ли рубли.

**Старт с нуля:** игрок начинает с 0 ₽. Первые рубли — онбординг-бонус за участие в обучающей беседе (даже без вложения).

**Инкогнито хозяина:** у каждого дела — уникальное имя хозяина, сгенерированное AI. Архетип (Буратино, Кощей и т.д.) игрок не видит нигде в UI — только угадывает в ходе беседы. После закрытия дела архетип раскрывается в PostMortem.

---

## Технический стек

```
Language:          Kotlin
UI:                Jetpack Compose
Architecture:      MVVM + Clean Architecture (UseCase layer)
AI Text:           OpenRouter API → deepseek/deepseek-chat-v3-0324
AI Images:         OpenRouter API → black-forest-labs/flux-schnell
Local DB:          Room
Image Cache:       Coil
DI:                Hilt
Async:             Kotlin Coroutines + Flow
Network:           Retrofit + OkHttp
Notifications:     WorkManager + NotificationManager
Min SDK:           26 (Android 8.0)
Target SDK:        35
```

---

## Структура проекта

```
app/
├── data/
│   ├── db/                  # Room: entities, DAOs, AppDatabase
│   ├── repository/          # Реализации репозиториев
│   ├── ai/
│   │   ├── OpenRouterApiService.kt
│   │   ├── PromptBuilder.kt          # Все AI-промпты
│   │   └── AmaSessionManager.kt
│   └── registry/
│       ├── projects.json             # Шаблоны типов дел
│       └── personas.json             # Архетипы хозяев
├── domain/
│   ├── model/               # Доменные модели
│   ├── usecase/
│   │   ├── GenerateProjectUseCase.kt
│   │   ├── GenerateProjectBannerUseCase.kt
│   │   ├── StartAmaSessionUseCase.kt
│   │   ├── SendAmaMessageUseCase.kt
│   │   ├── InvestUseCase.kt
│   │   ├── ExitProjectUseCase.kt
│   │   ├── PartialWithdrawUseCase.kt     # Частичный вывод (тип-зависимые лимиты)
│   │   ├── AdvanceDayUseCase.kt
│   │   └── GenerateDailyUpdatesUseCase.kt
│   └── repository/
├── presentation/
│   ├── home/                # HomeScreen — баланс, активные дела; RankUpCelebrationOverlay
│   ├── inbox/               # ✦ Входящие грамоты ✦
│   ├── ama/                 # AmaScreen — беседа с хозяином
│   ├── portfolio/           # ✦ Казна ✦ — активные дела + история
│   ├── news/                # ✦ Вести с ярмарки ✦
│   ├── stats/               # ✦ Успехи купца ✦
│   ├── registry/            # ✦ Летопись ✦ — энциклопедия архетипов
│   └── common/
│       ├── components/
│       │   ├── FairyCard.kt          # Градиентная карточка с угловыми орнаментами
│       │   ├── FairyTaleDecorations.kt # SparklesOverlay, OrnamentDivider, CardCornerOrnaments
│       │   ├── ScreenBackground.kt   # Фон + градиентный оверлей + SparklesOverlay
│       │   └── ProjectBannerImage.kt
│       └── theme/            # FairyGold, EnchantedPurple, NightBlue, типографика
└── di/
```

---

## Доменные модели

### Project

```kotlin
enum class ProjectType {
    CARD_GAME,       // Азартная игра
    TREASURE_HUNT,   // Поиск клада
    POTION_BREW,     // Зелейное дело (пассивный доход)
    GUILD_SCHEME,    // Артель / Гильдия (реферальная пирамида)
    HONEST_TRADE     // Честная торговля
}

enum class ProjectFate {
    INSTANT_SCAM,    // Бежит с деньгами на 1–3 день, 30%
    SLOW_DRAIN,      // Держится 1–3 недели, тихо исчезает, 25%
    HONEST_FAIL,     // Честно старался, не взлетело, 15%
    SURVIVOR,        // Долгожитель, стабильный доход, 20%
    UNICORN          // Взлетел: слава и иксы, 10%
}

enum class LieTopic {
    PATRON_COUNT,      // Количество вкладчиков
    DAILY_PROFIT,      // Ежедневный доход
    PAYOUT_DATE,       // Дата выплат
    GUILD_SIZE,        // Размер артели
    ELDER_BLESSING,    // Проверка старейшин
    NOBLE_BACKING,     // Покровители
    WITHDRAWAL_LIMITS  // Ограничения на вывод
}

data class Project(
    val id: String,
    val name: String,
    val type: ProjectType,
    val developerPersonaId: String,

    // СКРЫТЫЕ — до PostMortem не показывать в UI
    val fate: ProjectFate,
    val personaArchetype: PersonaArchetype,
    val daysUntilCollapse: Int?,
    val realDailyYieldRubles: Double,  // доходность руб./день на 1 ₽ вложений
    val lieTopics: List<LieTopic>,
    val truthTopics: List<LieTopic>,

    // ПУБЛИЧНЫЕ — видит игрок
    val developerName: String,
    val developerAvatarSeed: String,
    val claimedName: String,
    val claimedAPY: Float,
    val claimedUserCount: Int,
    val claimedTeamSize: Int,
    val roadmap: List<String>,
    val description: String,

    // СОСТОЯНИЕ
    val investedAmountRubles: Double = 0.0,
    val currentValueRubles: Double = 0.0,  // растёт с каждым днём (yield копится внутри)
    val daysSinceJoined: Int = 0,
    val isActive: Boolean = false,
    val isClosed: Boolean = false,
    val closureReason: String? = null,
    val isWithdrawalLocked: Boolean = false,
    val currentUserCount: Int = 0,
    val userCountHistory: List<Int> = emptyList(),
    val apyHistory: List<Float> = emptyList(),
    val lieGuessCorrect: Boolean = false,

    // МЕДИА
    val bannerImageUrl: String? = null,
    val bannerPromptUsed: String? = null
)
```

### DeveloperPersona

```kotlin
enum class PersonaArchetype {
    BURATINO,      // Наивный лжец, верит своим выдумкам (← классический скамер)
    BOYARIN,       // Пышно-официальный, ссылается на великих партнёров без имён
    KOLOBOK,       // Хвастун-оптимист, от всех вопросов укатывается с улыбкой
    KOSCHEI,       // Холодный и бессмертно-уверенный, говорит цифрами
    ZOLUSHKA,      // Давит на жалость и мечты, дедлайны «до полуночи»
    BABA_YAGA,     // Отвечает загадками, технически подкована
    IVAN_DURAK     // Открыт про прошлые провалы — третий раз может взлететь
}
```

Архетип скрыт от игрока. Видно только `developerName` (генерируется DeepSeek). Раскрывается в PostMortem.

### GameState

```kotlin
data class GameState(
    val balance: Double,             // СВОБОДНЫЕ рубли (не вложенные)
    val currentDay: Int,
    val activeProjects: List<Project>,
    val pendingInbox: List<Project>,
    val investorRank: InvestorRank,
    val totalInvested: Double,
    val totalReturned: Double,
    val scamsDetected: Int,
    val scamsMissed: Int,
    val dayStreak: Int,
    val isOnboardingComplete: Boolean = false,
    val balanceHistory: List<Double> = emptyList(),
    val investedHistory: List<Double> = emptyList(),  // сумма currentValueRubles активных дел по дням
    val intuitionScore: Int = 0,                      // накопленные очки Чуйки
    val pendingRankUp: InvestorRank? = null            // сигнал для показа поздравления
)

enum class InvestorRank {
    NEWBIE,       // Скоморох
    AMBASSADOR,   // Купец — день 5+ или баланс 20+ ₽
    ANALYST,      // Мудрец — день 30+, баланс 300+, чуйка 10+
    SHARK,        // Богатырь — день 50+, баланс 1 000+, чуйка 30+
    LAMBO_SENSEI  // Царь — день 777+, баланс 7 777+, чуйка 77+
}
```

---

## Механика «Чуйка» (IntuitionScore)

В ходе AMA-беседы игрок видит полоску «👁 Чуйка» — набор `FilterChip` по каждой из 7 тем:

| Тема | Emoji |
|---|---|
| PATRON_COUNT — Количество вкладчиков | 👥 |
| DAILY_PROFIT — Ежедневный доход | 💰 |
| PAYOUT_DATE — Дата выплат | 📅 |
| GUILD_SIZE — Размер артели | 🏗️ |
| ELDER_BLESSING — Проверка старейшин | 📜 |
| NOBLE_BACKING — Покровители | 🏰 |
| WITHDRAWAL_LIMITS — Ограничения на вывод | 🔒 |

Игрок нажимает на темы, в которых подозревает ложь. После 10 вопросов кнопка «Оценить чуйку» открывает диалог:
- +1 очко за каждое верное подозрение (тема в `lieTopics` дела)
- −1 очко за ложное обвинение (тема в `truthTopics` дела)

Повторная оценка невозможна — `AmaSession.isIntuitionEvaluated` персистируется в Room.

`intuitionScore` учитывается в `computeRank()` наряду с днями и балансом (`totalWealth = balance + Σ currentValueRubles`).

---

## Игровая экономика

Валюта — рубли (₽, Double). Отображать с точностью до 0 знаков (`"%.0f ₽"`).

| Параметр | Значение |
|---|---|
| Стартовый баланс | **0 ₽** |
| Онбординг-бонус | ~50 ₽ (за первую обучающую беседу) |
| Мин. вложение | 5 ₽ |
| Макс. вложение | 5 000 ₽ на дело |
| Активных дел | max 5 |
| Новых предложений в день | 1–3 |
| Доходность SURVIVOR | 0.3–1.5% в день от вложенного |
| Доходность UNICORN | 2–10% в день (нарастает) |
| Потеря при INSTANT_SCAM | 80–100% текущей стоимости |
| Потеря при SLOW_DRAIN | 30–70% текущей стоимости |

### Механика баланса (ВАЖНО)

- `state.balance` — только **свободные** рубли (не вложены никуда)
- `project.currentValueRubles` — текущая стоимость вложения, растёт каждый день на `dailyYield`
- **Баланс меняется только при:** инвестировании (−), выходе из дела или закрытии дела (+)
- **Дневной доход НЕ уходит в свободный баланс** — он копится в `currentValueRubles` до момента вывода
- При закрытии дела возвращается `currentValueRubles × (1 − lossPercent)`

### Лимиты вывода по типу дела (`PartialWithdrawUseCase`)

| Тип дела | Правило вывода |
|---|---|
| POTION_BREW, GUILD_SCHEME | Максимум 25% от `investedAmountRubles` за раз |
| CARD_GAME, TREASURE_HUNT | Любая сумма, но −25% комиссии (возвращается 75%) |
| HONEST_TRADE | Без ограничений и без комиссии |

UI (`WithdrawBottomSheet` в Казне) показывает предупреждение о лимите/комиссии и live-превью «получишь на руки».

---

## AI-интеграция (OpenRouter)

```kotlin
// local.properties (не коммитить в VCS)
OPENROUTER_API_KEY=sk-or-...

object GameConfig {
    const val OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/"
    const val TEXT_MODEL = "deepseek/deepseek-chat-v3-0324"
    const val IMAGE_MODEL = "black-forest-labs/flux-schnell"
    const val BANNER_IMAGE_SIZE = "512x512"
    const val MAX_TOKENS_AMA = 512
    const val MAX_TOKENS_UPDATE = 400
    const val MAX_TOKENS_POSTMORTEM = 600
    const val MAX_TOKENS_NAME_GEN = 20
    const val MAX_TOKENS_BANNER_CONCEPT = 120
}
```

| Назначение | Модель | Стоимость |
|---|---|---|
| Беседа (AMA) | `deepseek/deepseek-chat-v3-0324` | ~$0.27 / 1M токенов |
| Ежедневные вести | `deepseek/deepseek-chat-v3-0324` | ~$0.27 / 1M токенов |
| PostMortem | `deepseek/deepseek-chat-v3-0324` | ~$0.27 / 1M токенов |
| Баннер дела | `black-forest-labs/flux-schnell` | ~$0.003 / картинка |

### Язык AI-ответов (ВАЖНО)

- **Хозяин дела (AMA):** современный живой русский. Можно изредка вставить народную присказку, но не в каждом ответе. Никакого нарочитого «старорусского».
- **Ежедневные вести:** современный русский с образными оборотами в меру. Без блокчейна, крипты, TON — только рубли.
- Все суммы — в рублях (₽).

---

## UI-компоненты и тема

### Цвета
```kotlin
val FairyGold = Color(0xFFFFB800)      // золото — акценты, заголовки
val EnchantedPurple = Color(0xFF2A1960) // тёмно-фиолетовый — карточки (верх)
val NightBlue = Color(0xFF0D1735)       // тёмно-синий — карточки (низ), фон
```

### Ключевые компоненты
- **`ScreenBackground`** — фон-картинка + вертикальный градиент (`0xD9060412 → 0xBF0A0818 → 0xF0060412`) + `SparklesOverlay`. Используется на всех экранах.
- **`FairyCard`** — карточка с градиентом `EnchantedPurple(88%) → NightBlue(95%)` + `CardCornerOrnaments`. Заменяет стандартный `Card` повсюду.
- **`SparklesOverlay`** — 22 анимированных золотых искры (Canvas, infinite transition).
- **`OrnamentDivider`** — золотой разделитель с ромбом между секциями.
- **`CardCornerOrnaments`** — золотые угловые скобки с точками на карточках.

### Стиль TopAppBar
Все экраны используют формат `✦ Название ✦` с `containerColor = Color.Transparent`.

### Экраны и их названия в UI
| Экран | Заголовок |
|---|---|
| HomeScreen | «Из грязи в князи» (логотип) |
| InboxScreen | ✦ Входящие грамоты ✦ |
| AmaScreen | Имя хозяина + название дела |
| PortfolioScreen | ✦ Казна ✦ |
| NewsScreen | ✦ Вести с ярмарки ✦ |
| StatsScreen | ✦ Успехи купца ✦ |
| PersonaRegistryScreen | ✦ Летопись ✦ |

---

## Словарь UI-терминов

| Современное слово | В интерфейсе |
|---|---|
| инвестиции / вложения | вложения |
| инвестировать | вложить |
| ранг инвестора | купеческий чин |
| график | ведомость |
| финансы | злато |
| текущее состояние | нынешнее положение |
| заявленный APY | посул (APY) |
| дней в портфеле | дней в деле |
| выйти из проекта | покинуть дело |
| скипнуть | миновать |
| управление инвестицией | распорядиться вложением |
| успехи инвестора | успехи купца |

---

## Ежедневный цикл (AdvanceDayUseCase)

```
Для каждого активного дела:
  a. Уменьшить daysUntilCollapse на 1
  b. Если daysUntilCollapse == 2 и скам-судьба → заблокировать вывод
  c. Если daysUntilCollapse <= 0 → закрыть, вернуть currentValueRubles × (1 − loss) в баланс
  d. Иначе → dailyYield = investedAmount × realDailyYield × 10 → добавить в currentValueRubles
  e. Случайное событие (10%) → изменить currentValueRubles проекта
  f. Сгенерировать весть (DeepSeek)

Обновить баланс только за счёт закрытых дел.
Сгенерировать 1–3 новых дела в Inbox.
Отправить push-уведомления.
```

---

## Ключевые правила

- Скрытые параметры (`fate`, `personaArchetype`, `daysUntilCollapse`, `lieTopics`, `realDailyYieldRubles`) **никогда** не передавать в View/UI напрямую — только после закрытия в PostMortem
- OpenRouter API вызывается **только через UseCase**, не из ViewModel
- Баннер генерируется один раз (DeepSeek концепт → FLUX), URL в Room, кэш Coil
- Если генерация баннера или имени упала — placeholder и дефолтное имя, не крашить
- Онбординг-проект — всегда `HONEST_FAIL` с гарантированной выплатой `ONBOARDING_BONUS`
- Каждая беседа — отдельный `AmaSession` с историей, сохраняется в Room
- При закрытии дела — генерировать `PostMortemReport` с раскрытием архетипа
- Тёмная тема — основная
- Язык UI — русский
- Не использовать `SharedPreferences` — только Room
- `state.balance` = только свободные рубли; дневной доход копится в `currentValueRubles`
- `updateRankIfNeeded()` вызывается ТОЛЬКО в `AdvanceDayUseCase` — не при инвестировании/выводе
- `computeRank()` использует: `totalWealth = balance + Σ activeProject.currentValueRubles`; `intuitionScore`; `currentDay`
- `pendingRankUp` в Room очищается через `clearRankUpNotification()` после показа `RankUpCelebrationOverlay`
- `IntuitionStrip` (полоска Чуйки) — FlowRow с emoji-only FilterChip, текстовые подписи — в диалоге «?»
- `ModalBottomSheet` с текстовым вводом всегда использует `rememberModalBottomSheetState(skipPartiallyExpanded = true)`
- DB version: **9** (fallbackToDestructiveMigration — данные при смене версии сотрутся, OK для dev)
