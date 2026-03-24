FROM node:20-alpine

# OpenSSL нужен для Prisma на alpine
RUN apk add --no-cache openssl

WORKDIR /app/tg/server

# Install dependencies (включая devDeps для tsx)
COPY tg/server/package*.json ./
COPY tg/server/prisma ./prisma/
RUN npm install

# Copy source
COPY tg/server ./

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

# Запуск через tsx — не нужна компиляция в dist
CMD ["npx", "tsx", "src/index.ts"]
