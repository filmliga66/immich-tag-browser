# Implementation Plan — immich-tag-browser

> Living design doc. Each section lists **Options → Comparison → Recommendation**. Where the recommendation is obvious we call it; where it isn't, we flag it as an open question at the end.

---

## 1. Product scope (recap)

A small web app that connects to an existing Immich server and lets a logged-in user:

1. See **all tags** (flat list + tree by `parentId`).
2. **Search** tags incrementally by name.
3. **Multi-select** tags and view only the assets that satisfy the selection.
4. Toggle match mode: **AND (intersection)** (default) vs **OR (union)**.
5. Click an asset → open a lightbox preview (thumbnail first, original on demand).
6. Log in with **Immich email + password** (no separate user store).
7. **Selection state persisted in the URL** (`?tags=a,b&mode=and`) so views are shareable/bookmarkable.
8. Deploy as a **single Docker image** parameterised by `IMMICH_URL`.

Target Immich version: **2.7.5** (latest stable at time of writing). The generated typed client is pinned to this version's OpenAPI spec; weekly CI regen keeps us in sync with upstream.

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

**Recommendation: B1 (Fastify + TS).** Enables sharing `types/immich.ts` with the frontend (generated from Immich's OpenAPI spec) and keeps the mental model in one language. Final image can still be ~80 MB on `node:22-alpine`.

---

## 5. Authentication

Immich exposes `POST /api/auth/login` returning `{ accessToken, userId, ... }`. Subsequent calls use `Authorization: Bearer <accessToken>` *or* the `immich_access_token` cookie.

### Options

- **A1 — Token in localStorage (client-side).** Rejected: XSS-exposed.
- **A2 — Token in httpOnly cookie issued by our proxy.** Login form posts to `/auth/login` on the proxy, which forwards to Immich, extracts the token, and sets a `Set-Cookie: session=<signed>; HttpOnly; Secure; SameSite=Strict`. The proxy then injects `Authorization` on outbound Immich calls. **Recommended.**
- **A3 — User-supplied API key** (created in Immich → Account Settings → API Keys). Simple, but adds manual setup and most users don't know this flow. Offer as a secondary option under "Advanced login" — nice for read-only kiosk deploys.
- **A4 — OAuth / OIDC passthrough.** Immich supports OIDC. If the user's Immich is OIDC-backed, we'd redirect through the same IdP. Deferred to v2 — adds config surface (client id/secret, redirect URIs) that most self-hosters won't need.

### Session lifecycle

- Cookie TTL: 7 days, rolling. Refresh on every authenticated request.
- Logout: proxy clears cookie + (optionally) calls Immich `POST /api/auth/logout`.
- 401 from Immich → proxy clears cookie, client redirects to `/login`.

### Recommendation

Ship **A2 as the primary path**, with **A3 (API key)** hidden behind an "Advanced" toggle. Leave A4 as a clearly documented follow-up.

---

## 6. Immich API surface we need

Based on the OpenAPI spec (cross-check at `https://<immich>/api/docs`):

| Endpoint                                      | Purpose                                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `POST /api/auth/login`                        | exchange email+password for access token                                               |
| `POST /api/auth/logout`                       | server-side invalidation                                                               |
| `GET  /api/users/me`                          | confirm session + show avatar/name                                                     |
| `GET  /api/tags`                              | full tag list (includes `id`, `name`, `value`, `parentId`, `color`)                    |
| `POST /api/search/metadata`                   | primary asset query; accepts `tagIds: string[]` (AND semantics on server) + pagination |
| `GET  /api/assets/:id/thumbnail?size=preview` | thumbnail stream                                                                       |
| `GET  /api/assets/:id/original`               | full-res download (lazy)                                                               |

**AND vs OR tag logic.** `POST /api/search/metadata` applies AND across `tagIds`. For **OR** mode we either:
- O1: issue N parallel requests (one per tag) and union the results client-side. Simple, works today.
- O2: use `POST /api/search/smart` with a composed query. More flexible but heavier.
- O3: ask upstream to add a `tagMatch: "any"` flag. Out of scope for v1.

**Recommend O1** for v1 with a cap (e.g. only allow OR across ≤10 tags to bound request fan-out).

### Typed client

Generate a TypeScript client from the upstream OpenAPI spec at build time (`openapi-typescript` → types only, plus a tiny fetch wrapper). Avoids hand-written drift.

---

## 7. UX sketch

- **Left rail** (resizable): tag tree with search box at top. Click a tag = toggle select. Shift-click a parent = select all descendants. Selected tags appear as removable **chips** above the result grid.
- **Center**: virtualised asset grid (e.g. `react-virtuoso` + CSS grid). Infinite scroll via TanStack Query's `useInfiniteQuery`.
- **Top bar**: AND/OR toggle, sort (date desc default), user menu (logout).
- **Lightbox**: PhotoSwipe; arrow-key navigation; "Open in Immich" deep link.
- **Empty states**: "No tags yet — create some in Immich" with a link.
- **Accessibility**: keyboard-navigable tag tree, focus-visible styling, `aria-selected` on chips.

---

## 8. Docker deployment

### Options

- **D1 — Single image, multi-stage build** (recommended)
  1. `node:22-alpine` stage A → `pnpm build` produces `web/dist`.
  2. `node:22-alpine` stage B → installs only runtime deps for the proxy, copies `web/dist` to be served as static.
  3. Final image runs Fastify on `:8080`, serving `/` statically and proxying `/api/*`.
  - Final size target: **< 120 MB**.
- **D2 — Two images** (web + proxy behind Nginx). More flexible, adds compose complexity. Not worth it for v1.

### Runtime config (12-factor)

| Env var                  | Default      | Meaning                                                             |
| ------------------------ | ------------ | ------------------------------------------------------------------- |
| `IMMICH_URL`             | *(required)* | Base URL of the Immich instance (e.g. `https://immich.example.com`) |
| `PORT`                   | `8080`       | Port to listen on                                                   |
| `SESSION_SECRET`         | *(required)* | HMAC key for signing the session cookie                             |
| `COOKIE_SECURE`          | `true`       | Set to `false` for `http://` local dev                              |
| `TAGS_CACHE_TTL_SECONDS` | `60`         | In-memory cache for `/api/tags`                                     |
| `LOG_LEVEL`              | `info`       | Fastify log level                                                   |

### Healthcheck

`GET /healthz` → `200 OK` when process is up **and** reachable-check of `IMMICH_URL/api/server/ping` succeeded within the last 30 s.

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

**Phase 1 — Walking skeleton**
- Proxy: `/auth/login`, cookie session, generic `/api/*` passthrough.
- SPA: login page + "hello $user" post-login screen.
- Docker image published from CI.

**Phase 2 — Tag browser**
- `GET /api/tags` viewer with tree + search.
- Selection state + chip bar.
- Result grid with thumbnails (AND mode).

**Phase 3 — Polish**
- OR mode toggle (fan-out + union).
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
- **Contract**: regenerate Immich types from upstream OpenAPI on a weekly schedule; PR opens automatically if the types shift.

---

## 12. Resolved decisions

All five open questions have been decided — recorded here for traceability.

1. **Immich version.** Target **v2.7.5** (latest stable). Pin the generated OpenAPI client to this version; weekly regen PR (see §11) surfaces upstream drift.
2. **OR-mode ceiling.** Ship OR mode in v1 with a **hard cap of 10 tags** in the fan-out path. UI disables adding an 11th tag while OR is active with an inline hint.
3. **License.** **AGPL-3.0-or-later.** Matches upstream Immich, keeps derivative works open. A `LICENSE` file is added as part of Phase 0 scaffolding; every source file gets a short SPDX header (`// SPDX-License-Identifier: AGPL-3.0-or-later`).
4. **Multi-user support.** **Single user per deployment.** No concurrent-account multiplexing. Session store can be a single in-memory slot; no need for Redis/Postgres in v1.
5. **URL-persisted selection.** **Yes** — `?tags=<id>,<id>&mode=and|or`. Implemented from Phase 2 onward so it's wired in from the first working build, not retrofitted.

---

## 13. Recommendation summary

| Area         | Choice                                                  |
| ------------ | ------------------------------------------------------- |
| Architecture | SPA + thin Fastify proxy (2B)                           |
| Frontend     | React + Vite + TS + TanStack Query + Tailwind + Zustand |
| Backend      | Fastify + TS                                            |
| Auth         | httpOnly cookie session (A2), API-key fallback (A3)     |
| Tag AND      | server-side `tagIds` filter                             |
| Tag OR       | client-side fan-out + union (cap 10)                    |
| Packaging    | single multi-stage Docker image, multi-arch             |
| Monorepo     | pnpm workspaces                                         |
| CI           | GitHub Actions → GHCR                                   |
