# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Суть проекта

«Из грязи в князи» — Telegram Mini App, симулятор купца-инвестора в сказочной Руси. Игрок вкладывает гроши (г) в «дела», большинство из которых обман. Перед каждым вложением — испытание (мини-игра по архетипу хозяина). Текущая версия: **бета 4.4.3**.

- **Активная версия:** `tg/`. `app/` (Android) — заморожен (`CODEMAP.md` описывает Android-архитектуру, к `tg/` не относится).
- **Валюта:** гроши (г) в UI; DB-поля (`currentValueRubles`, `investedAmountRubles` и т.д.) не переименованы — только отображение. Всегда `Math.floor(n)`, **не** `.toFixed(0)` — `.toFixed` округляет вверх и вызывает «Недостаточно средств».
- **Архетип хозяина** (`personaArchetype`) публичный — нужен клиенту для баннера/беседы. Все остальные скрытые поля до PostMortem — через `toPublicDTO()`.

### Революция версии 4.0 (бета)

- **«Чуйка» (intuitionScore) полностью убрана из игры** — поле в БД остаётся для совместимости со старыми PostMortem, но больше не растёт, не отображается в UI и не влияет на ранг. Реферальный бонус тоже переведён со «чуйки ≥10» на «взято дел ≥3».
- **Чины — по числу взятых дел** (Project.investedAmountRubles > 0):
  - Скоморох → Купец: 5 дел
  - Купец → Мудрец: 20 дел
  - Мудрец → Боярин: 50 дел
  - Боярин → Князь: 100 дел
  - `recomputeRank` пересчитывает после каждого `invest` и в `advance-day`.
- **Единый поток интро + результата** для всех 7 архетипов (включая BOYARIN) через `MiniGameIntroScreen` + `MiniGameResultSheet`. Старый ResultSheet и старый IntroScreen удалены, фаза `'result'` тоже.

### Завязки (введены в 4.4.0)

Уровни отношений с дельцами по архетипам. Каждый ПОЛУЧЕННЫЙ за всю игру жетон у архетипа = +1 уровень. Уровни 0..10, на каждом +1%/день к доходности дел этого архетипа (максимум +10%/день).

- Серверный модуль: `tg/server/src/game/tiesService.ts` — `computeTieLevels`, `tieBonusFromLevel`, `totalTies`, константы `MAX_TIE_LEVEL=10`, `TIE_BONUS_PER_LEVEL=0.01`.
- Применяется в `AdvanceDayService` для активных дел (НЕ для VIP `SPONSOR_FIXED` — у них своя линейная 3× траектория).
- В `GameStateDTO`: `tieLevels` (Record<arch,number>), `tiesTotal`, `tiesMaxLevel`, `tiesBonusPerLevel`.
- Эндпоинт `/api/leaderboard/ties` — рейтинг по сумме уровней.
- UI: бейдж `Lv N` на плитке каждого хозяина в `RelationshipsPage`, карточка «Завязки» в детальной плашке, чип `⚡ +N%/день связи` на карточке дела в инбоксе.

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
- `/personas/*.webp` и `/avatars/*.webp` живут в `tg/client/public/` → Vite копирует в билд (`tg/server/public/`, gitignored). Используются на `AmaPage` (фон беседы 9:16) и `RelationshipsPage` (плитки хозяев 1:1). Theme-aware: суффикс `_LIGHT` для Сказочной темы. Преgenerated через `tools/banners/generate_personas.py` и `generate_avatars.py` (Vertex AI Imagen 4). Описания — `tools/banners/personas.json` (dark + light варианты у каждой персоны + avatar-варианты).

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

## Мини-игры по архетипам (`tg/client/src/components/minigames/`)

Каждый архетип хозяина (`personaArchetype`) запускает свою мини-игру вместо изучения дела. Все игры используют **PixiJS v8** и общий каркас. Маршрут `/charter/:projectId` остался.

| Архетип | Игра | Файл | Таймер |
|---|---|---|---|
| `BOYARIN` | Купеческая грамота (24 печати) | `tg/client/src/pages/CharterPage.tsx` + `Seal.tsx` | 15 сек |
| `BURATINO` | Золотой ключик | `BuratinoGame.tsx` | 10 сек эталон + 10 сек выбор |
| `KOSCHEI` | Память Кощея (memory match) | `KoscheiGame.tsx` | 20 сек, без лимита открытий |
| `KOLOBOK` | Нора-нора-нора (whack-a-mole) | `KolobokGame.tsx` | 10 сек |
| `ZOLUSHKA` | Золушкино счастье (падающие монеты) | `ZolushkaGame.tsx` | 5 сек эталон + 15 сек ловли |
| `BABA_YAGA` | Котёл (последовательность ингредиентов) | `BabaYagaGame.tsx` | 6 сек эталон + 15 сек выбора |
| `IVAN_DURAK` | Переводной дурак (повтори карту) | `IvanDurakGame.tsx` | 15 сек |

**Диспетчер**: `MiniGame.tsx` — `switch (archetype)` → нужная игра. Архетипы без файла → `PlaceholderGame` (две тест-кнопки).

**Справочник архетип → название/подсказка**: `info.ts` (`MINIGAME_INFO`). Используется для:
- Заголовка страницы (`pageTitle`) — заменяет «Купеческая грамота» для не-BOYARIN
- Подсказки на интро-экране (блок «🎯 Название · правила»)
- Текста кнопки «Принять испытание →»

**Единая лесенка ошибок (errorCount)** — на ней построены результат и инвест:
- **0 ошибок** → 🎯 идеальная игра: посул + тип дела + 🔮 совет чуйки + «Вложить»
- **1 ошибка** → 🙂 победа: посул + тип, без совета, «Вложить»
- **≥2 ошибок** → 😅 поражение: ничего не раскрыто, только «10⭐ — раскрыть дело»

Что считается ошибкой в каждой игре:
- BOYARIN: `FP + FN` (false positives + false negatives при разборе печатей)
- BURATINO: правильный тап = 0, неверный/таймаут = 2
- KOSCHEI: `attemptsUsed - 6` (число лишних открытий сверх минимума 6 пар); поражение = ≥2
- KOLOBOK: 12 баллов = 0 ошибок, 7–11 = 1, <7 = 2
- ZOLUSHKA: 12 пойманных = 0 ошибок, 7–11 = 1, <7 = 2 (фальшак = −2, настоящая = +1)
- BABA_YAGA: число неверных выборов; недосбор по таймеру = оставшиеся шаги тоже ошибки
- IVAN_DURAK: число неверных карт

**После выкупа за 10⭐** (`MiniGameResultSheet` → `handleBypass`) сервер `activateMinigameBypass(projectId)` возвращает `perfectInsight` и лист обновляется как при идеальной игре (посул + тип + совет). Игрок может всё взвесить и нажать «Вложить» — или передумать.

**Pixi-паттерны**:
- Каждая игра рендерит `Application` в свой `<div ref>`. Lifecycle: `app.init({ resizeTo, backgroundAlpha:0, antialias:true, resolution: dpr, autoDensity:true })` в `useEffect`, `destroy(true, {children:true})` в cleanup. Cancelled-флаг от React StrictMode-двойного запуска.
- Глобальный тикер `app.ticker.add(cb)` — обновляет позиции/анимации.
- Тапы: `container.eventMode = 'static'; container.cursor = 'pointer'; container.on('pointertap', ...)`. Хит-зона часто шире графики — добавляется отдельный прозрачный `Graphics` поверх.
- Псевдо-вращение вокруг вертикальной оси: `container.scale.x = Math.cos(t / period * 2π)`. Когда `scale.x < 0` — спрайт мирроится Pixi автоматически, что естественно для «обратной стороны».
- Двусторонние спрайты (`ZolushkaGame`): два дочерних Container'а (`frontFace`, `backFace`), `visible` переключается по знаку `scale.x`.
- Всплывающие очки `+1/−2/−3`: DOM-overlay с `framer-motion`, абсолютное позиционирование над канвасом, длительность 0.9с.

**Эталонный RNG**: `seedRng.ts` — FNV-1a → mulberry32. Один и тот же `charter.gridSeed` всегда даёт одну и ту же конфигурацию ассетов мини-игры. Любая «рандомизация» в игре должна идти через этот rng.

**Интро-экран**: `MiniGameIntroScreen` в `CharterPage.tsx`. **Не показывает APY** — посул раскрывается только при победе. Показывает: баннер дела, имя хозяина, число вкладчиков, размер артели, описание, блок с названием/правилами мини-игры, кнопку «Принять испытание →» и AMA-кнопку (10⭐).

**Старая `RANK_TIME_LIMIT` сетка** (NEWBIE 25 → LAMBO 5) удалена — Купеческая грамота теперь всегда 15 сек для всех чинов. Для не-BOYARIN — таймер задаётся внутри игры. Поле `timeLimitSeconds` в `CharterDTO` оставлено для совместимости (всегда 15).

**Серверный сабмит**:
- `POST /api/charter/:projectId/submit` — BOYARIN, тело `{ selectedIndices: number[] }`, ответ `{ ...result, errorCount, perfectInsight }`
- `POST /api/charter/:projectId/submit-minigame` — остальные, тело `{ errorCount: number }`, ответ `{ errorCount, perfectInsight }`
- `submitMiniGame` и `submitCharter` помечают `AmaSession.charterSubmittedAt` и `Project.isInbox=false`, **не** инкрементят `intuitionScore` (поле в БД хранит errorCount для аналитики).

**Навигация назад в CharterPage:** `useBlocker` из React Router **не работает** с `BrowserRouter`. Для перехвата свайпа-назад используется трюк: при монтировании пушится дубль текущего URL в `history.pushState`, затем `popstate` перехватывается вручную и показывает ExitConfirmSheet. Telegram BackButton перехватывается через `useTelegramBackHandler`.

---

## Плавный переход «Следующий день»

`DayTransitionOverlay` (`tg/client/src/components/DayTransitionOverlay.tsx`) — полноэкранный анимированный плейсхолдер с купцом, идущим по ярмарке. Показывается на время advance-day мутации + 800мс буфера, чтобы рефетч инбокса/портфеля успел осесть. Без него игрок видел старые грамоты или «инбокс пуст» на пару секунд.

В `HomePage.tsx` после успешного advance-day и timer_skip инвалидируются: `['gameState']`, `['updates']`, `['inbox']`, `['portfolio']`.

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
- **Две темы:** classic (тёмный фиолет) и fairy (медово-золотой пергамент). Переключатель в Настройках. UI на русском (+ EN перевод в `i18n/index.ts`). UI-словарь: вложить / купеческий чин / покинуть дело / посул (APY) / летопись / ярмарочный рейтинг
- Все денежные значения в UI: `Math.floor(n)` — никогда `.toFixed(0)`
- `claimedAPY` генерируется сервером в `GenerateProjectService.ts` (`computeClaimedAPY()`), а не AI. В промпт не включать и от AI не ждать
- `referrerId` и `referralBonusGranted` на `User` — **не сбрасывать** при сбросе игры (это связь аккаунта, а не игровая прогрессия). Сбрасывать только `pendingReferralParam: null`
- `seenTypes` / `seenArchetypes` / `seenFates` в `GameStateDTO` — вычисляются из `PostMortem` на лету в `/api/game` (GET), в БД не хранятся
- Поле чина в `GameStateDTO` называется **`investorRank`** (не `rank`) — частая ошибка при обращении к `gameState`
- **localStorage-ключи онбординга:** `onboarding_v3_seen` — тур показан (сбрасывать при мажорных обновлениях, меняя ключ); `charter_tutorial_seen` — обучалка грамоты показана; `ui-tour-v2` — состояние Zustand-store тура (см. `tourStore.ts`)
- `marketAnnouncementSeen` / `marketAnnouncementRewardClaimed` — поля на `GameState` в БД (не в localStorage). `pendingMarketAnnouncement: boolean` в `GameStateDTO` — вычисляется на лету. Награда +100 г, `POST /api/announcement/market` с `action: 'claim' | 'dismiss'`
- **Не сбрасывать** `utmSource` на `User` при сбросе игры — это аналитика привлечения, не игровой прогресс

---

## Дизайн-система (theme/)

Единые токены вместо инлайн-стилей по сайту:

- `gradients.cta` — тема-aware золотой градиент CTA-кнопок (главный паттерн для всех «активных» кнопок: Летопись, Принять испытание, Добавить вложение, Закрыть и т.д.)
- `colors.ctaBorder` / `colors.ctaText` — тема-aware кант + текст для CTA
- `ctaButton.{sm,md,lg}` (в `theme/colors.ts`) — готовый объект стилей для CTA-кнопок трёх размеров. Используется через `style={ctaButton.lg}` или `style={{ ...ctaButton.md, ...extra }}`
- `bigNumber(size)` (в `theme/index.ts`) — единый стиль для золотых цифр (баланс, награда дня, стоимость дела): gold + headingFontFamily + многослойная тёмная обводка + тёплое свечение. Размер задаётся параметром, тени масштабируются
- `gradients.card` — тема-aware фон карточек (тёмный фиолет / пергамент)
- `colors.textPrimary / textSecondary / textMuted` — тема-aware текст. На карточках в fairy — почти-чёрная сепия; в classic — белый
- `colors.textOnDark / textOnDarkSecond / textOnDarkMuted` — для тёмных поверхностей (нав-бар, модалки, оверлеи мини-игр), всегда белый
- `gradients.modal` / `colors.modalText / modalTextSec / modalTextMute` — тема-aware фон + текст модальных листов
- `gradients.goldBtn` — legacy, не использовать в новом коде; всё новое через `ctaButton.*`

---

## Подводные камни (lessons learned)

**Pixi мини-игры — утечки WebGL-памяти:**
- `app.stage.removeChildren()` НЕ освобождает WebGL-ресурсы (буферы геометрии Graphics, glyph-атласы Text). Без явного destroy() через 5-10 секунд работы в render-цикле WebView Telegram крашится по памяти.
- Паттерн: `const removed = container.removeChildren(); for (const o of removed) o.destroy({children: true})`.
- Любая «бесконечная» анимация (rAF-loop после complete) должна иметь временной лимит — иначе CPU/GPU работают пока не уйдёшь со страницы. См. BabaYagaGame drain (5s), KoscheiGame пирамида (3 цикла).

**Render-шторм в HomePage:**
- НЕ держать `useState<number>(now)` + `setInterval(setNow(Date.now()), 1000)` в HomePage — это перерисовывает всё дерево каждую секунду и вызывает мерцание framer-motion анимаций. Если нужен тикер для дочернего таймера — поднимать ровно в тот компонент, который реально показывает время.
- TourOverlay: при опросе `setTargetRect(el.getBoundingClientRect())` каждый тик новый объект DOMRect → React видит изменение → перерисовка через portal. Кэшировать предыдущий rect в `useRef` и звать `setTargetRect` только если значения реально изменились.

**Фоновая музыка (`main_theme.mp3`):**
- Audio-элемент — модульный синглтон (`let audioElement` в `HomePage.tsx`).
- Обработчики `visibilitychange` / `blur` / `viewportChanged` ставятся на МОДУЛЬНОМ уровне (`attachGlobalAudioListeners`) **один раз** при создании audioElement и **никогда не снимаются**. Иначе при навигации с главной на другую страницу cleanup useEffect удалит обработчики и сворачивание Telegram оставит музыку играть в фоне.
- НЕ ставить `audio.pause()` в cleanup useEffect HomePage — иначе при возврате на главную (`mainThemePlayed=true` → ранний return) музыку никто не возобновит.

**Eager-preload изображений:**
- Все 12 backgrounds + 7 avatars текущей темы предзагружаются при первом импорте `ScreenBackground.tsx` (см. `preloadAllBackgrounds`). Раньше эти картинки качались по требованию и страницы мерцали.
- Баннеры инбокс-дел предзагружаются в HomePage через `useEffect` на `gameState?.inboxProjects` — иначе после advance-day карточки рендерятся с пустыми 64×64 квадратами пока качают `/banners/<...>.webp`.

**VIP-дела (sponsor):**
- `SPONSOR_CHANCE` (в `types.ts`) — текущее значение `0.10` (тест). Применяется к каждому отдельному `generateProject()` в advance-day (1-3 в сутки).
- В `generateProject` перед роллом VIP проверяется что у игрока **уже нет** sponsor-проекта в `isInbox || isActive` — иначе при параллельных вызовах все попадали в одну `pickRandomActiveCampaign()` и материализовали ту же кампанию дважды.
- `VipArrivalOverlay` в `InboxPage` показывается **один раз за визит** на страницу — даже если непросмотренных VIP несколько (раньше открывался цепочкой по 4.2с каждый, инбокс мелькал между ними).

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

## План на 3D-апгрейд мини-игр

Текущая графика мини-игр — процедурная через `Pixi.Graphics` (примитивы: круги, прямоугольники, поли). Это инди-уровень. Для премиального ощущения планируется поэтапная замена на 3D-модели через **Three.js + react-three-fiber**.

### Решения по стеку

- **Формат моделей**: GLB (binary glTF) — оптимально. Один файл, текстуры PBR + материалы + анимации + скелет внутри. OBJ — работает, но без анимаций и со внешними `.mtl` (конвертим в GLB через `obj2gltf` на intake).
- **Рантайм**: Three.js (`GLTFLoader` / `OBJLoader`) + **react-three-fiber** + `@react-three/drei` для готовых `useGLTF` / `Environment` / `OrbitControls`. Pixi.js остаётся для тех игр, где 3D не нужен (Купеческая грамота, Память Кощея).
- **Сосуществование**: Pixi и Three.js работают параллельно — у каждой мини-игры свой канвас. Один и тот же `MiniGameProps` интерфейс, выбор рантайма — внутри игры.
- **Бандл**: Three.js core ~150 кб gz + R3F ~30 кб + drei (selective) ~30 кб. Можно code-split: `import('./IvanDurakGame3D')` — рантайм грузится только когда открыта 3D-игра.
- **Папка ассетов**: `tg/client/public/models/<archetype>/<asset>.glb`. Vite копирует в дистрибутив автоматически.
- **Telegram Mini App совместимость**: WebGL работает на iOS/Android. На самых старых Android FPS может падать — мы должны держать polygon count низким (<5k треугольников на модель) и избегать тяжёлого post-processing.

### Источники моделей

| Источник | Что | Лицензия | Стиль |
|---|---|---|---|
| [Poly Pizza](https://poly.pizza/) | сундук, череп, гриб, монета, ключ | CC0 | Low-poly, дёшево по полигонам |
| [Sketchfab](https://sketchfab.com/) (CC0 filter) | разное | CC0 | От арт-стайла до фотореализма |
| [Quaternius](https://quaternius.com/) | модульные паки (фэнтези/средневековье) | CC0 | Low-poly, единый стиль |
| [Kenney.nl](https://kenney.nl/) | геймдев-сеты | CC0 | Минимальный, чистый |
| [Mixamo](https://www.mixamo.com/) | rigged-персонажи + анимации ходьбы/прыжков | free для проекта | Реалистичный человек |
| **Свой Vertex AI** (`tools/banners/`) | произвольные ассеты в фирменном стиле | проектное | Сказочная Русь (как баннеры) |

Предпочтительный путь: для **визуала** — Poly Pizza / Sketchfab CC0; для **анимаций** — Mixamo + кастомные через Blender. Альтернатива: всё в Vertex AI + meshy.ai (text-to-3D в фирменном стиле).

### Поэтапный план миграции

1. **Этап Α — инфраструктура** (1 коммит):
   - Добавить `three`, `@react-three/fiber`, `@react-three/drei` в `tg/client/package.json`
   - Создать `tools/convert-models.sh` (батч-конверсия OBJ→GLB через npx obj2gltf)
   - Создать `tg/client/public/models/` (gitignored крупные файлы, мелкие коммитим)
   - Утилита `tg/client/src/components/minigames/three/useModel.ts` — обёртка над `useGLTF` с preload и кэшем
2. **Этап Β — пилот: Buratino 3D**:
   - Заменить `BuratinoGame.tsx` на `BuratinoGame3D.tsx` с Three.js: 7 GLB-ключей с PBR, вращение вокруг Y-оси через `useFrame`, кликабельные `<mesh>` с raycasting
   - Если визуал устроит — продолжаем; если нет — откатываем
3. **Этап Γ — остальные кандидаты на 3D**:
   - **Zolushka**: монеты как 3D-диски с frontTexture/backTexture, реальное вращение
   - **Kolobok**: 5 GLB-зверушек, простая прыжковая анимация через `useFrame`
   - **BabaYaga**: котёл-фон + 3D-ингредиенты на карточках
4. **Этап Δ — остаются на Pixi** (2D хватает):
   - **Koschei**: карточная сетка — 3D не добавляет ценности
   - **BOYARIN**: 24 печати — текущая `Seal.tsx` неплохо смотрится

### Что НЕ делать пока

- Не подключать Three.js до пилота — лишний бандл.
- Не модифицировать Pixi-игры под GLB — это другой рантайм, лучше отдельная версия.
- Не покупать платные паки до проверки на одной игре — может не понравиться визуально.

### Полезные комбинации

- **Lottie / Rive** для UI-микровзаимодействий (открытие карточки, фейерверк при идеальной игре) — независимо от 3D-выбора. `@rive-app/canvas` или `lottie-react`.
- **Particle emitters** (`@pixi/particle-emitter` для Pixi, `three-nebula` для Three.js) — искры, дым, пузыри. Дёшево по коду, дорого выглядит.
- **Spine / DragonBones** — если захочется скелетных 2D-анимаций (например, говорящий Буратино). Spine Pro ~$300.

---

## Известные TODO

| Задача | Где |
|---|---|
| Push-уведомления через бота | `bot/bot.ts` |
| Экран «Вести с ярмарки» (News feed) | новая страница клиента |
| Admin-панель | отдельный роут/сервис |
| 3D-апгрейд мини-игр | см. секцию выше |
| `SPONSOR_CHANCE` вернуть на `0.01` после теста | `types.ts` |
| Pre-existing TS errors в server (AmaSessionInput, ProjectPublicDTO, NpcTruthParams) — не блокируют tsx-runtime но висят | `tsc --noEmit` |
