# Android backend: AI-прокси и сбор фидбека

Android-приложение больше НЕ носит ключ OpenRouter в APK. Вся AI-генерация
и заметки тестеров идут через наш Railway-сервер (`tg/server`), где ключ
живёт в переменных окружения.

## Как это устроено

```
Android APK ──X-App-Key──> Railway (from0tolamba-production)
                            ├─ POST /api/mobile/chat     → OpenRouter (серверный ключ)
                            └─ POST /api/mobile/feedback → Postgres (таблица Feedback)
```

- `MOBILE_APP_KEY` — общий секрет допуска к прокси. Проверяется на сервере,
  зашит в APK. Скомпрометировали — меняешь его в Railway и пересобираешь APK,
  ключ OpenRouter при этом не трогается.
- `OPENROUTER_API_KEY` — только на сервере, в APK его нет.

## Railway → Variables (сервис From0toLamba)

Добавить одну новую переменную к уже существующим:

```
MOBILE_APP_KEY   <любая длинная случайная строка>
```

Уже должны быть (не трогаем):
```
DATABASE_URL         ${{Postgres.DATABASE_URL}}
OPENROUTER_API_KEY   sk-or-...
MINI_APP_URL         https://from0tolamba-production.up.railway.app
```

Таблица `Feedback` создастся сама при деплое (`prisma db push` в старт-скрипте).

## Сборка APK для тестеров

В `app/local.properties` (НЕ коммитить):

```
MOBILE_APP_KEY=<тот же секрет, что в Railway>
# MOBILE_PROXY_URL по умолчанию = https://from0tolamba-production.up.railway.app/
# переопределять нужно только если сервер на другом домене
```

Если `MOBILE_APP_KEY` не задать — сборка соберётся, но AI и отправка
фидбека будут получать 401 от сервера (когда на сервере ключ выставлен).

## Выгрузка заметок тестеров

Railway → Postgres → Query (или `psql`):

```sql
SELECT "createdAt", nickname, type, page, "appVersion", message
FROM "Feedback"
ORDER BY "createdAt" DESC;
```

Экспорт в CSV — кнопкой в Railway Data-вкладке или `\copy` из psql.

`type` = `BUG` | `SUGGESTION` | `QUESTION`; `page` — маршрут экрана, с
которого отправлено (`home`, `portfolio`, `ama/...` и т.п.).
