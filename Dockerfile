FROM node:20-alpine

RUN apk add --no-cache openssl

# ─── Сборка клиента ────────────────────────────────────────────────────────────
WORKDIR /build/tg/client
COPY tg/client/package*.json ./
RUN npm install
COPY tg/client ./
# Vite инлайнит VITE_*-переменные в бандл ВО ВРЕМЯ билда — рантайма недостаточно.
# Railway-переменные становятся build-args автоматически, но Dockerfile должен
# объявить их через ARG. После — пробрасываем как ENV перед `npm run build`,
# чтобы Vite их подхватил из process.env.
# Если переменных нет (локальная сборка) — VITE_-значение будет undefined и
# Telegram Analytics SDK просто не инициализируется (см. main.tsx safe-init).
ARG VITE_TG_ANALYTICS_TOKEN
ARG VITE_TG_ANALYTICS_APP
ENV VITE_TG_ANALYTICS_TOKEN=$VITE_TG_ANALYTICS_TOKEN
ENV VITE_TG_ANALYTICS_APP=$VITE_TG_ANALYTICS_APP
# outDir в vite.config.ts = '../server/public' → /build/tg/server/public
RUN npm run build

# ─── Зависимости сервера ────────────────────────────────────────────────────────
WORKDIR /deps
COPY tg/server/package*.json ./
COPY tg/server/prisma ./prisma/
RUN npm install && npx prisma generate

# ─── Исходники сервера ─────────────────────────────────────────────────────────
WORKDIR /app/tg/server
COPY tg/server ./
# Кладём собранный клиент (rm -rf гарантирует чистую замену)
RUN rm -rf ./public && cp -r /build/tg/server/public ./public
# Баннеры персонажей — статика, генерируются заранее
COPY tools/banners/output_realistic ./assets/banners/
# Фоновые изображения страниц
COPY tools/banners/output_backgrounds ./assets/backgrounds/

# NODE_PATH указывает Node искать модули в /deps/node_modules
ENV NODE_PATH=/deps/node_modules

EXPOSE 3000

# Синхронизируем схему БД перед стартом, затем запускаем сервер
CMD ["sh", "-c", "cd /deps && DATABASE_URL=$DATABASE_URL npx prisma db push --accept-data-loss --skip-generate && node /deps/node_modules/.bin/tsx /app/tg/server/src/index.ts"]
