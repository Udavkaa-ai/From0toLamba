# Архитектура новой Android-игры

> Этот документ — **источник правды** для нативной Android-версии «Из грязи в князи».
> Он перекрывает старый `CODEMAP.md` (который описывает заморожённую архитектуру `app/`
> до настоящей реархитектуры) и `CLAUDE.md` в той части, где CLAUDE.md описывает
> Telegram Mini App. Контент-идеи и доменные правила из обоих файлов остаются
> релевантными — техническая реализация ниже их не повторяет, а заменяет.

---

## 1. Контекст и решения

**Что мы строим.** Полностью самостоятельную Android-игру — нативный симулятор
купца-инвестора в сказочной Руси. Распространение — Google Play. Никакой
интеграции с Telegram, Mini App, TON Connect, Stars или ботом. Никакого
переиспользования `tg/server` (он остаётся для существующей TG-версии — мы
её не трогаем).

**Что мы НЕ строим (и не реализовываем):**

- Telegram Mini App слой, бот, Stars-платежи, TON Connect, UTM-партнёры.
- Чат «Ярмарочная площадь» — это multiplayer-фича, требует сервера с БД.
- Глобальный лидерборд (`/api/leaderboard/*`) — требует сервера с БД.
- Реферальная система (`referrerId`, `referralBonusGranted`) — требует
  кросс-устройственной идентификации.
- Внутриигровое поле `intuitionScore` («чуйка») — убрано в TG-версии 4.0,
  не вводим заново.

**Базовые решения сессии:**

| Решение | Выбор |
|---|---|
| Бэкенд для логики | Нет — всё локально на устройстве |
| AI для AMA-беседы | Serverless-прокси без БД (Vercel/Cloudflare) |
| Монетизация | Rewarded ads через AppLovin MAX (AdMob + Yandex) |
| Identity для прокси | Локальный `deviceId` (UUID, persistent через DataStore) |
| Сохранения | Room DB + потенциально Google Play Saved Games (позже) |
| Ad-mediation | AppLovin MAX, AdMob и Yandex как сети |

---

## 2. Стек

| Слой | Технология |
|---|---|
| UI | Jetpack Compose + Material 3 |
| Навигация | Navigation Compose (типизированные routes) |
| DI | Hilt |
| Асинхронность | Coroutines + Flow |
| Локальная БД | Room (KSP) |
| Persistent prefs | DataStore (Preferences) |
| Мини-игры | Korge (KMP-движок поверх Skia) — для арх-1..6 |
| 2D-рендер для BOYARIN | Compose Canvas (грамоты — векторные) |
| Сеть | OkHttp (для AI-прокси и ad SDK) |
| Сериализация | Kotlinx Serialization |
| Реклама | AppLovin MAX + AdMob adapter + Yandex Mobile Ads adapter |
| Тесты | JUnit4 + Turbine для Flow |
| CI | GitHub Actions, билдит APK на push в `claude/**` и `main` |

---

## 3. Структура модулей

Текущий `app/` остаётся **единственным** модулем — мультимодульность отложим
до тех пор, пока размер кода не оправдает её. Внутри `app/src/main/kotlin/com/s0dolamby/game/`:

```
data/
  db/                  # Room: entities, DAO, AppDatabase
  local/               # DataStore: preferences, deviceId
  repository/          # Реализации репозиториев
  remote/
    ai/                # AI-прокси клиент (OkHttp)
domain/
  model/               # POJO-модели (Project, GameState, AmaSession, …)
  enums/               # PersonaArchetype, ProjectType, ProjectFate, …
  config/              # FATE_CONFIG, WITHDRAWAL_RULES, тарифы цен
  usecase/             # Чистые сценарии (Invest, AdvanceDay, Withdraw, …)
ui/
  navigation/          # NavGraph
  screen/
    home/
    inbox/
    portfolio/
    minigame/          # Каркас + диспетчер
    ama/
    relationships/     # «Завязки»
    leaderboard/       # Локальный (по PostMortem)
    settings/
  theme/               # Compose-токены: Classic + Fairy
  components/
ads/
  AdManager.kt         # MAX wrapper + rewarded callback
  RewardedFeature.kt   # enum: TIMER_SKIP / AMA_UNLOCK / EXTRA_SLOT / MINIGAME_BYPASS
game/
  AdvanceDayService.kt
  GenerateProjectService.kt
  InvestService.kt
  ranks/               # recomputeRank по числу взятых дел
  ties/                # TieLevels, TokenBalance
  fate/                # Random events, mafia offers, sponsor campaigns
di/                    # Hilt-модули
util/                  # SeedRng, Money helpers (Math.floor!)
```

---

## 4. Игровая доменная модель

Берём за основу TG-версию 4.4 (включая «революцию 4.0» — чины по числу
дел, и завязки 4.4). Доменные сущности:

```
PersonaArchetype : BURATINO | BOYARIN | KOLOBOK | KOSCHEI | ZOLUSHKA | BABA_YAGA | IVAN_DURAK
ProjectType      : CARD_GAME | TREASURE_HUNT | POTION_BREW | GUILD_SCHEME | HONEST_TRADE
ProjectFate      : INSTANT_SCAM | SLOW_DRAIN | HONEST_FAIL | SURVIVOR | UNICORN
InvestorRank     : SKOMOROKH | KUPETS | MUDRETS | BOYARIN | KNYAZ
                 (5 ступеней — по числу взятых дел: 0/5/20/50/100)
```

**Чины — по числу `Project.investedAmountRubles > 0`:**

| Чин | Порог |
|---|---|
| Скоморох | старт |
| Купец | ≥ 5 дел |
| Мудрец | ≥ 20 дел |
| Боярин | ≥ 50 дел |
| Князь | ≥ 100 дел |

`recomputeRank(userId)` после каждого `invest` и в `advance-day`.

**Жетоны архетипов** (`archetypeTokens: Map<PersonaArchetype, Int>`)

- За каждую идеальную мини-игру (`errorCount == 0`) — +1 жетон у архетипа хозяина.
- Жетоны накопительные, **не тратятся**.

**Завязки** (TG-версия 4.4.0): уровень отношений с архетипом
= total tokens received за всю игру у этого архетипа.

- `tieLevel(arch) = min(MAX_TIE_LEVEL=10, tokens.received[arch])`
- Бонус: `+1% / день / уровень` к доходности активных дел этого архетипа
- VIP `SPONSOR_FIXED` бонус НЕ применяется (своя 3× траектория).

**Экономика** (берём из CLAUDE.md TG-версии без изменений):

| Параметр | Значение |
|---|---|
| Старт | 0 г → +50 г после онбординга |
| Мин/макс вложение | 5 / 5 000 г |
| Активных дел | 5 (+ до 5 extra slots) |
| Все money-операции | `Math.floor()`, **никогда** `.toFixed`/`Math.round` |

**Правила вывода** — `WITHDRAWAL_RULES`:

- `POTION_BREW`, `GUILD_SCHEME`: max 25% от `currentValueRubles` за раз
- `CARD_GAME`, `TREASURE_HUNT`: любая сумма, −25% комиссия
- `HONEST_TRADE`: без ограничений и комиссии

**FATE_CONFIG** — таблица параметров каждой судьбы (длительность, ставка, шанс):
переносим один-в-один из `tg/server/src/game/types.ts`.

---

## 5. Мини-игры

| Архетип | Игра | Рантайм | Таймер |
|---|---|---|---|
| BOYARIN | Купеческая грамота (24 печати) | Compose Canvas | 15 с |
| BURATINO | Золотой ключик | Korge | 10 с эталон + 10 с выбор |
| KOSCHEI | Память Кощея | Korge | 20 с |
| KOLOBOK | Нора-нора-нора | Korge | 10 с |
| ZOLUSHKA | Падающие монеты | Korge | 5 с эталон + 15 с ловли |
| BABA_YAGA | Котёл | Korge | 6 с эталон + 15 с выбора |
| IVAN_DURAK | Повторить карту | Korge | 15 с |

**BOYARIN остаётся на Compose Canvas** — текущая `Seal.kt`/процедурная печать
работает, нет смысла перетаскивать. Остальные 6 — на Korge (KMP-движок).
Причина: Korge даёт удобные `Scene`-классы, `Container`, hit-testing,
тикер — намного компактнее чем писать Canvas-цикл руками.

**Единая лесенка ошибок** (как в TG 4.4):

- `errorCount == 0` → идеальная игра + жетон + 🔮 совет чуйки (раскрыть посул/тип)
- `errorCount == 1` → победа без совета
- `errorCount >= 2` → поражение, ничего не раскрыто; пользователь может
  посмотреть rewarded ad для активации фичи `MINIGAME_BYPASS`

**Диспетчер**: `MiniGameScreen` (`ui/screen/minigame/`) — `when (archetype)`
→ нужный композит. Каждая Korge-игра обёрнута в `AndroidView` через
`KorgeView`. Подсказки `MINIGAME_INFO` — `domain/config/MinigameInfo.kt`.

**SeedRng** — `util/SeedRng.kt`: FNV-1a → mulberry32, один в один с
`tg/client/src/components/minigames/seedRng.ts`. Один и тот же
`charter.gridSeed` детерминирует расстановку ассетов.

---

## 6. Монетизация — rewarded ads

**4 фичи, каждая активируется одним rewarded видео:**

| Feature | Где запускается | Что даёт |
|---|---|---|
| `TIMER_SKIP` | Главный экран, кулдаун 2 ч после 7 быстрых дней | Сбрасывает кулдаун |
| `AMA_UNLOCK` | Карточка дела в инбоксе | Открывает беседу |
| `EXTRA_SLOT` | Попытка инвестировать при 5 активных | +1 слот (макс 5 доп.) |
| `MINIGAME_BYPASS` | После поражения в мини-игре | Раскрывает посул + тип, разрешает инвест |

**Mediation: AppLovin MAX → AdMob + Yandex.**

- Primary: AppLovin MAX SDK (`com.applovin:applovin-sdk`)
- Adapter AdMob: `com.applovin.mediation:google-adapter`
- Adapter Yandex: `com.applovin.mediation:yandex-adapter`

AppLovin MAX даёт единый API, медиация — серверная (waterfalls на их стороне).
Альтернатива «оба SDK напрямую с собственным fallback'ом» возможна, но MAX
сильно упрощает onboarding и репортинг.

**Архитектура клиента:**

```kotlin
// ads/RewardedFeature.kt
enum class RewardedFeature { TIMER_SKIP, AMA_UNLOCK, EXTRA_SLOT, MINIGAME_BYPASS }

// ads/AdManager.kt
class AdManager @Inject constructor(...) {
    fun preload(feature: RewardedFeature)
    suspend fun showRewarded(feature: RewardedFeature, activity: Activity): AdResult
}

sealed interface AdResult {
    object Rewarded : AdResult                // показано полностью → активируем
    object Dismissed : AdResult               // юзер закрыл до награды
    data class Failed(val reason: String) : AdResult
}
```

**Внутриигровая активация** (важно): ad-success → use case
`ActivateRewardUseCase(feature, projectId?)` атомарно меняет состояние:

- `TIMER_SKIP` → `cooldownExpiresAt = now()` + аналитика
- `AMA_UNLOCK` → `AmaSession.unlocked = true` для дела
- `EXTRA_SLOT` → `gameState.extraSlotsBalance += 1`
- `MINIGAME_BYPASS` → `Project.bypassUsedAt = now()`, разрешает Inbox→Invest
  даже при `errorCount >= 2`. Раскрываем `perfectInsight` для UI.

**Test ad-unit IDs во время разработки** — публичные от AppLovin/AdMob/Yandex,
зашиты в `local.properties`. Реальные — добавляются перед публикацией.

**GDPR/AppOpen consent**: подключим UMP SDK от Google + аналог Yandex'а.
Pre-launch экран показывает consent-дайлог при первом запуске.

---

## 7. AI-прокси

**Цель.** Беседа AMA с дельцом нуждается в LLM-ответах. Зашивать
OpenRouter-ключ в APK — выгорит за день (можно вытащить из бандла через
`strings` или дизассемблером). Серверный прокси держит ключ в env-vars,
делает rate-limit per device-id.

**Стек прокси:**

- Платформа: **Cloudflare Workers** (преимущества — глобальный edge, бесплатный
  тир достаточен для бета-нагрузки, no cold start). Альтернатива: Vercel
  Edge Functions, всё одно по интерфейсу.
- Язык: TypeScript (Worker runtime).
- БД: **нет**. Rate-limit через Cloudflare KV или Durable Objects
  (sliding window per device-id).
- Деплой: GitHub Actions из `proxy/` поддиректории, Wrangler CLI.

**Endpoint:** `POST https://ai.example.com/generate`

```json
// Request
{
  "deviceId": "uuid-v4",
  "scenario": "AMA_REPLY" | "BANNER_NAMES" | "POSTMORTEM" | "DAILY_UPDATE",
  "model": "deepseek/deepseek-v4-flash" | "google/gemini-3.1-flash-lite-preview",
  "messages": [{"role": "system" | "user" | "assistant", "content": "..."}]
}

// Response
{ "content": "...", "usage": { ... } }
```

**Rate limits (sliding window):**

| Сценарий | Per device, per минуту |
|---|---|
| `AMA_REPLY` | 6 |
| `BANNER_NAMES` | 3 |
| `POSTMORTEM` | 3 |
| `DAILY_UPDATE` | 2 |

**Промпт-сборка** — целиком на клиенте, прокси просто проксирует. Так мы
не отдаём прокси доменную логику и можем менять промпты без redeploy
прокси.

**Безопасность:**

- HMAC-подпись запроса (`X-Device-Sig`) от deviceId+timestamp на ключе,
  который ротируется через build-config (минимально — отстраняет
  curl-script kiddies, не серьёзная защита).
- Origin-проверка не работает (нативный клиент не присылает Origin
  достоверно), полагаемся на HMAC.
- Капы: глобальный лимит токенов в день; per-device абсолютный кап.

**Что положить в репо:**

```
proxy/
  src/
    worker.ts          # entrypoint
    rateLimit.ts       # KV-based sliding window
    openRouter.ts      # обёртка
  wrangler.toml        # Cloudflare config
  package.json
  README.md
```

---

## 8. Контент и ассеты

- **Баннеры персонажей** — переиспользуем из `tools/banners/output_realistic/`.
  Кладём в `app/src/main/assets/banners/`. Файлы: `<ARCH>_<TYPE>_<NN>.webp`,
  вариант детерминирован по `projectId.hashCode() % 5`.
- **Фоны страниц** — `tools/banners/output_backgrounds/`. Кладём в
  `app/src/main/assets/backgrounds/`. `HOME_01..07` (роль `day/7 % 7`),
  `BG_INBOX/PORTFOLIO/STATS/LEADERBOARD/REGISTRY`.
- **Аватары и фоны AMA-бесед** — из `tg/client/public/personas/` и
  `avatars/` (если есть). Theme-aware варианты `_LIGHT`.
- **Музыка** — `app/src/main/res/raw/main_theme.mp3`. MediaPlayer + AudioFocus.
- **SFX** — переписываем `tg/client/src/sounds.ts` (Web Audio API) на
  `SoundPool` + 7 коротких WAV: `tap, invest, day, win, lose, rankup, seal`.
  Альтернатива — генерация через `AudioTrack` (но проще короткие WAV).

---

## 9. Roadmap (фазы реализации)

### Фаза А — Фундамент (1-2 сессии)
- [x] Room schema extensions под все доменные поля (готово — Phase 1, см. ниже)
- [ ] `domain/enums/` — `PersonaArchetype`, `ProjectType`, `ProjectFate`, `InvestorRank`
- [ ] `domain/config/` — `FATE_CONFIG`, `WITHDRAWAL_RULES`, `MINIGAME_INFO`
- [ ] `data/local/DeviceIdProvider` — UUID в DataStore
- [ ] `util/SeedRng` — FNV-1a + mulberry32, парирует JS-версию
- [ ] Hilt-модули

### Фаза Б — Игровое ядро (2-3 сессии)
- [ ] `GenerateProjectService` (без AI, локальные шаблоны)
- [ ] `AdvanceDayService` (random events, mafia offers, sponsor campaigns,
      tie-бонусы, кулдаун)
- [ ] `InvestService` (атомарный perist, extra-slot логика)
- [ ] `WithdrawUseCase` с `WITHDRAWAL_RULES`
- [ ] `RankService.recompute` (по числу взятых дел)
- [ ] `TieService.compute` (уровни + бонусы)
- [ ] `TokenBalance` (`Map<PersonaArchetype, Int>` + `received`/`spent`)

### Фаза В — UI слои (3-4 сессии)
- [ ] `HomeScreen` (баланс, инбокс preview, лента, BG-rotation)
- [ ] `InboxPage`, `PortfolioPage`, `LeaderboardPage` (local-only по
      PostMortem), `RelationshipsPage`
- [ ] `MiniGameScreen` диспетчер + 1 пилотная игра (`BuratinoGame` на Korge)
- [ ] Оставшиеся 5 мини-игр
- [ ] BOYARIN на Compose Canvas
- [ ] `AmaScreen`
- [ ] `SettingsScreen` (тема, язык, mute, volume, сброс)
- [ ] `DayTransitionOverlay`
- [ ] Тур / онбординг

### Фаза Г — Монетизация (1 сессия)
- [ ] AppLovin MAX SDK + adapters
- [ ] `AdManager` + `RewardedFeature` + use case
- [ ] Интеграция в 4 точках (timer_skip, ama_unlock, extra_slot, minigame_bypass)
- [ ] GDPR consent (UMP)

### Фаза Д — AI-прокси (1 сессия)
- [ ] `proxy/` поддиректория с Cloudflare Worker
- [ ] OpenRouter wrapper + rate-limit
- [ ] Деплой через GitHub Actions
- [ ] `data/remote/ai/AiClient` в Android-клиенте
- [ ] `AmaUseCase` использует AiClient

### Фаза Е — Полировка + Play (2-3 сессии)
- [ ] Saved Games (Google Play Games Services) — опционально
- [ ] Crashlytics
- [ ] ProGuard/R8 rules
- [ ] Локализация (RU+EN string resources)
- [ ] Privacy policy + Data safety form
- [ ] Internal testing track в Play Console

---

## 10. Что наследуем из Phase 1

Phase 1 (`886bca7`) уже расширил Room под публичные поля
`tg/server`. **Большинство этих полей остаются актуальными** — но не как
зеркало TG-DTO, а как локальные поля, заполняемые местной логикой.

Файлы Phase 1:
- `app/src/main/kotlin/com/s0dolamby/game/data/db/entity/ProjectEntity.kt`
- `.../entity/GameStateEntity.kt`
- `.../entity/AmaSessionEntity.kt`
- `.../entity/UpdateEntity.kt`
- `domain/model/Project.kt`, `domain/model/DailyUpdate.kt`

**Что точно убрать в Фазе А:**

- `intuitionScore` (Field на `GameStateEntity`/`Project`) — оставить только
  в `PostMortem` для аналитики старых сейвов; новые сейвы не пишут.
- Любые поля связанные с TG ID, Stars, рефералами (`referrerId`,
  `referralBonusGranted`, `utmSource`) — если попали в Phase 1, убрать.

---

## 11. Что выкинуть из CODEMAP.md

`CODEMAP.md` (Android-часть) описывает заморожённое состояние app/ ДО
реархитектуры. Когда Фаза А завершена, `CODEMAP.md` будет переписан под
новую архитектуру. До тех пор он остаётся справочником по существующим
Compose-экранам и Room-слою — основной кодовый каркас валидный, меняется
домен и слой данных.

---

## 12. Принципы (коротко)

- **Money: всегда `Math.floor()`.** Никогда `.toFixed`, `Math.round`,
  `Math.ceil` для отображения денег. `.roundToInt()` тоже нет.
- **Скрытые поля проекта** (`fate`, `daysUntilCollapse`,
  `realDailyYieldRubles`, `forgedIndices`) — никогда не показываем в UI до
  PostMortem или `perfectInsight`. Mapping в `Project.toPublicUi()`.
- **Idempotent advance-day** — повторный вызов в один и тот же день =
  no-op. Защита от двойных нажатий.
- **Theme tokens** — все цвета через `theme/colors.kt` (classic + fairy
  вариант), никаких хардкодов в Composable'ах.
- **i18n** — все строки в `strings.xml` + `strings-ru.xml`. Никаких
  inline-литералов кроме отладочного.
- **deviceId** генерируется единожды и хранится в DataStore. Используется:
  (а) HMAC-подпись AI-прокси, (б) rate-limit ключ, (в) AppLovin
  user-identifier для отчётности.
- **Не хранить лишнего**: `seenTypes`, `seenArchetypes`, `seenFates`
  выводятся из PostMortem на лету, не лежат отдельным полем.
