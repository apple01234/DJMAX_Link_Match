# LINK MATCH 2027 운영 이미지. SQLite 파일은 /data 볼륨에 둔다 (컨테이너를 다시 만들어도 유지).
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DB_PATH=/data/linkmatch.sqlite \
    BACKUP_DIR=/backups
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json next.config.ts ./
COPY scripts ./scripts
RUN mkdir -p /data /backups && chown node:node /data /backups
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
