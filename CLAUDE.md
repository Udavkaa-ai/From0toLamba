# CLAUDE.md — «Из грязи в князи»
> Симулятор купца-инвестора в сказочной Руси. Telegram Mini App + (изначально) Android-приложение.

---

## Состояние проекта

**Активная версия:** Telegram Mini App (`tg/`) — v1.0.5
**Android:** код в `app/`, разработка заморожена — всё усилие на TG-версию
**Ветка разработки:** `claude/telegram-game-migration-FDnlX`

---

## Суть игры

Мобильная игра — симулятор инвестора в сказочной Руси. Игрок вкладывает рубли (₽) в «дела» (аналоги крипто-проектов), большинство из которых обман. Ключевая механика — **AMA-сессия**: чат с AI-хозяином дела (до 10 вопросов). AI знает судьбу дела заранее, но скрывает. Игрок задаёт вопросы и решает, вкладывать ли.

- **Стартовый баланс:** 0 ₽ → онбординг-бонус ~50 ₽
- **Валюта:** рубли (₽), отображать `"%.0f ₽"`
- **Архетип хозяина** скрыт до PostMortem

---

## Архитектура Telegram Mini App (`tg/`)

```
tg/
├── client/          # React + TypeScript + Vite + MUI
│   └── src/
│       ├── api/client.ts          # Все HTTP-запросы к серверу
│       ├── stores/gameStore.ts    # Zustand-стор (gameState, проекты)
│       ├── pages/                 # HomePage, InboxPage, AmaPage, PortfolioPage, StatsPage
│       │                          # LeaderboardPage, RegistryPage
│       ├── components/            # FairyCard, ScreenBackground, SparklesOverlay, BottomNav, RankUpOverlay
│       └── theme/colors.ts        # FairyGold, EnchantedPurple, NightBlue
└── server/          # Fastify + TypeScript + Prisma + PostgreSQL
    └── src/
        ├── index.ts               # Точка входа, регистрация плагинов и роутов
        ├── api/routes/
        │   ├── game.ts            # /api/game, /advance-day, /settings, /reset, /leaderboard, /version
        │   ├── projects.ts        # /api/projects/inbox, /portfolio, /updates, /skip
        │   ├── ama.ts             # /api/ama/:id/start|message|evaluate-intuition
        │   └── invest.ts          # /api/invest/:id (invest/add/withdraw/exit)
        ├── game/
        │   ├── types.ts           # Все энамы + FATE_CONFIG + WITHDRAWAL_RULES + ProjectPublicDTO
        │   ├── GenerateProjectService.ts  # AI-генерация нового дела + баннер Pollinations.ai
        │   ├── AmaSessionService.ts       # Чат с хозяином
        │   ├── AdvanceDayService.ts       # Ежедневный цикл + история
        │   ├── InvestService.ts           # Вложить/довложить/вывести/выйти + PostMortem при выходе
        │   ├── projectUtils.ts            # toPublicDTO (убирает скрытые поля)
        │   └── rankService.ts             # computeRank()
        ├── ai/openRouterClient.ts  # Запросы к OpenRouter (DeepSeek) + generateProjectBanner
        ├── bot/bot.ts              # Grammy Telegram bot
        ├── scheduler/dailyJob.ts   # node-cron — advance-day в 21:00 MSK
        ├── middleware/telegramAuth.ts  # Верификация X-Telegram-Init-Data
        ├── db/prisma.ts            # PrismaClient singleton
        └── data/personas.json      # Архетипы персонажей
    └── prisma/schema.prisma        # Полная схема БД
    └── .gitignore                  # Исключает public/ (сборка клиента — не коммитить!)
```

---

## API Reference

Все запросы требуют заголовок `X-Telegram-Init-Data` (Telegram.WebApp.initData).

### Game
| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/game` | Получить gameState + все проекты пользователя |
| POST | `/api/game/advance-day` | Прокрутить день вперёд |
| POST | `/api/game/clear-rank-up` | Очистить pendingRankUp после показа поздравления |
| POST | `/api/game/complete-onboarding` | Завершить онбординг (начисляет бонус ~50 ₽) |
| GET | `/api/game/settings` | Получить настройки (preferredModel) |
| POST | `/api/game/settings` | Обновить настройки |
| POST | `/api/game/reset` | Сбросить весь прогресс |
| GET | `/api/leaderboard` | Топ-100 игроков по totalWealth (без initData) |
| GET | `/api/version` | Текущая версия приложения (без initData) |

### Projects
| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/projects/inbox` | Входящие предложения |
| GET | `/api/projects/portfolio` | Активные + закрытые дела |
| GET | `/api/projects/:id/updates` | Ежедневные вести по делу |
| POST | `/api/projects/:id/skip` | Миновать (удалить из inbox) |

### AMA
| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/ama/:projectId/start` | Начать сессию беседы |
| GET | `/api/ama/:projectId` | Получить историю сессии |
| POST | `/api/ama/:projectId/message` | Отправить вопрос, получить ответ AI |
| POST | `/api/ama/:projectId/evaluate-intuition` | Оценить Чуйку (один раз) |

### Invest
| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/invest/:projectId` | Первое вложение |
| POST | `/api/invest/:projectId/add` | Довложить (max 5000 ₽, не при заблокированном выводе) |
| POST | `/api/invest/:projectId/withdraw` | Частичный вывод |
| POST | `/api/invest/:projectId/exit` | Выйти из дела полностью (запускает PostMortem async) |

---

## База данных (Prisma + PostgreSQL)

Схема: `tg/server/prisma/schema.prisma`

**Таблицы:** `User`, `GameState`, `Project`, `AmaSession`, `AmaMessage`, `DailyUpdate`, `PostMortem`, `Transaction`, `AdRevenue`

**КРИТИЧНО — скрытые поля `Project`:**
`fate`, `personaArchetype`, `daysUntilCollapse`, `realDailyYieldRubles`, `lieTopics`, `truthTopics`, `npcTruthParams` — **НИКОГДА** не отдавать клиенту напрямую. Использовать `toPublicDTO()` из `projectUtils.ts`.

**Поля истории для графиков:** `valueHistory`, `userCountHistory`, `apyHistory` — массивы последних 30 дней, обновляются в `AdvanceDayService`.

---

## Доменные типы (`tg/server/src/game/types.ts`)

```typescript
ProjectType:      CARD_GAME | TREASURE_HUNT | POTION_BREW | GUILD_SCHEME | HONEST_TRADE
ProjectFate:      INSTANT_SCAM(30%) | SLOW_DRAIN(25%) | HONEST_FAIL(15%) | SURVIVOR(20%) | UNICORN(10%)
PersonaArchetype: BURATINO | BOYARIN | KOLOBOK | KOSCHEI | ZOLUSHKA | BABA_YAGA | IVAN_DURAK
LieTopic:         PATRON_COUNT | DAILY_PROFIT | PAYOUT_DATE | GUILD_SIZE | ELDER_BLESSING | NOBLE_BACKING | WITHDRAWAL_LIMITS
InvestorRank:     NEWBIE → AMBASSADOR → ANALYST → SHARK → LAMBO_SENSEI
```

Правила вывода (`WITHDRAWAL_RULES`):
- `POTION_BREW`, `GUILD_SCHEME`: max 25% от вложенного
- `CARD_GAME`, `TREASURE_HUNT`: любая сумма, −25% комиссия
- `HONEST_TRADE`: без ограничений и без комиссии

---

## AI-интеграция

- **Провайдер:** OpenRouter (`https://openrouter.ai/api/v1/`)
- **Модели:** `deepseek/deepseek-chat-v3-0324` (по умолчанию) и `google/gemini-3.1-flash-lite-preview` (меняется в настройках через `preferredModel`)
- **Клиент:** `tg/server/src/ai/openRouterClient.ts`
- **Функции:** `generateAmaResponse`, `generateProjectName`, `generateDailyUpdate`, `generatePostMortem`, `generateProjectBanner`

**Баннеры дел:** генерируются через Pollinations.ai (`https://image.pollinations.ai/prompt/...`) — бесплатно, без API-ключа. Seed вычисляется из projectId. Сохраняются в `project.bannerImageUrl`.

**Язык ответов AI:** современный живой русский. Без нарочитого старорусского. Народные присказки — изредка. Все суммы в рублях. Без слов «блокчейн», «крипто», «TON».

---

## Деплой

**Хостинг: Railway** (`https://railway.app`)
- Сервис: `From0toLamba` — деплой из GitHub `udavkaa-ai/from0tolamba`, Dockerfile в корне
- БД: PostgreSQL-сервис на Railway, `DATABASE_URL` прокинут через `${{Postgres.DATABASE_URL}}`
- Домен: `https://from0tolamba-production.up.railway.app`
- Бот: `@vknyazi_bot`

При деплое Railway сам собирает Docker-образ. При старте контейнера автоматически:
1. `prisma db push --accept-data-loss` — синхронизирует схему БД
2. `tsx src/index.ts` — запускает сервер

- `NODE_ENV=production`: webhook Telegram + cron на 21:00 MSK
- `NODE_ENV=development`: long polling бота

**ВАЖНО:** `tg/server/public/` в `.gitignore` — никогда не коммитить сборку клиента. Docker сам собирает клиент и копирует в нужное место.

---

## Переменные окружения (Railway → Variables)

```
DATABASE_URL         ${{Postgres.DATABASE_URL}}   ← ссылка на Railway Postgres
TELEGRAM_BOT_TOKEN   123456:ABC...
MINI_APP_URL         https://from0tolamba-production.up.railway.app
OPENROUTER_API_KEY   sk-or-...
NODE_ENV             production
```

---

## Локальная разработка

```bash
# Сервер
cd tg/server && npm install && cp .env.example .env
# (заполнить .env)
npm run dev    # tsx watch src/index.ts

# Клиент
cd tg/client && npm install
npm run dev    # Vite :5173 → proxy /api → :3000

# Сборка клиента для production
npm run build  # outDir = ../server/public  (не коммитить!)
```

---

## Экономика игры

| Параметр | Значение |
|---|---|
| Стартовый баланс | 0 ₽ |
| Онбординг-бонус | ~50 ₽ |
| Мин. вложение | 5 ₽ |
| Макс. вложение | 5 000 ₽ на дело |
| Активных дел | max 5 |
| Доходность SURVIVOR | 0.3–1.5% в день, 15–30 дней жизни |
| Доходность UNICORN | 2–10% в день, 20–30 дней жизни |
| Потеря INSTANT_SCAM | 80–100% |
| Потеря SLOW_DRAIN | 30–70% |

`state.balance` — только свободные рубли. Доход копится в `project.currentValueRubles` до вывода/выхода.
`computeRank()` использует: `totalWealth = balance + Σ activeProjects.currentValueRubles`, `intuitionScore`, `currentDay`.

Успешные дела (SURVIVOR, UNICORN) закрываются по истечении срока с нарративной причиной «дело сменило владельца» — случайная фраза из массива `HANDOVER_REASONS_*` в `AdvanceDayService.ts`.

---

## Страницы клиента

| Страница | Файл | Назначение |
|---|---|---|
| Главная | `HomePage.tsx` | Баланс, активные дела (с новостями и «Довложить»), «Следующий день» |
| Входящие | `InboxPage.tsx` | Новые предложения из inbox |
| Беседа | `AmaPage.tsx` | AMA-чат с хозяином + полоска Чуйки |
| Казна | `PortfolioPage.tsx` | Активные дела: графики (Recharts), вести, довложить/вывести/выйти; ссылка на Летопись |
| Успехи | `StatsPage.tsx` | Статистика, ранг, история баланса |
| Рейтинг | `LeaderboardPage.tsx` | Топ-100 игроков по состоянию, текущий игрок выделен |
| Летопись | `RegistryPage.tsx` | Все закрытые дела: архетип, PostMortem, баннер, статистика |

---

## Версионирование и кэш

Клиент содержит константу `APP_VERSION` в `ScreenBackground.tsx`. При каждом монтировании компонента делается запрос к `/api/version`. Если версии расходятся — `window.location.reload()`.

При обновлении версии менять **в двух местах одновременно**:
1. `tg/client/src/components/ScreenBackground.tsx` — константа `APP_VERSION`
2. `tg/server/src/index.ts` — обработчик `GET /api/version`

---

## Ключевые правила

- Скрытые поля проекта — никогда в клиент до закрытия. Только `toPublicDTO()`
- AI вызывается только через `openRouterClient.ts`, не из роутов напрямую
- `updateRankIfNeeded()` — только в `AdvanceDayService`, не при инвестировании
- При закрытии дела — генерировать `PostMortem` с раскрытием архетипа
- При выходе игрока (`exitProject`) — вызывать `generatePostMortem` асинхронно (`.catch(console.error)`)
- `tg/server/public/` — **не коммитить**. Он в `.gitignore`
- Тёмная тема — основная. Язык UI — русский

---

## UI-словарь

| Обычное слово | В UI |
|---|---|
| инвестировать | вложить |
| ранг инвестора | купеческий чин |
| выйти из проекта | покинуть дело |
| заявленный APY | посул (APY) |
| управление инвестицией | распорядиться вложением |
| архив закрытых дел | летопись |
| таблица лидеров | ярмарочный рейтинг |

---

## Известные TODO

| Задача | Где |
|---|---|
| Push-уведомления через бота | `bot/bot.ts` |
| Экран «Вести с ярмарки» (News) | новая страница клиента |
| Admin-панель с AdRevenue | отдельный роут/сервис |

---

## Цвета темы

```typescript
FairyGold       = #FFB800  // золото — акценты, заголовки
EnchantedPurple = #2A1960  // тёмно-фиолетовый — верх карточек
NightBlue       = #0D1735  // тёмно-синий — низ карточек, фон
```
