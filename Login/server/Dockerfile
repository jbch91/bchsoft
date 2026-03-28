FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY sql ./sql

RUN mkdir -p uploads

EXPOSE 5050

CMD ["sh", "-lc", "node scripts/migrate.js && node src/server.js"]

