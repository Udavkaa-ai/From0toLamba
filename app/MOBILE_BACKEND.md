# Android backend: AI-прокси и сбор фидбека

Android-приложение больше НЕ носит ключ OpenRouter в APK. Вся AI-генерация
и заметки тестеров идут через **отдельный сервис `mobile-backend/`** на
Railway — со своей маленькой Postgres, TG-сервера и его базы с игроками
он НЕ касается.

> Инструкция по развёртыванию самого сервиса — в `mobile-backend/README.md`.
> Здесь — только про сборку APK.

## Как это устроено

```
Android APK ──X-App-Key──> mobile-backend (отдельный Railway-сервис)
                            ├─ POST /api/mobile/chat     → OpenRouter (серверный ключ)
                            └─ POST /api/mobile/feedback → своя Postgres (таблица Feedback)
```

- `MOBILE_APP_KEY` — общий секрет допуска к прокси. Проверяется на сервере,
  зашит в APK. Скомпрометировали — меняешь его в Railway и пересобираешь APK,
  ключ OpenRouter при этом не трогается.
- `MOBILE_PROXY_URL` — публичный домен сервиса mobile-backend (Railway
  выдаёт свой при создании). Без него APK соберётся, но AI/фидбек не заработают.
- `OPENROUTER_API_KEY` — только на сервере mobile-backend, в APK его нет.

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

Один и тот же ключ вписывается в места:

1. **Railway → сервис mobile-backend → Variables** — `MOBILE_APP_KEY`
   (и там же `OPENROUTER_API_KEY`, `DATABASE_URL` своей базы — см.
   `mobile-backend/README.md`).
2. **Где собираешь APK — GitHub Actions (основной путь):** GitHub →
   репозиторий → Settings → Secrets and variables → **Actions** → New
   repository secret:
   - `MOBILE_APP_KEY` — твой ключ (тот же, что в Railway);
   - `MOBILE_PROXY_URL` — публичный домен сервиса mobile-backend со `/`
     на конце (Railway → сервис → Settings → Networking).
   Старый секрет `OPENROUTER_API_KEY` можно удалить.
   Для локальной сборки — те же строки в `app/local.properties` (в .gitignore).

Значения `MOBILE_APP_KEY` в Railway и в GitHub Secrets должны совпадать
буква-в-букву: сервер сверяет присланный из APK ключ с тем, что в env.

Таблица `Feedback` создастся сама при деплое сервиса.

## Сборка APK для тестеров

CI сам подставит `MOBILE_APP_KEY` и `MOBILE_PROXY_URL` из GitHub Secrets.
Для локальной сборки — `app/local.properties` (НЕ коммитить):

```
MOBILE_APP_KEY=<тот же секрет, что в Railway>
MOBILE_PROXY_URL=https://<домен-mobile-backend>.up.railway.app/
```

Если секреты не задать — APK соберётся, но AI и отправка фидбека получат
401 (нет ключа) или не найдут сервер (нет URL).

## Выгрузка заметок тестеров — веб-страница (в БД лазить не надо)

Открой в браузере (подставь домен mobile-backend и свой MOBILE_APP_KEY):

```
https://<домен-mobile-backend>.up.railway.app/admin/feedback?key=ТВОЙ_КЛЮЧ
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
