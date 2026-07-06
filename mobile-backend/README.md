# mobile-backend — отдельный сервис для Android-версии

Изолированный мини-бэкенд: AI-прокси к OpenRouter + сбор заметок тестеров.
**Не касается TG-сервера и его базы с игроками** — своя маленькая Postgres
(одна таблица `Feedback`), свой доступ к OpenRouter.

```
Android APK ──X-App-Key──> mobile-backend (Railway)
                            ├─ POST /api/mobile/chat      → OpenRouter (ключ в env)
                            ├─ POST /api/mobile/feedback  → своя Postgres
                            └─ GET  /admin/feedback?key=  → лента + CSV
```

## Развёртывание на Railway (новый сервис)

1. Railway → проект → **New → GitHub Repo** → тот же `udavkaa-ai/from0tolamba`.
2. Настройки нового сервиса → **Root Directory** = `mobile-backend`.
   Railway возьмёт `mobile-backend/Dockerfile`.
3. К проекту добавить **отдельный Postgres** (New → Database → Postgres) —
   НЕ тот, что у TG-сервера. Это вторая независимая база.
4. Variables нового сервиса:
   ```
   DATABASE_URL         ${{Postgres.DATABASE_URL}}   ← ссылка на НОВЫЙ Postgres
   OPENROUTER_API_KEY   sk-or-...
   MOBILE_APP_KEY       <длинная случайная строка, openssl rand -hex 32>
   ```
5. Deploy. При старте контейнер сам создаст таблицу `Feedback`
   (`prisma db push`). Проверка: открой `https://<домен-сервиса>/health`
   → `{"ok":true}`.

Домен сервиса Railway покажет во вкладке Settings → Networking
(Public Networking). Он-то и есть `MOBILE_PROXY_URL` для APK.

## Что вписать в сборку APK

| Куда | Что |
|---|---|
| GitHub Secret `MOBILE_APP_KEY` | тот же ключ, что в Variables сервиса |
| GitHub Secret `MOBILE_PROXY_URL` | публичный домен этого сервиса (со `/` на конце) |
| Railway (этот сервис) `MOBILE_APP_KEY` | тот же ключ |

`MOBILE_APP_KEY` в GitHub и в Railway должны совпадать буква-в-букву.

## Выгрузка заметок

```
https://<домен-сервиса>/admin/feedback?key=ТВОЙ_КЛЮЧ
```

Лента заметок с фильтром по типу (🐞 баг / 💡 идея / ❓ вопрос) и кнопкой
⬇ CSV. Прямой CSV: добавить `&format=csv`.

## Купеческий рейтинг — кто играет

```
https://<домен-сервиса>/admin/merchants?key=ТВОЙ_КЛЮЧ
```

Лента всех купцов по богатству: сколько их всего, сколько активно за сутки
и за неделю, когда каждый последний раз заходил. Здесь видно, реально ли
тестеры играют. Прямой CSV: `&format=csv`.

Приложение шлёт положение игрока (`POST /api/mobile/leaderboard`, upsert по
стабильному `playerId`) при запуске, после ввода ника и при открытии рейтинга,
а само показывает верхушку из `GET /api/mobile/leaderboard`.

## Локальный запуск

```bash
cd mobile-backend
cp .env.example .env   # заполнить
npm install
npm run dev
```
