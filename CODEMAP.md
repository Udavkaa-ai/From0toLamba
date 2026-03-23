# CODEMAP — «С 0 до Ламбы»
> Карта зависимостей проекта. Обновляй при добавлении новых файлов.
> Используй чтобы понять, какие файлы нужно изменить при правке любого слоя.

---

## Слои и правило изменений

```
domain/model  ←  domain/repository  ←  domain/usecase
                        ↑                     ↑
                  data/repository       presentation/vm
                        ↑
                  data/db + data/ai
```

**Если меняешь модель** → меняй Entity + маппер toEntity/toDomain + Repository (интерфейс и impl)
**Если меняешь Repository** → меняй impl + DI module + все UseCase что его инжектируют
**Если меняешь UseCase** → меняй ViewModel который его вызывает
**Если меняешь GameConfig** → могут сломаться UseCases + Screens где константа использована напрямую

---

## Доменные модели → Entity → DAO → Repository

### Project
| Слой | Файл |
|---|---|
| Domain model | `domain/model/Project.kt` — `ProjectType`, `ProjectFate`, `LieTopic`, `Project` |
| DB Entity | `data/db/entity/ProjectEntity.kt` — маппер `toDomain(gson)` / `toEntity(gson)` |
| DAO | `data/db/dao/ProjectDao.kt` |
| Repository interface | `domain/repository/ProjectRepository.kt` |
| Repository impl | `data/repository/ProjectRepositoryImpl.kt` |
| DI binding | `di/RepositoryModule.kt` — `bindProjectRepository` |
| **Используют** | `InboxViewModel`, `PortfolioViewModel`, `AmaViewModel`, `PersonaRegistryViewModel` |
| **UseCase зависимости** | `GenerateProjectUseCase`, `AdvanceDayUseCase`, `InvestUseCase`, `ExitProjectUseCase`, `SendAmaMessageUseCase`, `StartAmaSessionUseCase` |

### GameState
| Слой | Файл |
|---|---|
| Domain model | `domain/model/GameState.kt` — `InvestorRank`, `GameState` |
| DB Entity | `data/db/entity/GameStateEntity.kt` — маппер |
| DAO | `data/db/dao/PlayerDao.kt` |
| Repository interface | `domain/repository/GameStateRepository.kt` |
| Repository impl | `data/repository/GameStateRepositoryImpl.kt` |
| DI binding | `di/RepositoryModule.kt` — `bindGameStateRepository` |
| **Используют** | `HomeViewModel`, `StatsViewModel`, `OnboardingScreen` (через initializeGameState) |
| **UseCase зависимости** | `AdvanceDayUseCase`, `InvestUseCase`, `ExitProjectUseCase` |

### AmaSession / AmaMessage / PostMortemReport
| Слой | Файл |
|---|---|
| Domain model | `domain/model/AmaSession.kt` — `AmaSession`, `AmaMessage`, `MessageRole`, `PostMortemReport` |
| DB Entity | `data/db/entity/AmaSessionEntity.kt` — `AmaSessionEntity` + `AmaMessageEntity` |
| DAO | `data/db/dao/AmaDao.kt` |
| Repository interface | `domain/repository/AmaRepository.kt` |
| Repository impl | `data/repository/AmaRepositoryImpl.kt` |
| DI binding | `di/RepositoryModule.kt` — `bindAmaRepository` |
| **Используют** | `AmaViewModel` |
| **UseCase зависимости** | `StartAmaSessionUseCase`, `SendAmaMessageUseCase` |

### DailyUpdate
| Слой | Файл |
|---|---|
| Domain model | `domain/model/DailyUpdate.kt` |
| DB Entity | `data/db/entity/UpdateEntity.kt` — маппер |
| DAO | `data/db/dao/UpdateDao.kt` |
| Repository interface | `domain/repository/UpdateRepository.kt` |
| Repository impl | `data/repository/UpdateRepositoryImpl.kt` |
| DI binding | `di/RepositoryModule.kt` — `bindUpdateRepository` |
| **Используют** | `NewsViewModel` |
| **UseCase зависимости** | `GenerateDailyUpdatesUseCase` |

### DeveloperPersona
| Слой | Файл |
|---|---|
| Domain model | `domain/model/DeveloperPersona.kt` — `PersonaArchetype`, `DeveloperPersona` |
| JSON-реестр | `assets/registry/personas.json` |
| Загрузка | `data/registry/PersonaRegistry.kt` — `getPersona(archetype)`, `getCompatibleArchetype(ids)` |
| DI | Hilt `@Singleton @Inject constructor` — нет модуля, автобиндинг |
| **UseCase зависимости** | `GenerateProjectUseCase`, `SendAmaMessageUseCase` |
| **UI** | `PersonaRegistryScreen.kt` — extension props `displayName`, `emoji`, `description` |

---

## UseCase — что инжектируют

| UseCase | Зависимости |
|---|---|
| `GenerateProjectUseCase` | `ProjectRepository`, `GameStateRepository`, `PersonaRegistry`, `ProjectRegistry`, `OpenRouterApiService` |
| `GenerateProjectBannerUseCase` | `ProjectRepository`, `OpenRouterApiService`, `PromptBuilder` |
| `GenerateDailyUpdatesUseCase` | `UpdateRepository`, `OpenRouterApiService`, `PromptBuilder` |
| `StartAmaSessionUseCase` | `AmaRepository`, `ProjectRepository` |
| `SendAmaMessageUseCase` | `AmaRepository`, `ProjectRepository`, `PersonaRegistry`, `AmaSessionManager` |
| `InvestUseCase` | `ProjectRepository`, `GameStateRepository` |
| `ExitProjectUseCase` | `ProjectRepository`, `GameStateRepository` |
| `PartialWithdrawUseCase` | `ProjectRepository`, `GameStateRepository` |
| `AdvanceDayUseCase` | `GameStateRepository`, `ProjectRepository`, `GenerateProjectUseCase`, `GenerateDailyUpdatesUseCase` |

---

## ViewModel → UseCase → Repository

```
HomeScreen
  └─ HomeViewModel
       ├─ GameStateRepository (observeGameState)
       └─ AdvanceDayUseCase
            ├─ GameStateRepository
            ├─ ProjectRepository
            ├─ GenerateProjectUseCase
            └─ GenerateDailyUpdatesUseCase

InboxScreen
  └─ InboxViewModel
       └─ ProjectRepository (getInboxProjects)

AmaScreen
  └─ AmaViewModel
       ├─ StartAmaSessionUseCase → AmaRepository + ProjectRepository
       ├─ SendAmaMessageUseCase → AmaRepository + ProjectRepository + PersonaRegistry + AmaSessionManager
       ├─ InvestUseCase → ProjectRepository + GameStateRepository
       ├─ GameStateRepository (recordIntuitionPoints)
       ├─ AmaRepository (observeSession, markIntuitionEvaluated)
       └─ ProjectRepository (getProjectById)

PortfolioScreen / ProjectDetailScreen
  └─ PortfolioViewModel
       ├─ ProjectRepository (getActiveProjects, getClosedProjects)
       ├─ ExitProjectUseCase → ProjectRepository + GameStateRepository
       ├─ InvestUseCase → ProjectRepository + GameStateRepository
       └─ PartialWithdrawUseCase → ProjectRepository + GameStateRepository

NewsScreen
  └─ NewsViewModel
       └─ UpdateRepository (observeUpdates)

StatsScreen
  └─ StatsViewModel
       └─ GameStateRepository (observeGameState)

PersonaRegistryScreen
  └─ PersonaRegistryViewModel
       └─ ProjectRepository (getClosedProjects)
```

---

## AI-слой

```
AmaSessionManager
  ├─ OpenRouterApiService  (Retrofit, chatCompletion)
  └─ PromptBuilder         (buildAmaSystemPrompt)

GenerateProjectUseCase (инлайн)
  └─ OpenRouterApiService  (chatCompletion для имени разработчика)

GenerateDailyUpdatesUseCase
  ├─ OpenRouterApiService  (chatCompletion → JSON апдейт)
  └─ PromptBuilder         (buildDailyUpdatePrompt)

GenerateProjectBannerUseCase
  ├─ OpenRouterApiService  (chatCompletion → концепт, generateImage → FLUX)
  └─ PromptBuilder         (buildBannerConceptPrompt, buildFinalImagePrompt)
```

**PromptBuilder** — чистый класс без зависимостей, методы:
- `buildAmaSystemPrompt(project, persona, questionCount)`
- `buildDeveloperNamePrompt(archetype)`
- `buildDailyUpdatePrompt(project)`
- `buildBannerConceptPrompt(projectName)`
- `buildFinalImagePrompt(concept)`
- `buildPostMortemPrompt(project, session)` ← **НЕ ВЫЗЫВАЕТСЯ** (задача: интегрировать в ExitProjectUseCase)

---

## DI модули

| Модуль | Что предоставляет |
|---|---|
| `di/DatabaseModule.kt` | `AppDatabase` (Room), все DAO (`ProjectDao`, `PlayerDao`, `AmaDao`, `UpdateDao`) |
| `di/NetworkModule.kt` | `OkHttpClient`, `Gson`, `Retrofit`, `OpenRouterApiService` |
| `di/RepositoryModule.kt` | Binds: `ProjectRepository→Impl`, `GameStateRepository→Impl`, `AmaRepository→Impl`, `UpdateRepository→Impl` |

**Авто-инжектируемые (нет модуля):** `PersonaRegistry`, `ProjectRegistry`, `PromptBuilder`, `AmaSessionManager`, все UseCase

---

## Навигация

```
NavGraph.kt
  NavViewModel (проверяет isOnboardingComplete → роутинг)

Маршруты:
  "onboarding"           → OnboardingScreen
  "home"                 → HomeScreen (+ bottom nav)
  "inbox"                → InboxScreen
  "ama/{projectId}"      → AmaScreen  ← projectId через SavedStateHandle
  "portfolio"            → PortfolioScreen
  "project/{projectId}"  → ProjectDetailScreen ← projectId через SavedStateHandle
  "news"                 → NewsScreen
  "stats"                → StatsScreen
  "registry"             → PersonaRegistryScreen

Bottom Nav (в HomeScreen): Home | Inbox | Portfolio | News | Stats
```

---

## База данных

```
AppDatabase.kt (Room, version=9, fallbackToDestructiveMigration)
  Таблицы:
  ├─ projects          ← ProjectEntity
  ├─ game_state        ← GameStateEntity   (+ investedHistory, intuitionScore, pendingRankUp)
  ├─ ama_sessions      ← AmaSessionEntity  (+ isIntuitionEvaluated)
  ├─ ama_messages      ← AmaMessageEntity  (FK → ama_sessions.id CASCADE DELETE)
  ├─ daily_updates     ← UpdateEntity
  └─ post_mortems      ← PostMortemEntity
```

**ВАЖНО:** При добавлении нового поля в Entity — нужна миграция Room или версия БД +1.
Текущая политика: `fallbackToDestructiveMigration` — данные сотрутся. Пока ок для dev.

---

## Логирование

```
AppLogger.kt (data/logging/AppLogger.kt)
  ├─ init(context)           ← вызов в GameApplication.onCreate()
  ├─ i(tag, msg)             ← info
  ├─ e(tag, msg, throwable)  ← error + stacktrace
  ├─ crash(throwable)        ← UncaughtExceptionHandler
  ├─ readLog()               ← последние 8k символов
  └─ share(context)          ← Android share sheet (файл через FileProvider)

FileProvider:
  ├─ AndroidManifest.xml     ← провайдер с authority "${applicationId}.fileprovider"
  └─ res/xml/file_provider_paths.xml  ← путь files-path/logs/

UI: StatsScreen → LogCard → кнопки "Просмотр" (AlertDialog) + "Поделиться" (share sheet)
```

**Как скинуть лог:** открой Stats → Логи приложения → Поделиться → выбери Telegram/почту

---

## Внешние ресурсы

| Ресурс | Путь |
|---|---|
| Personas JSON | `app/src/main/assets/registry/personas.json` |
| Projects JSON | `app/src/main/assets/registry/projects.json` |
| Banner placeholder | `app/src/main/res/drawable/banner_placeholder.xml` (нужно создать) |
| File provider paths | `app/src/main/res/xml/file_provider_paths.xml` |
| Notification channels | Создаются в `GameApplication.onCreate()` |
| API ключ | `local.properties` → `BuildConfig.OPENROUTER_API_KEY` |

---

## Что ещё не реализовано (известные задачи)

| Задача | Где нужен код |
|---|---|
| PostMortem AI-генерация | `ExitProjectUseCase` — вызвать `PromptBuilder.buildPostMortemPrompt` + сохранить через `AmaRepository.savePostMortem` |
| DailyReminderWorker | Новый файл `data/worker/DailyReminderWorker.kt` с `@HiltWorker`; зарегистрировать через WorkManager в `AdvanceDayUseCase` или `GameApplication` |
| Banner placeholder drawable | `res/drawable/banner_placeholder.xml` — нужен для `ProjectBannerImage.kt` |
