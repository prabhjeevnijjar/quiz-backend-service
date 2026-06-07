# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage Dockerfile for quiz-backend monorepo
#
# Stage 1 — Install ALL workspace dependencies (pnpm)
# Stage 2 — Copy source and run the api-gateway via tsx (dev mode)
#
# Why tsx instead of tsc+node?
#   In dev we want hot-reload and fast startup without a build step.
#   In production you would add a "build" stage: tsc then copy dist/.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root files first (layer cache)
COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Copy only package.json from every workspace member (fast dep resolution)
COPY packages/config/package.json  packages/config/
COPY packages/logger/package.json  packages/logger/
COPY apps/api-gateway/package.json apps/api-gateway/

# Install all workspace deps
RUN pnpm install --frozen-lockfile || pnpm install

# ── Stage 2: dev runner ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy everything from deps stage (node_modules already installed)
COPY --from=deps /app ./

# Copy all source code
COPY packages/ packages/
COPY apps/     apps/

# The api-gateway listens on this port
EXPOSE 3000

# Health check so Docker knows when the container is actually ready
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Start the api-gateway in dev mode (tsx = TypeScript execution without build)
CMD ["pnpm", "--filter", "api-gateway", "dev"]
