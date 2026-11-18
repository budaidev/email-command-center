# Email Command Center

AI email triage + GTD task creation. Node/Express backend (SQLite + `better-sqlite3`), React/Vite frontend (TanStack Query), IMAP from local `mailserver` container, Vikunja for tasks, two LLM endpoints (primary + fallback).

Containers: `email-command-center-backend` (host `:3009` → container `:3002`) and `email-command-center-frontend` (host `:5174` → container `:80` nginx).

For the feature list and route/component map see `STATUS.md`. This file documents only the non-obvious things that bite you on deployment.

## Deploy & rebuild

```bash
DC=/Volume1/@apps/DockerEngine/dockerd/bin/docker-compose

# Always build the frontend on the host FIRST (see "Frontend build quirk" below)
cd /Volume1/docker/email-command-center/frontend
ulimit -n 65536
npm run build

# Then rebuild + restart both services
cd /Volume1/docker/email-command-center
$DC up -d --build
```

After backend-only changes you can skip the frontend build and just run `$DC up -d --build backend`.

## Frontend build quirk

The frontend ships a prebuilt `dist/` because Vite running *inside* the container hits `EMFILE: too many open files` on `lucide-react` (hundreds of small icon files × NAS HDD I/O × default fd limit). Always:

1. Build on the host with `ulimit -n 65536` raised first.
2. The Dockerfile then just `COPY dist/` into the nginx image — no in-container `npm run build`.

If `dist/` is missing or stale, the frontend container will serve old code. Run the host build before every frontend deploy.

## ES-module hoisting + `.env` (the LLM bug)

`backend/src/index.js` calls `dotenv.config({ path: '../.env' })` at the top level, but ES-module imports are hoisted and resolved **before** any top-level code runs. By the time `dotenv.config()` executes, every transitively-imported module has already read `process.env` and captured the *defaults*.

This bit `llm.js`, which captures endpoints at module load:

```js
const PRIMARY_BASE_URL = process.env.LLM_PRIMARY_BASE_URL || 'http://localhost:8001/v1';
const FALLBACK_BASE_URL = process.env.LLM_FALLBACK_BASE_URL || 'http://localhost:8002/v1';
```

→ Without env vars, both clients point at localhost and every digest call fails with `Connection error.`

**Fix in `backend/Dockerfile`**: `CMD ["node", "--env-file=/app/.env", "src/index.js"]`. Node loads `/app/.env` into `process.env` *before* any user code runs, winning the import race. The redundant `dotenv.config()` in `index.js` stays for local-dev convenience.

If you write a new module that reads env at import time, the `--env-file` flag has you covered. Don't rely on the `dotenv.config()` call — assume it has not run yet.

## LLM endpoints

Configured in `backend/.env` (bind-mounted into the container — host edits take effect on restart, no rebuild):

| Key | Value |
|-----|-------|
| `LLM_PRIMARY_BASE_URL` | `http://100.125.119.50:8001/v1` (workpc-1 Tailscale IP) |
| `LLM_PRIMARY_MODEL` | `cyankiwi/gemma-4-26B-A4B-it-AWQ-4bit` (label only — llama.cpp ignores it) |
| `LLM_FALLBACK_BASE_URL` | `http://192.168.50.46:8317/v1` (NAS LAN IP, local cli-proxy) |
| `LLM_FALLBACK_API_KEY` | `your-secure-api-key-here` — literal value, matches cli-proxy `config.yaml`. Looks like a placeholder, isn't. |
| `LLM_FALLBACK_MODEL` | `gpt-5.2` |

### `enable_thinking: false` is mandatory on the primary

workpc-1 runs a Qwen3-style thinking model on llama.cpp. Left unconstrained the model dumps everything into `reasoning_content` and returns `content: ""`, which `llm.js#getJSON` then parses as `{}` — producing empty digests marked `complete`.

`llm.js` sends `chat_template_kwargs: { enable_thinking: false }` only to the primary client (the fallback's cli-proxy doesn't understand it). Same fix the approval-service ships with. If you swap the primary endpoint, re-verify whether the new server honors that kwarg or needs a different field.

## Network

Joined `paperless-ai-dev_paperless-net` (external) instead of creating its own bridge — the NAS Docker subnet pool was full when the project was added. If recreating from scratch and you need a fresh bridge, free a subnet first or stay on the shared network.

## SQLite

`backend/data/email-center.db` (with `-shm` and `-wal` siblings). Bind-mounted at `/app/data/`. The 18+ migrations in `backend/migrations/` run automatically at boot from `db.js`. To inspect:

```bash
/Volume1/@apps/DockerEngine/dockerd/bin/docker exec email-command-center-backend \
  node -e "const d=require('better-sqlite3')('/app/data/email-center.db',{readonly:true}); \
           console.log(d.prepare('SELECT date,status,length(content) FROM daily_digests ORDER BY date DESC LIMIT 5').all())"
```

## Crons

`backend/src/index.js` registers cron jobs:
- **Fallback sync** every 1 min (IMAP IDLE is primary; this is the catch-up)
- **Yesterday's digest** at 02:00 (auto-generates the previous day)
- **AI scoring** after each pipeline run

Restarting the container kills any in-flight backfill (`startBackfill` runs as a module-level async IIFE with state in `backfillState`). No persistence — re-trigger via `POST /api/daily-digests/backfill` after restart.

## API surfaces worth knowing

- `POST /api/daily-digests/:date/generate?force=1` — force-regenerate a digest even if already marked complete.
- `POST /api/daily-digests/backfill` body `{from, to}` — queues background sequential generation, skips already-complete dates *without* a force option (clear/delete the row first if you want to replace it).
- `GET /api/daily-digests/backfill/status` — `{running, total, completed, current_date, errors}`. Poll while a backfill is in flight.
- `GET /api/daily-digests/today` — now returns `digestStatus` and `digestError` (since 2026-05-14) for UI status surfacing.

## UX rule: surface backend errors

Any backend operation that can fail (LLM calls, sync, digest generation) must have its error state visible in the UI. The `daily_digests.error_msg` column existed long before the UI rendered it — that's a regression pattern. When adding a feature with a DB-backed `status` or `error_msg`, wire it into the frontend at the same time, not later.
