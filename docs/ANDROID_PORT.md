# Перенос игры на нативный Android (Kotlin/Compose)

> Документ-стартовая точка для отдельной ветки и нового чата. Цель — портировать
> всё что было сделано в Telegram-версии (`tg/`) в нативное Android-приложение
> (`app/`), которое уйдёт в Google Play.

---

## TL;DR — почему делаем

Telegram-версия (`tg/`) технически готова и работает, но игроков **5-7 человек**
после месяца в Telegram. В Google Play конкуренция жёстче, но и аудитория сильно
больше + ASO + потенциал органики. Дедлайнов нет, делается «как надо», без
компромиссов и WebView-обёрток.

---

## Состояние двух кодовых баз

### `app/` — старый Android (заморожен 30 апреля 2026)

| Параметр | Значение |
|---|---|
| Размер | ~8.8к строк Kotlin |
| Стек | Kotlin + Jetpack Compose + Hilt (DI) + Room (SQLite) + KSP |
| Архитектура | Clean: `domain/` → `data/` → `presentation/`, MVVM (ViewModels) |
| Хранилище | Локально (Room) — нет сервера |
| AI | Прямые вызовы к OpenRouter из клиента (BuildConfig ключ) |
| Что было сделано | 1 мини-игра (Купеческая грамота), главная/инбокс/портфель/беседа/настройки/онбординг/летопись |
| Документация | `CODEMAP.md` — карта зависимостей (271 строка). **Прочитать в первую очередь.** |

Файлы для входа:
- `app/build.gradle.kts` — зависимости + ключи в `local.properties`
- `CODEMAP.md` — карта связей domain/data/presentation
- `app/src/main/kotlin/com/s0dolamby/game/domain/model/` — модели предметной области
- `app/src/main/kotlin/com/s0dolamby/game/domain/usecase/` — бизнес-логика
- `app/src/main/kotlin/com/s0dolamby/game/data/db/` — Room-схема (старая, нужно расширять)

### `tg/` — текущая Telegram-версия (активна, ~3 месяца разработки)

| Параметр | Значение |
|---|---|
| Размер | ~32.5к строк TypeScript (24к клиент + 8.5к сервер) |
| Клиент | React + Vite + Zustand + framer-motion + Pixi.js + Three.js (план) |
| Сервер | Fastify + Prisma + PostgreSQL, на Railway |
| Auth | HMAC от Telegram initData |
| Документация | `CLAUDE.md` (актуальная) — описание всех систем |

Файлы для входа:
- `CLAUDE.md` — единственный источник правды по архитектуре tg/
- `tg/server/prisma/schema.prisma` — текущая схема БД (источник правды по моделям)
- `tg/server/src/game/types.ts` — enum'ы (ProjectType, ProjectFate, PersonaArchetype, InvestorRank) + FATE_CONFIG
- `tg/server/src/game/*.ts` — вся серверная игровая логика, ~4к строк
- `tg/client/src/components/minigames/*.tsx` — 7 мини-игр на PixiJS

---

## Что добавилось в `tg/` со времени заморозки `app/` (апрель → май 2026)

Это **дельта** которую нужно перенести в Android:

### Геймплей-системы
- **7 мини-игр** по архетипам хозяев (раньше была только одна):
  - `BOYARIN` → Купеческая грамота (24 печати, было)
  - `BURATINO` → Золотой ключик (поиск одинакового среди 7)
  - `KOSCHEI` → Память Кощея (memory match, 12 карт)
  - `KOLOBOK` → Нора-нора-нора (whack-a-mole)
  - `ZOLUSHKA` → Золушкино счастье (ловить настоящие монеты)
  - `BABA_YAGA` → Котёл (последовательность ингредиентов)
  - `IVAN_DURAK` → Переводной дурак (повтори карту)
- **Чуйка убрана** — чины теперь по числу взятых дел (5/20/50/100)
- **Жетоны хозяев** — за каждые 10 сыгранных игр или 5 взятых дел = 1 жетон.
  Тратится на бесплатную беседу или раскрытие подсказки вместо 10 ⭐
- **Завязки (Ties)** — уровни отношений с архетипом (0-10), каждый +1%/день
  к доходности дел этого хозяина (макс +10%)
- **VIP-дела от спонсоров** — гарантированные +200% за 14 дней, без испытания,
  по «заветному слову» с канала
- **Мафиозные принудительные выкупы** — за 2-3 дня до автозакрытия прибыльных
  дел показывается CTA «покинь сейчас», иначе автозакрытие возвращает 50%
- **Случайные события** при advance-day (NEGATIVE/POSITIVE/NEUTRAL)
- **Дополнительные слоты** — 1000 г или 10 ⭐ за слот сверх лимита 5 дел
- **Дневной ритуал** — ежедневная награда + streak-лесенка
- **Зал славы** — архив сезонов с замороженным топ-100

### Multiplayer (Telegram-специфика, на Android меняется)
- Глобальный чат «Ярмарочная площадь»
- Купеческий рейтинг (общий + по завязкам)
- Рефералы (+100г обоим за привод 3+ дел)
- Реферальные публичные эндпоинты для партнёров (UTM)
- Каналы-задания за подписку (+50г)

### Контент
- PostMortem (Летопись) для каждого закрытого дела — AI-генерация по
  скрытым полям дела + история беседы
- Дневные вести (AI-генерация изменений по делам)
- Имена дельцов и баннеры дел — AI-генерация
- Беседа (AMA) — 10 вопросов, AI отвечает в характере архетипа

### UI-системы
- **Темы**: classic (тёмный фиолет) и fairy (медово-золотой пергамент)
- **i18n RU + EN** — все строки. Дефолт EN, RU только если Telegram-клиент на ru
- **Чины**: Скоморох → Купец → Мудрец → Боярин → Князь (по числу взятых дел)
- **7 архетипов хозяев** с предгенерированными аватарками/баннерами/персонами

### Платежи
- **Telegram Stars** (4 фичи, по 10 ⭐): timer_skip, ama_unlock, extra_slot, minigame_bypass
- **TON Connect** — кошелёк + донат 0.1 TON

### Аналитика
- Telegram Analytics SDK (для каталога Apps Center)

---

## Главные решения которые нужно принять до старта

### 1. Сервер или local-only?

**Сервер (Fastify + PostgreSQL) перенести как есть в Android:**
- Все multiplayer-фичи работают (чат, рейтинги, рефералы)
- Auth: вместо initData использовать Google Sign-In / email-magic-link / просто
  device-id с серверной валидацией
- AI-генерация остаётся на сервере (контроль над расходом на OpenRouter)
- Минус: нужно поддерживать инфру, ежемесячные расходы Railway + DB

**Local-only (как было в `app/`):**
- AI-вызовы напрямую из клиента (есть в старом коде, ключ в BuildConfig)
- Игра полностью offline-capable
- Минус: нет чата, рейтингов, рефералов — это была одна из «фишек» tg-версии
- AI-ключ зашит в APK — кто угодно его извлечёт и будет жечь твой бюджет

**Гибрид:** local-only по умолчанию + опциональный sync с сервером для рейтингов
и чата. Сложнее в реализации, но даёт лучший UX.

**Рекомендация:** оставить сервер, **переиспользовать Fastify-API**. Auth
заменить с initData-HMAC на стандартную JWT-сессию по device-id. Сервер уже
работает, схема БД готова — главное не дублировать.

### 2. Платежи: Stars vs Google Play Billing

Telegram Stars **не работают вне Telegram** — придётся выпилить или заменить
на in-app purchases через Google Play Billing Library. Все 4 платных
фичи (timer_skip / ama_unlock / extra_slot / minigame_bypass) перепиать
на покупку через Play.

**Один из подходов:** не делать 4 разных IAP, а сделать единую виртуальную
валюту «Звёзды Лукоморья» через Play, которая тратится на те же фичи.

### 3. TON Connect — оставлять?

В Telegram TON-кошелёк связывают через `@tonconnect/ui-react`. На Android есть
TON Connect SDK (`@tonconnect/sdk` для headless или нативный wallet-deeplink).
Но монетизация через TON в Google Play под вопросом — Play требует чтобы все
платежи шли через Play Billing.

**Рекомендация:** убрать TON-донат в Android-версии. Если хочется crypto —
оставить только подключение кошелька как «бейдж» без денежных операций.

### 4. Мини-игры: Pixi/Canvas → Compose Canvas

Pixi-игры (~4.5к строк на 6 игр без BOYARIN) **не переносятся напрямую** —
PixiJS это WebGL-обёртка для JS, в Android её нет. Варианты:

**(a) Compose Canvas + ручная анимация** через `androidx.compose.foundation.Canvas`:
- Полностью нативно, отличный перфоманс
- Требует переписать каждую игру с нуля
- ~1-2 недели на игру среднего класса работы

**(b) Использовать Android-движок** (Korge, libGDX):
- Korge — Kotlin Multiplatform 2D game engine, ближе к Pixi
- Минус: ещё один большой стек добавить в проект
- Плюс: знакомый паттерн (Stage, Sprite, Ticker)

**(c) WebView для мини-игр**, остальное нативно:
- Pragmatic, но user сказал нет (хочет полный нативный)
- Скипаем

**Рекомендация:** **Compose Canvas + Animatable**. Для каждой игры закладывай
по 1-2 недели. Сначала простые (Kolobok = тапай по area), потом сложные
(Zolushka с двумя сторонами монет, BabaYaga с recipe-сложением).

---

## Предлагаемый план миграции (по фазам, не по неделям)

### Фаза 0 — Подготовка

- Создать новую ветку (например `android/v2`) от текущего `main` (`origin/main`)
- Обновить Gradle deps до актуальных (Compose, Hilt, Room, Coil)
- Перевести `CODEMAP.md` на новую структуру с пометкой «отстал от tg/, обновляется»
- Решить вопросы из «Главные решения» (см. выше)

### Фаза 1 — Расширение domain-моделей и Room-схемы

В `app/`:
- Добавить enum'ы `PersonaArchetype`, `MinigameArchetypeStats`, `ArchetypeTokenBalance`
- Расширить `GameStateEntity`: `extraSlotsBalance`, `archetypeTokens`, `archetypeTokensSpent`, `tieLevels`, `loginStreak`, `lastClaimedTodayReward`, `consecutiveAdvances`
- Добавить `ChatMessageEntity`, `LeaderboardCache`, `SeasonArchiveEntity`
- Добавить `randomEventsConfig`, `mafiaOfferState`
- Миграции Room — обязательно с тестом upgrade pathway

См. `tg/server/prisma/schema.prisma` как источник правды.

### Фаза 2 — Перенос игровой логики (UseCase)

В `app/src/main/kotlin/.../domain/usecase/`:
- `GenerateProjectUseCase` — порт из `tg/server/src/game/GenerateProjectService.ts`
- `AdvanceDayUseCase` — порт из `AdvanceDayService.ts` + интеграция с
  `randomEvents.ts` и `mafiaOffers.ts`
- `InvestUseCase` — расширить с `tg/server/src/game/InvestService.ts`
- `TokenSpendUseCase` — новый (см. `tokenService.ts`)
- `TiesService` — новый (см. `tiesService.ts`)
- `SponsorOfferService` — новый (см. `sponsorService.ts`)
- Сохранить детерминированность через single Random seed (для тестов)

### Фаза 3 — UI: главная + базовые экраны

- Пересобрать `HomeScreen` под новый дизайн (балансная карточка, чин,
  чип «Отношения с дельцами», превью инбокса)
- Inbox: карточки с баннером 16:9, VIP-маркеры
- Portfolio: активные дела + Cash Flow + Chronicle
- Settings: темы (classic/fairy), языки, музыка/звук, AI-модель
- Today (новый экран): дневной ритуал + streak + рейтинг

Не делать в этой фазе: AMA-чат, мини-игры, AI-генерация. Просто статичный UI
с фиктивными данными для verification.

### Фаза 4 — AI-генерация (через сервер или нет)

- Если сервер — настроить HTTP-клиент (Retrofit/Ktor) к Fastify-API
- Если local — выдрать `tg/server/src/ai/openRouterClient.ts` логику в
  `app/.../data/ai/OpenRouterClient.kt` (уже есть в старом коде, обновить
  под актуальные модели Gemini/DeepSeek)
- Системные промпты — взять из `buildAmaSystemPrompt` и т.д.
- Не забыть про `FATE_BEHAVIOR` подсказку для AMA-промпта

### Фаза 5 — Беседа (AMA)

- `AmaScreen` уже есть в `app/`, расширить:
  - 7 архетипов (раньше было меньше)
  - Tab-suggestions из i18n
  - Lock после 10 вопросов
  - Поле «обнаружено топиков лжи: X / N»
- AmaViewModel — состояние сессии, `forgedIndices` (если переходить с игр),
  стрим сообщений
- Шаблоны вопросов — переводы из `tg/client/src/pages/AmaPage.tsx`

### Фаза 6 — Мини-игры (самая длинная фаза)

Порядок по сложности (от простого к сложному):

1. **KOLOBOK** (Нора-нора-нора, ~1 неделя):
   - 5 нор, каждые 0.5-1.5с спавн зверушки или Колобка
   - Тап → +1 / −3
   - Compose Canvas + Animatable для прыжков

2. **KOSCHEI** (Память, ~1 неделя):
   - 12 карт grid, классический memory-match
   - Анимация переворота через `graphicsLayer { rotationY }`

3. **IVAN_DURAK** (Переводной дурак, ~1.5 недели):
   - 7 раундов, в руке 7 карт
   - Иван открывает 1 → найти такую же в руке за 2 сек
   - Шаффл руки между раундами
   - Карты как Compose-компоненты, ranks (`'6'..'10', 'В', 'Д'`) с локализацией

4. **BURATINO** (Золотой ключик, ~1 неделя):
   - 7 ключей, эталон 10 сек, поиск 10 сек
   - SVG-ключи как `Path` в Canvas или векторные ассеты

5. **ZOLUSHKA** (Падающие монеты, ~2 недели):
   - Монета с двумя сторонами (число/символ), эталон 5 сек
   - Падают настоящие (+1) и подделки (−2), 15 сек
   - 60fps падение + ловля по тапу
   - Самая сложная по анимации/геймплею после BABA_YAGA

6. **BABA_YAGA** (Котёл, ~2 недели):
   - Рецепт 5 ингредиентов показан 6 сек
   - Бросать в правильном порядке за 15 сек
   - Анимация падения ингредиента в котёл + плеск

7. **BOYARIN** (Купеческая грамота, ~1 неделя — уже была):
   - 24 печати с SVG-рендером (см. `tg/client/src/components/Seal.tsx`)
   - Эталон → найти подделки
   - Деривация подделок через seedRng

Всего: **~9-10 недель** только на мини-игры. Не торопиться, играбельность тут
ключевая.

### Фаза 7 — Мультиплеер (если решили оставить сервер)

- Чат-панель — WebSocket или поллинг к `/api/chat/messages`
- Рейтинги — `/api/leaderboard/wealth` + `/ties`
- Зал славы — `/api/season-archive`
- Рефералы — Android Install Referrer API + публичные эндпоинты

### Фаза 8 — Платежи

- Интеграция Google Play Billing Library 6+
- 4 продукта (consumable): timer_skip, ama_unlock, extra_slot, minigame_bypass
- Серверная валидация чеков через Play Developer API
- Альтернативно — единая валюта-обёртка

### Фаза 9 — i18n + полировка

- Compose strings.xml: ru, en
- Перенос всех ключей из `tg/client/src/i18n/index.ts` (~1.5к ключей)
- Тёмная/светлая темы (классическая + сказочная)
- Тур по интерфейсу для новых юзеров
- Аналитика (Firebase Analytics вместо Telegram Analytics)

### Фаза 10 — Релиз

- Google Play Console: setup ASO, screenshots, video
- Privacy policy, terms (использовать существующие из `tg/client/src/i18n/index.ts` → `settingsLegalText`)
- Beta-track для нескольких тестеров
- Production release

---

## Чего НЕ переносить (умышленные срезы)

- **Telegram Stars** — заменить на Google Play Billing
- **TON Connect on-chain** — убрать или оставить только подключение кошелька без донатов
- **`/start utm_xxx`** в боте — заменить на Play Install Referrer
- **Канал-задания** (`@vknyazi_izgryazi`, `@ssignet_ring`) — в Android не нужны
- **Telegram BackButton hook** — заменить на стандартный Android back-gesture
- **Telegram WebApp theme params** — использовать MaterialTheme

---

## Гочи и важные мелочи

- **`Math.floor(amount)`** в UI везде — никогда `.toFixed()` (см. CLAUDE.md)
- **Поле `personaArchetype` публичное**, всё остальное скрытое до PostMortem
- **i18n**: дефолт EN, переключение на ru только если Telegram-клиент на ru
  (в Android — `Locale.getDefault().language == "ru"`)
- **AI-промпты** в `tg/server/src/ai/openRouterClient.ts` — там много накопленных
  доработок, не упростить. `buildAmaSystemPrompt` с FATE_BEHAVIOR-подсказкой
  критично для качества AI-игры
- **Архитектура `domain/data/presentation`** в Android — выдержать. Не смешивать
  Compose с бизнес-логикой
- **Room migrations** — каждое изменение схемы обязательно тестировать
  на upgrade pathway (старая БД → новая)
- **Pixi-attribute** `eventMode='static'` для Telegram-версии — в Android этого
  нет, используем стандартные `Modifier.clickable` или `pointerInput`

---

## С чего начать новый чат

1. **Дать ассистенту прочитать `CLAUDE.md`** — он опишет всё что есть в tg/
2. **Дать прочитать `CODEMAP.md`** — структура Android-кода
3. **Дать прочитать этот файл** (`docs/ANDROID_PORT.md`)
4. **Ответить на «Главные решения» (раздел выше)** — это блокер для старта.
   Особенно:
   - Сервер или local-only?
   - Google Play Billing — единая валюта или 4 продукта?
   - TON оставлять?
5. **Создать новую ветку** `android/v2` от `origin/main`
6. **Начать с Фазы 1** — расширение Room-схемы под текущую модель данных

---

## Полезные ссылки внутри репо

- `CLAUDE.md` — актуальная архитектура tg/-версии
- `CODEMAP.md` — старая карта Android-кода (нужно поддерживать актуальной)
- `tg/server/prisma/schema.prisma` — источник правды по моделям БД
- `tg/server/src/game/types.ts` — enum'ы + FATE_CONFIG
- `tg/server/src/game/` — серверные сервисы (порт в Android-UseCase)
- `tg/client/src/i18n/index.ts` — все строки UI (1.5к ключей)
- `tg/client/src/components/minigames/` — 7 PixiJS-игр (порт в Compose Canvas)
- `app/src/main/kotlin/com/s0dolamby/game/` — целевая база
- `tools/banners/` — генерация ассетов (баннеры, фоны, аватары, персоны) через
  Vertex AI — это переиспользуется как есть
