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

## MOBILE_APP_KEY — как выглядит и где взять

Это просто длинная случайная строка (32+ символов, латиница+цифры).
Сгенерировать любым из способов:

```bash
openssl rand -hex 32
# или
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Пример (НЕ используй этот, сгенерируй свой):
```
MOBILE_APP_KEY=8f3c1a9e5d7b204c6e18af93b2705d4c9a1e6f80b3d5278c4e91a6f0d2b7c3e5
```

Один и тот же ключ вписывается в ДВА места:

1. **Railway → сервис From0toLamba → Variables** — переменная
   `MOBILE_APP_KEY` со значением ключа.
2. **Где собираешь APK:**
   - **Сборка на GitHub Actions (основной путь):** GitHub → репозиторий →
     Settings → Secrets and variables → **Actions** → New repository secret
     → Name `MOBILE_APP_KEY`, Secret — твой ключ. Workflow сам подставит
     его в сборку. (Старый секрет `OPENROUTER_API_KEY` можно удалить —
     больше не нужен. Опциональный секрет `MOBILE_PROXY_URL` — только если
     сервер на другом домене.)
   - **Локальная сборка:** строка `MOBILE_APP_KEY=<тот же ключ>` в
     `app/local.properties` (файл в .gitignore).

Значения в Railway и в GitHub Secrets должны совпадать буква-в-букву:
сервер сверяет присланный из APK ключ с тем, что в env.

Прочие переменные Railway уже есть (не трогаем):
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

## Выгрузка заметок тестеров — веб-страница (в БД лазить не надо)

Открой в браузере (подставь свой MOBILE_APP_KEY):

```
https://from0tolamba-production.up.railway.app/admin/feedback?key=ТВОЙ_КЛЮЧ
```

Страница показывает все заметки лентой: тип (🐞 баг / 💡 идея / ❓ вопрос),
автор, экран-источник, версия, время и текст. Наверху — фильтр по типу и
кнопка **⬇ CSV** для выгрузки в таблицу.

Прямая ссылка на CSV:
```
.../admin/feedback?key=ТВОЙ_КЛЮЧ&format=csv
```

Доступ закрыт тем же `MOBILE_APP_KEY` — без правильного `?key=` страница
отдаёт 401. (Запасной путь — SQL в Railway → Postgres:
`SELECT * FROM "Feedback" ORDER BY "createdAt" DESC;`.)
