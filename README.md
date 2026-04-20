# immich-tag-browser

A companion web app for [Immich](https://immich.app/) that lets you **browse, search, and combine tags** to filter your photo library. Pick one or more tags and instantly see the assets that carry all of them.

> Status: **planning**. See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the proposed architecture, tech-stack options, and rollout steps.

## Goals

- **List all tags** from a connected Immich instance (flat + hierarchical view).
- **Search/filter tags** by name as you type.
- **Multi-select** tags and show only assets that match the selection (intersection by default, with a toggle for union).
- **Login with Immich credentials** — no separate user store.
- **Ship as a single Docker image** that points at any Immich server via env vars.

## Non-goals (for v1)

- Editing, creating, or deleting tags.
- Editing asset metadata.
- Replacing Immich's main UI — this is a focused, tag-first lens.

## Quick start (planned)

```bash
docker run -d \
  -p 8080:8080 \
  -e IMMICH_URL=https://immich.example.com \
  ghcr.io/filmliga66/immich-tag-browser:latest
```

Then open <http://localhost:8080> and log in with your Immich email + password.

## Development setup

The repo is in **Phase 0** (workspace + CI scaffolding). The commands below reflect what you'll need once Phase 1 lands a working `web/` and `server/`.

### Prerequisites

Versions match the CI pins in [.github/workflows/ci.yml](.github/workflows/ci.yml). Diverging locally causes lockfile churn.

| Tool    | Version    | Notes                                                                                                  |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| Node.js | 24.x (LTS) | Active LTS. Node 22 works but is in maintenance-only until March 2026.                                 |
| pnpm    | 10.x       | Install via Corepack (ships with Node) or winget.                                                      |
| Git     | 2.40+      | `winget install Git.Git`                                                                               |
| Podman  | 5.x        | *Optional* — only needed if you want to test the Docker image locally. Docker Desktop works too.       |

### Windows setup (step by step)

Run PowerShell as a regular user unless noted.

**1. Install Node 24, Git, and VS Code via winget:**

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install Microsoft.VisualStudioCode
```

Reopen PowerShell so `node`, `git`, and `code` land on `PATH`. Verify:

```powershell
node --version   # v24.x
git --version
```

**2. Enable pnpm 10 via Corepack** (ships with Node, no separate install):

```powershell
npm install --global corepack@latest    # Windows needs a recent Corepack, see pnpm docs
corepack enable pnpm
corepack prepare pnpm@10 --activate
pnpm --version   # 10.x
```

**3. (Optional) Install Podman Desktop** — only if you want to build and run the container image locally. Skip this step if you just want to run the dev server.

```powershell
winget install RedHat.Podman-Desktop
```

After first launch, Podman Desktop provisions the `podman-machine-default` VM inside WSL2. That VM exposes a Docker-compatible socket automatically.

Verify:

```powershell
podman --version       # 5.x
podman run hello-world
```

If you prefer Docker Desktop, that works too. You can alias `docker` → `podman` in your PowerShell profile (`notepad $PROFILE`) if you want pasted `docker …` commands to resolve to Podman:

```powershell
Set-Alias docker podman
```

**4. Clone and bootstrap:**

```powershell
git clone https://github.com/filmliga66/immich-tag-browser.git
cd immich-tag-browser
pnpm install
Copy-Item .env.example .env   # fill in IMMICH_URL + SESSION_SECRET (see IMPLEMENTATION_PLAN.md §8)
pnpm dev                      # runs web (Vite) + server (Fastify) concurrently
```

Open <http://localhost:5173> and log in with your Immich credentials.

### Non-Windows quick notes

- **macOS:** `brew install node@24 pnpm git`. Add `podman` and `podman machine init && podman machine start` only if you want to build the container image locally.
- **Linux:** use your distro's packages for Node 24. Add Podman 5 only if you want to build the container image locally.

### Everyday commands

```bash
pnpm lint                      # ESLint across the workspace
pnpm typecheck                 # tsc --noEmit
pnpm test                      # Vitest unit + component
pnpm build                     # production builds of web + server
pnpm --filter web run gen:api  # regenerate the typed Immich client
```

### Editor

VS Code is the tested path. Recommended extensions: **ESLint**, **Prettier**, **Tailwind CSS IntelliSense**.

## Contributing

Open an issue or PR. Discussion on the architecture is welcome — the implementation plan explicitly documents the open trade-offs.

## License

[AGPL-3.0-or-later](LICENSE). Matches upstream Immich; derivative works must remain open-source.
