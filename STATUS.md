# Email Command Center — Current Status
_Last updated: 2026-04-22_

## What's Running
- **Backend**: port 3002 — `cd backend && node src/index.js`
- **Frontend**: port 5174+ — `cd frontend && npm run dev`
- **IMAP**: Local Dovecot (configured via `.env`)
- **LLM**: Primary + fallback endpoints (configured via `.env`)
- **10 email categories**, **39 category rules**, **0 scoring rules** (ready to configure)

---

## Architecture

### Layout
```
┌──────┬──────────────────────────────────────────┐
│      │                                          │
│ Rail │           Content Area                   │
│ 72px │      (varies by route)                   │
│      │                                          │
└──────┴──────────────────────────────────────────┘
```

### Navigation (Left Rail)
| Icon | Label | Route | Description |
|------|-------|-------|-------------|
| Flame | Today | `/` | Morning briefing — AI-triaged emails + daily summary + GTD pulse |
| Inbox | Inbox | `/inbox` | Traditional email list + reading pane |
| Archive | Digest archive | `/archive` | Calendar of past digests |
| Activity | GTD Pulse | `/pulse` | System health dashboard with improvement workflows |
| Brain | Triage Workbench | `/triage` | Configure, inspect, and backtest AI scoring |
| CheckSquare | Tasks | `/tasks` | GTD kanban board (Vikunja) |
| Settings | Settings | `/settings` | Categories + rules + actions |
| Sun/Moon | Theme | — | Toggle light/dark mode |

---

## Features

### Today View (`/`)
**Purpose**: Answer "what needs my attention today?" — driven by AI triage, not digest generation.

**Sections**:
1. **Masthead**: Greeting + "You have N items that need your attention" (count from triage)
2. **Stats row**: Arrived / Auto-handled / For you / Next sync
3. **01 · Needs your attention**: AI-triaged emails scored ≥50 with no feedback yet. Each card shows:
   - Score badge with breakdown (e.g., `82 35+47` = rules + AI)
   - Action type chip (Reply, Review, Decide, Schedule, Pickup, etc.)
   - Sender, subject, AI reason
   - Suggested task preview
   - Three buttons: **Approve** / **Dismiss** / **Create task**
   - Create task: instantly creates a Vikunja task with the AI-suggested title
4. **02 · Today's summary**: Top 5 emails ranked by score, paginated through all today's triaged emails (Prev/Next)
5. **03 · GTD Pulse**: Health score ring + bucket counts + warnings/praise + "Process inbox" and "Open Pulse" buttons

**Data sources**: `GET /api/triage?min_score=50&date=today` (section 01), `GET /api/triage?min_score=0&limit=5&offset=N&date=today` (section 02), `GET /api/tasks/health` (section 03)

### Inbox View (`/inbox`)
- 400px list pane with email rows
- Filter pills by category (All + each category with count)
- Category filter supports `category_id=none` for uncategorized

### Archive View (`/archive`)
- Month calendar grid with day status dots (today/ready/stale/never/weekend)
- Digest detail pane with summary, decisions, auto-handled list
- Supports both old and new digest formats (field-name compatible)

### Reading View (`/email/:id`)
- **Sticky action bar**: Back / Archive / Snooze / Label / **Create task** / Reply
  - Create task button: sparkle icon, 3 states (idle → loading/analyzing → linked)
  - When linked: chip shows "Linked task →"
- **AI Task Proposal panel**: Appears between summary and body when classifying
  - Editable title (pre-filled by AI), list toggle buttons (Next/Waiting/Someday/Inbox), due date hint
  - Cancel + "Create in {list}" button
  - Green confirmation banner after creation
- **TL;DR card**: AI summary pinned at top, streamed via SSE
- **Email content**: Category chip, subject, sender row, article body

### Tasks View (`/tasks`) — GTD Kanban Board
- **5 GTD columns**: Inbox · Next Action · Waiting For · Someday · Completed
- **Drag & drop** between columns with optimistic UI
- **New task modal**: Pure GTD capture — title only + AI rewrites (Cmd+Enter), always targets Inbox
  - SparkleButton in input field, SuggestionChips for AI rewrites
  - Keyboard: Enter = create, Cmd+Enter = AI rewrite, Esc = close
- **Fix vague badge**: "Fix N vague" pill in header (sparkle icon, accent-ai color)
  - Opens Task Improvement modal: one task at a time, choose AI suggestions or write own
  - Modes: choose → ai (SuggestionChips) → manual (text input) → done
- **Task detail sheet**: Right-side drawer with title, context, due, notes, move buttons
- **Due date chips**: Color-coded (overdue=danger, today=accent, tomorrow=warn)
- **Context tags**: @home, @work, @calls, @errand, @read

### GTD Pulse (`/pulse`)
**Purpose**: Full-page dashboard showing GTD system health + improvement workflows.

- **Masthead**: Score ring (140px SVG), headline ("Your system is healthy/needs attention"), stats row
- **Signals**: 2-column grid of warnings (!) and praise (✓) with fix-action buttons
- **Buckets**: Horizontal flow (Inbox → Next → Waiting → Someday → Completed) with counts
- **Improvement flows** (3×2 grid of cards, each launches a modal):
  - **Weekly Review**: 5-step guided wizard (clear inbox → review next/wait/some → reflect)
  - **Process Inbox**: Keyboard-driven triage (Y/W/S/D/X keys) with GTD tips panel
  - **Stale Sweep**: Batch review of tasks untouched >14 days (Keep/Someday/Sharpen/Trash)
  - **Sharpen Vague**: AI rewrite wizard for vague task titles
  - **Nudge Waiting-For**: AI draft follow-up messages, copy to clipboard
  - **Focus Mode**: Coming soon (disabled)

**Data source**: `GET /api/tasks/health` — returns score, trend, counts, warnings, praise, stale items, waiting-for details, inbox items

### Triage Workbench (`/triage`)
**Purpose**: Configure, inspect, and improve the AI email triage system.

**Sections**:
1. **Configuration**: Instructions textarea (left) + learned profile display + stats (right) + enable/disable + save/run buttons
2. **Scoring Rules**: Table of static rules (field/operator/value/score/label) with add/edit/toggle/delete. "Test rules" dry-run. Score range -50 to +50.
3. **The Prompt** (collapsible): Shows exact prompt the AI would send — 3 tabs (System/Context/Sample) + stats footer
4. **Decision History**: Paginated table of all approve/dismiss/task feedback with filter pills, search, flip button to correct mistakes
5. **Backtest**: Draft instructions editor + "Test on last N emails" + comparison table showing match/mismatch against past decisions + "Apply changes" button

### Settings (`/settings`)
- Category CRUD with rules editor
- AI rule suggestions (analyze uncategorized emails)
- Distribution preview + email browser
- Apply categorization to all emails

---

## Design System

### Design Tokens (CSS Variables)
All colors use oklch color space:
- Surfaces: `--bg`, `--surface`, `--surface-2`, `--surface-3`
- Borders: `--line`, `--line-soft`
- Text: `--text`, `--text-2`, `--text-3`, `--text-4`
- Accent: `--accent`, `--accent-soft`, `--accent-ink`
- AI Accent: `--accent-ai`, `--accent-ai-soft`, `--accent-ai-ink` (purple, distinct from blue)
- Semantic: `--danger`, `--warn`, `--ok`, `--violet`

### Typography
- **Sans**: Inter — main UI font
- **Serif**: Instrument Serif italic — Today greeting
- **Mono**: JetBrains Mono — stats, timestamps, scores

### Shared Components
- `SparkleButton` — AI action trigger (circular, spins when loading, accent-ai color)
- `SuggestionChips` — selectable radio-style AI suggestions (used in task capture, improvement, sharpen)
- `Avatar`, `FilterPill`, `Kbd` — utility components

---

## Backend API

### Triage (AI Email Scoring)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/triage` | Scored emails (query: min_score, limit, offset, date). Returns score breakdown. |
| POST | `/api/triage/run` | Manual trigger — triage un-triaged emails from last 7 days |
| POST | `/api/triage/:emailId/feedback` | Store approve/dismiss/create_task decision |
| GET | `/api/triage/preferences` | Instructions + learned profile + stats |
| PUT | `/api/triage/preferences` | Update instructions and/or enabled flag |
| POST | `/api/triage/summarize-preferences` | Force re-summarize learned profile |
| GET | `/api/triage/prompt-preview` | Full assembled prompt (system + context + sample) |
| GET | `/api/triage/feedback-history` | Paginated feedback log with filters and search |
| POST | `/api/triage/feedback/:id/flip` | Change an existing feedback decision |
| POST | `/api/triage/backtest` | Test draft instructions against past decisions |
| GET | `/api/triage/scoring-rules` | List all static scoring rules |
| POST | `/api/triage/scoring-rules` | Create a scoring rule |
| PATCH | `/api/triage/scoring-rules/:id` | Update a scoring rule |
| DELETE | `/api/triage/scoring-rules/:id` | Delete a scoring rule |
| POST | `/api/triage/scoring-rules/test` | Dry-run rules against recent emails |

### Tasks (GTD + AI Features)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/tasks` | All tasks for GTD board |
| GET | `/api/tasks/status` | Vikunja connection health |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/tasks/health` | Full GTD pulse data (score, counts, warnings, stale, waiting-for) |
| GET | `/api/tasks/vague` | Server-side vague task detection (heuristic + optional AI) |
| POST | `/api/tasks/classify-email` | AI email → task classification |
| POST | `/api/tasks/from-email` | Create task + link to email (idempotent) |
| POST | `/api/tasks/suggest` | AI title completion from partial input |
| POST | `/api/tasks/improve` | AI title rewrite (3 alternatives) |
| POST | `/api/tasks/nudge` | AI follow-up draft for waiting-for items |
| POST | `/api/tasks/review/complete` | Mark weekly review done, save health snapshot |

### Daily Digests
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/daily-digests/today` | Today briefing stats (arrived, handled, remaining) |
| GET | `/api/daily-digests/month-status` | Per-day status for archive grid |
| GET | `/api/daily-digests/:date` | Full digest for a date |
| POST | `/api/daily-digests/:date/generate` | Generate or regenerate |
| POST | `/api/daily-digests/backfill` | Batch generate for date range |

### Emails, Categories, Summaries, Sync, Calendar, Tags, Actions
See existing endpoint tables — unchanged from original implementation.

---

## Key Files

```
backend/src/
  index.js                        — Express entry, route registration, IDLE startup, crons
  db.js                           — SQLite + auto-migration runner
  services/
    sync.js                       — syncAccount, syncAll, IDLE watchers + triage hook
    llm.js                        — streamChat(), getJSON(), getModel() with fallback
    triage.js                     — triageEmails, computeRuleScore, feedback, backtest, prompt preview
    scoring.js                    — Static scoring engine (rule matching, computeRuleScore)
    categorizer.js                — Category rule matching, preview, apply, applyOperator (shared)
    daily-digest.js               — generateDailyDigest, backfill, stale detection
    vikunja.js                    — Vikunja API client, project→column mapping, local overrides
    action-runner.js              — Execute category actions
    imap.js, caldav.js            — IMAP fetch/IDLE, CalDAV sync
  routes/
    triage.js                     — 15 triage endpoints (scoring, feedback, rules, backtest, prompt)
    tasks.js                      — GTD CRUD + AI features (classify, improve, health, vague, nudge)
    daily-digests.js              — Today briefing, month-status, generate, backfill
    emails.js, categories.js, summaries.js, accounts.js, tags.js, sync.js, calendar-events.js, category-actions.js
  prompts/
    triage-emails.js              — Triage scoring prompt (0-50 AI scale) + preference summarization
    classify-email-task.js        — Email → GTD task classification
    improve-task.js               — Vague title → 3 action-oriented rewrites
    nudge-waiting.js              — Follow-up message drafting
    summarize-daily-digest.js     — Daily digest generation
    summarize-email.js            — Per-email TL;DR
    extract-references.js         — Action/date/contact/amount extraction
    suggest-rules.js              — AI category rule suggestions

frontend/src/
  App.tsx                         — 8 routes: / /inbox /archive /pulse /triage /tasks /email/:id /settings
  index.css                       — Design tokens (oklch) including --accent-ai-* + utility classes
  api/client.ts                   — Typed API client: all endpoints, 15+ interfaces, triage + scoring types
  components/
    Shell/NavRail.tsx             — 72px rail: Today, Inbox, Archive, Pulse, Triage, Tasks, Settings, Theme
    Today/
      TodayView.tsx               — Morning briefing (triage cards + summary + pulse widget)
      TriageEmailCard.tsx         — Score badge (breakdown), action type, approve/dismiss/create task
      GtdPulseWidget.tsx          — Compact health widget (score ring + counts + signals)
    Inbox/InboxView.tsx           — Email list with category filter pills
    Archive/ArchiveView.tsx       — Month grid + digest detail (supports old+new formats)
    Reading/
      ReadingView.tsx             — Email reader with "Create task" button + proposal panel
      CreateTaskFromEmail.tsx     — AI task proposal (title, list, due) with accent-ai styling
    Pulse/
      PulseView.tsx               — Full health page (masthead, signals, buckets, flow cards)
      ScoreRing.tsx               — SVG donut chart
      FlowModal.tsx               — Generic modal shell (Escape key support)
      ProcessInboxMode.tsx        — Keyboard triage (Y/W/S/D/X) with GTD tips
      StaleSweep.tsx              — Batch stale task review
      SharpenVague.tsx            — AI vague title rewrite wizard
      NudgeWaitingFor.tsx         — AI draft follow-ups, copy to clipboard
      WeeklyReviewWizard.tsx      — 5-step guided review
    Triage/
      TriageWorkbench.tsx         — Main workbench page (4 sections)
      TriageConfig.tsx            — Instructions + learned profile + stats
      TriageScoringRules.tsx      — Scoring rules CRUD + test
      TriagePromptPreview.tsx     — Collapsible prompt viewer (system/context/sample tabs)
      TriageFeedbackHistory.tsx   — Paginated feedback table with filters + flip
      TriageBacktest.tsx          — Draft instructions + test + comparison results
    Tasks/
      TasksView.tsx               — GTD kanban board with improvement modal
      TasksHeader.tsx             — Stats + "Fix N vague" badge + new task
      NewTaskModal.tsx             — Pure GTD capture (title + AI rewrites, always Inbox)
      TaskImprovement.tsx         — Vague task detection + AI/manual improvement
      Column.tsx, MinimalCard.tsx, ParkingCard.tsx, TaskDetailSheet.tsx, due.tsx
    Rules/RulesPage.tsx           — Category rules editor + AI suggestions
    shared/
      SparkleButton.tsx           — AI action button (spin loading, accent-ai)
      SuggestionChips.tsx         — Selectable AI suggestion rows
      Avatar.tsx, FilterPill.tsx, Kbd.tsx
  hooks/
    useSummary.ts                 — SSE streaming hook for email summaries
```

---

## DB Schema (12 migrations)

| Table | Rows | Purpose |
|-------|------|---------|
| `accounts` | 1 | IMAP account (encrypted credentials) |
| `emails` | 1614 | All synced emails (subject, sender, recipients, body, date, category) |
| `emails_fts` | 1614 | Full-text search index |
| `categories` | 10 | Email categories (name, color, behavior) |
| `category_rules` | 39 | Auto-categorization rules (field/operator/value) |
| `category_actions` | 0 | Post-categorization hooks |
| `action_log` | 0 | Action execution history |
| `tags` | 3 | User-created email tags |
| `email_tags` | 2 | Tag assignments |
| `summaries` | 45 | Cached AI summaries |
| `email_refs` | 200 | Extracted references (dates, amounts, contacts) |
| `daily_digests` | 24 | Pre-generated daily briefings |
| `calendar_events` | 0 | CalDAV events |
| `task_columns` | 35 | GTD column overrides for Vikunja tasks |
| `gtd_health_snapshots` | 0 | Health score history |
| `settings` | 3 | Triage instructions, learned profile, enabled flag |
| `triage_results` | 270 | Per-email AI scores (score, rule_score, ai_score, matched_rules, action_type, reason, suggested_task) |
| `triage_feedback` | 5 | User approve/dismiss/create_task decisions |
| `scoring_rules` | 0 | Static scoring rules (field/operator/value/score) |
