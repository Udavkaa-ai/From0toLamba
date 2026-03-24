FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cache layer)
COPY tg/server/package*.json tg/server/
COPY tg/server/prisma tg/server/prisma/
RUN cd tg/server && npm install

# Copy server source and build
COPY tg/server tg/server/
RUN cd tg/server && npx prisma generate && npm run build

EXPOSE 3000

CMD ["node", "tg/server/dist/index.js"]
