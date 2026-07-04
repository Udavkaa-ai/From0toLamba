# Отдельный сервис для Android-версии. Собирается независимо от TG-сервера.
FROM node:20-alpine

WORKDIR /app

# Сначала манифесты и схема — кэшируем npm install
COPY package.json ./
COPY prisma ./prisma/
RUN npm install && npx prisma generate

COPY tsconfig.json ./
COPY src ./src/

EXPOSE 3000

# На старте: синхронизируем свою БД (только таблица Feedback) и поднимаем сервер
CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && npx tsx src/index.ts"]
