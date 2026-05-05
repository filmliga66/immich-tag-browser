# SPDX-License-Identifier: AGPL-3.0-or-later
# syntax=docker/dockerfile:1.7

# ── Stage 1: Install all deps and build everything ──────────────────────────
FROM node:25-alpine AS builder

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy manifests first for layer-cached installs
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/

RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY shared/ ./shared/
COPY server/ ./server/
COPY web/ ./web/

# Build arg for drift detection (set by CI: --build-arg IMMICH_SPEC_SHA=<sha>)
ARG IMMICH_SPEC_SHA=dev
ENV IMMICH_SPEC_SHA=${IMMICH_SPEC_SHA}

# Build shared types, then server, then SPA
RUN pnpm --filter @immich-tag-browser/shared build
RUN pnpm --filter @immich-tag-browser/server build
RUN pnpm --filter @immich-tag-browser/web build

# ── Stage 2: Production runtime ──────────────────────────────────────────────
FROM node:25-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Only production manifests for pruned install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled server
COPY --from=builder /app/server/dist ./server/dist

# Copy SPA bundle into a path the server knows to serve statically
COPY --from=builder /app/web/dist ./web/dist

# Copy shared dist (types only — no runtime JS, but keeps workspace resolution happy)
COPY --from=builder /app/shared/dist ./shared/dist

ARG IMMICH_SPEC_SHA=dev
ENV IMMICH_SPEC_SHA=${IMMICH_SPEC_SHA} \
    PORT=8080 \
    NODE_ENV=production

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1

CMD ["node", "server/dist/index.js"]
