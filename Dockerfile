FROM node:20-alpine

RUN apk add --no-cache openssl

# ─── Сборка клиента ────────────────────────────────────────────────────────────
WORKDIR /build/tg/client
COPY tg/client/package*.json ./
RUN npm install
COPY tg/client ./
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
