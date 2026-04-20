# Implementation Plan — immich-tag-browser

> Living design doc. Each section lists **Options → Comparison → Recommendation**. Where the recommendation is obvious we call it; where it isn't, we flag it as an open question at the end.

---

## 1. Product scope (recap)

A small web app that connects to an existing Immich server and lets a logged-in user:

1. See **all tags** (flat list + tree by `parentId`).
2. **Search** tags incrementally by name.
3. **Multi-select** tags and view only the assets that satisfy the selection (**AND / intersection**; selecting a parent tag implicitly includes all descendants — see §6).
4. Click an asset → open a lightbox preview (thumbnail first, original on demand).
5. Log in with **Immich email + password** (no separate user store).
6. **Selection state persisted in the URL** (`?tags=a,b`) so views are shareable/bookmarkable.
7. Deploy as a **single Docker image** parameterised by `IMMICH_URL`.

Target Immich version: **upstream `main`** (rolling). The generated typed client is regenerated weekly from `https://raw.githubusercontent.com/immich-app/immich/main/open-api/immich-openapi-specs.json`; a regen PR opens automatically when the spec drifts. No hard version pin — we track `main` and absorb breaking changes as they surface. Users running older Immich releases may encounter mismatches; the README calls out that the tag browser tracks current Immich `main`.

Deployment assumption: **single user per deployment**. We do not multiplex multiple concurrent Immich accounts through one instance — users wanting that spin up another container.

Explicit non-goals for v1: editing tags/assets, replacing Immich's main UI, mobile-native shell, multi-account support.

---

## 2. Architecture — where does the code run?

Three realistic shapes.

### Option 2A — Pure SPA, browser calls Immich directly

```
browser ──(HTTPS)──▶ Immich API
```

- **Pros:** simplest; zero app-side state; one static bundle in Nginx.
- **Cons:**
  - Requires Immich to send permissive **CORS** headers for our origin. Immich's API supports this via `IMMICH_API_METRICS_PORT`/reverse-proxy config, but it's an extra setup burden on the user.
  - The access token lives in `localStorage` → exposed to any XSS on our origin.
  - The user must reach Immich directly from their browser; doesn't work if Immich is on a private network and the tag browser is public.

### Option 2B — SPA + thin reverse-proxy backend (recommended)

```
browser ──▶ tag-browser backend ──▶ Immich API
```

- Backend responsibilities are narrow: terminate the session cookie, forward `/api/*` to Immich with the stored bearer token, serve the static SPA.
- **Pros:**
  - Immich needs **no CORS** changes — same origin for the browser.
  - Token lives in an **httpOnly, SameSite=Strict cookie** → not reachable from JS, big XSS win.
  - Immich can stay on a private network; only the tag browser is exposed.
  - Natural place to add a small **response cache** for `/api/tags` (rarely changes).
- **Cons:** one more moving part; we must keep the proxy thin so it doesn't become a second API.

### Option 2C — SSR framework (Next.js / SvelteKit / Remix)

```
browser ──▶ SSR server (routes + API) ──▶ Immich API
```

- **Pros:** single process, server-side fetching, good DX, API routes co-located.
- **Cons:** bigger runtime image; SSR is largely wasted here because the UI is authenticated and interactive; couples framework upgrade cadence to the app.

### Recommendation

**Option 2B.** It gives us cookie-based auth and CORS-free operation at the cost of ~150 lines of proxy code. 2C would be defensible but is over-engineered for a tag filter view. 2A only makes sense for a desktop-only, single-user install — we want the Docker image to be deployable behind Traefik/Caddy alongside Immich.

---

## 3. Frontend stack

Assuming Option 2B, the SPA is a standalone bundle.

| Dimension                                           | Option F1: **React + Vite + TS**                              | Option F2: **SvelteKit (SPA mode)** | Option F3: **Vue 3 + Vite + TS** |
| --------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------- | -------------------------------- |
| Ecosystem size                                      | huge                                                          | medium                              | large                            |
| Bundle size (typical)                               | ~50–80 KB gz                                                  | ~15–30 KB gz                        | ~40–60 KB gz                     |
| Learning curve for contributors                     | low                                                           | low–medium                          | low                              |
| Component libs (tag chips, virtual lists, lightbox) | best-in-class (Radix, TanStack, PhotoSwipe bindings)          | growing                             | good                             |
| State mgmt for tag selection                        | Zustand or URL state                                          | stores (built-in)                   | Pinia                            |
| Data fetching                                       | **TanStack Query** (caching, retries, stale-while-revalidate) | TanStack Query (svelte) or custom   | TanStack Query (vue)             |

**Recommendation: F1 (React + Vite + TS)** + **TanStack Query** + **Tailwind** + **Zustand** (tiny) for selection state + **react-photoswipe-gallery** for the lightbox. Rationale: richest library ecosystem for the specific widgets we need (virtualised tag tree, chip input, image gallery) and the lowest onboarding cost for outside contributors. Bundle size is not a bottleneck for an authenticated tool.

If we later discover we want SSR for public share links, we can migrate the same React code to Next.js with moderate effort.

---

## 4. Backend / proxy stack

| Option                                           | Pros                                                                        | Cons                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **B1: Node + Fastify (TS)**                      | same language as frontend; shared types via a `shared/` package; fast; tiny | Node image adds ~40 MB to the final container                           |
| B2: Go (chi/echo)                                | smallest runtime (~10 MB image), great concurrency                          | separate language, duplicated request/response types                    |
| B3: Python FastAPI                               | easy, familiar                                                              | heaviest runtime; async story is fine but not a fit for a trivial proxy |
| B4: Caddy / Nginx with only reverse-proxy config | zero code                                                                   | can't hold session state or rewrite auth headers cleanly                |

**Recommendation: B1 (Fastify + TS).** Enables sharing `types/immich.ts` with the frontend (generated from Immich's OpenAPI spec) and keeps the mental model in one language. Final image can still be ~80 MB on `node:24-alpine`.

---

## 5. Authentication

Immich exposes `POST /api/auth/login` returning `{ accessToken, userId, ... }`. Subsequent calls use `Authorization: Bearer <accessToken>` *or* the `immich_access_token` cookie.

### Options

- **A1 — Token in localStorage (client-side).** Rejected: XSS-exposed.
- **A2 — Token in httpOnly cookie issued by our proxy.** Login form posts to `/auth/login` on the proxy, which forwards to Immich, reads `accessToken` from the JSON response body, and issues a `Set-Cookie: session=<signed>; HttpOnly; Secure; SameSite=Lax`. Immich itself sets three cookies on the login response (`immich_access_token` httpOnly, plus `immich_auth_type` and `immich_is_authenticated` non-httpOnly); the proxy **strips all `Set-Cookie` headers from Immich's response** before returning to the browser, so only our own signed cookie reaches the client. The proxy then injects `Authorization: Bearer` on outbound Immich calls. **Recommended.**
- **A4 — OAuth / OIDC passthrough.** Immich supports OIDC. If the user's Immich is OIDC-backed, we'd redirect through the same IdP. Deferred to v2 — adds config surface (client id/secret, redirect URIs) that most self-hosters won't need.

### Session lifecycle

- Cookie TTL: **7 days** (`Max-Age=604800`). Rationale: Immich v2.7.5 sets its own `immich_access_token` cookie with `Max-Age` of 400 days regardless of real session state (session expiry is tracked server-side), so mirroring that value is meaningless. A fixed local TTL keeps the cookie's lifetime bounded; the authoritative expiry signal remains a 401 from Immich, not the local clock.
- Logout: proxy clears cookie + calls Immich `POST /api/auth/logout` so the underlying Immich session is invalidated too.
- 401 from Immich → proxy clears cookie, client redirects to `/login`. This is the authoritative expiry signal; we do not pre-emptively expire based on our cookie's local clock.
- CSRF: `SameSite=Lax` defends passive requests but does **not** cover top-level `POST`/`PUT`/`DELETE` to `/api/*`. The proxy rejects any mutating request whose `Origin` header does not match the server's own origin (or is absent). Login itself is also gated by the same `Origin` check, since the cookie-to-be-set does not yet exist at request time. `SameSite=Lax` is chosen over `Strict` so shareable URLs (§1.7) and links from email/chat land logged-in.

### Recommendation

Ship **A2 as the only v1 path.** Leave A4 (OIDC) as a clearly documented follow-up. A3 (user-supplied API key) was considered and cut: Immich API keys don't expire and don't have a logout semantics, which would require a second auth code path the v1 scope does not justify.

---

## 6. Immich API surface we need

Based on the OpenAPI spec from Immich `main` (cross-check at `https://<immich>/api/docs`; authoritative source is `https://raw.githubusercontent.com/immich-app/immich/main/open-api/immich-openapi-specs.json`):

| Endpoint                                      | Purpose                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `POST /api/auth/login`                        | exchange email+password for access token                                                               |
| `POST /api/auth/logout`                       | server-side invalidation                                                                               |
| `GET  /api/users/me`                          | confirm session + show avatar/name                                                                     |
| `GET  /api/tags`                              | full tag list (includes `id`, `name`, `value`, `parentId`, `color`)                                    |
| `POST /api/search/metadata`                   | primary asset query; accepts `tagIds: string[]` (AND-of-descendants semantics, see below) + pagination |
| `GET  /api/assets/:id/thumbnail?size=preview` | thumbnail stream                                                                                       |
| `GET  /api/assets/:id/original`               | full-res download (lazy)                                                                               |

**Tag match semantics.** `POST /api/search/metadata` applies AND across `tagIds`, and each ID is expanded through `tag_closure` so a parent matches any of its descendants. Concretely: selecting `["Animals"]` returns assets tagged `Animals`, `Animals/Dog`, `Animals/Cat`, etc.; selecting `["Animals", "2024"]` returns assets that carry *some* descendant of `Animals` **and** *some* descendant of `2024`. Only AND is supported in v1 — OR mode was cut because client-side union of N paginated, date-sorted streams produces globally-wrong ordering, and the complexity isn't worth it for this release.

**Shift-click on a parent tag (UX interaction with descendant expansion).** Three options:
- T1: Shift-click adds each descendant as an individual chip (AND across siblings = intersection). Restrictive and rarely what the user wants.
- T2: Shift-click is a no-op because selecting the parent already implicitly covers all descendants via server-side closure expansion.
- T3: Shift-click swaps the parent chip for all descendants wrapped in a single "any of these" group. Requires client-side grouping + is a disguised OR — same complexity cost we just rejected.

**Recommend T2** for v1: the parent chip is the canonical way to say "anything under this branch." Shift-click is reserved for a future UX iteration once the AND-of-descendants behaviour is validated in practice.

### Typed client

Generate a TypeScript client from the upstream OpenAPI spec at build time (`openapi-typescript` → types only, plus a tiny fetch wrapper). Avoids hand-written drift.

---

## 7. UX sketch

- **Left rail** (resizable): tag tree with search box at top. Click a tag = toggle select. Selecting a parent implicitly covers all descendants (server-side closure expansion — see §6). Selected tags appear as removable **chips** above the result grid.
- **Center**: virtualised asset grid (e.g. `react-virtuoso` + CSS grid). Infinite scroll via TanStack Query's `useInfiniteQuery`.
- **Top bar**: sort (date desc default), user menu (logout). No AND/OR toggle — v1 is AND-only (§6).
- **Lightbox**: PhotoSwipe; arrow-key navigation; "Open in Immich" deep link.
- **Empty states**: "No tags yet — create some in Immich" with a link.
- **Accessibility**: keyboard-navigable tag tree, focus-visible styling, `aria-selected` on chips.

### Thumbnail traffic

The asset grid issues many concurrent `GET /api/assets/:id/thumbnail` requests. To keep the Fastify event loop and memory under control:

- The proxy uses **streaming pass-through** (`reply.from()` / `pipeline`) for `/api/assets/*/thumbnail` and `/api/assets/*/original` — response bodies are piped, never buffered.
- Upstream response headers `Content-Type`, `Content-Length`, `ETag`, and `Cache-Control` are forwarded verbatim so the browser can cache thumbnails; Immich already emits long-lived `Cache-Control` for immutable asset bytes.
- No proxy-side thumbnail cache in v1. The browser HTTP cache plus the TanStack Query key cache are enough for typical library sizes; revisit if we see measured pressure.

---

## 8. Docker deployment

### Options

- **D1 — Single image, multi-stage build** (recommended)
  1. `node:24-alpine` stage A → `pnpm build` produces `web/dist`.
  2. `node:24-alpine` stage B → installs only runtime deps for the proxy, copies `web/dist` to be served as static.
  3. Final image runs Fastify on `:8080`, serving `/` statically and proxying `/api/*`.
  - Final size target: **< 120 MB**.
- **D2 — Two images** (web + proxy behind Nginx). More flexible, adds compose complexity. Not worth it for v1.

### Runtime config (12-factor)

| Env var                  | Default      | Meaning                                                                                                                                                  |
| ------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IMMICH_URL`             | *(required)* | Base URL of the Immich instance (e.g. `https://immich.example.com`)                                                                                      |
| `PORT`                   | `8080`       | Port to listen on                                                                                                                                        |
| `SESSION_SECRET`         | *(required)* | HMAC key for signing the session cookie                                                                                                                  |
| `COOKIE_SECURE`          | `true`       | Set to `false` for `http://` local dev                                                                                                                   |
| `TAGS_CACHE_TTL_SECONDS` | `60`         | In-memory cache for `/api/tags`                                                                                                                          |
| `LOG_LEVEL`              | `info`       | Fastify log level                                                                                                                                        |
| `ALLOW_PRIVATE_IMMICH`   | `false`      | When `false`, refuse startup if `IMMICH_URL` resolves to loopback, link-local, or RFC1918 addresses. Flip to `true` for LAN / docker-network deployments. |

### Proxy hardening (SSRF)

- Resolve `IMMICH_URL` **once at startup** and cache the origin. Every outbound proxy call targets that cached origin verbatim — never a host derived from the incoming request.
- Normalise the incoming path (`URL` constructor, reject `..` segments post-normalisation) and require it to match `^/api/` before forwarding.
- Refuse loopback / link-local / RFC1918 destinations unless `ALLOW_PRIVATE_IMMICH=true`. Re-check on DNS rebind by pinning the resolved IP for the request's lifetime.

### Healthcheck

Two separate endpoints so transient Immich outages don't trigger container restarts:

- `GET /healthz` — **liveness only.** Always returns `200 OK` while the Fastify event loop is responsive. No outbound calls. This is the endpoint orchestrators (Docker, K8s, Traefik) use to decide whether to restart the container.
- `GET /readyz` — **readiness.** `200 OK` when a cached probe of `IMMICH_URL/api/server/ping` (refreshed every 30 s in the background) most recently succeeded; `503` otherwise. Load balancers use this to pull traffic without killing the pod.

### CI / publishing

- GitHub Actions: on push to `main`, build & push `ghcr.io/filmliga66/immich-tag-browser:{sha,latest}`.
- On tagged releases (`v*`), also push `:vX.Y.Z`.
- Multi-arch via `docker/build-push-action` with `linux/amd64,linux/arm64` (arm64 matters for Raspberry Pi / Synology users, which is a big chunk of the Immich audience).

---

## 9. Project layout (proposed)

```
immich-tag-browser/
├── web/                 # React SPA
│   ├── src/
│   │   ├── api/         # typed Immich client (generated)
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── tags/
│   │   │   └── gallery/
│   │   ├── components/  # shared UI
│   │   ├── routes/      # /login, /browse
│   │   └── main.tsx
│   └── vite.config.ts
├── server/              # Fastify proxy
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   └── proxy.ts
│   │   ├── session.ts
│   │   └── index.ts
│   └── tsconfig.json
├── shared/              # types shared across web + server
├── docker/
│   └── Dockerfile
├── .github/workflows/
│   └── release.yml
├── pnpm-workspace.yaml
└── package.json
```

Monorepo via **pnpm workspaces** (recommendation P1). Alternatives: Turborepo (P2 — overkill for two packages), Nx (P3 — overkill). Pnpm workspaces alone are enough at this size.

---

## 10. Phased delivery

**Phase 0 — Scaffolding (this PR adjacent)**
- Workspace, TS configs, lint/format (ESLint + Prettier), pre-commit (husky + lint-staged).
- `LICENSE` file (AGPL-3.0) + SPDX headers enforced via a lint rule.
- Dockerfile stub that just runs "hello world" Fastify.
- `.env.example` at repo root listing every env var from §8 (`IMMICH_URL`, `SESSION_SECRET`, `ALLOW_PRIVATE_IMMICH`, …) with placeholder values. Referenced by README's bootstrap step; contributors `cp .env.example .env` and fill in.

**Phase 1 — Walking skeleton**
- Proxy: `/auth/login`, cookie session, generic `/api/*` passthrough.
- SPA: login page + "hello $user" post-login screen.
- Docker image published from CI.

**Phase 2 — Tag browser**
- `GET /api/tags` viewer with tree + search.
- Selection state + chip bar.
- Result grid with thumbnails (AND match — the only mode in v1).

**Phase 3 — Polish**
- Lightbox + "Open in Immich" link.
- Infinite scroll + virtualisation.
- Dark mode.
- Basic e2e test (Playwright) against a test Immich container.

**Phase 4 — Nice-to-haves (post-v1)**
- OIDC passthrough.
- Shareable read-only links (requires server-side token delegation).
- Saved filter presets.
- Tag co-occurrence suggestions ("people who picked X also filter by Y").

---

## 11. Testing

- **Unit**: Vitest in both `web/` and `server/`.
- **Component**: React Testing Library for the tag tree and chip bar.
- **Integration**: Playwright smoke test against a disposable Immich via `docker compose` in CI (gated behind a `e2e` workflow to keep PR CI fast).
- **Contract**: regenerate Immich types from upstream `main`'s OpenAPI on a weekly schedule; PR opens automatically if the types shift.

---

## 12. CI/CD pipelines

Three GitHub Actions workflows, landed in Phase 0 as dormant shells (gated by `hashFiles(...)` so they no-op until the code exists) and progressively activated as each package appears.

### 12.1 `ci.yml` — per-PR quality gate

- **Triggers:** `pull_request`, `push: main`.
- **Jobs:**
  - `detect` — sets `has_pkg` output based on whether `package.json` exists (lets us land the workflow now, real checks activate once Phase 1 scaffolds the workspace).
  - `build` (depends on detect) — pnpm install with frozen lockfile → `lint` → `typecheck` → `test` → `build`. Single matrix on `node:24`.
- **Caching:** `actions/setup-node` with `cache: pnpm`.
- **Permissions:** `contents: read` only.
- **Required check** for branch protection on `main` once active.

### 12.2 `release.yml` — container publishing

- **Triggers:** `push: main` → `:main` + `:sha-<short>`; tags `v*` → `:vX.Y.Z`, `:vX.Y`, `:latest`.
- **Build:** `docker/build-push-action` with `linux/amd64,linux/arm64` (arm64 matters for Raspberry Pi / Synology hosts).
- **Registry:** GHCR, `ghcr.io/filmliga66/immich-tag-browser`.
- **Auth:** `GITHUB_TOKEN` with `packages: write`.
- **Cache:** `type=gha,mode=max` across runs.
- **Gate:** `hashFiles('docker/Dockerfile') != ''` so it stays idle until the Dockerfile lands.

### 12.3 `openapi-sync.yml` — upstream type drift guard

- **Triggers:** weekly cron (Mon 06:00 UTC) + `workflow_dispatch`.
- **Source:** `https://raw.githubusercontent.com/immich-app/immich/main/open-api/immich-openapi-specs.json` — we track Immich `main` rather than a pinned release tag.
- **Action:** regenerate the typed Immich client (`pnpm --filter web run gen:api`). If the working tree is dirty afterwards, open a PR with `peter-evans/create-pull-request`.
- **Rationale:** keeps us honest about upstream breaking changes without forcing weekly manual work. Chasing `main` means types change more often than they would against a tagged release, but the plan's goal is to stay current with Immich, not to support a fleet of legacy versions.

### 12.4 Supporting config

- **`dependabot.yml`** — weekly updates for `npm`, `github-actions`, `docker`; limit 5 open PRs on npm to keep noise low.
- **Branch protection** on `main` — expressed as a committed GitHub repository ruleset rather than clicked-in settings, so the rules are reviewable and reproducible.
  - `.github/rulesets/main.json` holds the ruleset definition (JSON schema per [GitHub's Rulesets API](https://docs.github.com/en/rest/repos/rules)).
  - A small workflow (`rulesets-apply.yml`, `workflow_dispatch` + on-push changes to that file) calls `POST/PUT /repos/{owner}/{repo}/rulesets` via `gh api` to sync the live ruleset to the committed spec. Requires a PAT / fine-grained token with `Administration: Write` stored as `RULESET_ADMIN_TOKEN` (the default `GITHUB_TOKEN` cannot manage rulesets).
  - Rules enforced: require `ci / build` to pass, require up-to-date branch, require signed commits (nice-to-have, not blocking), disallow force-push, disallow deletion of `main`.
- **CodeQL** (deferred, flagged as a TODO): auth-handling code path warrants it, but not while the repo is empty. Revisit at the end of Phase 1.

### 12.5 Secrets & environments

- `GITHUB_TOKEN` covers GHCR publishing — no extra secret needed for the release workflow.
- Any future deploy-to-prod workflow would use a **GitHub Environment** (`production`) with required reviewers, not raw repo secrets.

---

## 13. Claude Code configuration

Two small artefacts make this repo pleasant to work in with Claude Code (or other agentic tooling) without surprises.

### 13.1 `CLAUDE.md` at the root

A short, load-bearing file that Claude reads into every session. Contents:

- **Project summary** and pointer to this plan.
- **Stack + commands** (`pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`) so Claude uses the correct invocations.
- **Conventions:** TS strict, SPDX headers, types generated from OpenAPI, TanStack Query for server state, Zustand for client state, URL for tag selection.
- **Architectural guardrails:** proxy stays thin, single-user-per-deployment, AND-only tag matching, track Immich `main`.
- **PR checklist:** lint/typecheck/test green, Dockerfile builds if touched, env vars documented.

Keep it under ~100 lines — CLAUDE.md is context that ships on every turn, so bloat is expensive.

### 13.2 `.claude/settings.json` (committed, project-scoped)

Pre-approves read-only inspection commands and routine package operations so contributors aren't drowning in permission prompts:

- **Allow:** `pnpm *`, `git status/diff/log/show/branch/fetch`, `git add <path>` (specific, not wildcards to root), `git switch/stash/restore`, `gh pr/run/issue view|list|diff|checks`, `docker build`, `docker compose config`.
- **Deny** (explicit, belt-and-braces):
  - `git push --force*` — protected branches would catch it, but deny is cheaper than a push.
  - `git reset --hard*`, `git clean -f*` — destructive local ops.
  - `rm -rf *`, `docker system prune*`.
- **Per-user overrides** belong in `.claude/settings.local.json` (git-ignored).
- No hooks configured at the repo level in v1. If we later want auto-lint on save, we'll add a `PostToolUse` hook — but lint-staged already covers the commit path.

### 13.3 Why not more?

We deliberately skip:

- **Custom subagents** — nothing specialized enough to justify the maintenance burden yet.
- **Output styles / statuslines** — user preference, not project concern.
- **MCP servers** — no external integrations (issue tracker, logs) wired up yet.

These stay as open follow-ups once the app is running and actual workflow friction is visible.

---

## 14. Resolved decisions

All five open questions have been decided — recorded here for traceability.

1. **Immich version.** Track **upstream `main`**, not a pinned release. The generated OpenAPI client is regenerated weekly against `immich-app/immich@main`; the resulting PR (see §12.3) is how we absorb upstream changes. Users pinned to an older Immich release may encounter shape mismatches — documented as a known trade-off, not a supported configuration.
2. **Tag match semantics.** **AND-only in v1** (intersection). Each tag ID is server-side-expanded through `tag_closure`, so selecting a parent matches any descendant — see §6. OR mode was considered and cut: client-side union of N paginated, date-sorted streams produces globally-wrong ordering, and the complexity is not justified for v1. Revisit only if upstream Immich adds a native `tagMatch: "any"` flag.
3. **License.** **AGPL-3.0-or-later.** Matches upstream Immich, keeps derivative works open. A `LICENSE` file is added as part of Phase 0 scaffolding; every source file gets a short SPDX header (`// SPDX-License-Identifier: AGPL-3.0-or-later`).
4. **Multi-user support.** **Single user per deployment.** No concurrent-account multiplexing. Sessions are **stateless**: the Immich bearer token rides inside the signed cookie payload, so there is no server-side session store — no Redis, no Postgres, no in-memory slot that would log the user out on restart.
5. **URL-persisted selection.** **Yes** — `?tags=<id>,<id>`. No `mode` param (AND is the only mode — decision 2). Implemented from Phase 2 onward so it's wired in from the first working build, not retrofitted.

---

## 15. Recommendation summary

| Area              | Choice                                                                |
| ----------------- | --------------------------------------------------------------------- |
| Architecture      | SPA + thin Fastify proxy (2B)                                         |
| Frontend          | React + Vite + TS + TanStack Query + Tailwind + Zustand               |
| Backend           | Fastify + TS                                                          |
| Auth              | httpOnly cookie session (A2) only; OIDC deferred, API-key cut         |
| Tag matching      | AND only (server-side `tagIds` with closure expansion); no OR in v1   |
| Packaging         | single multi-stage Docker image, multi-arch                           |
| Monorepo          | pnpm workspaces                                                       |
| CI                | `ci.yml` (lint/type/test/build) + `release.yml` (multi-arch → GHCR)   |
| Type drift        | weekly `openapi-sync.yml` regenerates Immich client, opens PR on diff |
| Dep updates       | Dependabot (npm + actions + docker), weekly                           |
| Agent config      | `CLAUDE.md` + committed `.claude/settings.json` allowlist             |
