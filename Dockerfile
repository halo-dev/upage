# ---- build stage ----
FROM node:20.18.0-alpine  AS build
WORKDIR /app

ENV HUSKY=0

# Use pnpm
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

# Install python and build tools
RUN apk add --no-cache python3 make g++

# Install deps efficiently
COPY package.json pnpm-lock.yaml* ./
RUN pnpm fetch

# Copy source and build
COPY . .
# install with dev deps (needed to build)
RUN pnpm install --offline --frozen-lockfile

# Generate prisma client
RUN pnpm prisma generate

# Build the Remix app (SSR + client)
RUN NODE_OPTIONS=--max-old-space-size=4096 pnpm run build

# Keep only production deps for runtime
RUN pnpm prune --prod --ignore-scripts

# ---- runtime stage ----
FROM node:20.18.0-alpine  AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV LOGTO_ENABLE=false
ENV PORT=3000
ENV HOST=0.0.0.0

# Use pnpm
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

# Install bash
RUN apk add --no-cache bash \
  && rm -rf /var/lib/apt/lists/*

# Copy only what we need to run
COPY --from=build /app/build /app/build
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/public ./public
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/server.mjs ./
COPY --from=build /app/prisma ./prisma

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD [ "pnpm", "run", "start" ]
