# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Суть проекта

«Из грязи в князи» — Telegram Mini App, симулятор купца-инвестора в сказочной Руси. Игрок вкладывает гроши (г) в «дела», большинство из которых обман. Ключевая механика — **«Купеческая грамота»**: мини-игра на внимательность (24 SVG-печати, ищем подделки; таймер зависит от чина). Текущая версия: **3.2.0**.

- **Активная версия:** `tg/`. `app/` (Android) — заморожен (`CODEMAP.md` описывает Android-архитектуру, к `tg/` не относится).
- **Валюта:** гроши (г) в UI; DB-поля (`currentValueRubles`, `investedAmountRubles` и т.д.) не переименованы — только отображение. Всегда `Math.floor(n)`, **не** `.toFixed(0)` — `.toFixed` округляет вверх и вызывает «Недостаточно средств».
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

Клиентский alias `@/` → `tg/client/src/` (настроен в `vite.config.js`). Использовать везде вместо относительных путей вглубь.

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
│   │   ├── ChatPanel.tsx              # ярмарочная площадь — общий чат, висит поверх всех страниц
│   │   ├── MarketAnnouncementOverlay.tsx  # оверлей «Сбор купцов» с наградой +100 г за визит канала
│   │   ├── FairyCard.tsx              # базовая карточка + OrnamentDivider + SkeletonCard
│   │   └── BottomNav.tsx              # нижняя навигация
│   ├── i18n/index.ts          # RU + EN переводы; хук useT(); langStore (Zustand)
│   └── theme/colors.ts        # FairyGold #FFB800 · EnchantedPurple #2A1960 · NightBlue #0D1735
└── server/src/
    ├── index.ts               # точка входа: регистрация плагинов, роутов, статики
    ├── api/routes/            # game · projects · ama · charter · invest · banner · payments · tasks · chat · public
    ├── game/
    │   ├── types.ts           # все enum + FATE_CONFIG + WITHDRAWAL_RULES
    │   ├── GenerateProjectService.ts
    │   ├── CharterService.ts  # основная механика — forgedIndices только на сервере
    │   ├── AdvanceDayService.ts
    │   ├── InvestService.ts
    │   ├── AmaSessionService.ts
    │   ├── projectUtils.ts    # toPublicDTO() — фильтр скрытых полей
    │   ├── rankService.ts     # recomputeRank(userId)
    │   ├── referralService.ts # tryAttachReferrer + countReferrals; бонус 100 г обоим
    │   ├── weeklyService.ts   # ensureWeekStartSnapshot — снимок состояния на начало недели
    │   ├── mafiaOffers.ts     # «мафиозные» принудительные выкупы за 50% при закрытии
    │   └── randomEvents.ts    # случайные события NEGATIVE/POSITIVE/NEUTRAL при advance-day
    ├── ai/openRouterClient.ts # OpenRouter + staticBannerFilename()
    ├── bot/
    │   ├── bot.ts             # Grammy бот; экспортирует cancelBroadcast() для SIGTERM
    │   └── channelTasksConfig.ts  # CHANNEL_TASKS — список каналов с наградами
    ├── scheduler/dailyJob.ts  # cron advance-day 09:00 MSK + уведомления каждые 5 мин
    ├── middleware/telegramAuth.ts
    └── db/prisma.ts           # PrismaClient singleton
```

**Статика в `index.ts`:**
- `/banners/*` → `assets/banners/` — предгенерированные WebP-баннеры персонажей
- `/backgrounds/*` → `assets/backgrounds/` — фоновые изображения страниц
- Оба регистрируются с `decorateReply: false` из-за множественных `@fastify/static`

---

## Аутентификация

Каждый HTTP-запрос клиента несёт заголовок `X-Telegram-Init-Data` с `window.Telegram.WebApp.initData`. Сервер проверяет HMAC в `middleware/telegramAuth.ts` (`telegramAuthHook`). Все роуты вешают этот хук как `preHandler`.

Dev-обход: если `NODE_ENV=development` и заголовок равен строке `'dev'`, сервер ищет тестового пользователя по `telegramId='dev'`. Создать его через `prisma db studio` или вручную в БД.

---

## Состояние на клиенте (React Query + Zustand)

`GameStateDTO` живёт в двух местах одновременно:
- **React Query** — кэш `['gameState']`, единственный запрос в `HomePage.tsx`
- **Zustand** `gameStore.ts` — `gameState` читают все страницы через `useGameStore()`

**Правило синхронизации:** `setGameState` вызывается **только из `useEffect`** на `freshGameState` (data из useQuery), **никогда внутри `queryFn`**. Вызов внутри `queryFn` создаёт гонку: фоновый рефетч, начатый до инвестиции, завершается позже и затирает оптимистичное обновление.

```typescript
// ПРАВИЛЬНО (HomePage.tsx)
const { data: freshGameState } = useQuery({ queryKey: ['gameState'], queryFn: () => api.game.getState() })
useEffect(() => { if (freshGameState) setGameState(freshGameState) }, [freshGameState])

// НЕПРАВИЛЬНО
queryFn: async () => { const data = await api.game.getState(); setGameState(data); return data }
```

**Оптимистичные обновления баланса:** после мутации (invest, addInvestment) вызвать `updateBalance(-amount)` из Zustand, затем `qc.invalidateQueries(['gameState'])`. Не ждать рефетча — баланс обновится мгновенно.

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

**Типы транзакций** (поле `type` в таблице `Transaction`):
`INVEST` · `ADD` · `WITHDRAW` · `EXIT` · `RETURNED` · `REFERRAL_BONUS`

> Комментарии к enum `InvestorRank` в `types.ts` содержат устаревшие пороги из Android-версии. Источник правды — функция `computeRank()` в `rankService.ts`.

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

- Сетка 4×6 = 24 печати; по истечении таймера — автосабмит
- **Таймер зависит от чина** (`RANK_TIME_LIMIT` в `CharterService.ts`): NEWBIE 25 с · AMBASSADOR 20 с · ANALYST 15 с · SHARK 10 с · LAMBO_SENSEI 5 с
- Число подделок: `lieTopics.length + extra(fate)` (INSTANT_SCAM +2, SLOW_DRAIN +1)
- **`forgedIndices` отправляются клиенту** в `CharterDTO` при старте — клиент должен знать, какие ячейки рисовать мутированными. «Не покидают сервер» — устаревший комментарий.
- Difficulty по fate: EASY (INSTANT_SCAM/HONEST_FAIL) → явная мутация; MEDIUM (SLOW_DRAIN) → похожий зверь/цвет; HARD (SURVIVOR/UNICORN) → сдвиг тона ±20°
- **Мутации по чину** (`RANK_MUT_POOLS` в `Seal.tsx`): NEWBIE → только `shape`; AMBASSADOR → `shape, size, dots`; ANALYST+ → все типы включая `colorHue, rings, emblemSame`
- Формула чуйки: `delta = TP − FP − 2·FN` + бонус `+2` за верно опознанную чистую грамоту
- **Число подделок на интро-экране**: Скоморох видит точное число, Купец и выше — `???`
- `sealForCell(refSeed, index, isForged, difficulty, rank?)` — `rank` используется для выбора пула мутаций вместо `difficulty`

**Навигация назад в CharterPage:** `useBlocker` из React Router **не работает** с `BrowserRouter`. Для перехвата свайпа-назад (edge swipe) используется трюк: при монтировании пушится дубль текущего URL в `history.pushState`, затем `popstate` перехватывается вручную и показывает ExitConfirmSheet. Telegram BackButton перехватывается через `useTelegramBackHandler`.

---

## Звуки и музыка

**SFX** — `tg/client/src/sounds.ts`, Web Audio API (без файлов), 7 событий:
`tap` · `invest` · `day` · `win` · `lose` · `rankup` · `seal`

Вызов: `playSound('tap')`. Mute/volume хранятся в `localStorage` (`sound_muted`, `sound_volume`). Управление через `isMuted()`, `setMuted()`, `getVolume()`, `setVolume()`.

**Фоновая музыка** — `tg/client/public/main_theme.mp3` (файл в `public/`, отдаётся как `/main_theme.mp3`).
- Запускается **один раз за браузерную сессию** (модульный флаг `let mainThemePlayed = false` в `HomePage.tsx`), не перезапускается при навигации.
- Громкость: `soundVolume × 0.4` (при дефолтном ползунке 0.5 → 20%). Реагирует на mute-переключатель и ползунок громкости.
- Плавное затухание за последние 10 секунд трека.

---

## AI-интеграция

- **Провайдер:** OpenRouter, клиент в `openRouterClient.ts`
- **Модели:** `deepseek/deepseek-v4-flash` (дефолт) и `google/gemini-3.1-flash-lite-preview`; меняется через `preferredModel` в настройках. Старые модели авто-мигрируются на v4-flash при входе
- **Формат:** `response_format: { type: 'json_object' }` (DeepSeek поддерживает корректно)
- **Язык ответов:** современный живой русский, без «блокчейна», «крипто», «TON»
- AI вызывается только через `openRouterClient.ts`, не из роутов напрямую
- `buildAmaSystemPrompt` получает `fate` проекта и включает блок `FATE_BEHAVIOR` — скрытую подсказку NPC о реальном состоянии дела (INSTANT_SCAM/SLOW_DRAIN/HONEST_FAIL/SURVIVOR/UNICORN)

---

## Экономика

| Параметр | Значение |
|---|---|
| Стартовый баланс | 0 г → онбординг-бонус ~50 г |
| Мин./макс. вложение | 5 г / 5 000 г на дело |
| Активных дел | max 5 (+ до 5 extra slots) |
| Кулдаун дней | 7 быстрых подряд (`MAX_CONSECUTIVE_ADVANCES`) → блокировка 2 ч; 10 Stars сбрасывают пачку |
| SURVIVOR | 1.5–7.5%/день, 15–30 дней |
| UNICORN | 10–50%/день, 20–30 дней |
| INSTANT_SCAM | 5–20%/день, 2–5 дней, исчезает без предупреждений со 100% средств |
| SLOW_DRAIN | 1.5–7.5%/день, 7–21 день, −30–70%; за 2 дня блокирует вывод + DELAYED-вести |

`state.balance` — только свободные г. Доход копится в `project.currentValueRubles`.
`computeRank()` = `totalWealth = balance + Σ activeProjects.currentValueRubles` + intuitionScore + currentDay.

**Пороги чинов** (`rankService.ts`):
| Чин | totalWealth | intuitionScore |
|---|---|---|
| Купец (AMBASSADOR) | ≥ 100 г | ≥ 20 |
| Мудрец (ANALYST) | ≥ 1 000 г | ≥ 100 |
| Боярин (SHARK) | ≥ 10 000 г | ≥ 300 |
| Князь (LAMBO_SENSEI) | ≥ 50 000 г | ≥ 500 |

---

## Дополнительные слоты (extra slots)

Когда у игрока 5 активных дел, он может купить до 5 дополнительных слотов:
- **1 000 г** — списывается вместе с вложением в одной атомарной транзакции (`prisma.$transaction`)
- **10 Stars** (`STARS_EXTRA_SLOT`) — пополняет `extraSlotsBalance` на GameState, тратится при инвестиции

`isExtraSlot: true` на Project означает, что дело занимает купленный слот. При закрытии дела слот сгорает (не возвращается).

Ошибки из `InvestService.invest()`, которые клиент обрабатывает программно (не локализованы на сервере):
- `MAX_PROJECTS_REACHED` → показать ExtraSlotModal
- `MAX_EXTRA_SLOTS_REACHED` → лимит 5 доп. слотов достигнут
- `NO_EXTRA_SLOTS` → `extraSlotsBalance = 0`, нужно купить

---

## Локализация (i18n)

`tg/client/src/i18n/index.ts` — все строки UI на RU и EN. Структура:
- `translations.ru` и `translations.en` — объекты с идентичными ключами
- `useT()` — React-хук, читает язык из `langStore` (Zustand), возвращает нужный объект
- `langStore` — хранит `lang: 'ru' | 'en'`, синхронизируется с `gameState.preferredLanguage` при загрузке

**Правило:** любой новый текст в компонентах добавлять в оба языка. TypeScript выдаст ошибку сборки, если ключ есть в RU но не в EN (тип `Translations` выведен из `translations.ru`).

**Объявление-баннер турнира** — `BannerAnnouncementModal` в `HomePage.tsx`. Переключатель `IS_TOURNAMENT_ACTIVE` (константа в конце файла) управляет что показывать: `true` = `t.home.tournament`, `false` = `t.home.preReset`. Менять вручную при смене фазы.

---

## Чат (Ярмарочная площадь)

`ChatPanel.tsx` — глобальный оверлей поверх всех страниц (не в роутинге). Данные: `GET /api/chat/messages?since=<id>` (polling), `POST /api/chat/message`.

Ограничения (`chatRoutes.ts`): 300 символов, 5-секундный rate limit на сообщение, автомодерация через `leo-profanity` (RU + EN словари). Сервер возвращает `{ error: 'PROFANITY' }` — клиент должен обработать отдельно.

`displayName` в `ChatMessage` — снимок имени на момент отправки. Торговое имя (`nickname`) хранится на `User`, устанавливается в настройках на главной. Используется в чате вместо Telegram-имени, если задано.

---

## Версионирование и кэш

`APP_VERSION` сверяется при каждом монтировании `ScreenBackground` — при расхождении с `/api/version` делается `window.location.reload()`.

**При обновлении версии менять одновременно в двух местах:**
1. `tg/client/src/components/ScreenBackground.tsx` — константа `APP_VERSION`
2. `tg/server/src/index.ts` — обработчик `GET /api/version`

---

## Ключевые правила

- Скрытые поля проекта — только через `toPublicDTO()`, никогда напрямую. Скрытые поля в схеме: `fate`, `daysUntilCollapse`, `realDailyYieldRubles`, `lieTopics`, `truthTopics`, `npcTruthParams`; в AmaSession: `forgedIndices`
- `recomputeRank(userId)` вызывать после: сабмита грамоты, выхода из дела, advance-day. **Не** при вложениях/выводах
- `generatePostMortem` при `exitProject` — асинхронно (`.catch(console.error)`)
- `tg/server/public/` — в `.gitignore`, не коммитить
- Тёмная тема. UI на русском. UI-словарь: вложить / купеческий чин / покинуть дело / посул (APY) / летопись / ярмарочный рейтинг
- Все денежные значения в UI: `Math.floor(n)` — никогда `.toFixed(0)`
- `claimedAPY` генерируется сервером в `GenerateProjectService.ts` (`computeClaimedAPY()`), а не AI. В промпт не включать и от AI не ждать
- `referrerId` и `referralBonusGranted` на `User` — **не сбрасывать** при сбросе игры (это связь аккаунта, а не игровая прогрессия). Сбрасывать только `pendingReferralParam: null`
- `seenTypes` / `seenArchetypes` / `seenFates` в `GameStateDTO` — вычисляются из `PostMortem` на лету в `/api/game` (GET), в БД не хранятся
- Поле чина в `GameStateDTO` называется **`investorRank`** (не `rank`) — частая ошибка при обращении к `gameState`
- **localStorage-ключи онбординга:** `onboarding_v3_seen` — тур показан после v3.0 (сбрасывать при мажорных обновлениях, меняя ключ); `charter_tutorial_seen` — обучалка грамоты показана
- `marketAnnouncementSeen` / `marketAnnouncementRewardClaimed` — поля на `GameState` в БД (не в localStorage). `pendingMarketAnnouncement: boolean` в `GameStateDTO` — вычисляется на лету. Награда +100 г, `POST /api/announcement/market` с `action: 'claim' | 'dismiss'`
- **Не сбрасывать** `utmSource` на `User` при сбросе игры — это аналитика привлечения, не игровой прогресс

---

## Деплой (Railway)

- Репо: `udavkaa-ai/from0tolamba`, Dockerfile в корне
- **Деплой-ветка:** `claude/telegram-game-migration-FDnlX` (не `main` — у них нет общего предка)
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

Три фичи, все по **10 Stars** (`bot.ts`):
- `timer_skip` — пропуск 2-часового кулдауна; payload prefix `ts:`
- `ama_unlock` — открыть беседу с дельцом; payload prefix `au:`
- `extra_slot` — докупить слот сверх лимита 5 дел; payload prefix `es:`

Флоу: `POST /api/payments/invoice` → клиент вызывает `Telegram.WebApp.openInvoice(link)` → по callback `'paid'` → `POST /api/payments/activate`. `PAYMENTS_ENABLED=false` в `.env` пропускает весь флоу и активирует фичу бесплатно.

- `bot.ts` содержит обязательный хендлер `pre_checkout_query` и логгер `successful_payment`
- Stars зачисляются на баланс бота; смотреть через BotFather → /mybots → Revenue

---

## Бот (bot.ts)

Команды администратора (только `ADMIN_TELEGRAM_ID = 424553547`):
- `/resetall` — сброс всех игроков (защита от повторного запуска через маркер в БД)
- `/broadcast <текст>` — рассылка всем прошедшим онбординг; 50мс задержка между сообщениями
- `/broadcaststop` — остановить текущую рассылку

**UTM-трекинг:** `/start utm_xxx` payload из бота сохраняется в `User.utmSource`. Команда `/stats` для ADMIN показывает разбивку по источникам. Публичные партнёрские эндпоинты (без авторизации):
- `GET /api/public/check-player?tg_user_id=<ID>` — есть ли игрок и прошёл ли онбординг
- `GET /api/public/partner-stats?utm_source=<UTM>` — агрегатная статистика по партнёру

Флаги `broadcastActive` / `broadcastCancelled` — модульного уровня (не внутри `setupHandlers`). `cancelBroadcast()` экспортируется и вызывается в `index.ts` при SIGTERM — гарантирует остановку цикла при редеплое. Без этого Railway отправляет SIGTERM, `app.close()` завершается, но цикл broadcast продолжает работать до SIGKILL.

---

## Мафиозные предложения (`mafiaOffers.ts`)

За 2–3 дня до автозакрытия прибыльных дел (SURVIVOR/UNICORN) в ленту вставляется специальная весть с CTA «покинь дело сейчас». Если игрок не успевает выйти вручную — автозакрытие возвращает **50%** (`MAFIA_FORCED_CLOSURE_RETURN_PERCENT`). Шанс срабатывания предложения: 60% (`MAFIA_OFFER_CHANCE`).

---

## Известные TODO

| Задача | Где |
|---|---|
| Push-уведомления через бота | `bot/bot.ts` |
| Экран «Вести с ярмарки» (News feed) | новая страница клиента |
| Admin-панель | отдельный роут/сервис |
