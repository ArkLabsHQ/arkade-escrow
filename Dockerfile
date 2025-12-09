FROM node:24 AS base
WORKDIR /app

# ---- deps: dev (for building) ----
FROM base AS deps
COPY package*.json ./
ARG DEPS_CACHE_BUST=0
RUN echo "deps cache bust=$DEPS_CACHE_BUST"
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    npm_config_build_from_source=better-sqlite3 \
    npm ci --no-audit --fund=false

# ---- build ----
FROM deps AS build
WORKDIR /app
COPY . .
# Capture build arguments for Vite
ARG VITE_BACKOFFICE_API_BASE_URL
ARG VITE_BACKOFFICE_APP_ROOT_URL
ARG VITE_CLIENT_API_BASE_URL
ARG VITE_CLIENT_APP_ROOT_URL
ARG VITE_ITEMS_PER_PAGE
# Build the entire repository (API + client + backoffice)
RUN npm run build
# Build client and backoffice apps (install per-app deps to avoid mutating root node_modules)
RUN --mount=type=cache,id=npm-cache,target=/root/.npm bash -lc "cd client && npm ci --no-audit --fund=false && npm run build"
RUN --mount=type=cache,id=npm-cache,target=/root/.npm bash -lc "cd backoffice && npm ci --no-audit --fund=false && npm run build"
# Do NOT prune here; some tools install optional platform-specific files that confuse prune during multi-builds

# ---- runtime ----
FROM node:24 AS production
WORKDIR /app
RUN mkdir -p /app/data

# Copy only production deps fresh to avoid prune issues
COPY package*.json ./
RUN --mount=type=cache,id=npm-cache,target=/root/.npm npm ci --omit=dev --no-audit --fund=false

# App code and builds
COPY --from=build /app/dist ./dist
# Keep dist folders inside their app dirs so ServeStatic can find them
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/backoffice/dist ./backoffice/dist

# Run as root
EXPOSE 3000
CMD ["node", "dist/main.js"]
