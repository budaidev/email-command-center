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

Configured in `backend/.env` (bind-mounted into the container: host edits take effect on restart, no rebuild). All calls go through LiteLLM (`http://litellm:4000/v1`):

| Key | Value |
|-----|-------|
| `LLM_PRIMARY_MODEL` | `private-llm` (Gemini free tier, no fallback): summaries, categorising, references |
| `LLM_FALLBACK_*` | also LiteLLM `private-llm`; the old workpc-1 llama.cpp is gone |
| `LLM_IMPORTANCE_MODEL` | `email-llm` (cli-proxy GPT, chosen by the owner 2026-11-18): the importance rubric |
| `LANGFUSE_HOST/_PUBLIC_KEY/_SECRET_KEY` | the LiteLLM project's keys: the rubric prompt is fetched from there |

## Importance rubric (card #239)

The AI part of the triage score is three yes/no criteria with verbatim evidence quotes (`prompts/importance.js`, `services/importance.js`): reply or decision needed, mandatory appointment, payment due. Important = any yes = AI score 50, otherwise 0; rule scores add on top.

- **Prompt lives in Langfuse** (`ecc-importance`, label `production`, project `litellm`). Edit it there; the backend picks the new version up within 5 minutes. `LOCAL_SYSTEM` is the fallback when Langfuse is down; results then carry `prompt_version = "ecc-importance local"`.
- **One call per email**, 3 in parallel. Each is a Langfuse trace named `ecc-importance` with tags `app:email-command-center`, `prompt:ecc-importance:vN` and metadata `email_id`, `message_id`, `prompt_version`. LiteLLM's OTEL callback does not set Langfuse's own prompt link or trace id; filter on those metadata/tags.
- **Bodies**: the sync stores no body. `ensureBodies` fetches missing bodies from the local mailserver before evaluating and saves them in `emails.body_text`. Before 2026-11-18 the AI saw only sender and subject.
- `triage_results.criteria` (JSON with `evidence_found`: false when the quote is not in the email), `important`, `prompt_version`. The Today card shows them (`TriageCriteria.tsx`).
- `runBacktest` (Triage page) still uses the old 0-50 prompt; card #241 replaces it with Langfuse experiments.

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
