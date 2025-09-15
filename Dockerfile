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
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

USER nodejs
EXPOSE 3000
CMD ["node", "dist/main.js"]
