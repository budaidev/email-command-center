# Handoff: Email Command Center — UX Redesign

## Overview
Redesign of the Email Command Center app. The existing app was a dense three-column layout with unlabeled icons in a top bar, flat gray hierarchy, buried actions, and a folder-oriented IA (`Inbox / Digest / Calendar / Rules`). The redesign rethinks the app around **what needs attention today**, not which folder you're in.

Two major changes:

1. **Today-first IA** — "Today" is the home: a morning-briefing surface with stats, a decision queue, quietly-handled FYI items, and a peek at the rest of the inbox. Inbox is still there as a mode, but it's demoted.
2. **Digest archive** — replaces the old Calendar tab. A month-grid where each day is a tile showing the digest status (Live / Ready / Outdated / Not run / Quiet day). Clicking a day opens that day's digest with regenerate / rerun controls.

## About the Design Files
The HTML file in this bundle (`Email Redesign.html` + `reference/*.jsx`) is a **design reference** — a prototype showing intended look, hierarchy, and interactions. It is **not production code to copy-paste**.

Your task is to **recreate these designs inside the existing `frontend/` React + TypeScript + Tailwind + TanStack Query codebase**, wiring up the real backend (`backend/src/routes`, SQLite migrations, summary/digest services) that already exists in `email-command-center/`. Keep the codebase's established patterns: `useQuery` for data, Tailwind for styling, components split by feature under `src/components/`.

## Fidelity
**High-fidelity.** Final colors (oklch), typography, spacing, and interactions are all defined. The developer should recreate the UI pixel-perfectly. Everything in this doc has an exact value.

## Target codebase (context)
Already in `email-command-center/`:

```
frontend/src/
├── App.tsx                     — top-level view switcher (needs rewrite)
├── api/client.ts               — typed API client (Email, Tag, etc.)
├── hooks/useSummary.ts         — existing AI summary hook
├── index.css                   — Tailwind layer (needs tokens added)
└── components/
    ├── Accounts/AccountManager.tsx
    ├── Calendar/               — repurpose → Archive
    ├── Digest/DigestView.tsx   — repurpose → Today
    ├── EmailDetail/EmailDetail.tsx
    ├── EmailList/{EmailList,EmailItem}.tsx
    ├── RightPanel/RightPanel.tsx
    ├── Rules/RulesPage.tsx
    └── Settings/SettingsPage.tsx

backend/src/
├── routes/        — REST endpoints
├── services/      — summary + digest generation
├── prompts/       — LLM prompts (update for decision/FYI split)
└── migrations/    — SQLite schema, already covers daily_digests
```

Keep React 18, Vite, Tailwind, TanStack Query, lucide-react icons.

---

## Information architecture

**Old** (remove): `Inbox | Digest | Calendar | Settings | Rules` — tabs in a top bar, mostly icon-only.

**New**: a **left rail** (72px wide) with labeled icons:

| Position | Icon (lucide) | Label | Route / Mode | Notes |
|---|---|---|---|---|
| Top | `Flame`    | Today           | `/` or `today`    | Default landing |
| Top | `Inbox`    | Inbox           | `/inbox`          | Shows unread badge |
| Top | `Archive`  | Digest archive  | `/archive`        | Calendar of past digests |
| Top | `Bookmark` | Reading         | `/reading`        | Saved-for-later (future) |
| Bottom | `SlidersHorizontal` | Rules | `/rules` | Existing route |
| Bottom | `Settings` | Settings | `/settings` | Existing route |
| Bottom | Avatar | Profile | — | Current user |

Reading a specific email is a mode that takes over the main pane (`reading`). "Back to Today" returns the user wherever they launched from.

---

## Screens

### 1. Today view — `/` (default)

**Purpose**: give the user a morning briefing. Answer "what do I need to do today?" before they touch the inbox.

**Layout** (max-width `1040px`, centered; `padding: 48px 56px 80px`):

```
┌────────────────────────────────────────────────────┐
│  masthead                                          │
│    kicker (mono, uppercase, tracking 0.15em)       │
│    H1 (42px, italic serif greeting + sans body)    │
│    stats row (4 columns: Arrived / Auto-handled /  │
│                          For you / Next sync)      │
│  ────────────────────────────────────────────────  │
│  §1 · DECISION QUEUE                               │
│    [decision card]                                 │
│    [decision card]                                 │
│  §2 · QUIETLY HANDLED (FYI)                        │
│    [3-column grid of FYI cards]                    │
│  §3 · ALSO ARRIVED TODAY                           │
│    [condensed email list, 4 rows + "View all" CTA] │
└────────────────────────────────────────────────────┘
```

**Masthead greeting pattern** (mixed-weight headline):
```
<span class="serif italic text-text-2" style="font-size:42px">Good morning, Rin.</span>
<br/>
You have <span style="color:var(--accent)">{N} items</span> that need a decision.
```
- Serif font: Instrument Serif, italic 400
- Sans: Inter 500, `letter-spacing: -0.035em`, `line-height: 1.05`
- Max-width of H1: 760px

**Stats row** — 4 equal columns separated from masthead by a 1px `--line` divider with 24px padding-top. Each stat:
- Label: 10px, 600, `letter-spacing: 0.08em`, uppercase, `--text-3`
- Value: 28px, 500, `letter-spacing: -0.02em`, `line-height: 1`, accented color optional
- Hint: 11px, `--text-4`

Stats to show (values from DB queries):
- **Arrived** — `count(emails) where date = today` · hint `since 6 am`
- **Auto-handled** — `count(emails) where date = today and category_id is not null (auto-categorized)` · hint `filed by rules` · color `--ok`
- **For you** — `arrived - handled` · hint `needs decision` · color `--accent`
- **Next sync** — `in Nm` · hint `every 5 min` · use mono font

**Section title component** (used 3× on this page):
```
kicker (mono 10px uppercase, tracking 0.15em, --text-3)   e.g. "01 · DECISION QUEUE"
H2 (18px, 600, -0.015em)                                  e.g. "Waiting on you"
marginBottom: 16px
```

**Decision card** (white surface, used in §1):
- Padding 20px, `background: var(--surface)`, `border: 1px solid var(--line)`, `border-radius: 14px`
- Grid: `1fr auto` — body on left, round open-arrow button on right (40×40, `border: 1px solid var(--line)`, `border-radius: 8px`)
- Top row: `<Sparkle/>` 12px accent color + "DECISION" label (11px, accent, tracking 0.03em) + "· from {sender}" (11px, `--text-3`)
- Title: 15.5px, 600, `-0.01em`
- Body: 13.5px, `line-height: 1.55`, `--text-2`, max-width 620px
- Suggested-action chips row: up to 3 chips, gap 8px, first is primary (`bg: --accent`, `color: --accent-ink`), others ghost (`bg: --surface-2`, `border: 1px solid --line`). Chips are 6×11px padding, 7px radius, 12px text 500.

**FYI card** (§2, 3-column grid, gap 12px):
- Padding 16px, `bg: --surface`, `border: 1px solid --line-soft`, radius 12px
- Kicker 10px mono uppercase tracking 0.1em, `--text-3` — e.g. "AUTOMATED" / "LIGHT"
- Body 13px `--text-2`, `line-height: 1.45`
- Footer (if `count`): 11px `--text-3`, `{count} items · ` + "review" link in accent color

**§3 Rest-of-inbox list** (condensed):
- Container: `bg: --surface`, `border: 1px solid --line-soft`, radius 12, `overflow: hidden`
- Row: `grid-template-columns: 28px 1fr 80px auto`, gap 12, padding `12px 18px`, `border-bottom: 1px solid --line-soft`
- Avatar 26px (see Avatar component spec)
- Middle: `{sender} · {subject in --text-3}` on line 1, snippet on line 2 in `--text-3`
- Time: right-aligned mono 11px `--text-3`
- Chevron-right 14px `--text-4`
- Footer CTA: "View all {N} · `I`" (full-width 12px button, `--text-3`)

**Data source**: `GET /api/digests/today` should return
```ts
{
  date: string,                 // "2026-04-20"
  arrived: number,
  handled: number,              // auto-categorized
  remaining: number,
  highlights: Array<{
    title: string,
    body: string,
    emailId: string,
    kind: 'decision' | 'fyi',
  }>,
  fyi: Array<{
    title: string,
    kind: 'auto' | 'light',
    count?: number,
    emailId?: string,
  }>,
}
```

---

### 2. Inbox view — `/inbox`

**Purpose**: the traditional list + reading pane, but cleaner. Accessible via the rail but not default.

**Layout**: `grid-template-columns: 400px 1fr` — list left, reading pane right. When no email selected, right pane shows empty state ("Select a message · J/K").

**List header** (padding 20px 20px 14px, border-bottom `--line`):
- H1 "Inbox" — 20px 600 -0.02em
- Filter pills row below, horizontally scrollable, gap 6px
  - "All {N}" pill (active = `bg: --text, color: --bg`)
  - One pill per category (has colored dot + label + count)
  - Pill: padding `6px 12px`, `border-radius: 999px`, 12px 500, `bg: --surface`, `border: 1px solid --line` when inactive

**List row** — 3 variants, switchable via a Tweaks panel in the prototype. In production, settle on one or ship as user preference:
- **Rows** (default — compact): `grid-template-columns: 28px 1fr auto`, padding `var(--row-py) var(--row-px)` (density-driven), avatar left, sender+dot+category label on line 1, subject bold if unread, snippet `--text-3`, mono time top-right.
- **Cards**: each row is a card with padding 14, radius 10, `--surface` bg, includes avatar header + subject + snippet + category chip at bottom.
- **Threaded**: adds a 3px colored left-bar (accent if selected, category color if unread) and thread count "· 4".

See `reference/common.jsx` `ListRow` for exact styles of all three.

**Density** (exposed as tweak — implement as CSS variables on `:root` or user setting):
- Compact: `--row-py: 8px; --row-px: 12px`
- Comfortable (default): `12px / 16px`
- Spacious: `18px / 20px`

---

### 3. Digest archive — `/archive` ★ NEW

**Purpose**: Browse past days' digests. Each day has a summary of emails received that day. User can generate missing digests and rerun outdated ones.

**Layout**: `grid-template-columns: 1.25fr 1fr` — calendar grid left, digest detail right.

**Left — month grid**:

Header (padding 24px 32px 16px, border-bottom `--line`):
- Kicker "DIGEST ARCHIVE" (mono 11px tracking 0.15em uppercase `--text-3`)
- Title `{Month Year}` (24px 500 -0.025em) + prev / next / "Today" buttons (right-aligned, 6px padding, 6px radius, 1px border `--line`)

Grid body (padding 16px 24px 24px):
- Weekday labels row (Mon-Sun), mono 10px tracking 0.1em `--text-4`
- 7-column grid, gap 6, each cell is a button. Cell:
  - min-height: 82px, padding 10, radius 10
  - bg: `--surface` default; `--accent-soft` if today; `--surface-2` if selected
  - border: `1px solid --line-soft` default; `1px solid --accent` if today or selected
  - Day number top-left: 15px, 500 (600 if today), `-0.01em`, accent color if today
  - Email count top-right: mono 10px `--text-3`
  - Status indicator bottom: 6×6 dot + label 10px `--text-3`
  - Unread-decisions indicator: 6×6 accent dot top-right corner (abs-positioned)
  - Future days: opacity 0.35, `cursor: not-allowed`, no status

**Status states** (compute backend-side per day):
| State | Dot | Label | Meaning |
|---|---|---|---|
| `today` | `--accent` solid | "Live" | Today, digest updates as emails arrive |
| `ready` | `--ok` solid | "Digest" | Digest was generated and is current |
| `stale` | `--warn` solid | "Outdated" | Digest exists but newer emails arrived after generation |
| `never` | dashed border, no fill | "Not run" | Emails received that day but no digest generated |
| `weekend` / quiet | `--text-4` solid | "Quiet" | Fewer than threshold emails, don't auto-generate |

Detection of `stale`: `max(emails.received_at where date = d) > daily_digests.generated_at`.

Legend (below grid, 14px 16px padding, `--surface`, `--line-soft` border, radius 10):
- Flex row, gap 18, 11px `--text-3`, one entry per status.

**Right — digest detail** (padding 32px 36px 60px, max-width 640):

If `never` or `weekend` with 0 emails → render `EmptyDigest`:
- Kicker (mono 11px uppercase tracking 0.15em `--text-3`) — "NO DIGEST YET" / "QUIET DAY"
- Title: 22px 600 -0.02em — full date e.g. "Thursday, April 3"
- Body: 14px `--text-2` `line-height: 1.6`
- CTA button (if generable): "Generate digest" — `bg: --accent`, `color: --accent-ink`, 8px 14px padding, 8px radius, 12.5px 500, `<Sparkle>` icon 13px.

Otherwise render full digest:
- **Header**: kicker ("Today · live digest" or "Archived digest") + title (22px 600 full date) + stats row (Received / Decisions / Generated, separated by 20px gap, 16px bottom padding, border-bottom `--line`)
- **Stale banner** (only if `stale`): horizontal flex, `bg: color-mix(in oklch, var(--warn) 10%, transparent)`, `border: 1px solid color-mix(in oklch, var(--warn) 35%, transparent)`, radius 10, padding 12 14. Clock icon 14px in warn color + copy "This digest was generated before N emails arrived later that day. Rerun to include them." + "Rerun" button (`bg: --warn, color: --bg`, 5/10 padding, 6 radius).
- **Summary card**: 18px padding, `--surface` bg, `--line` border, radius 12. Kicker "SUMMARY" with `<Sparkle>` accent icon. Body 14px `line-height: 1.65`, `--text`.
- **Decisions list** (if `decisions > 0`): kicker "DECISIONS MADE ({N})". Each item is a button: full-width, 12 padding, radius 10, `--surface` bg, `--line-soft` border. Title 13 500, body 12 `--text-3` `line-height: 1.5`. Clicking opens the source email.
- **Auto-handled list**: kicker "AUTO-HANDLED". Each item: 8 12 padding, 8 radius, `--surface` bg, `--line-soft` border, 12.5px `--text-2`, small grey dot on the left.
- **Footer actions** (padding-top 18, border-top `--line`): "Regenerate / Rerun" button (left, `--surface-2` bg, `--line` border, 7 12 padding, 7 radius) + "View all N emails" (ghost, same padding) + "Export" (far right, ghost `--text-3`).

**Regeneration behavior**:
- Button shows spinner + "Regenerating…" text while in flight.
- On success: re-fetch the digest; banner / stale state should clear.

---

### 4. Reading view (email detail) — `/email/:id`

**Purpose**: read a single email. Full-width sheet, not crammed into a 600px center column.

**Sticky top action bar** (position sticky top 0, 12 32 padding, border-bottom `--line`, `background: color-mix(in oklch, var(--bg) 88%, transparent)`, `backdrop-filter: blur(8px)`):
- Left: "← Back to Today" button (6 10 padding, 12px `--text-2`)
- Flex spacer
- Action buttons (6 padding, 6 radius, 12px `--text-2`, icon 13 + label):
  - Archive (shortcut `E`)
  - Snooze (`H`)
  - Label (`L`)
  - Vertical divider 1×18 `--line` with 6px horizontal margin
- **Primary Reply button** (far right): `bg: --accent`, `color: --accent-ink`, 7 14 padding, 7 radius, 12 500, `<Reply>` icon + "Reply" + `R` kbd.

**Body** (max-width 760, centered, padding 44 40 80):
- **Pinned TL;DR card** at top (this is the big UX shift — pinned summary above the email itself):
  - 18 padding, `--surface` bg, `--line` border, radius 12
  - Kicker "TL;DR" with accent `<Sparkle>` 13px
  - Body 14 `line-height: 1.6` `--text`
  - Suggested-action chips below (primary = accent-soft bg + accent text, others `--surface-2`)
- Category chip row
- H1 subject (26 600 -0.025em `line-height: 1.2`)
- Sender row: 36px avatar + name+email + date/time meta
- Article body: 15 `line-height: 1.75` `--text-2`

---

## Design tokens

Copy this block into `frontend/src/index.css` (inside `@layer base { :root { ... } }`). Then either use `bg-[var(--bg)]` arbitrary values or extend Tailwind's `theme.colors` to map the vars.

```css
:root {
  /* DARK (default) */
  --bg:          oklch(0.16 0.004 80);
  --surface:     oklch(0.195 0.005 80);
  --surface-2:   oklch(0.23 0.005 80);
  --surface-3:   oklch(0.27 0.005 80);
  --line:        oklch(0.28 0.005 80 / 0.9);
  --line-soft:   oklch(0.28 0.005 80 / 0.45);
  --text:        oklch(0.97 0.005 80);
  --text-2:      oklch(0.78 0.004 80);
  --text-3:      oklch(0.56 0.004 80);
  --text-4:      oklch(0.42 0.004 80);

  --accent:      oklch(0.72 0.14 250);
  --accent-soft: oklch(0.72 0.14 250 / 0.14);
  --accent-ink:  oklch(0.22 0.04 250);

  --danger:      oklch(0.68 0.18 25);
  --warn:        oklch(0.78 0.14 75);
  --ok:          oklch(0.72 0.13 155);
  --violet:      oklch(0.72 0.14 300);

  --shadow: 0 1px 2px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.28);

  --row-py: 12px;
  --row-px: 16px;
  --pane-px: 20px;
  --radius: 10px;
  --radius-sm: 6px;
}

:root[data-theme="light"] {
  --bg:          oklch(0.985 0.003 80);
  --surface:     oklch(1    0     0);
  --surface-2:   oklch(0.965 0.003 80);
  --surface-3:   oklch(0.935 0.004 80);
  --line:        oklch(0.88 0.004 80);
  --line-soft:   oklch(0.92 0.004 80);
  --text:        oklch(0.2  0.01  80);
  --text-2:      oklch(0.38 0.008 80);
  --text-3:      oklch(0.55 0.006 80);
  --text-4:      oklch(0.72 0.004 80);
  --accent:      oklch(0.55 0.16 250);
  --accent-soft: oklch(0.55 0.16 250 / 0.1);
  --accent-ink:  oklch(0.98 0 0);
  --shadow: 0 1px 2px rgba(15,17,21,.06), 0 8px 24px rgba(15,17,21,.06);
}

:root[data-density="compact"]     { --row-py: 8px;  --row-px: 12px; --pane-px: 16px; }
:root[data-density="comfortable"] { --row-py: 12px; --row-px: 16px; --pane-px: 20px; }
:root[data-density="spacious"]    { --row-py: 18px; --row-px: 20px; --pane-px: 28px; }
```

### Typography
- **Sans**: Inter 400/450/500/600/700 — `font-feature-settings: "cv11","ss01","ss03"`
- **Serif** (only for the Today greeting): Instrument Serif italic 400
- **Mono**: JetBrains Mono 400/500 — `font-feature-settings: "zero","ss01"`

Load via Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&family=JetBrains+Mono:wght@400;500&family=Instrument+Serif&display=swap" rel="stylesheet">
```

### Type scale (use exactly — not Tailwind defaults)
| Role | Size | Weight | Tracking | Line-height |
|---|---|---|---|---|
| H1 (Today greeting) | 42px | 500 | -0.035em | 1.05 |
| H1 (page) | 20–22px | 600 | -0.02em | 1.2 |
| H1 (archived digest date) | 22px | 600 | -0.02em | — |
| H1 (email subject, reading) | 26px | 600 | -0.025em | 1.2 |
| H2 (section) | 18px | 600 | -0.015em | — |
| Body | 14px | 400 | — | 1.6 |
| Body (article) | 15px | 400 | — | 1.75 |
| Kicker | 10–11px | 600 | 0.08–0.15em uppercase | — |
| Meta | 11–12px | 400 | — | — |

### Radii: 6 · 7 · 8 · 10 · 12 · 14 · 999 (pill)
### Spacing: 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 24 · 28 · 32 · 36 · 40 · 48 · 56 · 80

---

## Backend work required

### New endpoints

```ts
// Today briefing
GET  /api/digests/today
→ { date, arrived, handled, remaining, highlights[], fyi[] }

// Archive grid — 1 month of per-day status
GET  /api/digests/month?year=2026&month=4
→ Array<{
    date: 'YYYY-MM-DD',
    status: 'today' | 'ready' | 'stale' | 'never' | 'weekend',
    emailCount: number,
    decisionCount: number,
    generatedAt: string | null,
  }>

// Archive detail for a specific day
GET  /api/digests/:date
→ { date, status, emailCount, decisionCount, summary, highlights[], fyi[], generatedAt }

// Generate (first time) or regenerate (force rerun)
POST /api/digests/:date/regenerate
→ same shape as GET — fresh data after rerun
```

### Schema additions to `daily_digests`
Already has per-day summary storage. Confirm it has `generated_at` timestamp. Add a `generation_count` column if you want to show "rerun 3×".

### LLM prompt update (`backend/src/prompts/`)
The digest prompt needs to **split output into `decision` vs `fyi`** explicitly. Example structured output:

```json
{
  "summary": "…short paragraph…",
  "highlights": [
    {"title": "…", "body": "…", "emailId": "e1", "kind": "decision"},
    {"title": "…", "body": "…", "emailId": "e3", "kind": "decision"}
  ],
  "fyi": [
    {"title": "12 receipts auto-filed", "kind": "auto", "count": 12},
    {"title": "Jordan intro: Dana", "kind": "light", "emailId": "e6"}
  ]
}
```

A highlight is `decision` if the user likely needs to respond, approve, schedule, or choose. Otherwise `fyi`.

---

## Component inventory

Map of prototype → target codebase files you should create or change:

| Prototype component | Target file | Action |
|---|---|---|
| `SceneB` wrapper + mode switcher | `src/App.tsx` | Rewrite. Use React Router (`/today`, `/inbox`, `/archive`, `/tasks`, `/email/:id`, `/rules`, `/settings`). |
| Left rail | `src/components/Shell/NavRail.tsx` | **New**. Replaces current top-bar. 72px wide. |
| `TodayView` | `src/components/Today/TodayView.tsx` | **New**. Landing page. |
| `Stat`, `SectionTitle`, `DecisionCard` | `src/components/Today/*` | **New**. Sub-components. |
| `ArchiveView` | `src/components/Archive/ArchiveView.tsx` | **New** (replaces `Calendar/`). |
| `ArchiveGrid`, `ArchiveDayCell` | `src/components/Archive/` | **New**. |
| `ArchiveDetail`, `EmptyDigest`, `MiniStat`, `LegendDot` | `src/components/Archive/` | **New**. |
| `InboxView` | `src/components/EmailList/EmailList.tsx` | Rework header (H1 + filter pills), apply list-row spec. |
| `ListRow` | `src/components/EmailList/EmailItem.tsx` | Rework — support `rows / cards / threaded` variants. |
| `FilterPill` | `src/components/shared/FilterPill.tsx` | **New**. |
| `ReadingView` | `src/components/EmailDetail/EmailDetail.tsx` | Add sticky action bar, pin TL;DR card at top. Use existing `useSummary` hook. |
| `Avatar` | `src/components/shared/Avatar.tsx` | **New**. Deterministic hue from name. |
| `Icon` | lucide-react already available | Use existing. |
| `Kbd`, `chip` classes | `src/index.css` utility layer | **New**. |

---

## Interactions & behavior

- **Navigation**: rail clicks route via React Router. Default route is `/today`.
- **Archive date selection**: click day tile → right pane updates. Persist `selectedDate` in URL (`/archive?date=2026-04-15`).
- **Regenerate**: POST to backend, optimistic spinner in button, refetch query on success, invalidate `['digest', date]` key.
- **Stale detection**: backend computes — frontend renders the warn banner when `status === 'stale'`.
- **Keyboard shortcuts** (in reading view): `E` archive, `H` snooze, `R` reply, `L` label, `J/K` next/prev in list. Use a single key-handler at the app shell level.
- **Future dates**: disabled, `opacity: 0.35`, `cursor: not-allowed`. Clicking does nothing.
- **Transitions**: all hover/active `transition: all .14s ease`. Rail collapse (if implemented) `.2s ease`.
- **Theme**: `data-theme="dark|light"` on `<html>`. Persist in localStorage as `theme`. System default via `prefers-color-scheme` fallback.

---

## State management

Use TanStack Query for every server value. Keys:

```ts
['digest', 'today']                        // Today view
['digest', 'month', year, month]           // Archive grid
['digest', 'day', date]                    // Archive detail
['emails', { accountId, category, search }] // Inbox list
['email', id]                              // Reading view
['sync-status']                            // Existing, keep
```

Local state:
- `theme: 'dark' | 'light'` — localStorage
- `density: 'compact' | 'comfortable' | 'spacious'` — localStorage, apply to `<html data-density>`
- `listStyle: 'rows' | 'cards' | 'threaded'` — localStorage (optional, single-user pref)
- `selectedEmailId`, `selectedArchiveDate` — URL params

---

## Migration order (recommended)

1. **Tokens + typography** in `index.css` + Tailwind config. Load fonts. Nothing visual yet — but everything downstream depends on this.
2. **NavRail** — rip the top bar out of `App.tsx`, put the rail in. Route the existing views through it. This alone fixes the "unlabeled icons" pain point.
3. **Today view** — wire to existing `daily_digests` table. Start with just the masthead + stats + summary card. Add decision cards next.
4. **Archive view** — port `Calendar/` components to the new visual spec. Wire the `stale`/`never`/`ready` status logic.
5. **Regenerate endpoint** — backend route + prompt update + frontend mutation.
6. **Reading polish** — sticky action bar, pinned TL;DR.
7. **Inbox polish** — list row variants, filter pills.
8. **Keyboard shortcuts** — last, not blocking.

---

## Files in this bundle

- `Email Redesign.html` — the prototype entry point. Open this in a browser to see the live design. Load with a local HTTP server (JSX files need to be served, not `file://`).
- `reference/data.jsx` — demo data shape. Mirror this when shaping your real API response.
- `reference/icons.jsx` — inline SVG icon component used by the prototype. In production use `lucide-react` (already in your package.json).
- `reference/common.jsx` — `Avatar`, `Kbd`, `SectionHead`, `ListRow` (all 3 variants). **`ListRow` is the most valuable reference** — copy its CSS verbatim.
- `reference/scene-a.jsx` — alternate "refined 3-pane" variation. **Not the chosen direction** — ignore unless you want to see the road not taken.
- `reference/scene-b.jsx` — **the chosen direction for email**. Contains `TodayView`, `InboxView`, `ArchiveView`, `ArchiveDetail`, `ReadingView`, `EmptyDigest`, and all sub-components.
- `reference/scene-c.jsx` — **Tasks / GTD kanban**. Contains `SceneC`, all 3 board variants, card variants, `DueChip`, `TaskDetailSheet`. Ship **one** board variant (see Tasks section for recommendation); keep others as reference.
- `reference/boot.jsx` — ignore (prototype mounting only).

---

---

## 5. Tasks view (GTD kanban) — `/tasks` ★ NEW

**Purpose**: Standalone Getting-Things-Done board. Unrelated to email. Backed by **Vikunja** (self-hosted task manager with a REST API).

**Columns** (5, fixed):

| id | Label | Kicker | Meaning |
|---|---|---|---|
| `inbox` | Inbox | capture | Unprocessed captures — decide what they are |
| `next` | Next Action | do | Concrete, doable items |
| `wait` | Waiting For | track | Blocked on someone else |
| `some` | Someday | parking | Maybe / not-now / idea lot |
| `done` | Completed | archive | Auto-archives after 7 days — only recent shown |

**Rail icon**: `Check` (lucide) labeled "Tasks". Sits between Archive and Reading.

**Header** (padding 22 32 18, border-bottom `--line`):
- Kicker row: `TASKS · VIKUNJA · ● connected` (mono 11 tracking 0.15em uppercase `--text-3`; the `●` is `--ok`)
- Title row: H1 "Getting Things Done" (26 600 -0.025em) + meta "{N} open · {M} completed this week" (12 `--text-3`)
- Right-aligned controls:
  - Layout toggle (segmented, `surface-2` bg, 3px pad, 8 radius): `5-col · 4-col + tray · Swimlanes`
  - "Hide done / Show done" ghost button (6/10 pad, 7 radius, 1px `--line` border)
  - Primary "New task" button with `N` kbd

### Drag & drop (required)
- HTML5 native drag (`draggable`, `onDragStart/End/Over/Drop`)
- Drop target highlights with `bg: var(--accent-soft)` and 12 radius
- Dragging card opacity → 0.4
- On drop into `done`: set `completedAt` to today
- On drop out of `done`: clear `completedAt`

### Three variants (ship ONE to production — pick with user)

#### V1 — Classic 5-col kanban (default recommendation)
- 5 equal columns, `minmax(240px, 1fr)`, gap 14
- Minimal cards (10 12 padding, 10 radius, `--surface`, `--line-soft` border)
- Title 13 500. Notes clamp 2 lines 11.5 `--text-3`. Meta row: context `@label` in context color (mono 10.5) + due chip + completed mark.
- Someday uses **parking chips** (6 10 padding, 7 radius, one line, 12 `--text-2`) — higher density.

#### V2 — 4-col + Inbox overflow tray
- Inbox moves out of the main grid to a **bottom tray** (max-height 200, horizontal scroll)
- Tray copy: "Capture now, process later — drag into a column to clarify"
- Tray cards are `--surface-2` bg with a **dashed** `--line` border (visual "unprocessed" hint)
- Main grid becomes 4 columns with **richer cards** (14 padding, 12 radius, subtle shadow, context pill up top, due chip right-aligned)

#### V3 — Color swimlanes
- Each column gets a tint per position (neutral / accent / warn / violet / ok)
- Column bg: `color-mix(in oklch, {tint} 6%, transparent)`, border `color-mix(… 24%, transparent)`, radius 12
- Cards get a 3px left color-bar matching their **context** (`@home`/`@work`/`@calls`/etc.)
- Denser (8 pad, 8 radius), gap 6 between cards
- Background subtle radial accent tint at top-left

### Task fields (confirmed scope)
- `title` (required)
- `notes` (markdown-ish, plain for now)
- `due` (ISO date) — renders as due chip with tone:
  - overdue → `--danger` (14% alpha bg, `--danger` fg)
  - today → `--accent` soft
  - tomorrow → `--warn` (14% alpha bg)
  - within a week → neutral `surface-2`
  - further → neutral, month+day format
- `context` — one of `@home`, `@work`, `@calls`, `@errand`, `@read` (extensible list). Each has a color (see `TASK_CONTEXTS` in `reference/scene-c.jsx`).

### Context palette
```ts
@home:   oklch(0.72 0.13 155)   // green
@work:   oklch(0.72 0.14 250)   // accent blue
@calls:  oklch(0.78 0.14 75)    // warn yellow
@errand: oklch(0.72 0.14 300)   // violet
@read:   oklch(0.68 0.08 80)    // muted
```

### Task detail sheet
Right-side drawer (460 wide, `--surface`, 1px `--line` left border, shadow). Opens on card click. Contains:
- Header: column kicker + close button
- H2 title (18 600 -0.02em)
- Context pill + due chip row
- Notes block (12 pad, `--surface-2`, `--line-soft`, radius 8, min-height 72)
- "Move to" — row of pill buttons for every other column (6/10 pad, 7 radius, `--surface-2` bg, `--line` border)

### Backend — Vikunja integration (backend work required)

Vikunja exposes a REST API. You'll proxy it through your `backend/src/routes/` to avoid exposing the user's Vikunja token to the browser.

Suggested endpoints (thin pass-through):

```ts
GET    /api/tasks                           → Task[]
POST   /api/tasks                           → Task           (body: { title, notes?, due?, context?, col })
PATCH  /api/tasks/:id                       → Task           (body: partial — col change = DnD move)
DELETE /api/tasks/:id                       → { ok }

// Connection management
GET    /api/integrations/vikunja            → { connected, instanceUrl, projectId }
POST   /api/integrations/vikunja/connect    → sets user's token + default project
DELETE /api/integrations/vikunja            → disconnect
```

Map to Vikunja concepts:
- **Column** → Vikunja "label" (or a kanban bucket on a specific project — Vikunja supports both). Using labels is simpler: one label per column (`gtd:inbox`, `gtd:next`, `gtd:wait`, `gtd:some`). `done` = task's `done: true` flag, not a label.
- Ship auto-archive: any task with `done: true` AND `done_at < now - 7d` is excluded from `GET /api/tasks` server-side.

### State keys (TanStack Query)
```ts
['tasks', 'all']                  // full board
['integrations', 'vikunja']       // connection status
```

Optimistic mutations on `PATCH /api/tasks/:id` — move the card locally before the server confirms, rollback on error.

### Component inventory (scene-c.jsx → target files)

| Prototype | Target | Action |
|---|---|---|
| `SceneC` | `src/components/Tasks/TasksView.tsx` | **New** |
| `TasksHeader` | `src/components/Tasks/TasksHeader.tsx` | **New** |
| `TasksBoard` (dispatcher) | inside `TasksView` | Inline |
| `BoardKanban` / `BoardOverflowTray` / `BoardSwimlanes` | `src/components/Tasks/boards/*.tsx` | **New** — ship one, others as follow-up |
| `Column`, `ColumnSwim` | `src/components/Tasks/Column.tsx` | **New** |
| `MinimalCard`, `RichCard`, `ColorCard`, `ParkingCard`, `TrayCard` | `src/components/Tasks/cards/*.tsx` | **New** |
| `DueChip`, `DueInline`, `parseDue`, `relDate` | `src/components/Tasks/due.ts(x)` | **New** |
| `TaskDetailSheet` | `src/components/Tasks/TaskDetailSheet.tsx` | **New** |
| Vikunja client | `backend/src/services/vikunja.ts` | **New** |
| Task routes | `backend/src/routes/tasks.ts` | **New** |

### What the prototype fakes (wire up for real)
- Task IDs are string literals (`t1`, `t2`…) — use Vikunja's numeric IDs
- `completedAt` is set to `'2026-04-20'` — use real timestamps and filter server-side for 7-day window
- "Connected" dot is static — read actual integration status

---

## Out of scope / future

- Reading-list view (`/reading`) — rail stub exists, no screen designed yet
- Multi-account switching polish — uses existing `AccountManager`
- Rules page redesign — existing `/rules` still works, just gets dropped into the new rail
- Mobile layout — desktop-only for now
