FROM node:24 AS base
WORKDIR /app

# ---- deps: dev (for building) ----
FROM base AS deps
COPY package*.json ./
ARG DEPS_CACHE_BUST=0
RUN echo "deps cache bust=$DEPS_CACHE_BUST"
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    npm_config_build_from_source=sqlite3 \
    npm ci --no-audit --fund=false

# ---- build ----
FROM deps AS build
WORKDIR /app
COPY . .
# Either 'nest build' (requires @nestjs/cli in devDependencies)
# or 'tsc -p tsconfig.build.json'
RUN npm run build
# Trim dev deps after build
RUN npm prune --omit=dev

# ---- runtime ----
FROM node:24 AS production
WORKDIR /app
RUN groupadd --gid 1001 --system nodejs && \
    useradd  --uid 1001 --system --gid nodejs --shell /bin/bash nodejs
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app
ENV NODE_ENV=production
ENV PORT=3000
ENV SQLITE_DB_PATH="/app/data/db.sqlite"

COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Run as root to fix ownership of a mounted volume at container start,
# then drop privileges to the 'nodejs' user for the actual app.
# Install gosu to safely switch user.
RUN apt-get update && apt-get install -y --no-install-recommends gosu && rm -rf /var/lib/apt/lists/*

# Add an entrypoint that chowns the data dir and execs as nodejs
COPY --chown=root:root scripts/entrypoint.sh /app/entrypoint.sh
RUN chmod 755 /app/entrypoint.sh

USER root
EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "dist/main.js"]
