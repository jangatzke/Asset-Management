# ============================================================================
# Asset Management ISMS – Frontend Dockerfile
# Multi-stage build: deps → build → production (nginx)
# ============================================================================

# ---------- Stage 1: Install dependencies ----------
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/

RUN npm ci --workspace=shared --workspace=frontend

# ---------- Stage 2: Build ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# Build shared workspace (frontend imports shared/src via vite alias)
RUN npm run build --workspace=shared

# Build frontend (tsc + vite build)
RUN cd frontend && npm run build

# ---------- Stage 3: Production (nginx) ----------
FROM nginx:1.27-alpine AS production

# Copy built assets
COPY --from=build /app/frontend/dist /usr/share/nginx/html

# Nginx config: SPA fallback + API proxy
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
