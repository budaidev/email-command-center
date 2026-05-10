# Email Command Center — Architecture & Design

## Overview

Personal Email Command Center that connects to a local Dovecot IMAP server, syncs emails, and presents them through an AI-powered "Today-first" interface. Instead of dumping you into an inbox, the app answers "what needs my attention today?" through:

1. **AI Email Triage** — every email gets scored (0-100) using a hybrid system: static scoring rules (0-50) + AI analysis (0-50). The AI learns from your approve/dismiss feedback.
2. **GTD Task Integration** — create tasks from emails with AI-proposed titles, manage a kanban board backed by Vikunja, process inbox items with keyboard shortcuts.
3. **GTD Pulse** — system health monitoring with weekly review wizard, stale sweep, vague task detection, and follow-up nudge drafting.

**Not** a general-purpose email client — it's a personal productivity tool focused on intelligent triage, task creation, and GTD workflow.

---

## Design Philosophy

### Today-First Information Architecture
The app is organized around **what needs attention today**, not which folder you're in.

1. **Today** is the home: AI-triaged emails needing action, daily summary ranked by relevance, GTD pulse
2. **Inbox** exists but is secondary — accessible from the rail
3. **Digest archive** — a month-grid where each day shows its digest status
4. **GTD Pulse** — full-page system health dashboard with improvement workflows
5. **Triage Workbench** — configure, inspect, and backtest the AI scoring system
6. **Tasks** — GTD kanban board backed by Vikunja
7. **Reading** — full-width email view with AI summary and one-click task creation

### Hybrid Triage Scoring
Every email receives a score from two sources:
- **Static rules (0-50)**: User-defined rules matching sender, domain, category, keywords, recipients. Instant, deterministic, transparent.
- **AI score (0-50)**: LLM evaluates content, context, urgency. Learns from feedback.
- **Final score = rule_score + ai_score** (clamped 0-100)

The scoring is transparent — the UI shows the breakdown and which rules matched.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | Node.js + Express (ESM) | Lightweight, same patterns as other projects |
| Frontend | React 19 + TypeScript + Vite 7 | Fast HMR, modern tooling |
| Styling | Tailwind CSS 4 + oklch CSS variables | Theme-aware via `data-theme`, no build-time color config |
| State | TanStack Query 5 | Server state management with cache invalidation |
| Routing | react-router-dom 7 | Client-side SPA routing |
| Database | SQLite (better-sqlite3, WAL, FTS5) | Zero-ops, single file, built-in search |
| LLM | OpenAI SDK → local endpoints | Gemma 4 26B (primary, 256K context) + GPT-5.2 (fallback) |
| Email | ImapFlow | Modern Promise-based IMAP with IDLE support |
| Icons | lucide-react | Consistent icon set |
| Fonts | Inter + Instrument Serif + JetBrains Mono | via Google Fonts |

---

## Infrastructure

### Email Sync
- **Source**: Local Dovecot IMAP (docker-mailserver) — configured via `IMAP_HOST`/`IMAP_PORT` env vars
- **Initial sync**: Fetch last 500 envelopes, bodies lazy-loaded on demand
- **Incremental**: IMAP UID-based — only fetch UIDs newer than `last_uid`
- **Real-time**: IMAP IDLE persistent connection per account (auto-reconnect)
- **Fallback**: node-cron every 5 min catches missed IDLE events
- **Post-sync pipeline**: categorize → triage (AI scoring, fire-and-forget)

### LLM
- **Primary**: Local LLM endpoint (e.g., llama.cpp, vLLM) — configured via `LLM_PRIMARY_BASE_URL`
- **Fallback**: Secondary endpoint — configured via `LLM_FALLBACK_BASE_URL`
- **Health check**: Tests primary every 60s, auto-falls back if unreachable
- **Thinking model handling**: +10k token headroom for reasoning overhead, `response_format: json_object`
- **JSON repair**: 5-attempt iterative repair for truncated responses
- **Sanitization**: Non-ASCII → ASCII for fallback endpoint if needed

### Database
- SQLite with WAL mode for concurrent reads
- FTS5 virtual table for full-text search (subject + sender + body)
- 14 migrations covering accounts, emails, tags, summaries, categories, digests, calendar, actions, task columns, health snapshots, triage, scoring rules, pipeline
- Encrypted IMAP credentials (AES-256-GCM)

### Vikunja (GTD Tasks)
- **Instance**: Self-hosted Vikunja — configured via `VIKUNJA_URL`/`VIKUNJA_TOKEN` env vars
- **Auth**: Scoped API token (task read/write only)
- **Architecture**: Backend proxies Vikunja API; column mapping derived from `project_id` (1=inbox, 2=next, 4=wait, 5=some). Local SQLite overrides for drag-drop moves.
- **Excluded**: Projects 3 (references), 6 (project-specific), 7 (automated tasks)

---

## Data Flows

### Email Sync → Categorize → Triage
```
IMAP sync (IDLE or 5-min cron)
  → Insert new emails into DB
  → applyCategoriesToNew(newIds): test rules, assign category_id
  → triageNewEmails(newIds): fire-and-forget async
    → Compute static rule scores (instant)
    → Batch emails (40 per LLM call)
    → LLM scores 0-50 (AI analysis)
    → Final score = rule_score + ai_score (0-100)
    → Store in triage_results
```

### Email → Task Creation
```
User clicks "Create task" in ReadingView action bar
  → POST /api/tasks/classify-email → LLM proposes title + list + due
  → User reviews/edits in TaskProposal panel
  → POST /api/tasks/from-email → Creates Vikunja task, links via gtd_task_id
  → Green confirmation banner, "Linked task →" button in action bar
```

### Triage Feedback Loop
```
User approves/dismisses emails on Today page
  → POST /api/triage/:emailId/feedback (stores decision + score snapshot)
  → Every 20 feedbacks: summarizeLearnedPreferences()
    → LLM compresses all feedback into a profile paragraph
    → Stored in settings.triage_learned_profile
  → Every triage prompt includes: instructions + learned profile + 15 recent examples
```

### GTD Pulse Health
```
GET /api/tasks/health
  → Fetch all tasks from Vikunja
  → Compute: inbox size, overdue, stale (>14d), processing rate
  → Score: 100 - inbox*2 - overdue*5 - stale*2
  → Warnings (inbox overload, stale, overdue) + Praise
  → Waiting-for details, stale details, inbox items
```

---

## AI Features

### Email Triage (Hybrid Scoring)
- **Static rules** (0-50): User-created in Triage Workbench. Match on sender_email, sender_domain, sender_name, subject, category, keyword (subject+body), recipient_email, recipient_domain. Positive scores boost, negative suppress.
- **AI score** (0-50): LLM evaluates content with scoring guide. Action types: reply, review, decide, schedule, pickup, send, delegate, task, none.
- **Prompt layers**: system guide + user instructions + learned profile + 15 recent feedback examples + email batch (with recipients, labels, body/snippet, category)
- **Batching**: 40 emails per LLM call, maxTokens scaled by batch size

### Email → Task Classification
- LLM proposes: actionable (bool), GTD list (inbox/next/wait/some), action-oriented title, due date hint
- Prompt includes existing AI summary if available

### Task Title Improvement
- Rewrites vague titles ("taxes", "check servers") into 3 action-oriented alternatives
- Used in: NewTaskModal (Cmd+Enter), Task Improvement modal, Sharpen Vague wizard

### GTD Health Analysis
- Heuristic vague task detection (weak verbs, short titles, missing action verbs)
- Optional AI pass for borderline cases
- Health score with multi-dimensional breakdown

### Nudge Drafting
- AI generates follow-up messages for Waiting-For items
- Draft-only (copy to clipboard, no SMTP sending)

### Preference Summarization
- Compresses approve/dismiss feedback into a natural language profile
- Injected into future triage prompts for learning

---

## Category System

### Behaviors
- **always-summarize**: Expanded in digest, AI summary per group
- **digest-only**: Shown in digest, collapsed by default
- **silent**: Synced but hidden from digest

### Rule Fields
`sender_email`, `sender_domain`, `sender_name`, `subject`, `recipient_email`, `recipient_domain`

### Rule Operators
`contains`, `equals`, `starts_with`, `ends_with`

### Actions (per category)
| Type | Description |
|------|-------------|
| `mark_read` | Auto-mark as read |
| `auto_tag` | Create and attach tags |
| `script` | Execute shell command with email JSON on stdin |
| `ai_prompt` | Run custom LLM prompt against email |
| `webhook` | POST email data to URL |
| `skip` | No-op |

---

## Theming

Dark (default) and light themes via CSS custom properties using oklch color space:

```css
:root {
  --bg, --surface, --surface-2, --surface-3     /* surfaces */
  --line, --line-soft                             /* borders */
  --text, --text-2, --text-3, --text-4           /* text hierarchy */
  --accent, --accent-soft, --accent-ink          /* blue accent */
  --accent-ai, --accent-ai-soft, --accent-ai-ink /* purple AI accent */
  --danger, --warn, --ok, --violet               /* semantic colors */
  --shadow                                        /* elevation */
}
```

Both dark and light variants defined. Theme detection: system preference → localStorage override.

---

## Development

### Start
```bash
cd backend && node src/index.js    # port 3002
cd frontend && npm run dev          # port 5174+
```

### Environment Variables
See `backend/.env.example` for all available variables and defaults.

---

## DB Migrations

| File | Contents |
|------|----------|
| `001_accounts.sql` | accounts table (encrypted IMAP creds) |
| `002_emails.sql` | emails + FTS5 + sync triggers |
| `003_tags.sql` | tags + email_tags |
| `004_summaries.sql` | summaries + email_refs |
| `005_categories.sql` | categories + category_rules + category_id on emails |
| `006_daily_digests.sql` | daily_digests table |
| `007_calendar_events.sql` | calendar_events table |
| `008_category_actions.sql` | category_actions + action_log |
| `009_task_columns.sql` | task_columns (GTD column + context overrides) |
| `010_health_and_reviews.sql` | gtd_health_snapshots + email-task index |
| `011_triage.sql` | settings, triage_results, triage_feedback |
| `012_scoring_rules.sql` | scoring_rules + triage breakdown columns |

---

## Pending / Future

- [ ] Keyboard shortcuts (E/H/R/L/J/K in reading view)
- [ ] Paperless-NGX archive integration
- [x] GTD kanban board (Vikunja integration)
- [x] Email→Task conversion (AI classification + one-click creation)
- [x] AI triage system (hybrid scoring + feedback learning)
- [x] Triage Workbench (prompt preview, backtest, scoring rules)
- [x] GTD Pulse (health dashboard + weekly review + inbox processing + stale sweep)
- [x] Smart task capture (AI rewrites in NewTaskModal)
- [x] Task improvement (vague detection + AI suggestions)
- [ ] Task inline editing (title/notes/due in detail sheet)
- [ ] Task board variants V2 (4-col + tray) and V3 (swimlanes)
- [ ] Mobile responsive layout
