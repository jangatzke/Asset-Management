# ============================================================================
# Asset Management ISMS – Backend Dockerfile
# Multi-stage build: deps → build → production
# CI uses: docker build --target production -f backend/Dockerfile .
# ============================================================================

# ---------- Stage 1: Install dependencies ----------
FROM node:20-alpine AS deps

WORKDIR /app

# Install build tools required for Prisma (native engine)
RUN apk add --no-cache libc6-compat

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install all workspace dependencies
RUN npm ci

# ---------- Stage 2: Build ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build shared workspace (backend imports shared/dist)
RUN npm run build --workspace=shared

# Generate Prisma client
RUN cd backend && node scripts/prisma-provider.cjs generate

# Build backend TypeScript
RUN cd backend && npm run build

# ---------- Stage 3: Production ----------
FROM node:20-alpine AS production

WORKDIR /app

# Install build tools for Prisma native engine at runtime
RUN apk add --no-cache libc6-compat

# Copy node_modules and built artifacts from build stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shared/ ./shared/
COPY --from=build /app/backend/ ./backend/

# Create uploads directory for file storage
RUN mkdir -p /app/uploads && adduser -S appuser && chown -R appuser:appuser /app
USER appuser

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3001)+'/health/live',r=>{process.exit(r.statusCode<400?0:1)}).on('error',()=>process.exit(1))"

# Start the backend: run migrations, then start the server
CMD ["sh", "-c", "cd backend && node scripts/prisma-provider.cjs migrate deploy && node scripts/with-backend-env.cjs node dist/index.js"]
