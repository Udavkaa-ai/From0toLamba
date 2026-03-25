# Из грязи в князи

Симулятор купца-инвестора в сказочной Руси — Telegram Mini App.

Игрок вкладывает рубли (₽) в «дела» — аналоги инвестиционных проектов, большинство из которых обман. Задача — научиться отличать честных хозяев от жуликов через беседу с AI-персонажем.

---

## Как играть

1. Открываешь Telegram Mini App
2. Получаешь стартовый бонус ~50 ₽ за онбординг
3. В «Входящих грамотах» появляются новые дела — от 1 до 3 в день
4. Жмёшь «Побеседовать» → задаёшь до 10 вопросов AI-хозяину дела
5. Решаешь: вложить рубли или миновать
6. Каждый день нажимаешь «Следующий день» — дела живут, приносят доход или рушатся
7. В «Казне» смотришь графики, вестей и управляешь вложениями
8. После закрытия дела — PostMortem раскрывает архетип хозяина и твой результат

---

## Механики

**AMA-сессия (беседа)** — главная фишка. AI играет роль хозяина дела и знает его судьбу, но скрывает. Каждый архетип ведёт себя по-своему: Буратино наивно врёт, Кощей давит цифрами, Баба-Яга говорит загадками.

**Чуйка** — система оценки интуиции. В ходе беседы отмечаешь, в каких темах подозреваешь ложь. После 10 вопросов — оценка: +1 за верное подозрение, −1 за ложное.

**Судьбы дел:**
- `INSTANT_SCAM` (30%) — бежит с деньгами на 1–3 день
- `SLOW_DRAIN` (25%) — держится 1–3 недели, тихо исчезает
- `HONEST_FAIL` (15%) — честно старался, не взлетело
- `SURVIVOR` (20%) — долгожитель, стабильный доход
- `UNICORN` (10%) — взлетел: иксы и слава

**Купеческий чин:** растёт с балансом, днями в игре и очками Чуйки. От Скомороха до Царя.

---

## Стек

### Telegram Mini App (активная версия)

| Слой | Технологии |
|---|---|
| Frontend | React 18 + TypeScript + Vite + MUI |
| Backend | Fastify + TypeScript + tsx |
| База данных | PostgreSQL + Prisma ORM |
| AI | OpenRouter API → DeepSeek Chat v3 |
| Бот | Grammy (Telegram Bot API) |
| Деплой | Docker, один контейнер |

### Android (оригинальная версия, заморожена)

| | |
|---|---|
| Язык | Kotlin |
| UI | Jetpack Compose |
| Архитектура | MVVM + Clean Architecture |
| DB | Room |
| DI | Hilt |

---

## Быстрый старт

### Через Docker

```bash
git clone https://github.com/udavkaa-ai/from0tolamba.git
cd from0tolamba

docker build -t from0tolamba .

docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/from0tolamba" \
  -e TELEGRAM_BOT_TOKEN="123456:ABC..." \
  -e MINI_APP_URL="https://your-domain.com" \
  -e OPENROUTER_API_KEY="sk-or-..." \
  -e NODE_ENV="production" \
  from0tolamba
```

### Локально

```bash
# 1. Сервер
cd tg/server
npm install
cp .env.example .env   # заполнить DATABASE_URL, BOT_TOKEN, OPENROUTER_API_KEY

npm run dev            # :3000

# 2. Клиент (в другом терминале)
cd tg/client
npm install
npm run dev            # :5173
```

---

## Переменные окружения

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `TELEGRAM_BOT_TOKEN` | Токен от @BotFather |
| `MINI_APP_URL` | Публичный URL приложения (для Telegram webhook) |
| `OPENROUTER_API_KEY` | Ключ [openrouter.ai](https://openrouter.ai) |
| `ADMIN_JWT_SECRET` | Секрет для admin-панели (любая строка) |
| `PORT` | Порт сервера (по умолчанию 3000) |
| `NODE_ENV` | `development` или `production` |

---

## Структура проекта

```
from0tolamba/
├── tg/                    # Telegram Mini App (активная разработка)
│   ├── client/            # React frontend
│   └── server/            # Fastify backend
│       ├── src/
│       │   ├── api/       # HTTP маршруты
│       │   ├── game/      # Игровая логика
│       │   ├── ai/        # OpenRouter клиент
│       │   ├── bot/       # Telegram бот
│       │   └── scheduler/ # Ежедневный cron
│       └── prisma/        # Схема БД
├── app/                   # Android приложение (заморожено)
└── Dockerfile             # Сборка и деплой
```

---

## Игровая экономика

- Все суммы — в рублях (₽), без копеек
- Баланс = только свободные рубли (не вложенные)
- Доход копится внутри вложения до момента вывода
- Максимум 5 активных дел одновременно
- Максимальное вложение — 5 000 ₽ на одно дело

**Лимиты вывода:**
- Зелейное дело / Артель: не более 25% за раз
- Азартная игра / Поиск клада: любая сумма, минус 25% комиссии
- Честная торговля: без ограничений

---

## Лицензия

Proprietary. All rights reserved.
