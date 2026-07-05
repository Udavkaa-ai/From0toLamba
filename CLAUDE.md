# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Язык проекта — русский: UI, комментарии, доменные термины, коммиты. Пиши в том же стиле.

## Что это

«Из грязи в князи» — симулятор купца-инвестора в сказочной Руси. Игрок вкладывает
гроши (₽, отображать `"%.0f г"`) в «дела» (аналоги крипто-проектов), большинство —
обман. Ядро — **беседа с AI-хозяином дела**: делец знает судьбу дела заранее, но
скрывает; игрок задаёт вопросы и решает, вкладывать ли.

В репозитории три приложения:

| Путь | Что | Статус |
|---|---|---|
| `app/` | **Android-приложение (Kotlin/Compose)** | Активная разработка, цель — Google Play |
| `tg/` | Telegram Mini App (React `client/` + Fastify `server/`) | Прежняя версия, деплой на Railway, в разработке не трогаем |
| `mobile-backend/` | Отдельный Fastify-сервис для Android | AI-прокси к OpenRouter + сбор фидбека тестеров |

Разработка Android идёт на фиче-ветке (`claude/android-port-*`). TG-сервер и его БД с
живыми игроками (6000+ записей) **не трогать** — Android изолирован через `mobile-backend`
со своей Postgres.

## Команды

```bash
# Android (из корня, есть ./gradlew)
./gradlew assembleDebug          # собрать debug APK → app/build/outputs/apk/debug/
./gradlew lintDebug              # ЛИНТ. abortOnError=true — падает от любой ошибки, не только warning
./gradlew test                   # unit-тесты (app/src/test)
./gradlew test --tests "com.s0dolamby.game.domain.ranks.RankServiceTest"   # один тест-класс

# mobile-backend
cd mobile-backend && npm install && npm run dev    # локально; заполнить .env из .env.example
npx tsc --noEmit                                    # быстрая проверка типов без запуска
```

Локального Android SDK в среде обычно нет — **проверка идёт через CI** (GitHub Actions
`Build Debug APK`: сначала джоб Lint Check `lintDebug`, затем Build `assembleDebug` + `test`).
После пуша дождись зелёного прогона; `lintDebug` — самый частый источник падений.

## Архитектура Android

Трёхслойка, пакет `com.s0dolamby.game`, DI через Hilt:

```
domain/model  ←  domain/repository (интерфейсы)  ←  domain/usecase
                          ↑                                ↑
                  data/repository (impl)            presentation/*ViewModel
                          ↑
                data/db (Room) + data/registry + data/ai
```

Правило изменений (подробная карта — `CODEMAP.md`):
- меняешь `domain/model` → правь `data/db/entity/*Entity.kt` + маппер `toEntity`/`toDomain` + Repository (интерфейс и impl)
- меняешь Repository → правь impl + DI-модуль + все use-case, что его инжектируют
- меняешь use-case → правь ViewModel, который его вызывает

### Room и миграции (критично)
- Единая БД `data/db/AppDatabase.kt`, версия растёт при каждом изменении схемы (сейчас **v25**).
- **Все миграции строго аддитивные** — только `ALTER TABLE ... ADD COLUMN` с DEFAULT.
  Прописываются в `di/DatabaseModule.kt` (`MIGRATION_N_N+1`) и добавляются в `.addMigrations(...)`.
  При добавлении поля: model → entity (+`@ColumnInfo(defaultValue)`) → маппер → миграция →
  bump версии в `AppDatabase`. `fallbackToDestructiveMigration()` включён, но полагаться на него
  нельзя — пиши миграцию.
- In-memory синглтоны (`*UnlockStore`, `DayNewsStore`) переживают чистку БД — при «Сбросе
  прогресса» их надо чистить явно (`clearAll()` в `SettingsViewModel.resetGame`), плюс
  `db.clearAllTables()` вызывать **на Dispatchers.IO** (иначе краш на главном потоке).

### Скрытые поля Project
`fate`, `personaArchetype`, `daysUntilCollapse`, `realDailyYieldRubles` — судьба дела.
Раскрываются постепенно: тип/посул — за мини-игру, всё остальное — только в PostMortem после
закрытия. Не показывай их в UI до закрытия.

### Контент: банки вместо AI
AI (нейросеть) вызывается **только** для ответов дельца на вопросы игрока в чате
(`data/ai/AmaSessionManager.sendMessage`). Всё остальное — детерминированные локальные банки,
работают офлайн:
- `data/registry/GreetingBank` — приветствие дельца
- `data/registry/DeveloperNameBank` — имена дельцов
- `data/registry/NewsTemplateBank` — ежедневные вести
- `data/registry/PostMortemScribe` — «разбор старца» (конструктор из блоков)
- `data/registry/ProjectRegistry`/`PersonaRegistry` — шаблоны дел и персон из `assets/registry/*.json`
- `domain/science/ScienceCatalog` — «Наука старца» (карты приёмов)

Добавляешь новую «сгенерированную» строку — не тяни AI, пиши банк.

### Основной игровой цикл
`domain/usecase/AdvanceDayUseCase` — сердце: прокручивает активные дела (доход/крах/события),
генерирует новые грамоты, разрешает недельную «Ярмарку», начисляет чуйку, обновляет чин/подвиги.
Экономика: `итоговый возврат = dailyYield × YIELD_MULTIPLIER(10) × дней жизни`; диапазоны судеб
в `domain/config/FateConfig` заданы так, чтобы UNICORN ≤ ~500%, честные исходы 20–150%.

### Генерация и сиды
«Ярмарка недели» (`domain/week/WeeklyFair`) даёт общий сид: `GenerateProjectUseCase` принимает
`rng: Random` (по умолчанию `Random.Default`, для недели — `Random(WeeklyFair.seed(...))`).
Архетип выбирается **равновероятно из всех семи**, потом совместимый шаблон (иначе частые в
`compatiblePersonas` дельцы вытесняют редких). Сезонные модификаторы — `WeekModifier`.

### UI-конвенции
- **i18n**: не Android-ресурсы, а in-memory `Strings.t(key, vararg)`
  (`presentation/common/i18n/Strings.kt`), словари RU + EN-fallback. Добавляешь строку — в обе
  карты. `Strings.t` — `@Composable`, вне композиции (LaunchedEffect и т.п.) не вызывать — хойстить.
- **Две темы** (тёмная ночь / тёплая ярмарка) концептуально разные. Цвета — из `LocalAppPalette`
  через `FairyCard`/`ProvideOnCardColors`. Правило: поверхности-карточки (пергамент в WARM)
  используют карточные локали (`LocalContentColor`, `LocalAccentOnCard`); фиксированно-тёмные
  поверхности — фиксированные `Color.White`/`FairyGold`. Material `colorScheme` всегда тёмная в
  обеих темах. TextField на карточках — `fairyOnCardTextFieldColors()`.
- **Без внешних спрайтов** (лицензии) — вся графика рисуется Canvas'ом или эмодзи.
- Навигация — единый `presentation/navigation/NavGraph.kt`; глобальные оверлеи (вести дня,
  подвиги, «Наука старца», день-переход) висят в корневом Box поверх NavHost.

## Тестовая инфраструктура фидбека (временная)

Язычок «🐞 Тестерам» (`presentation/feedback/`) на каждом экране: попап баг/идея/вопрос +
скриншот момента (PixelCopy), при открытии ставит на паузу таймерные мини-игры
(`FeedbackPauseBus` + `pausableDelay`). Уходит в `mobile-backend` → Postgres, смотрится на
`<домен>/admin/feedback?key=...`. **Перед релизом весь этот функционал удаляется** (пакет
`feedback/`, вызовы в NavGraph, строки `feedback.*`, сервис mobile-backend) + вайп прогресса.

## Ключевые доменные типы (`domain/model/`)

```
ProjectType:      CARD_GAME | TREASURE_HUNT | POTION_BREW | GUILD_SCHEME | HONEST_TRADE
ProjectFate:      INSTANT_SCAM(30%) | SLOW_DRAIN(25%) | HONEST_FAIL(15%) | SURVIVOR(20%) | UNICORN(10%)
PersonaArchetype: BURATINO | BOYARIN | KOLOBOK | KOSCHEI | ZOLUSHKA | BABA_YAGA | IVAN_DURAK
InvestorRank:     NEWBIE(0) → AMBASSADOR(5) → ANALYST(20) → SHARK(50) → LAMBO_SENSEI(100)  # по числу взятых дел
PlayerVerdict:    HONEST | SCAM  # «Верю — не верю», сверяется при закрытии → рейтинг чуйки
```

Правила вывода (`WITHDRAWAL_RULES`): POTION_BREW/GUILD_SCHEME — max 25% за раз;
CARD_GAME/TREASURE_HUNT — любая сумма, −25% комиссия; HONEST_TRADE — без ограничений.
Экономика: старт 0 ₽ → онбординг-бонус ~50 ₽; мин. вклад 5 ₽; макс. 5000 ₽/дело; макс.
5 активных дел (+доп. слоты за 1000 ₽).

## AI-интеграция

Android ходит через `mobile-backend` (не напрямую в OpenRouter): `BuildConfig.MOBILE_PROXY_URL`
+ заголовок `X-App-Key` = `BuildConfig.MOBILE_APP_KEY` (оба из `local.properties` / GitHub Secrets,
в код не коммитить). Серверный `OPENROUTER_API_KEY` живёт только на `mobile-backend`, в APK его нет.
Язык ответов AI: современный живой русский, суммы в грошах, без слов «блокчейн»/«крипто»/«TON».
