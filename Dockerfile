FROM node:20-alpine

RUN apk add --no-cache openssl

# Устанавливаем зависимости в /deps — вне пути монтирования bothost
WORKDIR /deps
COPY tg/server/package*.json ./
COPY tg/server/prisma ./prisma/
RUN npm install && npx prisma generate

# Копируем исходники (на случай если bothost не монтирует)
WORKDIR /app/tg/server
COPY tg/server ./

# NODE_PATH указывает Node искать модули в /deps/node_modules
ENV NODE_PATH=/deps/node_modules

EXPOSE 3000

# Синхронизируем схему БД перед стартом, затем запускаем сервер
CMD ["sh", "-c", "cd /deps && DATABASE_URL=$DATABASE_URL npx prisma db push --accept-data-loss --skip-generate && node /deps/node_modules/.bin/tsx /app/tg/server/src/index.ts"]
