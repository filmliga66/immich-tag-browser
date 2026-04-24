# Project: immich-tag-browser

Companion web app for Immich — browse, search, multi-select tags; filter assets by the selection.

Architecture lives in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Read it before structural changes.

## Stack

- Monorepo: pnpm workspaces (`web/`, `server/`, `shared/`)
- Frontend: React + Vite + TS + TanStack Query + Tailwind + Zustand
- Backend: Fastify + TS (thin reverse proxy to Immich; no business logic)
- Tests: Vitest + React Testing Library

## Conventions

- TypeScript strict. No `as any` except at FFI boundaries with a one-line comment.
- SPDX header on every source file: `// SPDX-License-Identifier: AGPL-3.0-or-later`
- Immich client is generated — never hand-type a response shape. Regen if missing.
- Proxy stays thin. SPA owns UX logic.
- Server state via TanStack Query. Client state via Zustand.
- URL is the source of truth for tag selection (`?tags=<id>,<id>`). AND-only.
- Conventional Commits. One concern per PR.

## Issue implementation workflow

When implementing an issue:

1. `git checkout main && git pull` to get latest main.
2. Create a branch (`feat/<slug>`, `fix/<slug>`, etc.).
3. Commit step by step as work progresses — small, focused commits using Conventional Commits.
4. Push the branch and open a PR referencing the issue.

## Before opening a PR

- `pnpm lint && pnpm typecheck && pnpm test` green.
- Docker build succeeds locally if you touched `docker/`, `server/`, or prod deps.
- New env vars documented in the plan and README.
- PR title uses Conventional Commit style.
