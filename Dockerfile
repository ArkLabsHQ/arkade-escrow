FROM node:24 AS base
WORKDIR /app

# Production dependencies stage
FROM base AS deps-dev
ENV NODE_ENV=production
RUN npm config set python /usr/bin/python3 || true
COPY package*.json ./
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    npm ci --no-audit --fund=false && \
    npm cache clean --force

# Development dependencies stage (for building)
FROM base AS deps-prod
# often avoids mirror flakiness; still set python explicitly
RUN npm config set python /usr/bin/python3 || true
COPY package*.json ./
# Force build from source for sqlite3 (skip prebuilt download),
# and make sure npm uses python3 for node-gyp.
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    npm ci --omit-dev --no-audit --fund=false --build-from-source=sqlite3

# Build stage
FROM deps-dev AS build
WORKDIR /app
COPY . .
RUN npm run build && \
    npm prune --production

# Production stage
FROM base AS production
WORKDIR /app
# Create non-root user
RUN groupadd --gid 1001 --system nodejs && \
    useradd --uid 1001 --system --gid nodejs --shell /bin/bash nodejs
# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies
COPY --from=deps-prod --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]
