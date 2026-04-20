# Project: immich-tag-browser

Companion web app for [Immich](https://immich.app/) — browse, search, multi-select tags; filter assets by the selection.

Full architecture context lives in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Read it before suggesting structural changes.

## Status

Phase 0 scaffolding — workspace, CI, Docker stub, LICENSE. The working app does not exist yet; do not assume `web/` or `server/` are populated until the plan's Phase 1 lands.

## Stack (target shape)

- Monorepo: **pnpm workspaces** (`web/`, `server/`, `shared/`).
- Frontend: React + Vite + TS + TanStack Query + Tailwind + Zustand.
- Backend: Fastify + TS (thin reverse proxy to Immich; no business logic).
- Tests: Vitest, React Testing Library, Playwright (e2e).
- Container: multi-stage Docker on `node:24-alpine`, multi-arch (amd64 + arm64).

## Commands (once scaffolded)

```bash
pnpm install                  # install everything
pnpm dev                      # run web + server concurrently
pnpm --filter web dev         # SPA only
pnpm --filter server dev      # proxy only
pnpm lint                     # ESLint across workspace
pnpm typecheck                # tsc --noEmit
pnpm test                     # Vitest unit + component
pnpm test:e2e                 # Playwright against dockerised Immich
pnpm build                    # production builds of both packages
pnpm --filter web run gen:api # regenerate typed Immich client
```

## Conventions

- **TypeScript strict everywhere.** No implicit `any`; no `as any` except at FFI boundaries with a one-line comment explaining why.
- **SPDX header** on every source file: `// SPDX-License-Identifier: AGPL-3.0-or-later`.
- **Types first.** The Immich client is generated — never hand-type a response shape. If a type is missing, regen before working around it.
- **Proxy stays thin.** `server/` routes either forward to Immich, set/clear the session cookie, or emit `/healthz` + `/readyz`. No tag aggregation, no filtering — the SPA owns UX logic.
- **Server state** via TanStack Query. No `useEffect` + `fetch`.
- **Client state** via Zustand. Keep stores small and feature-local.
- **URL is the source of truth** for tag selection (`?tags=<id>,<id>`). AND-only, no `mode` param. Read/write via `useSearchParams`; don't duplicate into a store.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). One concern per PR.
- **Secrets** never in the repo. Required env vars are listed in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §8.

## Architectural guardrails

- Track Immich **upstream `main`** (not a pinned release). A weekly CI job (`openapi-sync.yml`) regenerates the typed client from `immich-app/immich@main`.
- **AND-only tag matching.** Selecting a parent tag implicitly covers all descendants (server-side closure expansion — plan §6). No OR mode in v1.
- **Single user per deployment.** Do not add code paths for multiplexing concurrent Immich accounts — users wanting that spin up another container.
- **Stateless sessions.** The Immich bearer token rides inside the signed cookie payload; no Redis/in-memory session store.
- **AGPL-3.0-or-later.** Derivative works stay open.

## Before opening a PR

- `pnpm lint && pnpm typecheck && pnpm test` all green.
- Docker build succeeds locally if you touched `docker/`, `server/`, or any production dep.
- No snapshot updates without a paired assertion change.
- New env vars documented in both the plan and the README.
- PR title uses Conventional Commit style.
