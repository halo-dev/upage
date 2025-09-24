FROM node:20.18.0-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ bash

COPY package.json pnpm-lock.yaml ./

ENV HUSKY=0

RUN npm install -g pnpm && pnpm install

COPY . .

RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm run build

FROM node:20.18.0-alpine AS deps

WORKDIR /app

RUN apk add --no-cache python3 make g++ bash

COPY package.json pnpm-lock.yaml ./

ENV HUSKY=0

RUN npm install -g pnpm && pnpm install --prod

COPY prisma ./prisma

RUN pnpm prisma generate

FROM node:20.18.0-alpine AS upage-ai-production

WORKDIR /app

RUN apk add --no-cache bash

RUN npm install -g pnpm

ARG LOG_LEVEL=debug
ARG PORT=3000
ARG LLM_DEFAULT_PROVIDER
ARG LLM_DEFAULT_MODEL
ARG LLM_ENABLED_PROVIDERS
ARG DEFAULT_NUM_CTX
ARG OLLAMA_API_BASE_URL
ARG TOGETHER_API_BASE_URL
ARG LOGTO_ENDPOINT
ARG LOGTO_APP_ID
ARG LOGTO_BASE_URL

ENV NODE_ENV=production \
    PORT=${PORT} \
    LOG_LEVEL=${LOG_LEVEL} \
    DEFAULT_NUM_CTX=${DEFAULT_NUM_CTX} \
    LLM_DEFAULT_PROVIDER=${LLM_DEFAULT_PROVIDER} \
    LLM_DEFAULT_MODEL=${LLM_DEFAULT_MODEL} \
    LLM_ENABLED_PROVIDERS=${LLM_ENABLED_PROVIDERS} \
    OLLAMA_API_BASE_URL=${OLLAMA_API_BASE_URL} \
    TOGETHER_API_BASE_URL=${TOGETHER_API_BASE_URL} \
    LOGTO_ENDPOINT=${LOGTO_ENDPOINT} \
    LOGTO_APP_ID=${LOGTO_APP_ID} \
    LOGTO_BASE_URL=${LOGTO_BASE_URL} \
    RUNNING_IN_DOCKER=true \
    STORAGE_DIR=/app/storage

COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.mjs ./

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

COPY package.json ./

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD [ "pnpm", "run", "start" ]
