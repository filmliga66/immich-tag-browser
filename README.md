# immich-tag-browser

A companion web app for [Immich](https://immich.app/) — browse, search, and multi-select tags to filter assets by the intersection.

## Run with Docker Compose

Create a `.env` next to your `docker-compose.yml` (see [.env.example](.env.example) for all variables):

```env
IMMICH_URL=https://immich.example.com
SESSION_SECRET=replace-me-with-a-32-byte-hex-string
PORT=8080
COOKIE_SECURE=true
```

```yaml
services:
  immich-tag-browser:
    image: ghcr.io/filmliga66/immich-tag-browser:latest
    env_file: .env
    ports:
      - "8080:8080"
    restart: unless-stopped
```

Then `docker compose up -d` and open <http://localhost:8080>. Log in with your Immich credentials.

## Development

```bash
pnpm install
cp .env.example .env   # fill in IMMICH_URL + SESSION_SECRET
pnpm dev               # web (Vite) + server (Fastify)
```

Requires Node 24 and pnpm 10. Open <http://localhost:5173>.

Common commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm --filter web run gen:api`.

## License

[AGPL-3.0-or-later](LICENSE).
