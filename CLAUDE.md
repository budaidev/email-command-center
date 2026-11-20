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
- **Prompt v2** (production since 2026-11-20) also returns `want_to_know` (forced false when important) and `due` (the stated deadline, `YYYY-MM-DD`, kept only when important; stored as `criteria.due`). It counts personal mail from real people (recruiters, accountant, teachers), portal "new document" notices, forwarded bills and parcel pickups as important, and code-hosting/list notifications as at most want_to_know. It was written from v1's misses on the same 70 labels, so its backtest score (Luna 98.6%, Sol 100% on important) is optimistic; the Átnézés decisions are the fresh check.
- **Live model** `email-llm-strong` (GPT-6.2 Sol, `LLM_IMPORTANCE_MODEL`, since 2026-11-20). It hits cli-proxy's short-term limit after ~150 quick calls: each call waits 70 s and retries up to 3 times on 429/500, and an hourly cron (:17) re-runs `not_evaluated` emails of the last 3 days.
- `runBacktest` (Triage page) still uses the old 0-50 prompt. The real backtest is `src/scripts/backtest.js` (below).

## Backtest (card #241)

Ground truth: the owner's labels on the 70-email test set, Langfuse dataset `ecc-importance-labels` (active items; `scripts/sync_labels.py` copies annotation-queue labels into the items' expected output; corrections posted over the API are marked `corrected`).

```bash
docker exec email-command-center-backend node --env-file=/app/.env src/scripts/backtest.js \
  --model email-llm [--prompt-version N | --prompt-label candidate] [--limit N]
docker exec email-command-center-backend node --env-file=/app/.env src/scripts/backtest.js --compare RUN_A RUN_B
```

- A run is a Langfuse **experiment** on the dataset (Datasets → `ecc-importance-labels` → Runs). Langfuse v4 events-only ignores `POST /api/public/dataset-run-items`; experiments are declared as `langfuse.experiment.*` attributes on OTel spans (environment `ecc-backtest`).
- Results with every answer: `backend/data/backtests/<run>.json`. The pre-#239 triage (score >= 50, from `data/email-center.backup-2026-11-18.db`) is printed as the old-system baseline.
- `--compare` gives the confidence tiers: sure (both models agree, all quotes found), likely (agree, a quote missing), doubtful (disagree).
- cli-proxy returns 500 on its short-term limit and LiteLLM then cools the route for 60 s; the script runs one call at a time and waits 70 s on 429/500. `email-llm-strong` (GPT-6.2 Sol) is the second model.

## Deterministic signals (card #246)

`services/signals.js`: facts about each email computed without an LLM, stored in `email_signals` (JSON, `SIGNALS_VERSION`). `prepareEmails` (called by the importance evaluation, i.e. right after each sync) fetches the raw message once for emails missing a body or current signals, and stores both. Backfill: `src/scripts/backfill-signals.js`. Measure: `python3 scripts/signal_report.py` (each signal and candidate hard rule against the owner's labels, plus coverage of all mail).

- Headers come from `imap.fetchBodies` meta. mailparser folds `List-*` headers into one structured `list` header: read that, not `list-unsubscribe`.
- `OWNER_ADDRESSES` in `.env`: the owner's addresses (all Gmail accounts land in one mailbox).
- Sender history (`owner_wrote_to_sender_before`, `owner_replied_in_thread_before`) comes from `/app/mailstate/sent_index.jsonl`, header-only records of the owner's sent Gmail mail written by `mailserver/config/gmail_sync.py` (mounted read-only from `mailserver/mail-state/lib-fetchmail`). Only mail sent before the email's date counts; whether the owner later replied must never be a signal.
- Domain categories: table `domain_categories` (seeded with Claude's proposal), edited in the UI.

## Decision rules (card #247)

Triage → Workbench → "Döntési szabályok" (`TriageDecisionRules.tsx`, API `/api/rules`, `services/rules.js`, table `decision_rules`). Replaces the additive `scoring_rules` in the UI (that table and its pipeline code still exist, empty).

- A rule: conditions over the signals and email fields (all must hold; `any_of` gives an OR over yes/no signals), a verdict and a status (draft/active/off). `not_important` and `want_to_know` rules answer without calling the LLM (`triage_results.prompt_version = "rule:<name>"`, model `rules`); `important` rules let the LLM run and override its verdict. Only active rules run; the first match by `sort_order` wins; emails without signals are never decided by a rule.
- Backtest (button, `POST /api/rules/:id/backtest` or `/api/rules/backtest` for an unsaved draft): fires and errors on the owner's labels (`importance_labels`, synced from the Langfuse dataset with the "Címkék" button), coverage of all mail, disagreement with each LLM source (`data/backtests/*.json`, `data/llm-checks/*.json`, live `triage_results`), and a sample of hits. Activation is refused unless the exact saved definition was backtested; editing a rule clears its backtest.
- Same numbers as `scripts/signal_report.py`.

## Review list (card #242)

"Átnézés" page (`/review`, `components/Review/ReviewView.tsx`, API `/api/review`, `services/review.js`, table `email_review`). Lists emails evaluated by the new pipeline (`prompt_version` set) that have no decision and no linked task:

- **Teendő**: `important = 1`. "TODO-ba" creates a Vikunja task in the GTD inbox (project 1) with the why and a link back to the email, and sets `emails.gtd_task_id`; "Nem kell" dismisses.
- **Tudni akarom**: `important = 0 AND want_to_know = 1`. Set by `want_to_know` rules (no LLM call), or by the LLM (prompt v2 on; v1 results have NULL).
- **Bizonytalan**: the LLM decided and the signal score contradicts it by 10+ points (at most 15). A draft score model scores every email (stored in `criteria.score`) without deciding; only an active one decides.
- **Fineract**: everything about Apache Fineract (subject or sender contains "fineract", `list_id_value` e.g. `dev.fineract.apache.org`, or `github_repo` e.g. `apache/fineract`) is taken out of the three lists above and shown on its own tab: important, want_to_know and unsure by default, every undecided one with `?all=1`. "Mind láttam" marks the shown page seen (`POST /api/review/bulk`).
- Due date: `services/due.js` guesses a deadline from the email text without an LLM (Hungarian/English date forms near deadline or appointment words; `11.17.` without a year takes the email's year) and prefills the TODO's due date; the LLM's `criteria.due` (prompt v2) wins when present.
- Undo deletes the `email_review` row(s); a created Vikunja task stays.
- **Feedback** ("Rossz besorolás", table `email_feedback`, `services/feedback.js`, API `/api/feedback`): the owner's right verdict (important / want_to_know / not_important) plus an optional note, on every review card and in the reading view (`components/Feedback/`), so misses outside the lists can be flagged too. The prediction and prompt version at the time are stored with it. From a list, not_important / want_to_know also writes `email_review` (dismissed / seen); undo removes both. "Nem kell" means only "no task", not "not important".
- **Visszajelzések** tab: confusion matrix and mismatches over explicit feedback plus implicit labels (TODO = important, "Láttam" on Tudni akarom = want_to_know). "Javaslat kérése" sends up to 40 mismatches/notes (subject, sender, 300-char snippet) to `LLM_IMPORTANCE_MODEL` for proposed rules and prompt changes.

Signals v4 added `list_id_value` and `github_repo` (from the subject's `[owner/repo]`); v3 added `kw_security` (body+subject) and `kw_verification_code` (subject only: "OTP" in bodies is a bank). Draft rules "Biztonsági riasztás" (want_to_know) and "Ellenőrző kód" (not_important) run before HARD v1 (`sort_order`).

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
