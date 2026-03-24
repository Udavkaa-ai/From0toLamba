FROM node:20-alpine

# OpenSSL нужен для Prisma на alpine
RUN apk add --no-cache openssl

WORKDIR /app/tg/server

# Install dependencies first (cache layer)
COPY tg/server/package*.json ./
COPY tg/server/prisma ./prisma/
RUN npm install

# Copy source and build
COPY tg/server ./
RUN npx prisma generate && npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
