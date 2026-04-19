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

## Contributing

Open an issue or PR. Discussion on the architecture is welcome — the implementation plan explicitly documents the open trade-offs.

## License

TBD (likely MIT).
