# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Суть проекта

«Из грязи в князи» — Telegram Mini App, симулятор купца-инвестора в сказочной Руси. Игрок вкладывает рубли (₽) в «дела» (аналоги крипто-проектов), большинство из которых обман. Ключевая механика — **«Купеческая грамота»**: мини-игра на внимательность (24 SVG-печати, ищем подделки за 15 сек).

- **Активная версия:** `tg/` — v2.9.0. `app/` (Android) — заморожен.
- **Валюта:** рубли (₽), отображать `"%.0f ₽"`.
- **Архетип хозяина** (`personaArchetype`) публичный — нужен клиенту для баннера/беседы. Все остальные скрытые поля до PostMortem — через `toPublicDTO()`.

---

## Команды разработки

```bash
# Сервер (порт 3000)
cd tg/server
npm install && cp .env.example .env   # первый раз
npm run dev          # tsx watch src/index.ts

# Клиент (порт 5173, proxy /api → :3000)
cd tg/client
npm install
npm run dev

# Сборка клиента (outDir = ../server/public — НЕ коммитить)
cd tg/client && npm run build

# Prisma
cd tg/server
npm run db:push      # применить изменения схемы
npm run db:studio    # GUI для БД в браузере
```

Нет тестов. Нет линтера. TypeScript проверяется при `npm run build`.

---

## Архитектура `tg/`

```
tg/
├── client/src/
│   ├── api/client.ts          # все HTTP-запросы; типы ProjectDTO, PostMortemDTO и т.д.
│   ├── stores/gameStore.ts    # Zustand — gameState + проекты
│   ├── pages/                 # по одному файлу на экран
│   ├── components/
│   │   ├── ScreenBackground.tsx  # фоновые изображения + версионирование + PAGE_BG + homeBackground()
│   │   ├── Seal.tsx              # процедурная SVG-печать (6 параметров, детерминирована из seed)
│   │   ├── FairyCard.tsx         # базовая карточка + OrnamentDivider + SkeletonCard
│   │   └── BottomNav.tsx         # нижняя навигация
│   └── theme/colors.ts        # FairyGold #FFB800 · EnchantedPurple #2A1960 · NightBlue #0D1735
└── server/src/
    ├── index.ts               # точка входа: регистрация плагинов, роутов, статики
    ├── api/routes/            # game · projects · ama · charter · invest · banner · payments · tasks
    ├── game/
    │   ├── types.ts           # все enum + FATE_CONFIG + WITHDRAWAL_RULES
    │   ├── GenerateProjectService.ts
    │   ├── CharterService.ts  # основная механика — forgedIndices только на сервере
    │   ├── AdvanceDayService.ts
    │   ├── InvestService.ts
    │   ├── AmaSessionService.ts
    │   ├── projectUtils.ts    # toPublicDTO() — фильтр скрытых полей
    │   ├── rankService.ts     # recomputeRank(userId)
    │   ├── referralService.ts # tryAttachReferrer + countReferrals; бонус 100 ₽ обоим
    │   ├── weeklyService.ts   # ensureWeekStartSnapshot — снимок состояния на начало недели
    │   ├── mafiaOffers.ts     # «мафиозные» принудительные выкупы за 50% при закрытии
    │   └── randomEvents.ts    # случайные события NEGATIVE/POSITIVE/NEUTRAL при advance-day
    ├── ai/openRouterClient.ts # OpenRouter + staticBannerFilename()
    ├── bot/bot.ts             # Grammy бот
    ├── scheduler/dailyJob.ts  # cron advance-day 09:00 MSK + уведомления каждые 5 мин
    ├── middleware/telegramAuth.ts
    └── db/prisma.ts           # PrismaClient singleton
```

**Статика в `index.ts`:**
- `/banners/*` → `assets/banners/` — предгенерированные WebP-баннеры персонажей
- `/backgrounds/*` → `assets/backgrounds/` — фоновые изображения страниц
- Оба регистрируются с `decorateReply: false` из-за множественных `@fastify/static`

---

## Доменные типы

```
ProjectType:      CARD_GAME | TREASURE_HUNT | POTION_BREW | GUILD_SCHEME | HONEST_TRADE
ProjectFate:      INSTANT_SCAM(25%) | SLOW_DRAIN(30%) | HONEST_FAIL(15%) | SURVIVOR(25%) | UNICORN(5%)
PersonaArchetype: BURATINO | BOYARIN | KOLOBOK | KOSCHEI | ZOLUSHKA | BABA_YAGA | IVAN_DURAK
InvestorRank:     NEWBIE → AMBASSADOR → ANALYST → SHARK → LAMBO_SENSEI
```

**Правила вывода** (`WITHDRAWAL_RULES` в `types.ts`):
- `POTION_BREW`, `GUILD_SCHEME`: max `Math.floor(currentValueRubles × 0.25)` за раз
- `CARD_GAME`, `TREASURE_HUNT`: любая сумма, −25% комиссия
- `HONEST_TRADE`: без ограничений и без комиссии

---

## Баннеры и фоны

**Баннеры персонажей** — статические WebP, лежат в `tools/banners/output_realistic/` и копируются в Docker-образ. Имя файла: `<ARCHETYPE>_<TYPE>_<NN>.webp`, вариант детерминирован по projectId:

```typescript
// в openRouterClient.ts
const hash = parseInt(projectId.replace(/-/g, '').slice(-8), 16)
const variant = (hash % 5) + 1   // 1..5
```

`/api/banner/:id` (legacy URL в БД) делает 301 redirect на `/banners/{filename}`.

Маппинг архетип→папку: `BOYARIN` → `TSAR_GOROKH` (в `ARCHETYPE_TO_BANNER` в `openRouterClient.ts`).

**Фоновые изображения** — `tools/banners/output_backgrounds/`, 7 вариантов главной (`HOME_01..07`) + 5 страничных (`BG_INBOX`, `BG_PORTFOLIO`, `BG_STATS`, `BG_LEADERBOARD`, `BG_REGISTRY`).

```typescript
// ScreenBackground.tsx
homeBackground(currentDay)  // меняется каждые 7 дней: Math.floor(day/7) % 7 + 1
PAGE_BG.portfolio           // '/backgrounds/BG_PORTFOLIO.webp'
```

---

## Механика «Купеческой грамоты»

- Сетка 4×6 = 24 печати; таймер 15 сек, по истечении — автосабмит
- Число подделок: `lieTopics.length + extra(fate)` (INSTANT_SCAM +2, SLOW_DRAIN +1)
- Difficulty: EASY (INSTANT_SCAM/HONEST_FAIL) → радикальная мутация; MEDIUM (SLOW_DRAIN) → похожий зверь/цвет; HARD (SURVIVOR/UNICORN) → ±точки розетки, сдвиг тона ±20°
- Формула чуйки: `delta = TP − FP − 2·FN` + бонус `+2` за верно опознанную чистую грамоту
- `forgedIndices` **никогда** не покидают сервер до сабмита (хранятся в `AmaSession`)

---

## AI-интеграция

- **Провайдер:** OpenRouter, клиент в `openRouterClient.ts`
- **Модели:** `deepseek/deepseek-v4-flash` (дефолт) и `google/gemini-3.1-flash-lite-preview`; меняется через `preferredModel` в настройках. Старые модели авто-мигрируются на v4-flash при входе
- **Формат:** `response_format: { type: 'json_object' }` (DeepSeek поддерживает корректно)
- **Язык ответов:** современный живой русский, без «блокчейна», «крипто», «TON»
- AI вызывается только через `openRouterClient.ts`, не из роутов напрямую

---

## Экономика

| Параметр | Значение |
|---|---|
| Стартовый баланс | 0 ₽ → онбординг-бонус ~50 ₽ |
| Мин./макс. вложение | 5 ₽ / 5 000 ₽ на дело |
| Активных дел | max 10 |
| Кулдаун дней | 7 быстрых подряд (`MAX_CONSECUTIVE_ADVANCES`) → блокировка 2 ч; 10 Stars сбрасывают пачку |
| SURVIVOR | 1.5–7.5%/день, 15–30 дней |
| UNICORN | 10–50%/день, 20–30 дней |
| INSTANT_SCAM | 5–20%/день, 2–5 дней, исчезает без предупреждений со 100% средств |
| SLOW_DRAIN | 1.5–7.5%/день, 7–21 день, −30–70%; за 2 дня блокирует вывод + DELAYED-вести |

`state.balance` — только свободные ₽. Доход копится в `project.currentValueRubles`.
`computeRank()` = `totalWealth = balance + Σ activeProjects.currentValueRubles` + intuitionScore + currentDay.

---

## Версионирование и кэш

`APP_VERSION` сверяется при каждом монтировании `ScreenBackground` — при расхождении с `/api/version` делается `window.location.reload()`.

**При обновлении версии менять одновременно в двух местах:**
1. `tg/client/src/components/ScreenBackground.tsx` — константа `APP_VERSION`
2. `tg/server/src/index.ts` — обработчик `GET /api/version`

---

## Ключевые правила

- Скрытые поля проекта — только через `toPublicDTO()`, никогда напрямую
- `recomputeRank(userId)` вызывать после: сабмита грамоты, выхода из дела, advance-day. **Не** при вложениях/выводах
- `generatePostMortem` при `exitProject` — асинхронно (`.catch(console.error)`)
- `tg/server/public/` — в `.gitignore`, не коммитить
- Тёмная тема. UI на русском. UI-словарь: вложить / купеческий чин / покинуть дело / посул (APY) / летопись / ярмарочный рейтинг

---

## Деплой (Railway)

- Репо: `udavkaa-ai/from0tolamba`, Dockerfile в корне
- Домен: `https://from0tolamba-production.up.railway.app`, бот: `@vknyazi_bot`
- При старте контейнера: `prisma db push --accept-data-loss` → `tsx src/index.ts`
- `NODE_ENV=production`: Telegram webhook + cron 09:00 MSK
- `NODE_ENV=development`: long polling бота

**Переменные окружения:**
```
DATABASE_URL          ${{Postgres.DATABASE_URL}}
TELEGRAM_BOT_TOKEN
MINI_APP_URL          https://from0tolamba-production.up.railway.app
OPENROUTER_API_KEY    sk-or-...
PAYMENTS_ENABLED      true   # false = dev bypass (Stars не списываются)
POLLINATIONS_API_KEY  (опционально, legacy)
NODE_ENV              production
```

---

## Генерация изображений (`tools/banners/`)

Инструменты для пересборки статики (нужен Google Cloud / Vertex AI):

```bash
pip install google-genai pillow

# Баннеры персонажей (175 шт, 7 арх × 5 типов × 5 вариантов)
python generate_vertex.py --project <GCP_PROJECT> --style realistic
python generate_vertex.py --project ... --sample 10   # тест 10 штук
python compress.py --inplace output_realistic/        # PNG→WebP, quality=85

# Фоновые изображения страниц (12 шт)
python generate_backgrounds.py --project <GCP_PROJECT>
python compress.py --inplace output_backgrounds/

# После генерации — добавить в git и задеплоить (Docker сам копирует в образ)
```

Конфигурация описаний: `characters.json` (7 арх × 5 вариантов), `deals.json`, `backgrounds.json`.

---

## Telegram Stars (платежи)

- Пропуск кулдауна: **10 Stars** (`STARS_TIMER_SKIP` в `bot.ts`)
- Беседа с дельцом (AMA): **10 Stars** (`STARS_AMA_UNLOCK`)
- `PAYMENTS_ENABLED=false` → сервер активирует фичу бесплатно (dev-режим)
- `bot.ts` содержит обязательный хендлер `pre_checkout_query` и логгер `successful_payment`
- Stars зачисляются на баланс бота; смотреть через BotFather → /mybots → Revenue

---

## Известные TODO

| Задача | Где |
|---|---|
| Push-уведомления через бота | `bot/bot.ts` |
| Экран «Вести с ярмарки» (News feed) | новая страница клиента |
| Admin-панель | отдельный роут/сервис |
